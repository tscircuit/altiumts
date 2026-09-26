import { AltiumSerializationError } from "../errors/altium-error"
import { normalizeAltiumPcbLayerName } from "../pcb-layers"

const NAMED_PCB_LAYER_IDS: Readonly<Record<string, number>> = {
  BACKGROUND: 76,
  BOTTOM: 32,
  BOTTOMOVERLAY: 34,
  BOTTOMPASTE: 36,
  BOTTOMSOLDER: 38,
  CONNECTIONS: 75,
  DRCERROR: 77,
  DRILLDRAWING: 73,
  DRILLGUIDE: 55,
  KEEPOUT: 56,
  MULTILAYER: 74,
  PADHOLES: 81,
  SELECTIONS: 78,
  TOP: 1,
  TOPOVERLAY: 33,
  TOPPASTE: 35,
  TOPSOLDER: 37,
  VIAHOLES: 82,
  VISIBLEGRID1: 79,
  VISIBLEGRID2: 80,
}

export function getAltiumPcbLayerId(
  layerName: string | undefined,
  fallbackLayerId = 1,
): number {
  if (layerName === undefined) return fallbackLayerId
  const normalizedLayerName = normalizeAltiumPcbLayerName(layerName)
  const namedLayerId = NAMED_PCB_LAYER_IDS[normalizedLayerName]
  if (namedLayerId !== undefined) return namedLayerId

  const ordinalLayerId = getOrdinalAltiumPcbLayerId(normalizedLayerName)
  if (ordinalLayerId !== undefined) return ordinalLayerId
  throw new AltiumSerializationError(
    `Unsupported Altium PCB layer: ${JSON.stringify(layerName)}`,
  )
}

function getOrdinalAltiumPcbLayerId(
  normalizedLayerName: string,
): number | undefined {
  const layerMatch = /^(MID|INTERNALPLANE|MECHANICAL)(\d{1,2})$/u.exec(
    normalizedLayerName,
  )
  const ordinal = Number.parseInt(layerMatch?.[2] ?? "", 10)
  if (!layerMatch || !Number.isInteger(ordinal) || ordinal < 1) {
    return undefined
  }
  if (layerMatch[1] === "MID" && ordinal <= 30) return ordinal + 1
  if (layerMatch[1] === "INTERNALPLANE" && ordinal <= 16) {
    return ordinal + 38
  }
  if (layerMatch[1] === "MECHANICAL" && ordinal <= 16) return ordinal + 56
  if (layerMatch[1] === "MECHANICAL" && ordinal <= 32) return ordinal + 66
  return undefined
}
