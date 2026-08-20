import {
  AltiumFormatDetectionError,
  AltiumTruncatedRecordError,
} from "../errors/altium-error"
import { AltiumField } from "../fields/altium-field"
import { AltiumArcRecord } from "../records/altium-arc-record"
import { AltiumFillRecord } from "../records/altium-fill-record"
import { AltiumPadRecord } from "../records/altium-pad-record"
import type { AltiumRecord } from "../records/altium-record"
import { AltiumTextRecord } from "../records/altium-text-record"
import { AltiumTrackRecord } from "../records/altium-track-record"
import { AltiumViaRecord } from "../records/altium-via-record"
import { parseAltiumBinaryPropertyRecord } from "./parse-altium-binary-property-record"

const PRIMITIVE_TYPE: Record<string, number> = {
  Arcs6: 1,
  BoardRegions: 11,
  ComponentBodies6: 12,
  Fills6: 6,
  Pads6: 2,
  Regions6: 11,
  ShapeBasedRegions6: 11,
  ShapeBasedComponentBodies6: 12,
  Texts6: 5,
  Tracks6: 4,
  Vias6: 3,
}

export type AltiumBinaryPcbPrimitiveFamily =
  | "Arcs6"
  | "BoardRegions"
  | "ComponentBodies6"
  | "Fills6"
  | "Pads6"
  | "Regions6"
  | "ShapeBasedRegions6"
  | "ShapeBasedComponentBodies6"
  | "Texts6"
  | "Tracks6"
  | "Vias6"

type SimplePrimitiveFamily = "Arcs6" | "Fills6" | "Tracks6" | "Vias6"

type ContourPrimitiveFamily =
  | "BoardRegions"
  | "ComponentBodies6"
  | "Regions6"
  | "ShapeBasedComponentBodies6"
  | "ShapeBasedRegions6"

const CONTOUR_STREAM_CONFIG: Record<
  ContourPrimitiveFamily,
  { extendedVertices: boolean; recordKind: string }
> = {
  BoardRegions: {
    extendedVertices: false,
    recordKind: "BoardRegion",
  },
  ComponentBodies6: {
    extendedVertices: false,
    recordKind: "ComponentBodyLegacy",
  },
  Regions6: {
    extendedVertices: false,
    recordKind: "RegionFill",
  },
  ShapeBasedRegions6: {
    extendedVertices: true,
    recordKind: "Region",
  },
  ShapeBasedComponentBodies6: {
    extendedVertices: true,
    recordKind: "ComponentBody",
  },
}

export interface ParseAltiumBinaryPcbPrimitiveOptions {
  expectedRecordCount?: number
  maximumRecordLength?: number
  wideStrings?: ReadonlyMap<number, string>
}

/**
 * Parses the common type-byte + uint32-length framing used by Altium's binary
 * PCB primitive streams. The first implementation intentionally limits
 * semantic decoding to the verified primitive families while validating every
 * frame.
 */
export function parseAltiumBinaryPcbPrimitiveStream(
  family: AltiumBinaryPcbPrimitiveFamily,
  bytes: Uint8Array,
  options: ParseAltiumBinaryPcbPrimitiveOptions = {},
): AltiumRecord[] {
  if (family === "Pads6") {
    return annotatePrimitiveRecords(parsePadStream(bytes, options), family)
  }
  if (family === "Texts6") {
    return annotatePrimitiveRecords(parseTextStream(bytes, options), family)
  }
  if (
    family === "BoardRegions" ||
    family === "ComponentBodies6" ||
    family === "Regions6" ||
    family === "ShapeBasedRegions6" ||
    family === "ShapeBasedComponentBodies6"
  ) {
    return annotatePrimitiveRecords(
      parseContourStream(family, bytes, options),
      family,
    )
  }

  const maximumRecordLength = options.maximumRecordLength ?? 16 * 1024 * 1024
  const records: AltiumRecord[] = []
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0

  while (offset < bytes.byteLength) {
    const frameOffset = offset
    if (offset + 5 > bytes.byteLength) {
      throw new AltiumTruncatedRecordError(
        `${family} primitive frame header is truncated`,
        offset,
      )
    }

    const primitiveType = bytes[offset]
    const rawLength = view.getUint32(offset + 1, true)
    const length = rawLength & 0x00ff_ffff
    offset += 5

    if (primitiveType !== PRIMITIVE_TYPE[family]) {
      throw new AltiumFormatDetectionError(
        `${family} frame at offset ${frameOffset} has unexpected primitive type ${primitiveType}`,
      )
    }
    if (length === 0 || length > maximumRecordLength) {
      throw new AltiumTruncatedRecordError(
        `Invalid ${family} primitive length ${length}`,
        frameOffset + 1,
      )
    }
    if (offset + length > bytes.byteLength) {
      throw new AltiumTruncatedRecordError(
        `${family} primitive at offset ${frameOffset} exceeds its stream`,
        frameOffset,
      )
    }

    const payload = bytes.subarray(offset, offset + length)
    records.push(decodePrimitive(family, payload, frameOffset))
    offset += length
  }

  if (
    options.expectedRecordCount !== undefined &&
    records.length !== options.expectedRecordCount
  ) {
    throw new AltiumFormatDetectionError(
      `${family} stream declares ${options.expectedRecordCount} records but contains ${records.length}`,
    )
  }

  return annotatePrimitiveRecords(records, family)
}

