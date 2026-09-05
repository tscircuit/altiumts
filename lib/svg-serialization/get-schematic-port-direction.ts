import { altiumPointsEqual } from "../geometry/altium-geometry"
import type { AltiumRecord } from "../records/altium-record"
import {
  getSchematicCoordinate,
  getSchematicIndexedPoints,
} from "./altium-values"
import type { SvgPoint } from "./svg-types"

export type SchematicConnectionSegment = { start: SvgPoint; end: SvgPoint }

interface GetSchematicPortDirectionParams {
  record: AltiumRecord
  segments: SchematicConnectionSegment[]
  width: number
}

/** Port styles 0–3 are horizontal; 4–7 are their vertical counterparts. */
export function getSchematicPortDirection({
  record,
  segments,
  width,
}: GetSchematicPortDirectionParams) {
  const style = record.getNumber("STYLE") ?? 0
  const vertical = style >= 4 && style <= 7
  const start = {
    x: getSchematicCoordinate(record, "LOCATION.X"),
    y: getSchematicCoordinate(record, "LOCATION.Y"),
  }
  const end = {
    x: start.x + (vertical ? 0 : width),
    y: start.y + (vertical ? width : 0),
  }
  const ioType = record.getNumber("IOTYPE") ?? 0

  // Unspecified ports use the saved arrow style. Electrical types use the
  // connected end: outputs point away from the circuit, inputs toward it.
  if (ioType !== 1 && ioType !== 2 && ioType !== 3) {
    return {
      vertical,
      pointAtStart: vertical
        ? style === 6 || style === 7
        : style === 1 || style === 3,
      pointAtEnd: vertical
        ? style === 5 || style === 7
        : style === 2 || style === 3,
    }
  }
  if (ioType === 3) {
    return { vertical, pointAtStart: true, pointAtEnd: true }
  }

  const startConnected = isConnected(start, segments)
  const endConnected = isConnected(end, segments)
  // With neither end (or both ends) connected, retain a deterministic
  // left-to-right / bottom-to-top direction.
  const connectedAtEnd = endConnected && !startConnected
  const pointAtStart = ioType === 1 ? connectedAtEnd : !connectedAtEnd
  return { vertical, pointAtStart, pointAtEnd: !pointAtStart }
}

/** Collect wire/bus segments and visible pin tips once for the whole sheet. */
export function getSchematicConnectionSegments(
  records: AltiumRecord[],
): SchematicConnectionSegment[] {
  const segments: SchematicConnectionSegment[] = []
  for (const record of records) {
    if (record.recordKind === "27" || record.recordKind === "26") {
      const points = getSchematicIndexedPoints(record)
      for (const [index, start] of points.entries()) {
        const end = points[index + 1]
        if (end) segments.push({ start, end })
      }
    }
    if (record.recordKind === "2") {
      const conglomerate = record.getNumber("PINCONGLOMERATE")
      if (
        record.getBoolean("ISHIDDEN") ||
        (conglomerate !== undefined && (conglomerate & 4) !== 0)
      )
        continue
      const orientation =
        (conglomerate ?? record.getNumber("ORIENTATION") ?? 0) & 3
      const length = getSchematicCoordinate(record, "PINLENGTH", 10)
      const point = {
        x:
          getSchematicCoordinate(record, "LOCATION.X") +
          (orientation === 0 ? length : orientation === 2 ? -length : 0),
        y:
          getSchematicCoordinate(record, "LOCATION.Y") +
          (orientation === 1 ? length : orientation === 3 ? -length : 0),
      }
      segments.push({ start: point, end: point })
    }
  }
  return segments
}

function isConnected(
  point: SvgPoint,
  segments: SchematicConnectionSegment[],
): boolean {
  return segments.some(({ start, end }) => {
    if (altiumPointsEqual(point, start) || altiumPointsEqual(point, end))
      return true
    const dx = end.x - start.x
    const dy = end.y - start.y
    const lengthSquared = dx * dx + dy * dy
    if (lengthSquared === 0) return false
    const t =
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    return (
      t > 0 &&
      t < 1 &&
      altiumPointsEqual(point, { x: start.x + t * dx, y: start.y + t * dy })
    )
  })
}
