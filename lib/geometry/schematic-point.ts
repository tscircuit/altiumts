import { getSchematicCoordinate } from "../measurement/schematic-coordinate"
import type { AltiumRecord } from "../records/altium-record"
import type { AltiumPoint } from "./altium-geometry"

/** Read a point with omitted zero axes, or undefined when no axis is present. */
export function getSchematicPoint(
  record: AltiumRecord,
  { xKey, yKey }: { xKey: string; yKey: string },
): AltiumPoint | undefined {
  if (
    [xKey, `${xKey}_FRAC`, yKey, `${yKey}_FRAC`].every(
      (key) => record.getCaseInsensitive(key) === undefined,
    )
  )
    return undefined
  return {
    x: getSchematicCoordinate(record, { key: xKey }),
    y: getSchematicCoordinate(record, { key: yKey }),
  }
}
