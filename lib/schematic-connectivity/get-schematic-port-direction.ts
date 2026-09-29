import { getSchematicCoordinate } from "../measurement/schematic-coordinate"
import type { AltiumRecord } from "../records/altium-record"
import { isPointConnectedToSchematicSegments } from "./is-point-connected-to-schematic-segments"
import type {
  SchematicConnectionSegment,
  SchematicPortDirection,
} from "./types"

/** Port styles 0–3 are horizontal; 4–7 are their vertical counterparts. */
export function getSchematicPortDirection({
  record,
  segments,
  width,
}: {
  record: AltiumRecord
  segments: SchematicConnectionSegment[]
  width: number
}): SchematicPortDirection {
  const style = record.getNumber("STYLE") ?? 0
  const vertical = style >= 4 && style <= 7
  const start = {
    x: getSchematicCoordinate(record, { key: "LOCATION.X" }),
    y: getSchematicCoordinate(record, { key: "LOCATION.Y" }),
  }
  const end = {
    x: start.x + (vertical ? 0 : width),
    y: start.y + (vertical ? width : 0),
  }
  const ioType = record.getNumber("IOTYPE") ?? 0

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

  const startConnected = isPointConnectedToSchematicSegments(start, segments)
  const endConnected = isPointConnectedToSchematicSegments(end, segments)
  const connectedAtEnd = endConnected && !startConnected
  const pointAtStart = ioType === 1 ? connectedAtEnd : !connectedAtEnd
  return { vertical, pointAtStart, pointAtEnd: !pointAtStart }
}