function annotatePrimitiveRecords(
  records: AltiumRecord[],
  family: AltiumBinaryPcbPrimitiveFamily,
): AltiumRecord[] {
  for (const [recordIndex, record] of records.entries()) {
    const location = {
      recordIndex,
      streamPath: `/${family}/Data`,
    }
    record.setSourceLocation(location)
    for (const [fieldIndex, item] of record.items.entries()) {
      item.setSourceLocation({ ...location, fieldIndex })
    }
  }
  return records
}

function decodePrimitive(
  family: SimplePrimitiveFamily,
  payload: Uint8Array,
  byteOffset: number,
): AltiumRecord {
  const minimumLength =
    family === "Tracks6"
      ? 33
      : family === "Arcs6"
        ? 45
        : family === "Fills6"
          ? 37
          : 31
  if (payload.byteLength < minimumLength) {
    throw new AltiumTruncatedRecordError(
      `${family} primitive payload is shorter than ${minimumLength} bytes`,
      byteOffset,
    )
  }

  const view = new DataView(
    payload.buffer,
    payload.byteOffset,
    payload.byteLength,
  )
  const layer = getAltiumPcbLayerName(view.getUint8(0))
  if (family === "Fills6") {
    const keepout = view.getUint8(2) === 2
    const items = [
      field("RECORD", "Fill"),
      field("LAYER", layer),
      field("LOCKED", booleanText((view.getUint8(1) & 0x04) === 0)),
      field("KEEPOUT", booleanText(keepout)),
      field("NET", String(view.getUint16(3, true))),
      field("COMPONENT", String(view.getUint16(7, true))),
      measurementField("X1", view.getInt32(13, true)),
      measurementField("Y1", view.getInt32(17, true)),
      measurementField("X2", view.getInt32(21, true)),
      measurementField("Y2", view.getInt32(25, true)),
      field("ROTATION", formatNumber(view.getFloat64(29, true))),
      field(
        "KEEPOUTRESTRICTIONS",
        String(payload.byteLength >= 47 ? view.getUint8(46) : keepout ? 31 : 0),
      ),
    ]
    if (payload.byteLength >= 46) {
      items.push(field("LAYER_V7_ID", String(view.getUint32(42, true))))
    }
    if (payload.byteLength > 37 && payload.byteLength < 46) {
      items.push(
        field("UNPARSEDTRAILINGBYTES", String(payload.byteLength - 37)),
      )
    }
    if (payload.byteLength > 47) {
      items.push(
        field("UNPARSEDTRAILINGBYTES", String(payload.byteLength - 47)),
      )
    }
    return new AltiumFillRecord({ items, originalBinaryPayload: payload })
  }

  const commonFields = [
    field("LAYER", layer),
    field("LOCKED", booleanText((view.getUint8(1) & 0x04) === 0)),
    field("NET", String(view.getUint16(3, true))),
    field("COMPONENT", String(view.getUint16(7, true))),
    field("POLYGON", String(view.getUint16(9, true))),
  ]

  if (family === "Tracks6") {
    return new AltiumTrackRecord({
      originalBinaryPayload: payload,
      items: [
        field("RECORD", "Track"),
        ...commonFields,
        measurementField("X1", view.getInt32(13, true)),
        measurementField("Y1", view.getInt32(17, true)),
        measurementField("X2", view.getInt32(21, true)),
        measurementField("Y2", view.getInt32(25, true)),
        measurementField("WIDTH", view.getInt32(29, true)),
      ],
    })
  }

  if (family === "Arcs6") {
    return new AltiumArcRecord({
      originalBinaryPayload: payload,
      items: [
        field("RECORD", "Arc"),
        ...commonFields,
        field("KEEPOUT", booleanText((view.getUint16(1, true) & 0x0200) !== 0)),
        measurementField("LOCATION.X", view.getInt32(13, true)),
        measurementField("LOCATION.Y", view.getInt32(17, true)),
        measurementField("RADIUS", view.getInt32(21, true)),
        field("STARTANGLE", formatNumber(view.getFloat64(25, true))),
        field("ENDANGLE", formatNumber(view.getFloat64(33, true))),
        measurementField("WIDTH", view.getInt32(41, true)),
      ],
    })
  }

  return new AltiumViaRecord({
    originalBinaryPayload: payload,
    items: [
      field("RECORD", "Via"),
      field("LAYER", "MULTILAYER"),
      field("LOCKED", booleanText((view.getUint8(1) & 0x04) === 0)),
      field("TENTEDTOP", booleanText((view.getUint8(1) & 0x20) !== 0)),
      field("TENTEDBOTTOM", booleanText((view.getUint8(1) & 0x40) !== 0)),
      field("NET", String(view.getUint16(3, true))),
      measurementField("X", view.getInt32(13, true)),
      measurementField("Y", view.getInt32(17, true)),
      measurementField("DIAMETER", view.getInt32(21, true)),
      measurementField("HOLESIZE", view.getInt32(25, true)),
      field("STARTLAYER", getAltiumPcbLayerName(view.getUint8(29))),
      field("ENDLAYER", getAltiumPcbLayerName(view.getUint8(30))),
    ],
  })
}

