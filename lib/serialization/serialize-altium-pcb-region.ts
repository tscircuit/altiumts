import {
  type AltiumRecordFields,
  getAltiumRecordFields,
  parseAltiumIndex,
  toAltiumBinaryRecordBytes,
} from "./altium-binary-record-encoding"
import { serializeAltiumShapeBasedContour } from "./serialize-altium-pcb-contour"

const NO_INDEX = 0xffff

export function serializeAltiumRegionRecord(
  recordSource: string,
): Uint8Array[] {
  const fields = getAltiumRecordFields(recordSource)
  return serializeAltiumShapeBasedContour({
    fields,
    propertyBytes: createRegionPropertyBytes(fields),
  })
}

function createRegionPropertyBytes(fields: AltiumRecordFields): Uint8Array {
  const layer = fields.get("LAYER") ?? "TOP"
  const polygonIndex = parseAltiumIndex(fields.get("POLYGON"))
  const propertySource = [
    `V7_LAYER=${layer}`,
    "NAME= ",
    "KIND=0",
    `SUBPOLYINDEX=${polygonIndex === NO_INDEX ? -1 : polygonIndex}`,
    "UNIONINDEX=0",
    "ARCRESOLUTION=0.5mil",
    "ISSHAPEBASED=FALSE",
    "CAVITYHEIGHT=0mil",
  ].join("|")
  return toAltiumBinaryRecordBytes(`|${propertySource}`).subarray(1)
}
