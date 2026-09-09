import { parseAltiumMeasurementToMils } from "../measurement/altium-measurement"
import { getPcbContour, getPcbRegionGeometry } from "../pcb-contours"
import type { AltiumRecord } from "../records/altium-record"
import type { SvgPoint } from "./svg-types"

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

export function getSchematicCoordinate(
  record: AltiumRecord,
  key: string,
  fallback = 0,
): number {
  // SchDoc coordinates are two signed integers, not decimal strings. A
  // fraction of 8000 means 0.08 even without leading zeroes. Do not repair
  // malformed exporter output here: Altium does not accept "258.08" as X2.
  return (
    readSchematicInteger(record.getCaseInsensitive(key), fallback) +
    readSchematicInteger(record.getCaseInsensitive(`${key}_FRAC`), 0) / 100_000
  )
}

export function readSchematicInteger(
  raw: string | undefined,
  fallback: number,
): number {
  if (raw === undefined || !/^[+-]?\d+$/u.test(raw.trim())) return fallback
  const value = Number(raw)
  return Number.isSafeInteger(value) ? value : fallback
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
    if (
      !Number.isFinite(declaredCount) &&
      record.getCaseInsensitive(xKey) === undefined &&
      record.getCaseInsensitive(yKey) === undefined
    ) {
      break
    }
    points.push({
      x: getSchematicCoordinate(record, xKey),
      y: getSchematicCoordinate(record, yKey),
    })
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