function parsePadStream(
  bytes: Uint8Array,
  options: ParseAltiumBinaryPcbPrimitiveOptions,
): AltiumRecord[] {
  const maximumRecordLength = options.maximumRecordLength ?? 16 * 1024 * 1024
  const records: AltiumRecord[] = []
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0

  while (offset < bytes.byteLength) {
    const recordOffset = offset
    if (bytes[offset] !== PRIMITIVE_TYPE.Pads6) {
      throw new AltiumFormatDetectionError(
        `Pads6 record at offset ${recordOffset} has unexpected primitive type ${bytes[offset]}`,
      )
    }
    offset += 1

    const subrecords: Uint8Array[] = []
    for (let subrecordIndex = 0; subrecordIndex < 6; subrecordIndex++) {
      const lengthOffset = offset
      if (offset + 4 > bytes.byteLength) {
        throw new AltiumTruncatedRecordError(
          `Pads6 subrecord ${subrecordIndex + 1} length is truncated`,
          offset,
        )
      }
      const length = view.getUint32(offset, true) & 0x00ff_ffff
      offset += 4
      if (length > maximumRecordLength) {
        throw new AltiumTruncatedRecordError(
          `Invalid Pads6 subrecord length ${length}`,
          lengthOffset,
        )
      }
      if (offset + length > bytes.byteLength) {
        throw new AltiumTruncatedRecordError(
          `Pads6 subrecord ${subrecordIndex + 1} at offset ${lengthOffset} exceeds its stream`,
          lengthOffset,
        )
      }
      subrecords.push(bytes.subarray(offset, offset + length))
      offset += length
    }

    const name = decodePadName(subrecords[0] ?? new Uint8Array())
    const geometry = subrecords[4]
    if (!geometry || geometry.byteLength < 110) {
      throw new AltiumTruncatedRecordError(
        "Pads6 geometry subrecord is shorter than 110 bytes",
        recordOffset,
      )
    }
    records.push(decodePad(name, geometry, subrecords[5]))
  }

  if (
    options.expectedRecordCount !== undefined &&
    records.length !== options.expectedRecordCount
  ) {
    throw new AltiumFormatDetectionError(
      `Pads6 stream declares ${options.expectedRecordCount} records but contains ${records.length}`,
    )
  }
  return records
}

function parseTextStream(
  bytes: Uint8Array,
  options: ParseAltiumBinaryPcbPrimitiveOptions,
): AltiumRecord[] {
  const maximumRecordLength = options.maximumRecordLength ?? 16 * 1024 * 1024
  const records: AltiumRecord[] = []
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0

  while (offset < bytes.byteLength) {
    const recordOffset = offset
    if (bytes[offset] !== PRIMITIVE_TYPE.Texts6) {
      throw new AltiumFormatDetectionError(
        `Texts6 record at offset ${recordOffset} has unexpected primitive type ${bytes[offset]}`,
      )
    }
    offset += 1

    const properties = readSubrecord(
      "Texts6 properties",
      bytes,
      view,
      offset,
      maximumRecordLength,
    )
    offset = properties.nextOffset
    const legacyText = readSubrecord(
      "Texts6 legacy text",
      bytes,
      view,
      offset,
      maximumRecordLength,
    )
    offset = legacyText.nextOffset
    records.push(
      decodeText(
        properties.payload,
        legacyText.payload,
        options.wideStrings,
        recordOffset,
      ),
    )
  }

  validateRecordCount("Texts6", records, options.expectedRecordCount)
  return records
}

