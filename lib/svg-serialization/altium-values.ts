import { parseAltiumMeasurementToMils } from "../measurement/altium-measurement"
import { getPcbContour, getPcbRegionGeometry } from "../pcb-contours"
import type { AltiumRecord } from "../records/altium-record"
import type { SvgPoint } from "./svg-types"

export {
  getSchematicCoordinate,
  readSchematicInteger,
} from "../measurement/schematic-coordinate"
export { getSchematicIndexedPoints } from "../geometry/get-schematic-indexed-points"

export function parsePcbMeasurement(
  raw: string | undefined,
): number | undefined {
  return parseAltiumMeasurementToMils(raw)
}

export function getPcbMeasurement(
  record: AltiumRecord,
  key: string,
  fallback = 0,
): number {
  return parsePcbMeasurement(record.getCaseInsensitive(key)) ?? fallback
}

export function getPcbVertexPoints(record: AltiumRecord): SvgPoint[] {
  return getPcbContour(record).points
}

export function getPcbRegionContours(record: AltiumRecord): SvgPoint[][] {
  const geometry = getPcbRegionGeometry(record)
  return [geometry.outline, ...geometry.holes]
    .map(({ points }) => points)
    .filter((contour) => contour.length >= 3)
}

export function altiumColorToCss(
  raw: string | undefined,
  fallback: string,
): string {
  if (raw === undefined) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) return fallback

  const red = value & 0xff
  const green = (value >>> 8) & 0xff
  const blue = (value >>> 16) & 0xff
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, "0")
}
