import type { AltiumPcbDocument } from "./altium-pcb-document"
import {
  type AltiumBounds,
  type AltiumContourWinding,
  type AltiumPoint,
  altiumPointsEqual,
  getAltiumBounds,
  getAltiumContourWinding,
} from "./geometry/altium-geometry"
import { parseAltiumMeasurementToMils } from "./measurement/altium-measurement"
import type { AltiumRecord } from "./records/altium-record"

export type AltiumPcbContourVertexKind = "arc" | "line" | "unknown"

export interface AltiumPcbContourArc {
  center: AltiumPoint
  endAngleDegrees: number
  radiusMils: number
  startAngleDegrees: number
}

export interface AltiumPcbContourVertex {
  arc?: AltiumPcbContourArc
  index: number
  kind: AltiumPcbContourVertexKind
  position: AltiumPoint
  rawKind?: number
}

export interface AltiumPcbContour {
  bounds?: AltiumBounds
  isExplicitlyClosed: boolean
  points: AltiumPoint[]
  vertices: AltiumPcbContourVertex[]
  winding: AltiumContourWinding
}

export interface AltiumPcbRegionGeometry {
  holes: AltiumPcbContour[]
  outline: AltiumPcbContour
  record: AltiumRecord
}

export interface AltiumPcbBoardGeometry {
  cutouts: AltiumPcbRegionGeometry[]
  layerStackRegions: AltiumPcbRegionGeometry[]
  outline: AltiumPcbContour
  polygonCutouts: AltiumPcbRegionGeometry[]
}

const MAX_CONTOUR_VERTICES = 100_000
const MAX_CONTOUR_HOLES = 10_000

export function getPcbContour(record: AltiumRecord): AltiumPcbContour {
  return createContour(getPcbContourVertices(record))
}

export function getPcbContourVertices(
  record: AltiumRecord,
): AltiumPcbContourVertex[] {
  return getPcbContourVerticesFromFields(getCaseInsensitiveFields(record))
}

function getPcbContourVerticesFromFields(
  fields: ReadonlyMap<string, string>,
): AltiumPcbContourVertex[] {
  const vertices: AltiumPcbContourVertex[] = []
  for (let index = 0; index < MAX_CONTOUR_VERTICES; index++) {
    const x = getMeasurement(fields, `VX${index}`)
    const y = getMeasurement(fields, `VY${index}`)
    if (x === undefined || y === undefined) break

    const rawKind = getFiniteNumber(fields, `KIND${index}`)
    const position = { x, y }
    if (rawKind !== 1) {
      vertices.push({
        index,
        kind: rawKind === undefined || rawKind === 0 ? "line" : "unknown",
        position,
        rawKind,
      })
      continue
    }

    const centerX = getMeasurement(fields, `CX${index}`)
    const centerY = getMeasurement(fields, `CY${index}`)
    const radiusMils = getMeasurement(fields, `R${index}`)
    const startAngleDegrees = getFiniteNumber(fields, `SA${index}`)
    const endAngleDegrees = getFiniteNumber(fields, `EA${index}`)
    const arc =
      centerX !== undefined &&
      centerY !== undefined &&
      radiusMils !== undefined &&
      radiusMils > 0 &&
      startAngleDegrees !== undefined &&
      endAngleDegrees !== undefined
        ? {
            center: { x: centerX, y: centerY },
            endAngleDegrees,
            radiusMils,
            startAngleDegrees,
          }
        : undefined
    vertices.push({
      arc,
      index,
      kind: arc ? "arc" : "unknown",
      position,
      rawKind,
    })
  }
  return vertices
}

export function getPcbRegionGeometry(
  record: AltiumRecord,
): AltiumPcbRegionGeometry {
  const fields = getCaseInsensitiveFields(record)
  const holes: AltiumPcbContour[] = []
  const holeCount = boundedInteger(fields.get("HOLECOUNT"), MAX_CONTOUR_HOLES)
  for (let holeIndex = 0; holeIndex < holeCount; holeIndex++) {
    const vertexCount = boundedInteger(
      fields.get(`HOLE${holeIndex}COUNT`),
      MAX_CONTOUR_VERTICES,
    )
    const vertices: AltiumPcbContourVertex[] = []
    for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex++) {
      const x = getMeasurement(fields, `HOLE${holeIndex}VX${vertexIndex}`)
      const y = getMeasurement(fields, `HOLE${holeIndex}VY${vertexIndex}`)
      if (x === undefined || y === undefined) break
      vertices.push({
        index: vertexIndex,
        kind: "line",
        position: { x, y },
        rawKind: 0,
      })
    }
    if (vertices.length >= 3) holes.push(createContour(vertices))
  }
  return {
    holes,
    outline: createContour(getPcbContourVerticesFromFields(fields)),
    record,
  }
}

