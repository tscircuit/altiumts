import {
  isAltiumPcbCopperLayerName,
  normalizeAltiumPcbLayerName,
} from "../pcb-layers"
import type { AltiumPcbLayerStack } from "../pcb-layer-stack"
import type { AltiumRecord } from "../records/altium-record"

export const PCB_BOARD_FILL_COLOR = "#123d32"
export const PCB_BOARD_OUTLINE_COLOR = "#6ee7b7"
const BOTTOM_COURTYARD_COLOR = "#26e9ff"
const MECHANICAL_LAYER_COLOR = "#ec4899"

const LAYER_COLORS: Record<string, string> = {
  BOTTOM: "#3b82f6",
  BOTTOMOVERLAY: "#fde68a",
  BOTTOMPASTE: "#94a3b8",
  BOTTOMSOLDER: "#22c55e",
  KEEPOUT: "#a855f7",
  MULTILAYER: "#22c55e",
  TOP: "#ef4444",
  TOPOVERLAY: "#f8fafc",
  TOPPASTE: "#cbd5e1",
  TOPSOLDER: "#4ade80",
}

export const normalizeLayerName = normalizeAltiumPcbLayerName

export function getPcbLayerColor(layer: string | undefined): string {
  if (!layer) return "#f59e0b"
  const normalized = normalizeLayerName(layer)
  if (normalized === "MECHANICAL16") return BOTTOM_COURTYARD_COLOR
  if (normalized.startsWith("MECHANICAL")) return MECHANICAL_LAYER_COLOR
  if (normalized.startsWith("MID") || normalized.startsWith("INTERNALPLANE")) {
    return "#f97316"
  }
  return LAYER_COLORS[normalized] ?? "#f59e0b"
}

export function recordAppliesToLayers(
  record: AltiumRecord,
  requestedLayers: string[] | undefined,
  layerStack?: AltiumPcbLayerStack,
): boolean {
  if (!requestedLayers || requestedLayers.length === 0) return true

  const normalizedRequested = new Set(requestedLayers.map(normalizeLayerName))
  if (record.recordKind === "Via") {
    const recordLayer = record.getCaseInsensitive("LAYER")
    if (recordLayer && normalizeLayerName(recordLayer) !== "MULTILAYER") {
      return normalizedRequested.has(normalizeLayerName(recordLayer))
    }
    return viaAppliesToLayers(record, normalizedRequested, layerStack)
  }

  const recordLayer = record.getCaseInsensitive("LAYER")
  if (recordLayer) {
    const normalizedRecordLayer = normalizeLayerName(recordLayer)
    if (normalizedRequested.has(normalizedRecordLayer)) return true
    if (
      normalizedRecordLayer === "MULTILAYER" &&
      [...normalizedRequested].some((layer) =>
        isAltiumPcbCopperLayerName(layer, layerStack),
      )
    ) {
      return true
    }
    return false
  }

  return record.recordKind === "Board"
}

function viaAppliesToLayers(
  record: AltiumRecord,
  requestedLayers: ReadonlySet<string>,
  layerStack: AltiumPcbLayerStack | undefined,
): boolean {
  const requestedCopperLayers = [...requestedLayers].filter((layer) =>
    isAltiumPcbCopperLayerName(layer, layerStack),
  )
  if (requestedCopperLayers.length === 0) return false
  if (requestedLayers.has("MULTILAYER")) return true

  const startLayer = getViaLayer(record, "STARTLAYER", "FROMLAYER")
  const endLayer = getViaLayer(record, "ENDLAYER", "TOLAYER", "STOPLAYER")
  if (!startLayer || !endLayer) return true

  return requestedCopperLayers.some((requestedLayer) =>
    isLayerWithinViaSpan(requestedLayer, startLayer, endLayer, layerStack),
  )
}

function getViaLayer(
  record: AltiumRecord,
  ...fieldNames: string[]
): string | undefined {
  for (const fieldName of fieldNames) {
    const value = record.getCaseInsensitive(fieldName)
    if (value) return normalizeLayerName(value)
  }
  return undefined
}

function isLayerWithinViaSpan(
  requestedLayer: string,
  startLayer: string,
  endLayer: string,
  layerStack: AltiumPcbLayerStack | undefined,
): boolean {
  if (requestedLayer === startLayer || requestedLayer === endLayer) return true

  const stackPositions = getStackLayerPositions(layerStack)
  const requestedPosition = stackPositions.get(requestedLayer)
  const startPosition = stackPositions.get(startLayer)
  const endPosition = stackPositions.get(endLayer)
  if (
    requestedPosition !== undefined &&
    startPosition !== undefined &&
    endPosition !== undefined
  ) {
    return isBetween(requestedPosition, startPosition, endPosition)
  }

  const requestedOrdinal = getSignalLayerOrdinal(requestedLayer)
  const startOrdinal = getSignalLayerOrdinal(startLayer)
  const endOrdinal = getSignalLayerOrdinal(endLayer)
  if (
    requestedOrdinal !== undefined &&
    startOrdinal !== undefined &&
    endOrdinal !== undefined
  ) {
    return isBetween(requestedOrdinal, startOrdinal, endOrdinal)
  }

  return false
}

function getStackLayerPositions(
  layerStack: AltiumPcbLayerStack | undefined,
): Map<string, number> {
  const positions = new Map<string, number>()
  for (const entry of layerStack?.entries ?? []) {
    const aliases = [entry.name, getCanonicalLayerName(entry.layerId)]
    for (const alias of aliases) {
      if (alias) positions.set(normalizeLayerName(alias), entry.index)
    }
  }
  return positions
}

function getCanonicalLayerName(
  layerId: string | undefined,
): string | undefined {
  const numericLayerId = Number(layerId)
  if (!Number.isSafeInteger(numericLayerId)) return undefined
  const family = Math.floor(numericLayerId / 0x1_0000)
  const ordinal = numericLayerId % 0x1_0000
  if (family === 0x100) {
    if (ordinal === 1) return "TOP"
    if (ordinal >= 2 && ordinal <= 31) return `MID${ordinal - 1}`
    if (ordinal === 0xffff) return "BOTTOM"
  }
  if (family === 0x101 && ordinal >= 1 && ordinal <= 16) {
    return `INTERNALPLANE${ordinal}`
  }
  return undefined
}

function getSignalLayerOrdinal(layer: string): number | undefined {
  if (layer === "TOP" || layer === "TOPLAYER") return 0
  if (layer === "BOTTOM" || layer === "BOTTOMLAYER") return 31
  const match = /^(?:MID|MIDLAYER)(\d{1,2})$/u.exec(layer)
  if (!match) return undefined
  const ordinal = Number(match[1])
  return ordinal >= 1 && ordinal <= 30 ? ordinal : undefined
}

function isBetween(value: number, first: number, second: number): boolean {
  return value >= Math.min(first, second) && value <= Math.max(first, second)
}
