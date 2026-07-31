import {
  AltiumBinaryPcbDoc,
  type AltiumPcbStreamSummary,
} from "../altium-binary-pcb-doc"
import {
  isAltiumCompoundFile,
  type ParseAltiumCompoundFileOptions,
  parseAltiumCompoundFile,
} from "../compound-file/parse-altium-compound-file"
import {
  AltiumFormatDetectionError,
  AltiumTruncatedRecordError,
} from "../errors/altium-error"
import type { AltiumRecord } from "../records/altium-record"
import {
  type AltiumBinaryPcbPrimitiveFamily,
  parseAltiumBinaryPcbPrimitiveStream,
  parseAltiumBinaryPcbWideStrings,
} from "./parse-altium-binary-pcb-primitives"
import { parseAltiumBinaryPropertyRecord } from "./parse-altium-binary-property-record"

const PROPERTY_STREAM_RECORD_KINDS: Record<string, string> = {
  Board6: "Board",
  Classes6: "Class",
  Components6: "Component",
  FileVersionInfo: "FileVersionInfo",
  Nets6: "Net",
  Polygons6: "Polygon",
  SignalClasses: "SignalClass",
  SmartUnions: "SmartUnion",
  UniqueIDPrimitiveInformation: "UniqueIDPrimitiveInformation",
}

const PRIMITIVE_STREAM_FAMILIES = new Set([
  "Arcs6",
  "BoardRegions",
  "Pads6",
  "Regions6",
  "ShapeBasedRegions6",
  "Texts6",
  "Tracks6",
  "Vias6",
])

export interface ParseAltiumBinaryPcbDocOptions
  extends ParseAltiumCompoundFileOptions {
  maxPrimitiveRecordLength?: number
  maxPropertyRecordLength?: number
}

export function parseAltiumBinaryPcbDoc(
  source: Uint8Array,
  options: ParseAltiumBinaryPcbDocOptions = {},
): AltiumBinaryPcbDoc {
  if (!isAltiumCompoundFile(source)) {
    throw new AltiumFormatDetectionError(
      "Binary PcbDoc input does not begin with the OLE/CFB signature",
    )
  }

  const compoundFile = parseAltiumCompoundFile(source, options)
  if (
    !compoundFile.getStream("/Board6/Data") ||
    !compoundFile.getStream("/Board6/Header")
  ) {
    throw new AltiumFormatDetectionError(
      "Compound document does not contain the Board6 PCB streams",
    )
  }

  const storageFamilies = new Set(
    compoundFile.streams
      .filter((stream) => stream.path.length >= 2)
      .map((stream) => stream.path[0])
      .filter((family): family is string => family !== undefined),
  )
  const propertyRecords = new Map<string, AltiumRecord[]>()
  const primitiveRecords = new Map<string, AltiumRecord[]>()
  const streamSummaries: AltiumPcbStreamSummary[] = []
  const wideStringsData = compoundFile.getStream("/WideStrings6/Data")
  const wideStrings = wideStringsData
    ? parseAltiumBinaryPcbWideStrings(wideStringsData.content)
    : new Map<number, string>()

  for (const family of [...storageFamilies].sort()) {
    const data = compoundFile.getStream([family, "Data"])
    const header = compoundFile.getStream([family, "Header"])
    const declaredRecordCount = header
      ? readDeclaredRecordCount(header.content)
      : undefined
    const recordKind = PROPERTY_STREAM_RECORD_KINDS[family]
    const decodedRecords =
      data && recordKind
        ? parsePropertyRecordStream(
            data.content,
            recordKind,
            declaredRecordCount,
            options.maxPropertyRecordLength,
          )
        : []
    const decodedPrimitives =
      data && PRIMITIVE_STREAM_FAMILIES.has(family)
        ? parseAltiumBinaryPcbPrimitiveStream(
            family as AltiumBinaryPcbPrimitiveFamily,
            data.content,
            {
              expectedRecordCount: declaredRecordCount,
              maximumRecordLength: options.maxPrimitiveRecordLength,
              wideStrings,
            },
          )
        : []

    if (decodedRecords.length > 0) {
      propertyRecords.set(family, decodedRecords)
    }
    if (decodedPrimitives.length > 0) {
      primitiveRecords.set(family, decodedPrimitives)
    }
    streamSummaries.push({
      dataSize: data?.content.byteLength,
      declaredRecordCount,
      decodedPrimitiveRecordCount: decodedPrimitives.length,
      decodedPropertyRecordCount: decodedRecords.length,
      family,
      hasData: data !== undefined,
      hasHeader: header !== undefined,
    })
  }

  return new AltiumBinaryPcbDoc({
    compoundFile,
    primitiveRecords,
    propertyRecords,
    streamSummaries,
    wideStrings,
  })
}

function parsePropertyRecordStream(
  bytes: Uint8Array,
  recordKind: string,
  expectedRecordCount: number | undefined,
  maximumRecordLength = 16 * 1024 * 1024,
): AltiumRecord[] {
  if (bytes.byteLength === 0) return []
  const records: AltiumRecord[] = []
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0

  while (offset < bytes.byteLength) {
    const lengthOffset = offset
    if (offset + 4 > bytes.byteLength) {
      throw new AltiumTruncatedRecordError(
        `${recordKind} property record length is truncated`,
        offset,
      )
    }
    const rawLength = view.getUint32(offset, true)
    const length = rawLength & 0x00ff_ffff
    offset += 4
    if (length === 0 || length > maximumRecordLength) {
      throw new AltiumTruncatedRecordError(
        `Invalid ${recordKind} property record length ${length}`,
        lengthOffset,
      )
    }
    if (offset + length > bytes.byteLength) {
      throw new AltiumTruncatedRecordError(
        `${recordKind} property record at offset ${lengthOffset} exceeds its stream`,
        lengthOffset,
      )
    }
    const payload = bytes.subarray(offset, offset + length)
    if (payload[0] !== 0x7c) {
      throw new AltiumFormatDetectionError(
        `${recordKind} property record at offset ${lengthOffset} does not begin with "|"`,
      )
    }
    records.push(parseAltiumBinaryPropertyRecord(payload, recordKind))
    offset += length
  }

  if (
    expectedRecordCount !== undefined &&
    records.length !== expectedRecordCount
  ) {
    throw new AltiumFormatDetectionError(
      `${recordKind} stream declares ${expectedRecordCount} records but contains ${records.length}`,
    )
  }
  return records
}

function readDeclaredRecordCount(bytes: Uint8Array): number | undefined {
  if (bytes.byteLength < 4) return undefined
  return new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(0, true)
}