function decodeText(
  payload: Uint8Array,
  legacyPayload: Uint8Array,
  wideStrings: ReadonlyMap<number, string> | undefined,
  byteOffset: number,
): AltiumTextRecord {
  if (payload.byteLength < 40) {
    throw new AltiumTruncatedRecordError(
      "Texts6 properties subrecord is shorter than 40 bytes",
      byteOffset,
    )
  }

  const view = new DataView(
    payload.buffer,
    payload.byteOffset,
    payload.byteLength,
  )
  const wideStringIndex =
    payload.byteLength >= 119 ? view.getUint32(115, true) : 0xffff_ffff
  const text =
    wideStrings?.get(wideStringIndex) ?? decodeLegacyText(legacyPayload)
  const items = [
    field("RECORD", "Text"),
    field("LAYER", getAltiumPcbLayerName(view.getUint8(0))),
    field("LOCKED", booleanText((view.getUint8(1) & 0x04) === 0)),
    field("COMPONENT", String(view.getUint16(7, true))),
    measurementField("X", view.getInt32(13, true)),
    measurementField("Y", view.getInt32(17, true)),
    measurementField("HEIGHT", view.getInt32(21, true)),
    field("STROKEFONT", String(view.getUint16(25, true))),
    field("ROTATION", formatNumber(view.getFloat64(27, true))),
    field("MIRROR", booleanText(view.getUint8(35) !== 0)),
    measurementField("WIDTH", view.getInt32(36, true)),
    field("WIDESTRINGINDEX", String(wideStringIndex)),
    field("WIDESTRING", encodeAltiumWideString(text)),
  ]

  if (payload.byteLength >= 137) {
    items.push(
      field("COMMENT", booleanText(view.getUint8(40) !== 0)),
      field("DESIGNATOR", booleanText(view.getUint8(41) !== 0)),
      field("FONTTYPE", String(view.getUint8(43))),
      field("BOLD", booleanText(view.getUint8(44) !== 0)),
      field("ITALIC", booleanText(view.getUint8(45) !== 0)),
      field("FONTNAME", decodeUtf16Field(payload.subarray(46, 110))),
      field("INVERTED", booleanText(view.getUint8(110) !== 0)),
      measurementField("MARGINBORDERWIDTH", view.getInt32(111, true)),
      field("INVERTEDRECT", booleanText(view.getUint8(123) !== 0)),
      measurementField("TEXTBOXWIDTH", view.getInt32(124, true)),
      measurementField("TEXTBOXHEIGHT", view.getInt32(128, true)),
      field("JUSTIFICATION", String(view.getUint8(132))),
      measurementField("TEXTOFFSET", view.getInt32(133, true)),
    )
  }

  if (payload.byteLength >= 230) {
    items.push(
      field("LAYER_V7", getAltiumPcbLayerName(view.getUint32(226, true))),
    )
  }

  return new AltiumTextRecord({
    items,
    originalBinaryPayload: payload,
  })
}

function parseContourStream(
  family: ContourPrimitiveFamily,
  bytes: Uint8Array,
  options: ParseAltiumBinaryPcbPrimitiveOptions,
): AltiumRecord[] {
  const config = CONTOUR_STREAM_CONFIG[family]
  const maximumRecordLength = options.maximumRecordLength ?? 16 * 1024 * 1024
  const records: AltiumRecord[] = []
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0

  while (offset < bytes.byteLength) {
    const recordOffset = offset
    if (bytes[offset] !== PRIMITIVE_TYPE[family]) {
      throw new AltiumFormatDetectionError(
        `${family} record at offset ${recordOffset} has unexpected primitive type ${bytes[offset]}`,
      )
    }
    offset += 1
    const subrecord = readSubrecord(
      family,
      bytes,
      view,
      offset,
      maximumRecordLength,
    )
    records.push(
      decodeContourPrimitive(
        subrecord.payload,
        recordOffset,
        family,
        config.recordKind,
        config.extendedVertices,
      ),
    )
    offset = subrecord.nextOffset
  }

  validateRecordCount(family, records, options.expectedRecordCount)
  return records
}

