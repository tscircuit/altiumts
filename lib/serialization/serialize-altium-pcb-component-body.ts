import {
  getAltiumRecordFields,
  toAltiumBinaryRecordBytes,
} from "./altium-binary-record-encoding"
import { serializeAltiumShapeBasedContour } from "./serialize-altium-pcb-contour"

const COMPONENT_BODY_GEOMETRY_FIELD =
  /^(?:KIND|VX|VY|CX|CY|R|SA|EA)\d+$|^HOLE\d+(?:COUNT|V[XY]\d+)$/u

const COMPONENT_BODY_STREAM_FIELDS = new Set([
  "COMPONENT",
  "HOLECOUNT",
  "KEEPOUT",
  "LAYER",
  "LOCKED",
  "NET",
  "POLYGON",
  "RECORD",
  "SOURCESTREAM",
  "TEARDROP",
])

export function serializeAltiumComponentBodyRecord(
  recordSource: string,
): Uint8Array[] {
  const fields = getAltiumRecordFields(recordSource)
  const propertySource = [...fields.entries()]
    .filter(
      ([fieldName]) =>
        !COMPONENT_BODY_STREAM_FIELDS.has(fieldName) &&
        !COMPONENT_BODY_GEOMETRY_FIELD.test(fieldName),
    )
    .map(([fieldName, fieldText]) => `|${fieldName}=${fieldText}`)
    .join("")

  return serializeAltiumShapeBasedContour({
    fields,
    propertyBytes: toAltiumBinaryRecordBytes(propertySource).subarray(1),
  })
}
