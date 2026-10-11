import type { AltiumRecord } from "../records/altium-record"
import type { AltiumPoint } from "./altium-geometry"
import { getSchematicPoint } from "./schematic-point"

export function getSchematicIndexedPoints(record: AltiumRecord): AltiumPoint[] {
  const points: AltiumPoint[] = []
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