function decodeContourPrimitive(
  payload: Uint8Array,
  byteOffset: number,
  family: ContourPrimitiveFamily,
  recordKind: string,
  extendedVertices: boolean,
): AltiumRecord {
  if (payload.byteLength < 26) {
    throw new AltiumTruncatedRecordError(
      `${family} payload is shorter than 26 bytes`,
      byteOffset,
    )
  }

  const view = new DataView(
    payload.buffer,
    payload.byteOffset,
    payload.byteLength,
  )
  const propertyLength = view.getUint32(18, true) & 0x00ff_ffff
  const propertyStart = 22
  const propertyEnd = propertyStart + propertyLength
  if (propertyEnd + 4 > payload.byteLength) {
    throw new AltiumTruncatedRecordError(
      `${family} property block exceeds its record`,
      byteOffset + propertyStart,
    )
  }

  const propertyPayload = new Uint8Array(propertyLength + 1)
  propertyPayload[0] = 0x7c
  propertyPayload.set(payload.subarray(propertyStart, propertyEnd), 1)
  const record = parseAltiumBinaryPropertyRecord(propertyPayload, recordKind)
  const flags = view.getUint8(1)
  const propertyKind = Number(record.getCaseInsensitive("KIND") ?? 0)
  const isBoardCutout = record.getBoolean("ISBOARDCUTOUT") === true
  const extraFields = [
    field("SOURCESTREAM", family),
    field("LAYER", getAltiumPcbLayerName(view.getUint8(0))),
    field("LOCKED", booleanText((flags & 0x04) === 0)),
    field("TEARDROP", booleanText((flags & 0x10) !== 0)),
    field("KEEPOUT", booleanText(view.getUint8(2) === 2)),
    field("NET", String(view.getUint16(3, true))),
    field("POLYGON", String(view.getUint16(5, true))),
    field("COMPONENT", String(view.getUint16(7, true))),
    field("HOLECOUNT", String(view.getUint16(14, true))),
  ]
  if (
    family === "BoardRegions" ||
    family === "Regions6" ||
    family === "ShapeBasedRegions6"
  ) {
    extraFields.push(
      field(
        "REGIONKIND",
        getAltiumRegionKindName(family, propertyKind, isBoardCutout),
      ),
    )
  }

  let geometryOffset = propertyEnd
  const storedOutlineCount = view.getUint32(geometryOffset, true)
  const outlineCount = storedOutlineCount + (extendedVertices ? 1 : 0)
  geometryOffset += 4
  if (extendedVertices) {
    assertVertexArrayFits(
      `${family} outline`,
      outlineCount,
      37,
      geometryOffset,
      payload.byteLength,
      byteOffset,
    )
  } else {
    assertVertexArrayFits(
      `${family} outline`,
      outlineCount,
      16,
      geometryOffset,
      payload.byteLength,
      byteOffset,
    )
  }
  for (let index = 0; index < outlineCount; index++) {
    if (extendedVertices) {
      const isRound = view.getUint8(geometryOffset) !== 0
      extraFields.push(
        field(`KIND${index}`, isRound ? "1" : "0"),
        measurementField(`VX${index}`, view.getInt32(geometryOffset + 1, true)),
        measurementField(`VY${index}`, view.getInt32(geometryOffset + 5, true)),
        measurementField(`CX${index}`, view.getInt32(geometryOffset + 9, true)),
        measurementField(
          `CY${index}`,
          view.getInt32(geometryOffset + 13, true),
        ),
        measurementField(`R${index}`, view.getInt32(geometryOffset + 17, true)),
        field(
          `SA${index}`,
          formatNumber(view.getFloat64(geometryOffset + 21, true)),
        ),
        field(
          `EA${index}`,
          formatNumber(view.getFloat64(geometryOffset + 29, true)),
        ),
      )
      geometryOffset += 37
    } else {
      extraFields.push(
        field(`KIND${index}`, "0"),
        measurementField(`VX${index}`, view.getFloat64(geometryOffset, true)),
        measurementField(
          `VY${index}`,
          view.getFloat64(geometryOffset + 8, true),
        ),
      )
      geometryOffset += 16
    }
  }

  const holeCount = view.getUint16(14, true)
  for (let holeIndex = 0; holeIndex < holeCount; holeIndex++) {
    if (geometryOffset + 4 > payload.byteLength) {
      throw new AltiumTruncatedRecordError(
        `${family} hole ${holeIndex} count is truncated`,
        byteOffset + geometryOffset,
      )
    }
    const vertexCount = view.getUint32(geometryOffset, true)
    geometryOffset += 4
    assertVertexArrayFits(
      `${family} hole ${holeIndex}`,
      vertexCount,
      16,
      geometryOffset,
      payload.byteLength,
      byteOffset,
    )
    extraFields.push(field(`HOLE${holeIndex}COUNT`, String(vertexCount)))
    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++) {
      extraFields.push(
        measurementField(
          `HOLE${holeIndex}VX${vertexIndex}`,
          view.getFloat64(geometryOffset, true),
        ),
        measurementField(
          `HOLE${holeIndex}VY${vertexIndex}`,
          view.getFloat64(geometryOffset + 8, true),
        ),
      )
      geometryOffset += 16
    }
  }

  if (geometryOffset !== payload.byteLength) {
    extraFields.push(
      field(
        "UNPARSEDTRAILINGBYTES",
        String(payload.byteLength - geometryOffset),
      ),
    )
  }
  const originalItems = record.items
  const mergedItems = []
  if (originalItems[0]) mergedItems.push(originalItems[0])
  for (const item of extraFields) mergedItems.push(item.setParent(record))
  for (let index = 1; index < originalItems.length; index += 1) {
    const item = originalItems[index]
    if (item) mergedItems.push(item)
  }
  record.items = mergedItems
  record.setOriginalBinaryPayload(payload)
  return record
}

