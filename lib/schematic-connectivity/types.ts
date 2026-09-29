import type { AltiumPoint } from "../geometry/altium-geometry"

export interface SchematicConnectionSegment {
  end: AltiumPoint
  start: AltiumPoint
}

export interface SchematicPortDirection {
  pointAtEnd: boolean
  pointAtStart: boolean
  vertical: boolean
}
