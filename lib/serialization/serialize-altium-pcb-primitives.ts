import { AltiumBinaryWriter } from "../binary/altium-binary-io"
import { decodeAltiumWideString } from "../decode-altium-wide-string"
import {
  type AltiumRecordFields,
  getAltiumRecordFields,
  parseAltiumBoolean,
  parseAltiumFiniteNumber,
  parseAltiumIndex,
  parseAltiumInternalUnits,
  toAltiumPascalString,
  toAltiumUtf16LeBytes,
  toLegacyAltiumText,
} from "./altium-binary-record-encoding"
import { getAltiumPcbLayerId } from "./altium-pcb-binary-layers"
import { getAltiumPadShapeId } from "./validate-altium-pcb-binary-primitive"

const NO_INDEX = 0xffff
const UNLOCKED_PRIMITIVE_FLAG = 0x04
const STANDARD_PRIMITIVE_FLAG = 0x08
const TENTED_TOP_PRIMITIVE_FLAG = 0x20
const TENTED_BOTTOM_PRIMITIVE_FLAG = 0x40
const KEEPOUT_PRIMITIVE_FLAG = 0x0200
// Native Vias6 records retain a reserved metadata tail even when every
// optional via-stack field is unset. Real Altium documents use this minimum.
const NATIVE_VIA_PAYLOAD_LENGTH = 209

export const PCB_OBJECT_ID = {
  componentBody: 12,
  fill: 6,
  pad: 2,
  region: 11,
  text: 5,
  track: 4,
  via: 3,
} as const

type WritePrimitiveCommonOptions = {
  defaultLayerId: number
  fields: AltiumRecordFields
  writer: AltiumBinaryWriter
}

export function serializeAltiumPadRecord(recordSource: string): Uint8Array[] {
  const fields = getAltiumRecordFields(recordSource)
  const layerId = getAltiumPcbLayerId(fields.get("LAYER"))
  const shapeId = getAltiumPadShapeId(fields.get("SHAPE"))
  const xSize = parseAltiumInternalUnits(fields.get("XSIZE"))
  const ySize = parseAltiumInternalUnits(fields.get("YSIZE"))
  const writer = new AltiumBinaryWriter()
  writeAltiumPcbPrimitiveCommon({ defaultLayerId: layerId, fields, writer })
  writer
    .int32(parseAltiumInternalUnits(fields.get("X")))
    .int32(parseAltiumInternalUnits(fields.get("Y")))
  for (let index = 0; index < 3; index++) {
    writer.int32(xSize).int32(ySize)
  }
  writer
    .int32(parseAltiumInternalUnits(fields.get("HOLESIZE")))
    .uint8(shapeId)
    .uint8(shapeId)
    .uint8(shapeId)
    .float64(parseAltiumFiniteNumber(fields.get("ROTATION")))
    .uint8(parseAltiumBoolean(fields.get("PLATED")) ? 1 : 0)
    .uint8(0)
    .uint8(0)
    .int32(0)
    .writeBytes(new Uint8Array(38))
    .uint8(0)
    .float64(parseAltiumFiniteNumber(fields.get("HOLEROTATION")))

  return [
    toAltiumPascalString(fields.get("NAME") ?? ""),
    toAltiumPascalString(""),
    toAltiumPascalString(""),
    toAltiumPascalString(""),
    writer.toUint8Array(),
    serializeAltiumPadStack(fields),
  ]
}

export function serializeAltiumTrackRecord(recordSource: string): Uint8Array[] {
  const fields = getAltiumRecordFields(recordSource)
  const writer = new AltiumBinaryWriter()
  writeAltiumPcbPrimitiveCommon({
    defaultLayerId: getAltiumPcbLayerId(fields.get("LAYER")),
    fields,
    writer,
  })
  writer
    .int32(parseAltiumInternalUnits(fields.get("X1")))
    .int32(parseAltiumInternalUnits(fields.get("Y1")))
    .int32(parseAltiumInternalUnits(fields.get("X2")))
    .int32(parseAltiumInternalUnits(fields.get("Y2")))
    .int32(parseAltiumInternalUnits(fields.get("WIDTH")))
    .uint16(0)
  return [writer.toUint8Array()]
}