function decodePad(
  name: string,
  payload: Uint8Array,
  stackPayload: Uint8Array | undefined,
): AltiumPadRecord {
  const view = new DataView(
    payload.buffer,
    payload.byteOffset,
    payload.byteLength,
  )
  const shapeId = view.getUint8(49)
  const flags = view.getUint8(1)
  const padMode = view.getUint8(62)
  const items = [
    field("RECORD", "Pad"),
    field("NAME", name),
    field("LAYER", getAltiumPcbLayerName(view.getUint8(0))),
    field("LOCKED", booleanText((flags & 0x04) === 0)),
    field("TENTEDTOP", booleanText((flags & 0x20) !== 0)),
    field("TENTEDBOTTOM", booleanText((flags & 0x40) !== 0)),
    field("NET", String(view.getUint16(3, true))),
    field("COMPONENT", String(view.getUint16(7, true))),
    measurementField("X", view.getInt32(13, true)),
    measurementField("Y", view.getInt32(17, true)),
    measurementField("XSIZE", view.getInt32(21, true)),
    measurementField("YSIZE", view.getInt32(25, true)),
    measurementField("MIDXSIZE", view.getInt32(29, true)),
    measurementField("MIDYSIZE", view.getInt32(33, true)),
    measurementField("BOTTOMXSIZE", view.getInt32(37, true)),
    measurementField("BOTTOMYSIZE", view.getInt32(41, true)),
    measurementField("HOLESIZE", view.getInt32(45, true)),
    field("SHAPE", getAltiumPadShapeName(shapeId)),
    field("MIDSHAPE", getAltiumPadShapeName(view.getUint8(50))),
    field("BOTTOMSHAPE", getAltiumPadShapeName(view.getUint8(51))),
    field("ROTATION", formatNumber(view.getFloat64(52, true))),
    field("PLATED", view.getUint8(60) === 0 ? "FALSE" : "TRUE"),
    field("PADMODE", String(padMode)),
    field("PADSTACKMODE", getAltiumPadModeName(padMode)),
    measurementField("PASTEMASKEXPANSION_MANUAL", view.getInt32(86, true)),
    measurementField("SOLDERMASKEXPANSION_MANUAL", view.getInt32(90, true)),
    field("PASTEMASKEXPANSIONMODE", getAltiumModeName(view.getUint8(101))),
    field("SOLDERMASKEXPANSIONMODE", getAltiumModeName(view.getUint8(102))),
  ]

  if (payload.byteLength >= 114) {
    items.push(field("HOLEROTATION", formatNumber(view.getFloat64(106, true))))
  }
  if (payload.byteLength >= 120) {
    items.push(
      field("TOLAYER", getAltiumPcbLayerName(view.getUint8(114))),
      field("FROMLAYER", getAltiumPcbLayerName(view.getUint8(117))),
    )
  }
  if (stackPayload && stackPayload.byteLength >= 596) {
    items.push(...decodePadStackFields(stackPayload))
  }

  return new AltiumPadRecord({
    items,
    originalBinaryPayload: payload,
  })
}

