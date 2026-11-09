import { altiumPointsEqual } from "../geometry/altium-geometry"
import type { SchematicConnectionSegment } from "./types"

export function isPointConnectedToSchematicSegments(
  point: { x: number; y: number },
  segments: SchematicConnectionSegment[],
): boolean {
  return segments.some(({ start, end }) => {
    if (altiumPointsEqual(point, start) || altiumPointsEqual(point, end)) {
      return true
    }
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
