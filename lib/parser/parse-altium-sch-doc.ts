import { AltiumSchDoc } from "../altium-sch-doc"
import type { AltiumLineTerminator } from "../base/altium-line"
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
  type AltiumTextEncodingOverride,
  decodeAltiumText,
} from "./decode-altium-text"
import { type ParseAltiumOptions, parseAltiumAscii } from "./parse-altium-ascii"
import { parseAltiumBinaryPropertyRecord } from "./parse-altium-binary-property-record"

export interface ParseAltiumSchDocOptions
  extends ParseAltiumOptions,
    ParseAltiumCompoundFileOptions {
  maxRecordLength?: number
  encoding?: AltiumTextEncodingOverride
}

export function parseAltiumSchDoc(
  source: string | Uint8Array,
  options: ParseAltiumSchDocOptions = {},
): AltiumSchDoc {
  if (typeof source === "string") {
    const document = new AltiumSchDoc({
      lines: parseAltiumAscii(source, options),
      originalText: source,
      sourceFormat: "ascii",
    })
    validateSchematicDocument(document)
    return document
  }

  if (!isAltiumCompoundFile(source)) {
    const decoded = decodeAltiumText(source, options.encoding)
    const document = new AltiumSchDoc({
      lines: parseAltiumAscii(decoded.text, options),
      originalBytes: source.slice(),
      originalText: decoded.text,
      sourceEncoding: decoded.encoding,
      sourceFormat: "ascii",
    })
    validateSchematicDocument(document)
    return document
  }

  const compoundFile = parseAltiumCompoundFile(source, options)
  const fileHeader = compoundFile.getStream("/FileHeader")
  if (!fileHeader) {
    throw new AltiumFormatDetectionError(
      "Compound document does not contain a FileHeader stream",
    )
  }

  const lines = parseBinarySchematicRecords(
    fileHeader.content,
    options.maxRecordLength,
  )
  const header = lines[0]
  if (
    !header
      ?.getCaseInsensitive("HEADER")
      ?.toLowerCase()
      .includes("schematic capture")
  ) {
    throw new AltiumFormatDetectionError(
      "FileHeader is not an Altium schematic record stream",
    )
  }

  return new AltiumSchDoc({
    compoundFile,
    lines,
    objectDefinitionRecords: compoundFile.getStream("/ObjectDefinitions")
      ? parseBinarySchematicRecords(
          compoundFile.getStream("/ObjectDefinitions")!.content,
          options.maxRecordLength,
          "/ObjectDefinitions",
        )
      : [],
    originalBytes: source.slice(),
    sourceFormat: "binary",
  })
}

function validateSchematicDocument(document: AltiumSchDoc): void {
  const header = document.header?.getCaseInsensitive("HEADER")
  if (
    !header?.toLowerCase().includes("schematic capture") &&
    document.getRecordsByKind("31").length === 0
  ) {
    throw new AltiumFormatDetectionError(
      "Expected an Altium schematic header or sheet record",
    )
  }
}

function parseBinarySchematicRecords(
  bytes: Uint8Array,
  maximumRecordLength = 16 * 1024 * 1024,
  streamPath = "/FileHeader",
): AltiumRecord[] {
  const records: AltiumRecord[] = []
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0

  while (offset < bytes.byteLength) {
    const lengthOffset = offset
    if (offset + 4 > bytes.byteLength) {
      throw new AltiumTruncatedRecordError(
        "Schematic record length is truncated",
        offset,
      )
    }
    const rawLength = view.getUint32(offset, true)
    const length = rawLength & 0x00ff_ffff
    offset += 4
    if (length === 0 || length > maximumRecordLength) {
      throw new AltiumTruncatedRecordError(
        `Invalid schematic record length ${length}`,
        lengthOffset,
      )
    }
    if (offset + length > bytes.byteLength) {
      throw new AltiumTruncatedRecordError(
        `Schematic record at offset ${lengthOffset} declares ${length} bytes with only ${bytes.byteLength - offset} available`,
        lengthOffset,
      )
    }

    const record = parseAltiumBinaryPropertyRecord(
      bytes.subarray(offset, offset + length),
      undefined,
      {
        byteOffset: lengthOffset,
        recordIndex: records.length,
        streamPath,
      },
    )
    const terminator: AltiumLineTerminator =
      offset + length < bytes.byteLength ? "\n" : ""
    record.terminator = terminator
    records.push(record)
    offset += length
  }

  return records
}
