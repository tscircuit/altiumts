import type { AltiumPcbDoc } from "../altium-pcb-doc"
import type { AltiumSchDoc } from "../altium-sch-doc"
import { AltiumBinaryWriter } from "../binary/altium-binary-io"
import { AltiumSerializationError } from "../errors/altium-error"
import { parseAltiumMeasurementToMils } from "../measurement/altium-measurement"
import { concatAltiumBinaryBytes } from "./altium-binary-container"

const NO_INDEX = 0xffff
const INTERNAL_UNITS_PER_MIL = 10_000

export type AsciiAltiumDocument = string | AltiumPcbDoc | AltiumSchDoc
export type AltiumFieldName = string
export type AltiumRecordFields = Map<AltiumFieldName, string>

export function getAsciiAltiumSource(document: AsciiAltiumDocument): string {
  if (typeof document === "string") return document
  if ("sourceFormat" in document && document.sourceFormat !== "ascii") {
    throw new AltiumSerializationError(
      "Binary Altium input is already a compound document",
    )
  }
  return document.getString()
}

export function getAltiumRecordFields(
  recordSource: string,
): AltiumRecordFields {
  return new Map<AltiumFieldName, string>(
    getAltiumRecordSegments(recordSource).map(({ fieldName, fieldText }) => [
      fieldName,
      fieldText,
    ]),
  )
}

export function getAltiumRecordFieldNames(recordSource: string): string[] {
  return getAltiumRecordSegments(recordSource).map(({ fieldName }) => fieldName)
}

export function getAltiumRecordKind(recordSource: string): string {
  return getAltiumRecordFields(recordSource).get("RECORD") ?? ""
}

export function toAltiumBinaryRecordBytes(
  recordSource: string,
  preserveFieldNameCase = false,
): Uint8Array {
  const output: number[] = []
  for (const { fieldName, fieldText } of getAltiumRecordSegments(
    recordSource,
    preserveFieldNameCase,
  )) {
    if (/[^\x20-\x7e]/u.test(fieldText)) {
      output.push(
        ...new TextEncoder().encode(`|%UTF8%${fieldName}=${fieldText}||`),
      )
    }
    output.push(
      ...toAltiumAsciiBytes(
        `|${fieldName}=${fieldText.replace(/[^\x20-\x7e]/gu, "?")}`,
      ),
    )
  }
  output.push(0)
  return Uint8Array.from(output)
}

export function writeLengthPrefixedAltiumRecords(
  recordSources: string[],
): Uint8Array {
  const writer = new AltiumBinaryWriter()
  for (const recordSource of recordSources) {
    writer.uint32LengthPrefixedBytes(toAltiumBinaryRecordBytes(recordSource))
  }
  return writer.toUint8Array()
}

export function writeBinaryTypeLengthPrefixedAltiumRecords(
  recordSources: string[],
): Uint8Array {
  const writer = new AltiumBinaryWriter()
  for (const recordSource of recordSources) {
    const fields = getAltiumRecordFields(recordSource)
    const binaryRecordType = parseAltiumBinaryRecordType(
      fields.get("BINARYRECORDTYPE"),
    )
    const payloadSource = recordSource
      .split("|")
      .filter((segment) => segment && !/^BINARYRECORDTYPE=/iu.test(segment))
      .map((segment) => `|${segment}`)
      .join("")
    const payload = toAltiumBinaryRecordBytes(payloadSource)
    writer
      .uint16(binaryRecordType)
      .uint32(payload.byteLength)
      .writeBytes(payload)
  }
  return writer.toUint8Array()
}

export function parseAltiumInternalUnits(
  measurement: string | undefined,
): number {
  if (measurement === undefined) return 0
  const mils = parseAltiumMeasurementToMils(measurement)
  if (mils === undefined || !Number.isFinite(mils)) {
    throw new AltiumSerializationError(
      `Invalid Altium measurement: ${JSON.stringify(measurement)}`,
    )
  }
  return Math.round(mils * INTERNAL_UNITS_PER_MIL)
}

export function parseAltiumIndex(indexText: string | undefined): number {
  if (indexText === undefined) return NO_INDEX
  const parsedIndex = Number(indexText)
  if (
    !Number.isInteger(parsedIndex) ||
    parsedIndex < 0 ||
    parsedIndex > NO_INDEX
  ) {
    throw new AltiumSerializationError(
      `Invalid Altium record index: ${JSON.stringify(indexText)}`,
    )
  }
  return parsedIndex
}

function parseAltiumBinaryRecordType(
  recordTypeText: string | undefined,
): number {
  if (recordTypeText === undefined) return 0
  const recordType = Number(recordTypeText)
  if (!Number.isInteger(recordType) || recordType < 0 || recordType > 0xffff) {
    throw new AltiumSerializationError(
      `Invalid Altium binary record type: ${JSON.stringify(recordTypeText)}`,
    )
  }
  return recordType
}

export function parseAltiumFiniteNumber(
  numberText: string | undefined,
): number {
  if (numberText === undefined) return 0
  const parsedNumber = Number(numberText)
  if (!Number.isFinite(parsedNumber)) {
    throw new AltiumSerializationError(
      `Invalid finite Altium number: ${JSON.stringify(numberText)}`,
    )
  }
  return parsedNumber
}

export function parseAltiumBoolean(booleanText: string | undefined): boolean {
  if (booleanText === undefined || booleanText.toUpperCase() === "FALSE") {
    return false
  }
  if (booleanText.toUpperCase() === "TRUE") return true
  throw new AltiumSerializationError(
    `Invalid Altium boolean: ${JSON.stringify(booleanText)}`,
  )
}

export function toAltiumPascalString(text: string): Uint8Array {
  const bytes = toAltiumAsciiBytes(text.slice(0, 255))
  return concatAltiumBinaryBytes([Uint8Array.of(bytes.byteLength), bytes])
}

export function toAltiumUtf16LeBytes(
  text: string,
  byteLength?: number,
): Uint8Array {
  const output = new Uint8Array(byteLength ?? (text.length + 1) * 2)
  const view = new DataView(output.buffer)
  const maximumCodeUnitCount = Math.min(text.length, output.byteLength / 2)
  for (let index = 0; index < maximumCodeUnitCount; index++) {
    view.setUint16(index * 2, text.charCodeAt(index), true)
  }
  return output
}

export function toLegacyAltiumText(text: string): string {
  return text.replace(/[^\x20-\x7e]/gu, "?")
}

function getAltiumRecordSegments(
  recordSource: string,
  preserveFieldNameCase = false,
): Array<{
  fieldName: AltiumFieldName
  fieldText: string
}> {
  return recordSource
    .split("|")
    .filter(Boolean)
    .map((segment) => {
      const equalsIndex = segment.indexOf("=")
      if (equalsIndex < 1) {
        throw new AltiumSerializationError(
          `Invalid Altium record field: ${JSON.stringify(segment)}`,
        )
      }
      return {
        fieldName: preserveFieldNameCase
          ? segment.slice(0, equalsIndex)
          : segment.slice(0, equalsIndex).toUpperCase(),
        fieldText: segment.slice(equalsIndex + 1),
      }
    })
}

function toAltiumAsciiBytes(text: string): Uint8Array {
  return Uint8Array.from(text, (character) => character.charCodeAt(0) & 0x7f)
}