function decodePadStackFields(payload: Uint8Array): AltiumField[] {
  const view = new DataView(
    payload.buffer,
    payload.byteOffset,
    payload.byteLength,
  )
  const fields = [
    field("STACKDATALENGTH", String(payload.byteLength)),
    field("HOLETYPE", String(view.getUint8(262))),
    field("HOLESHAPE", getAltiumPadHoleShapeName(view.getUint8(262))),
    measurementField("SLOTLENGTH", view.getInt32(263, true)),
    field("SLOTROTATION", formatNumber(view.getFloat64(267, true))),
  ]
  if (payload.byteLength > 596) {
    fields.push(field("UNPARSEDSTACKBYTES", String(payload.byteLength - 596)))
  }

  for (let ordinal = 0; ordinal < 32; ordinal++) {
    fields.push(
      measurementField(
        `LAYER${ordinal}HOLEXOFFSET`,
        view.getInt32(275 + ordinal * 4, true),
      ),
      measurementField(
        `LAYER${ordinal}HOLEYOFFSET`,
        view.getInt32(403 + ordinal * 4, true),
      ),
      field(
        `LAYER${ordinal}ALTSHAPE`,
        getAltiumPadAlternateShapeName(view.getUint8(532 + ordinal)),
      ),
      field(
        `LAYER${ordinal}CORNERRADIUS`,
        String(view.getUint8(564 + ordinal)),
      ),
    )
  }

  for (let innerIndex = 0; innerIndex < 29; innerIndex++) {
    const ordinal = innerIndex + 2
    fields.push(
      measurementField(
        `LAYER${ordinal}XSIZE`,
        view.getInt32(innerIndex * 4, true),
      ),
      measurementField(
        `LAYER${ordinal}YSIZE`,
        view.getInt32(116 + innerIndex * 4, true),
      ),
      field(
        `LAYER${ordinal}SHAPE`,
        getAltiumPadShapeName(view.getUint8(232 + innerIndex)),
      ),
    )
  }

  return fields
}

function readSubrecord(
  label: string,
  bytes: Uint8Array,
  view: DataView,
  offset: number,
  maximumRecordLength: number,
): { nextOffset: number; payload: Uint8Array } {
  if (offset + 4 > bytes.byteLength) {
    throw new AltiumTruncatedRecordError(
      `${label} subrecord length is truncated`,
      offset,
    )
  }
  const lengthOffset = offset
  const length = view.getUint32(offset, true) & 0x00ff_ffff
  offset += 4
  if (length > maximumRecordLength) {
    throw new AltiumTruncatedRecordError(
      `Invalid ${label} subrecord length ${length}`,
      lengthOffset,
    )
  }
  if (offset + length > bytes.byteLength) {
    throw new AltiumTruncatedRecordError(
      `${label} subrecord at offset ${lengthOffset} exceeds its stream`,
      lengthOffset,
    )
  }
  return {
    nextOffset: offset + length,
    payload: bytes.subarray(offset, offset + length),
  }
}

function validateRecordCount(
  family: string,
  records: AltiumRecord[],
  expectedRecordCount: number | undefined,
): void {
  if (
    expectedRecordCount !== undefined &&
    records.length !== expectedRecordCount
  ) {
    throw new AltiumFormatDetectionError(
      `${family} stream declares ${expectedRecordCount} records but contains ${records.length}`,
    )
  }
}

function assertVertexArrayFits(
  label: string,
  count: number,
  bytesPerVertex: number,
  offset: number,
  byteLength: number,
  recordOffset: number,
): void {
  const remaining = byteLength - offset
  if (count > Math.floor(remaining / bytesPerVertex)) {
    throw new AltiumTruncatedRecordError(
      `${label} declares ${count} vertices but exceeds its record`,
      recordOffset + offset,
    )
  }
}

function getAltiumRegionKindName(
  family: AltiumBinaryPcbPrimitiveFamily,
  kind: number,
  isBoardCutout: boolean,
): string {
  if (family === "BoardRegions") return "LAYER_STACK_REGION"
  if (kind === 0) return isBoardCutout ? "BOARD_CUTOUT" : "COPPER"
  if (kind === 1) return "POLYGON_CUTOUT"
  if (kind === 2) return "DASHED_OUTLINE"
  if (kind === 3) return "UNKNOWN_3"
  if (kind === 4) return "CAVITY_DEFINITION"
  return `UNKNOWN_${kind}`
}

function decodePadName(payload: Uint8Array): string {
  if (payload.byteLength === 0) return ""
  const declaredLength = payload[0] ?? 0
  const end = Math.min(declaredLength + 1, payload.byteLength)
  return new TextDecoder("windows-1252").decode(payload.subarray(1, end))
}

function decodeLegacyText(payload: Uint8Array): string {
  if (payload.byteLength === 0) return ""
  const declaredLength = payload[0] ?? 0
  const end = Math.min(declaredLength + 1, payload.byteLength)
  return new TextDecoder("windows-1252")
    .decode(payload.subarray(1, end))
    .replaceAll("\r\n", "\n")
}

function decodeUtf16Field(payload: Uint8Array): string {
  return decodeUtf16Le(payload).replace(/\0.*$/su, "")
}

function encodeAltiumWideString(value: string): string {
  return Array.from(value, (character) =>
    String(character.codePointAt(0) ?? 0),
  ).join(",")
}

function getAltiumPadShapeName(shapeId: number): string {
  if (shapeId === 1) return "ROUND"
  if (shapeId === 2) return "RECTANGLE"
  if (shapeId === 3) return "OCTAGONAL"
  return `SHAPE${shapeId}`
}

