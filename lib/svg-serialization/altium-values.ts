import { getSchematicPoint } from "../geometry/schematic-point"
import { parseAltiumMeasurementToMils } from "../measurement/altium-measurement"
import { getPcbContour, getPcbRegionGeometry } from "../pcb-contours"
import type { AltiumRecord } from "../records/altium-record"
import type { SvgPoint } from "./svg-types"

export {
  getSchematicCoordinate,
  readSchematicInteger,
} from "../measurement/schematic-coordinate"

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

export function getSchematicIndexedPoints(record: AltiumRecord): SvgPoint[] {
  const points: SvgPoint[] = []
  const declaredCount = Number(record.getCaseInsensitive("LOCATIONCOUNT"))
  const maximum = Number.isFinite(declaredCount)
    ? Math.min(Math.max(declaredCount, 0), 10_000)
    : 10_000

  for (let index = 1; index <= maximum; index++) {
    const xKey = `X${index}`
    const yKey = `Y${index}`
    const point = getSchematicPoint(record, { xKey, yKey })
    if (!point && !Number.isFinite(declaredCount)) break
    points.push(point ?? { x: 0, y: 0 })
  }

  return points
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
