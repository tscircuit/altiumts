import type { AltiumPadRecord } from "../records/altium-pad-record"
import { normalizeLayerName } from "./normalizeLayerName"

export function getRequestedPadLayerOrdinal({
  record,
  requestedLayers,
}: {
  record: AltiumPadRecord
  requestedLayers: readonly string[] | undefined
}): number {
  const requestedLayer =
    requestedLayers?.length === 1
      ? normalizeLayerName(requestedLayers[0])
      : normalizeLayerName(record.layer)
  if (requestedLayer === "BOTTOM" || requestedLayer === "BOTTOMSOLDER") {
    return 31
  }
  if (requestedLayer === "TOP" || requestedLayer === "TOPSOLDER") return 0

  const innerLayerMatch = /^(?:MIDLAYER|MID|INTERNALPLANE)(\d+)$/u.exec(
    requestedLayer,
  )
  if (!innerLayerMatch?.[1]) return 0
  return Math.min(Math.max(Number(innerLayerMatch[1]), 1), 30)
}
