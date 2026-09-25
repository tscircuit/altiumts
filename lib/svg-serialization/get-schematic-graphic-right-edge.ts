import { approximateAltiumArc } from "../geometry/approximateAltiumArc"
import type { AltiumRecord } from "../records/altium-record"
import {
  getSchematicCoordinate,
  getSchematicIndexedPoints,
} from "./altium-values"

/** Right edge in the definition's local coordinates, before port rotation. */
export function getSchematicGraphicRightEdge(record: AltiumRecord): number {
  const x = getSchematicCoordinate(record, "LOCATION.X", 0)
  switch (record.recordKind) {
    case "5":
    case "6":
    case "7":
      return Math.max(0, ...getSchematicIndexedPoints(record).map((p) => p.x))
    case "8":
      return x + getSchematicCoordinate(record, "RADIUS", 1)
    case "11":
    case "12":
      return Math.max(
        ...approximateAltiumArc({
          center: { x, y: getSchematicCoordinate(record, "LOCATION.Y", 0) },
          radius: getSchematicCoordinate(record, "RADIUS", 1),
          startAngleDegrees: record.getNumber("STARTANGLE") ?? 0,
          endAngleDegrees: record.getNumber("ENDANGLE") ?? 360,
        }).map((p) => p.x),
      )
    default:
      return Math.max(x, getSchematicCoordinate(record, "CORNER.X", x))
  }
}