export function serializeAltiumFillRecord(recordSource: string): Uint8Array[] {
  const fields = getAltiumRecordFields(recordSource)
  const writer = new AltiumBinaryWriter()
  writeAltiumPcbPrimitiveCommon({
    defaultLayerId: getAltiumPcbLayerId(fields.get("LAYER")),
    fields,
    writer,
  })
  writer
    .int32(parseAltiumInternalUnits(fields.get("X1")))
    .int32(parseAltiumInternalUnits(fields.get("Y1")))
    .int32(parseAltiumInternalUnits(fields.get("X2")))
    .int32(parseAltiumInternalUnits(fields.get("Y2")))
    .float64(parseAltiumFiniteNumber(fields.get("ROTATION")))
  return [writer.toUint8Array()]
}

export function serializeAltiumViaRecord(recordSource: string): Uint8Array[] {
  const fields = getAltiumRecordFields(recordSource)
  const writer = new AltiumBinaryWriter()
  writeAltiumPcbPrimitiveCommon({
    defaultLayerId: getAltiumPcbLayerId("MULTILAYER"),
    fields,
    writer,
  })
  writer
    .int32(parseAltiumInternalUnits(fields.get("X")))
    .int32(parseAltiumInternalUnits(fields.get("Y")))
    .int32(parseAltiumInternalUnits(fields.get("DIAMETER")))
    .int32(parseAltiumInternalUnits(fields.get("HOLESIZE")))
    .uint8(getAltiumPcbLayerId(fields.get("STARTLAYER"), 1))
    .uint8(
      getAltiumPcbLayerId(
        fields.get("ENDLAYER") ?? fields.get("STOPLAYER"),
        32,
      ),
    )
    .writeBytes(new Uint8Array(NATIVE_VIA_PAYLOAD_LENGTH - writer.length))
  return [writer.toUint8Array()]
}

export function serializeAltiumTextRecord(
  recordSource: string,
  wideStringIndex: number,
): Uint8Array[] {
  const fields = getAltiumRecordFields(recordSource)
  const text = getAltiumTextContent(fields)
  const writer = new AltiumBinaryWriter(137, 137)
  writeAltiumPcbPrimitiveCommon({
    defaultLayerId: getAltiumPcbLayerId(fields.get("LAYER")),
    fields,
    writer,
  })
  writer
    .int32(parseAltiumInternalUnits(fields.get("X")))
    .int32(parseAltiumInternalUnits(fields.get("Y")))
    .int32(parseAltiumInternalUnits(fields.get("HEIGHT")))
    .uint16(parseAltiumFiniteNumber(fields.get("STROKEFONT")))
    .float64(parseAltiumFiniteNumber(fields.get("ROTATION")))
    .uint8(parseAltiumBoolean(fields.get("MIRROR")) ? 1 : 0)
    .int32(parseAltiumInternalUnits(fields.get("WIDTH")))
    .uint8(parseAltiumBoolean(fields.get("COMMENT")) ? 1 : 0)
    .uint8(parseAltiumBoolean(fields.get("DESIGNATOR")) ? 1 : 0)
    .uint8(0)
    .uint8(parseAltiumBoolean(fields.get("USETTFONTS")) ? 1 : 0)
    .uint8(parseAltiumBoolean(fields.get("BOLD")) ? 1 : 0)
    .uint8(parseAltiumBoolean(fields.get("ITALIC")) ? 1 : 0)
    .writeBytes(toAltiumUtf16LeBytes(fields.get("FONTNAME") ?? "", 64))
    .uint8(parseAltiumBoolean(fields.get("INVERTED")) ? 1 : 0)
    .int32(parseAltiumInternalUnits(fields.get("MARGINBORDERWIDTH")))
    .uint32(wideStringIndex)
    .writeBytes(new Uint8Array(4))
    .uint8(parseAltiumBoolean(fields.get("INVERTEDRECT")) ? 1 : 0)
    .int32(parseAltiumInternalUnits(fields.get("TEXTBOXWIDTH")))
    .int32(parseAltiumInternalUnits(fields.get("TEXTBOXHEIGHT")))
    .uint8(parseAltiumFiniteNumber(fields.get("JUSTIFICATION")))
    .int32(parseAltiumInternalUnits(fields.get("TEXTOFFSET")))
  return [writer.toUint8Array(), toAltiumPascalString(toLegacyAltiumText(text))]
}