function getAltiumPadAlternateShapeName(shapeId: number): string {
  if (shapeId === 0) return "DEFAULT"
  if (shapeId === 1) return "ROUND"
  if (shapeId === 2) return "RECTANGLE"
  if (shapeId === 3) return "OCTAGONAL"
  if (shapeId === 9) return "ROUNDRECT"
  return `ALTSHAPE${shapeId}`
}

function getAltiumPadHoleShapeName(shapeId: number): string {
  if (shapeId === 0) return "ROUND"
  if (shapeId === 1) return "SQUARE"
  if (shapeId === 2) return "SLOT"
  return `HOLESHAPE${shapeId}`
}

function getAltiumPadModeName(mode: number): string {
  if (mode === 0) return "SIMPLE"
  if (mode === 1) return "TOP_MIDDLE_BOTTOM"
  if (mode === 2) return "FULL_STACK"
  return `PADMODE${mode}`
}

function getAltiumModeName(mode: number): string {
  if (mode === 0) return "None"
  if (mode === 1) return "Rule"
  if (mode === 2) return "Manual"
  return `Mode${mode}`
}

function field(key: string, value: string): AltiumField {
  return new AltiumField({ key, value })
}

function booleanText(value: boolean): string {
  return value ? "TRUE" : "FALSE"
}

function measurementField(key: string, internalValue: number): AltiumField {
  return field(key, `${formatNumber(internalValue / 10_000, 4)}mil`)
}

function formatNumber(value: number, maximumFractionDigits = 10): string {
  if (!Number.isFinite(value)) return "0"
  return value
    .toFixed(maximumFractionDigits)
    .replace(/\.?0+$/u, "")
    .replace(/^-0$/u, "0")
}

export function getAltiumPcbLayerName(layerId: number): string {
  if (layerId === 1) return "TOP"
  if (layerId >= 2 && layerId <= 31) return `MID-LAYER${layerId - 1}`
  if (layerId === 32) return "BOTTOM"
  if (layerId === 33) return "TOPOVERLAY"
  if (layerId === 34) return "BOTTOMOVERLAY"
  if (layerId === 35) return "TOPPASTE"
  if (layerId === 36) return "BOTTOMPASTE"
  if (layerId === 37) return "TOPSOLDER"
  if (layerId === 38) return "BOTTOMSOLDER"
  if (layerId >= 39 && layerId <= 54) {
    return `INTERNALPLANE${layerId - 38}`
  }
  if (layerId === 55) return "DRILLGUIDE"
  if (layerId === 56) return "KEEPOUT"
  if (layerId >= 57 && layerId <= 72) {
    return `MECHANICAL${layerId - 56}`
  }
  if (layerId === 73) return "DRILLDRAWING"
  if (layerId === 74) return "MULTILAYER"
  if (layerId === 75) return "CONNECTIONS"
  if (layerId === 76) return "BACKGROUND"
  if (layerId === 77) return "DRCERROR"
  if (layerId === 78) return "SELECTIONS"
  if (layerId === 79) return "VISIBLEGRID1"
  if (layerId === 80) return "VISIBLEGRID2"
  if (layerId === 81) return "PADHOLES"
  if (layerId === 82) return "VIAHOLES"
  if (layerId >= 83 && layerId <= 98) {
    return `MECHANICAL${layerId - 66}`
  }
  return `LAYER${layerId}`
}

export function parseAltiumBinaryPcbWideStrings(
  bytes: Uint8Array,
  maximumStringLength = 16 * 1024 * 1024,
): Map<number, string> {
  const strings = new Map<number, string>()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0

  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) {
      throw new AltiumTruncatedRecordError(
        "WideStrings6 entry header is truncated",
        offset,
      )
    }
    const index = view.getUint32(offset, true)
    const length = view.getUint32(offset + 4, true)
    offset += 8
    if (length > maximumStringLength || offset + length > bytes.byteLength) {
      throw new AltiumTruncatedRecordError(
        `WideStrings6 entry ${index} has invalid length ${length}`,
        offset - 4,
      )
    }
    const storedLength = length <= 2 ? 0 : length
    const value =
      storedLength === 0
        ? ""
        : decodeUtf16Le(
            bytes.subarray(offset, offset + storedLength - 2),
          ).replaceAll("\r\n", "\n")
    strings.set(index, value)
    offset += storedLength
  }

  return strings
}

function decodeUtf16Le(bytes: Uint8Array): string {
  let value = ""
  for (let offset = 0; offset + 1 < bytes.byteLength; offset += 2) {
    value += String.fromCharCode(
      (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8),
    )
  }
  return value
}
