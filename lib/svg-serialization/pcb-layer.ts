import { normalizeAltiumPcbLayerName } from "../pcb-layers"
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
): boolean {
  if (!requestedLayers || requestedLayers.length === 0) return true

  const normalizedRequested = new Set(requestedLayers.map(normalizeLayerName))
  const recordLayer = record.getCaseInsensitive("LAYER")
  if (recordLayer) {
    const normalizedRecordLayer = normalizeLayerName(recordLayer)
    if (normalizedRequested.has(normalizedRecordLayer)) return true
    if (
      normalizedRecordLayer === "MULTILAYER" &&
      [...normalizedRequested].some(isCopperLayer)
    ) {
      return true
    }
    return false
  }

  if (record.recordKind === "Via") {
    return [...normalizedRequested].some(isCopperLayer)
  }

  return record.recordKind === "Board"
}

function isCopperLayer(layer: string): boolean {
  return (
    layer === "TOP" ||
    layer === "BOTTOM" ||
    layer === "MULTILAYER" ||
    layer.startsWith("MID") ||
    layer.startsWith("INTERNALPLANE")
  )
}