export function writeAltiumWideStrings(recordSources: string[]): Uint8Array {
  const writer = new AltiumBinaryWriter()
  for (const [wideStringIndex, recordSource] of recordSources.entries()) {
    const textBytes = toAltiumUtf16LeBytes(
      getAltiumTextContent(getAltiumRecordFields(recordSource)),
    )
    writer.uint32(wideStringIndex).uint32(textBytes.byteLength)
    // Native files declare the UTF-16 terminator for an empty string without
    // storing those two bytes in the stream.
    if (textBytes.byteLength > 2) {
      writer.writeBytes(textBytes)
    }
  }
  return writer.toUint8Array()
}

function getAltiumTextContent(fields: AltiumRecordFields): string {
  const wideString = fields.get("WIDESTRING")
  return wideString === undefined
    ? (fields.get("TEXT") ?? "")
    : decodeAltiumWideString(wideString)
}

export function writeAltiumPrimitiveRecords(
  objectId: number,
  serializedRecords: Uint8Array[][],
): Uint8Array {
  const writer = new AltiumBinaryWriter()
  for (const serializedSubrecords of serializedRecords) {
    writer.uint8(objectId)
    for (const serializedSubrecord of serializedSubrecords) {
      writer.uint32LengthPrefixedBytes(serializedSubrecord)
    }
  }
  return writer.toUint8Array()
}

export function writeAltiumPcbPrimitiveCommon({
  defaultLayerId,
  fields,
  writer,
}: WritePrimitiveCommonOptions): void {
  writer
    .uint8(getAltiumPcbLayerId(fields.get("LAYER"), defaultLayerId))
    .uint16(getPrimitiveFlags(fields))
    .uint16(parseAltiumIndex(fields.get("NET")))
    .uint16(parseAltiumIndex(fields.get("POLYGON")))
    .uint16(parseAltiumIndex(fields.get("COMPONENT")))
    .uint16(NO_INDEX)
    .uint16(NO_INDEX)
}

function getPrimitiveFlags(fields: AltiumRecordFields): number {
  let flags = STANDARD_PRIMITIVE_FLAG
  if (!parseAltiumBoolean(fields.get("LOCKED"))) {
    flags |= UNLOCKED_PRIMITIVE_FLAG
  }
  if (parseAltiumBoolean(fields.get("TENTEDTOP"))) {
    flags |= TENTED_TOP_PRIMITIVE_FLAG
  }
  if (parseAltiumBoolean(fields.get("TENTEDBOTTOM"))) {
    flags |= TENTED_BOTTOM_PRIMITIVE_FLAG
  }
  if (parseAltiumBoolean(fields.get("KEEPOUT"))) {
    flags |= KEEPOUT_PRIMITIVE_FLAG
  }
  return flags
}

function serializeAltiumPadStack(fields: AltiumRecordFields): Uint8Array {
  const holeShape = fields.get("HOLESHAPE")?.toUpperCase()
  if (holeShape !== "SLOT" && holeShape !== "SQUARE") {
    return new Uint8Array()
  }
  const output = new Uint8Array(596)
  const view = new DataView(output.buffer)
  view.setUint8(262, holeShape === "SLOT" ? 2 : 1)
  view.setInt32(263, parseAltiumInternalUnits(fields.get("HOLEWIDTH")), true)
  view.setFloat64(
    267,
    parseAltiumFiniteNumber(fields.get("HOLEROTATION")),
    true,
  )
  return output
}
