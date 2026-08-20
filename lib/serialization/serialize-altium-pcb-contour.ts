import { AltiumBinaryWriter } from "../binary/altium-binary-io"
import { AltiumSerializationError } from "../errors/altium-error"
import {
  type AltiumRecordFields,
  parseAltiumFiniteNumber,
  parseAltiumInternalUnits,
} from "./altium-binary-record-encoding"
import { getAltiumPcbLayerId } from "./altium-pcb-binary-layers"
import { writeAltiumPcbPrimitiveCommon } from "./serialize-altium-pcb-primitives"

type SerializeAltiumShapeBasedContourOptions = {
  fields: AltiumRecordFields
  propertyBytes: Uint8Array
}

export function serializeAltiumShapeBasedContour({
  fields,
  propertyBytes,
}: SerializeAltiumShapeBasedContourOptions): Uint8Array[] {
  const outlineVertexCount = getOutlineVertexCount(fields)
  const holeCount = getContourHoleCount(fields)
  const writer = new AltiumBinaryWriter()
  writeAltiumPcbPrimitiveCommon({
    defaultLayerId: getAltiumPcbLayerId(fields.get("LAYER")),
    fields,
    writer,
  })
  writer
    .uint8(0)
    .uint16(holeCount)
    .uint16(0)
    .uint32(propertyBytes.byteLength)
    .writeBytes(propertyBytes)
    .uint32(outlineVertexCount - 1)

  for (let vertexIndex = 0; vertexIndex < outlineVertexCount; vertexIndex++) {
    writeExtendedContourVertex({ fields, vertexIndex, writer })
  }
  for (let holeIndex = 0; holeIndex < holeCount; holeIndex++) {
    writeContourHole({ fields, holeIndex, writer })
  }
  return [writer.toUint8Array()]
}

function getOutlineVertexCount(fields: AltiumRecordFields): number {
  const vertexIndexes = [...fields.keys()].flatMap((fieldName) => {
    const match = /^VX(\d+)$/u.exec(fieldName)
    return match?.[1] === undefined ? [] : [Number(match[1])]
  })
  const outlineVertexCount = Math.max(...vertexIndexes, -1) + 1
  if (outlineVertexCount < 4) {
    throw new AltiumSerializationError(
      "Altium contours require an explicitly closed outline",
    )
  }
  for (let vertexIndex = 0; vertexIndex < outlineVertexCount; vertexIndex++) {
    if (!fields.has(`VX${vertexIndex}`) || !fields.has(`VY${vertexIndex}`)) {
      throw new AltiumSerializationError(
        `Altium contour outline is missing vertex ${vertexIndex}`,
      )
    }
  }
  if (
    parseAltiumInternalUnits(fields.get("VX0")) !==
      parseAltiumInternalUnits(fields.get(`VX${outlineVertexCount - 1}`)) ||
    parseAltiumInternalUnits(fields.get("VY0")) !==
      parseAltiumInternalUnits(fields.get(`VY${outlineVertexCount - 1}`))
  ) {
    throw new AltiumSerializationError(
      "Altium contour outline must repeat its first vertex",
    )
  }
  return outlineVertexCount
}

function getContourHoleCount(fields: AltiumRecordFields): number {
  const holeCount = parseAltiumFiniteNumber(fields.get("HOLECOUNT"))
  if (!Number.isInteger(holeCount) || holeCount < 0 || holeCount > 0xffff) {
    throw new AltiumSerializationError(
      `Invalid Altium contour hole count: ${holeCount}`,
    )
  }
  return holeCount
}

function writeExtendedContourVertex({
  fields,
  vertexIndex,
  writer,
}: {
  fields: AltiumRecordFields
  vertexIndex: number
  writer: AltiumBinaryWriter
}): void {
  const vertexKind = parseAltiumFiniteNumber(fields.get(`KIND${vertexIndex}`))
  if (vertexKind !== 0 && vertexKind !== 1) {
    throw new AltiumSerializationError(
      `Unsupported Altium contour vertex kind at index ${vertexIndex}: ${vertexKind}`,
    )
  }
  writer
    .uint8(vertexKind)
    .int32(parseAltiumInternalUnits(fields.get(`VX${vertexIndex}`)))
    .int32(parseAltiumInternalUnits(fields.get(`VY${vertexIndex}`)))
    .int32(parseAltiumInternalUnits(fields.get(`CX${vertexIndex}`)))
    .int32(parseAltiumInternalUnits(fields.get(`CY${vertexIndex}`)))
    .int32(parseAltiumInternalUnits(fields.get(`R${vertexIndex}`)))
    .float64(parseAltiumFiniteNumber(fields.get(`SA${vertexIndex}`)))
    .float64(parseAltiumFiniteNumber(fields.get(`EA${vertexIndex}`)))
}

function writeContourHole({
  fields,
  holeIndex,
  writer,
}: {
  fields: AltiumRecordFields
  holeIndex: number
  writer: AltiumBinaryWriter
}): void {
  const holeVertexCount = parseAltiumFiniteNumber(
    fields.get(`HOLE${holeIndex}COUNT`),
  )
  if (
    !Number.isInteger(holeVertexCount) ||
    holeVertexCount < 3 ||
    holeVertexCount > 0xffff_ffff
  ) {
    throw new AltiumSerializationError(
      `Invalid Altium contour hole ${holeIndex} vertex count: ${holeVertexCount}`,
    )
  }
  writer.uint32(holeVertexCount)
  for (let vertexIndex = 0; vertexIndex < holeVertexCount; vertexIndex++) {
    const holeX = fields.get(`HOLE${holeIndex}VX${vertexIndex}`)
    const holeY = fields.get(`HOLE${holeIndex}VY${vertexIndex}`)
    if (holeX === undefined || holeY === undefined) {
      throw new AltiumSerializationError(
        `Altium contour hole ${holeIndex} is missing vertex ${vertexIndex}`,
      )
    }
    writer
      .float64(parseAltiumInternalUnits(holeX))
      .float64(parseAltiumInternalUnits(holeY))
  }
}
