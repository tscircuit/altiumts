import type { AltiumRecord } from "../records/altium-record"
import type { SvgPoint } from "./svg-types"

const MILS_PER_UNIT: Record<string, number> = {
  cm: 10_000 / 25.4,
  in: 1000,
  inch: 1000,
  inches: 1000,
  mil: 1,
  mils: 1,
  mm: 1000 / 25.4,
}

export function parsePcbMeasurement(
  raw: string | undefined,
): number | undefined {
  if (raw === undefined) return undefined
  const match =
    /^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]+)?\s*$/iu.exec(
      raw,
    )
  if (!match?.[1]) return undefined

  const value = Number(match[1])
  const unit = match[2]?.toLowerCase()
  if (!Number.isFinite(value)) return undefined
  if (unit === undefined) return value
  return value * (MILS_PER_UNIT[unit] ?? 1)
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
  const integerPart = Number(record.getCaseInsensitive(key) ?? fallback)
  const fractionRaw = record.getCaseInsensitive(`${key}_FRAC`)
  if (!Number.isFinite(integerPart) || fractionRaw === undefined) {
    return Number.isFinite(integerPart) ? integerPart : fallback
  }

  const normalizedFraction = fractionRaw.replace(/^[+-]/u, "")
  const fraction = Number(`0.${normalizedFraction}`)
  if (!Number.isFinite(fraction)) return integerPart
  return integerPart < 0 ? integerPart - fraction : integerPart + fraction
}

export function getPcbVertexPoints(record: AltiumRecord): SvgPoint[] {
  const points: SvgPoint[] = []

  for (let index = 0; index < 10_000; index++) {
    const x = parsePcbMeasurement(record.getCaseInsensitive(`VX${index}`))
    const y = parsePcbMeasurement(record.getCaseInsensitive(`VY${index}`))
    if (x === undefined || y === undefined) break
    const position = { x, y }
    const kind = Number(record.getCaseInsensitive(`KIND${index}`) ?? 0)
    if (kind !== 1) {
      appendDistinctPoint(points, position)
      continue
    }

    const centerX = parsePcbMeasurement(record.getCaseInsensitive(`CX${index}`))
    const centerY = parsePcbMeasurement(record.getCaseInsensitive(`CY${index}`))
    const radius = parsePcbMeasurement(record.getCaseInsensitive(`R${index}`))
    const startAngle = Number(record.getCaseInsensitive(`SA${index}`))
    const endAngle = Number(record.getCaseInsensitive(`EA${index}`))
    if (
      centerX === undefined ||
      centerY === undefined ||
      radius === undefined ||
      radius <= 0 ||
      !Number.isFinite(startAngle) ||
      !Number.isFinite(endAngle)
    ) {
      appendDistinctPoint(points, position)
      continue
    }

    for (const arcPoint of approximateAltiumVertexArc({
      center: { x: centerX, y: centerY },
      endAngle,
      position,
      radius,
      startAngle,
    })) {
      appendDistinctPoint(points, arcPoint)
    }
  }

  return points
}

export function getPcbRegionContours(record: AltiumRecord): SvgPoint[][] {
  const contours = [getPcbVertexPoints(record)]
  const declaredHoleCount = Number(record.getCaseInsensitive("HOLECOUNT") ?? 0)
  const holeCount = Number.isInteger(declaredHoleCount)
    ? Math.min(Math.max(declaredHoleCount, 0), 10_000)
    : 0

  for (let holeIndex = 0; holeIndex < holeCount; holeIndex++) {
    const points: SvgPoint[] = []
    const declaredVertexCount = Number(
      record.getCaseInsensitive(`HOLE${holeIndex}COUNT`) ?? 0,
    )
    const vertexCount = Number.isInteger(declaredVertexCount)
      ? Math.min(Math.max(declaredVertexCount, 0), 100_000)
      : 0
    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++) {
      const x = parsePcbMeasurement(
        record.getCaseInsensitive(`HOLE${holeIndex}VX${vertexIndex}`),
      )
      const y = parsePcbMeasurement(
        record.getCaseInsensitive(`HOLE${holeIndex}VY${vertexIndex}`),
      )
      if (x === undefined || y === undefined) break
      points.push({ x, y })
    }
    if (points.length >= 3) contours.push(points)
  }

  return contours.filter((contour) => contour.length >= 3)
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
      record.getCaseInsensitive(xKey) === undefined ||
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

export function decodeAltiumWideString(raw: string | undefined): string {
  if (!raw) return ""
  if (!/^\d+(?:,\d+)*$/u.test(raw)) return raw

  try {
    return String.fromCodePoint(...raw.split(",").map((value) => Number(value)))
  } catch {
    return raw
  }
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

function approximateAltiumVertexArc(init: {
  center: SvgPoint
  endAngle: number
  position: SvgPoint
  radius: number
  startAngle: number
}): SvgPoint[] {
  const start = pointOnArc(init.center, init.radius, init.startAngle)
  const end = pointOnArc(init.center, init.radius, init.endAngle)
  const sweep = normalizePositiveAngle(init.endAngle - init.startAngle) || 360
  const positionAtStart =
    squaredDistance(init.position, start) <= squaredDistance(init.position, end)
  const firstAngle = positionAtStart ? init.startAngle : init.endAngle
  const signedSweep = positionAtStart ? sweep : -sweep
  const segments = Math.max(2, Math.ceil(Math.abs(signedSweep) / 7.5))
  const points: SvgPoint[] = []

  for (let index = 0; index <= segments; index++) {
    points.push(
      pointOnArc(
        init.center,
        init.radius,
        firstAngle + (signedSweep * index) / segments,
      ),
    )
  }
  return points
}

function pointOnArc(center: SvgPoint, radius: number, angle: number): SvgPoint {
  const radians = (angle * Math.PI) / 180
  return {
    x: center.x + Math.cos(radians) * radius,
    y: center.y + Math.sin(radians) * radius,
  }
}

function normalizePositiveAngle(angle: number): number {
  return ((angle % 360) + 360) % 360
}

function squaredDistance(left: SvgPoint, right: SvgPoint): number {
  const dx = left.x - right.x
  const dy = left.y - right.y
  return dx * dx + dy * dy
}

function appendDistinctPoint(points: SvgPoint[], point: SvgPoint): void {
  const previous = points.at(-1)
  if (
    previous &&
    Math.abs(previous.x - point.x) < 0.0001 &&
    Math.abs(previous.y - point.y) < 0.0001
  ) {
    return
  }
  points.push(point)
}
