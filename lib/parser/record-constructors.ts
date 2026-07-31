import { AltiumArcRecord } from "../records/altium-arc-record"
import { AltiumBoardRecord } from "../records/altium-board-record"
import { AltiumComponentRecord } from "../records/altium-component-record"
import { AltiumNetRecord } from "../records/altium-net-record"
import { AltiumPadRecord } from "../records/altium-pad-record"
import { AltiumPolygonRecord } from "../records/altium-polygon-record"
import type { AltiumRecord, AltiumRecordInit } from "../records/altium-record"
import { AltiumRegionRecord } from "../records/altium-region-record"
import { AltiumTextRecord } from "../records/altium-text-record"
import { AltiumTrackRecord } from "../records/altium-track-record"
import { AltiumViaRecord } from "../records/altium-via-record"

export type AltiumRecordConstructor = new (
  init?: AltiumRecordInit,
) => AltiumRecord

export const recordConstructors = new Map<string, AltiumRecordConstructor>([
  ["Arc", AltiumArcRecord],
  ["Board", AltiumBoardRecord],
  ["BoardRegion", AltiumRegionRecord],
  ["Component", AltiumComponentRecord],
  ["Net", AltiumNetRecord],
  ["Pad", AltiumPadRecord],
  ["Polygon", AltiumPolygonRecord],
  ["Region", AltiumRegionRecord],
  ["RegionFill", AltiumRegionRecord],
  ["Text", AltiumTextRecord],
  ["Track", AltiumTrackRecord],
  ["Via", AltiumViaRecord],
])
