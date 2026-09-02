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
  const regionKind = getAltiumRegionKindId(fields.get("REGIONKIND"))
  const propertySource = [
    `V7_LAYER=${layer}`,
    "NAME= ",
    `KIND=${regionKind}`,
    `SUBPOLYINDEX=${polygonIndex === NO_INDEX ? -1 : polygonIndex}`,
    "UNIONINDEX=0",
    "ARCRESOLUTION=0.5mil",
    "ISSHAPEBASED=FALSE",
    "CAVITYHEIGHT=0mil",
  ].join("|")
  return toAltiumBinaryRecordBytes(`|${propertySource}`).subarray(1)
}

function getAltiumRegionKindId(regionKind: string | undefined): number {
  return regionKind?.toUpperCase() === "POLYGON_CUTOUT" ? 1 : 0
}
