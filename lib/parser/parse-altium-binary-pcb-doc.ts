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

const PROPERTY_STREAM_CONFIG: Record<
  string,
  {
    allowOpaqueRecords?: boolean
    headerSize?: 4 | 6
    recordKind: string
  }
> = {
  Board6: { recordKind: "Board" },
  Classes6: { recordKind: "Class" },
  Components6: { recordKind: "Component" },
  Connections6: { allowOpaqueRecords: true, recordKind: "Connection" },
  Dimensions6: { headerSize: 6, recordKind: "Dimension" },
  FileVersionInfo: { recordKind: "FileVersionInfo" },
  FromTos6: { recordKind: "FromTo" },
  Models: { recordKind: "Model" },
  Nets6: { recordKind: "Net" },
  Polygons6: { recordKind: "Polygon" },
  Rules6: { headerSize: 6, recordKind: "Rule" },
  SignalClasses: { recordKind: "SignalClass" },
  SmartUnions: { recordKind: "SmartUnion" },
  UniqueIDPrimitiveInformation: {
    recordKind: "UniqueIDPrimitiveInformation",
  },
}

const PRIMITIVE_STREAM_FAMILIES = new Set([
  "Arcs6",
  "BoardRegions",
  "ComponentBodies6",
  "Fills6",
  "Pads6",
  "Regions6",
  "ShapeBasedRegions6",
  "ShapeBasedComponentBodies6",
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
    const propertyConfig = PROPERTY_STREAM_CONFIG[family]
    const decodedRecords =
      data && propertyConfig
        ? parsePropertyRecordStream({
            allowOpaqueRecords: propertyConfig.allowOpaqueRecords,
            allowMissingLeadingDelimiter: family === "Models",
            bytes: data.content,
            expectedRecordCount: declaredRecordCount,
            family,
            headerSize: propertyConfig.headerSize,
            maximumRecordLength: options.maxPropertyRecordLength,
            recordKind: propertyConfig.recordKind,
          })
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

function parsePropertyRecordStream({
  allowOpaqueRecords = false,
  allowMissingLeadingDelimiter = false,
  bytes,
  expectedRecordCount,
  recordKind,
  family = recordKind,
  headerSize = 4,
  maximumRecordLength = 16 * 1024 * 1024,
}: {
  allowOpaqueRecords?: boolean
  allowMissingLeadingDelimiter?: boolean
  bytes: Uint8Array
  expectedRecordCount: number | undefined
  family?: string
  headerSize?: 4 | 6
  maximumRecordLength?: number
  recordKind: string
}): AltiumRecord[] {
  if (bytes.byteLength === 0) return []
  const records: AltiumRecord[] = []
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0
  let parsedRecordCount = 0

  while (offset < bytes.byteLength) {
    const lengthOffset = offset
    if (offset + headerSize > bytes.byteLength) {
      throw new AltiumTruncatedRecordError(
        `${recordKind} property record length is truncated`,
        offset,
      )
    }
    const rawLength = view.getUint32(
      headerSize === 6 ? offset + 2 : offset,
      true,
    )
    const length = rawLength & 0x00ff_ffff
    const binaryRecordType =
      headerSize === 6 ? view.getUint16(offset, true) : undefined
    offset += headerSize
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
    if (payload[0] !== 0x7c && !allowMissingLeadingDelimiter) {
      if (allowOpaqueRecords) {
        parsedRecordCount += 1
        offset += length
        continue
      }
      throw new AltiumFormatDetectionError(
        `${recordKind} property record at offset ${lengthOffset} does not begin with "|"`,
      )
    }
    const recordIndex = parsedRecordCount
    const sourceLocation = {
      byteOffset: lengthOffset,
      recordIndex,
      streamPath: `/${family}/Data`,
    }
    const record = parseAltiumBinaryPropertyRecord(
      payload,
      recordKind,
      sourceLocation,
    )
    if (binaryRecordType !== undefined) {
      record.insertField("BINARYRECORDTYPE", String(binaryRecordType), {
        index: 1,
      })
      record.clearDirty(true)
    }
    records.push(record)
    parsedRecordCount += 1
    offset += length
  }

  if (
    expectedRecordCount !== undefined &&
    parsedRecordCount !== expectedRecordCount
  ) {
    throw new AltiumFormatDetectionError(
      `${recordKind} stream declares ${expectedRecordCount} records but contains ${parsedRecordCount}`,
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
