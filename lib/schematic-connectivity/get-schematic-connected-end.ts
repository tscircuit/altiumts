import type { AltiumPoint } from "../geometry/altium-geometry"
import { isPointConnectedToSchematicSegments } from "./is-point-connected-to-schematic-segments"
import type { SchematicConnectionSegment } from "./types"

export function getSchematicConnectedEnd({
  end,
  segments,
  start,
}: {
  end: AltiumPoint
  segments: SchematicConnectionSegment[]
  start: AltiumPoint
}): "end" | "start" | undefined {
  const startConnected = isPointConnectedToSchematicSegments(start, segments)
  const endConnected = isPointConnectedToSchematicSegments(end, segments)
  if (startConnected === endConnected) return undefined
  return endConnected ? "end" : "start"
}