export function getPcbBoardGeometry(
  document: AltiumPcbDocument,
): AltiumPcbBoardGeometry {
  const outline = document.board
    ? getPcbContour(document.board)
    : createContour([])
  const regions = document.records.filter(
    (record) =>
      record.recordKind === "BoardRegion" || record.recordKind === "Region",
  )

  return {
    cutouts: regions
      .filter((record) => getPcbRegionSemanticKind(record) === "BOARD_CUTOUT")
      .map(getPcbRegionGeometry),
    layerStackRegions: regions
      .filter(
        (record) => getPcbRegionSemanticKind(record) === "LAYER_STACK_REGION",
      )
      .map(getPcbRegionGeometry),
    outline,
    polygonCutouts: regions
      .filter((record) => getPcbRegionSemanticKind(record) === "POLYGON_CUTOUT")
      .map(getPcbRegionGeometry),
  }
}

export function getPcbRegionSemanticKind(
  record: AltiumRecord,
): string | undefined {
  if (
    record.recordKind === "BoardRegion" ||
    record.getDecoded("OBJECTKIND")?.toUpperCase() === "BOARDREGION" ||
    record.getDecoded("LAYERSTACKID") !== undefined
  ) {
    return "LAYER_STACK_REGION"
  }
  const kind =
    record.getDecoded("REGIONKIND") ?? record.getDecoded("KIND") ?? undefined
  const normalized = kind?.replace(/[\s-]+/gu, "_").toUpperCase()
  if (normalized === "0") {
    return record.getBoolean("ISBOARDCUTOUT") === true
      ? "BOARD_CUTOUT"
      : "COPPER"
  }
  if (normalized === "1") return "POLYGON_CUTOUT"
  if (normalized === "2") return "DASHED_OUTLINE"
  if (normalized === "3") return "UNKNOWN_3"
  if (normalized === "4") return "CAVITY_DEFINITION"
  return normalized
}

function createContour(vertices: AltiumPcbContourVertex[]): AltiumPcbContour {
  const points: AltiumPoint[] = []
  for (const vertex of vertices) {
    if (!vertex.arc) {
      appendDistinctPoint(points, vertex.position)
      continue
    }
    for (const point of approximateArcVertex(vertex.position, vertex.arc)) {
      appendDistinctPoint(points, point)
    }
  }
  const first = points[0]
  const last = points.at(-1)
  return {
    bounds: getAltiumBounds(points),
    isExplicitlyClosed:
      first !== undefined &&
      last !== undefined &&
      altiumPointsEqual(first, last, 0.0001),
    points,
    vertices,
    winding: getAltiumContourWinding(points),
  }
}

function approximateArcVertex(
  position: AltiumPoint,
  arc: AltiumPcbContourArc,
): AltiumPoint[] {
  const start = pointOnArc(arc.center, arc.radiusMils, arc.startAngleDegrees)
  const end = pointOnArc(arc.center, arc.radiusMils, arc.endAngleDegrees)
  const sweep =
    normalizePositiveAngle(arc.endAngleDegrees - arc.startAngleDegrees) || 360
  const positionAtStart =
    squaredDistance(position, start) <= squaredDistance(position, end)
  const firstAngle = positionAtStart
    ? arc.startAngleDegrees
    : arc.endAngleDegrees
  const signedSweep = positionAtStart ? sweep : -sweep
  const segments = Math.max(2, Math.ceil(Math.abs(signedSweep) / 7.5))
  const points: AltiumPoint[] = []
  for (let index = 0; index <= segments; index++) {
    points.push(
      pointOnArc(
        arc.center,
        arc.radiusMils,
        firstAngle + (signedSweep * index) / segments,
      ),
    )
  }
  return points
}

function pointOnArc(
  center: AltiumPoint,
  radius: number,
  angle: number,
): AltiumPoint {
  const radians = (angle * Math.PI) / 180
  return {
    x: center.x + Math.cos(radians) * radius,
    y: center.y + Math.sin(radians) * radius,
  }
}

function normalizePositiveAngle(angle: number): number {
  return ((angle % 360) + 360) % 360
}

function squaredDistance(left: AltiumPoint, right: AltiumPoint): number {
  const dx = left.x - right.x
  const dy = left.y - right.y
  return dx * dx + dy * dy
}

function appendDistinctPoint(points: AltiumPoint[], point: AltiumPoint): void {
  const previous = points.at(-1)
  if (previous && altiumPointsEqual(previous, point, 0.0001)) return
  points.push(point)
}

function getCaseInsensitiveFields(record: AltiumRecord): Map<string, string> {
  const fields = new Map<string, string>()
  for (const field of record.fields) {
    const key = field.key.toUpperCase()
    if (!fields.has(key)) fields.set(key, field.value)
  }
  return fields
}

function getMeasurement(
  fields: ReadonlyMap<string, string>,
  key: string,
): number | undefined {
  return parseAltiumMeasurementToMils(fields.get(key.toUpperCase()))
}

function getFiniteNumber(
  fields: ReadonlyMap<string, string>,
  key: string,
): number | undefined {
  const value = Number(fields.get(key.toUpperCase()))
  return Number.isFinite(value) ? value : undefined
}

function boundedInteger(raw: string | undefined, maximum: number): number {
  const value = Number(raw ?? 0)
  return Number.isInteger(value) ? Math.min(Math.max(value, 0), maximum) : 0
}
