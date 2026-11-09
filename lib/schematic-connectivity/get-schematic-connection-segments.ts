import { getSchematicIndexedPoints } from "../geometry/get-schematic-indexed-points"
import { getSchematicCoordinate } from "../measurement/schematic-coordinate"
import type { AltiumRecord } from "../records/altium-record"
import type { SchematicConnectionSegment } from "./types"

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
      ) {
        continue
      }
      const orientation =
        (conglomerate ?? record.getNumber("ORIENTATION") ?? 0) & 3
      const length = getSchematicCoordinate(record, {
        key: "PINLENGTH",
        fallback: 10,
      })
      const point = {
        x:
          getSchematicCoordinate(record, { key: "LOCATION.X" }) +
          (orientation === 0 ? length : orientation === 2 ? -length : 0),
        y:
          getSchematicCoordinate(record, { key: "LOCATION.Y" }) +
          (orientation === 1 ? length : orientation === 3 ? -length : 0),
      }
      segments.push({ start: point, end: point })
    }
  }
  return segments
}
