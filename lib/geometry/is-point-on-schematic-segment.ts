import type { AltiumPoint } from "./altium-geometry"

export function isPointOnSchematicSegment({
  point,
  start,
  end,
}: {
  point: AltiumPoint
  start: AltiumPoint
  end: AltiumPoint
}): boolean {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  // Shared vertices already connect by their coordinate key. A repeated
  // vertex must not make every point appear to lie on a zero-length segment.
  if (lengthSquared === 0) return false
  const cross = (point.x - start.x) * dy - (point.y - start.y) * dx
  const tolerance = 0.000001 * Math.max(Math.abs(dx), Math.abs(dy))
  if (Math.abs(cross) > tolerance) return false
  const dot = (point.x - start.x) * dx + (point.y - start.y) * dy
  return dot >= -tolerance && dot <= lengthSquared + tolerance
}
