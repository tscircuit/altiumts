import type { AltiumPcbLayerStack } from "./pcb-layer-stack"

export type NormalizedAltiumPcbLayerName = string

const STANDARD_PCB_LAYERS = new Set([
  "BACKGROUND",
  "BOTTOM",
  "BOTTOMLAYER",
  "BOTTOMOVERLAY",
  "BOTTOMPADMASTER",
  "BOTTOMPASTE",
  "BOTTOMSOLDER",
  "CONNECTIONS",
  "DRCDETAILMARKERS",
  "DRCERROR",
  "DRCERRORMARKERS",
  "DRILLDRAWING",
  "DRILLGUIDE",
  "KEEPOUT",
  "KEEPOUTLAYER",
  "MULTILAYER",
  "PADHOLES",
  "SELECTIONS",
  "TOP",
  "TOPLAYER",
  "TOPOVERLAY",
  "TOPPADMASTER",
  "TOPPASTE",
  "TOPSOLDER",
  "VIAHOLES",
  "VISIBLEGRID1",
  "VISIBLEGRID2",
])

export function normalizeAltiumPcbLayerName(
  layer: string,
): NormalizedAltiumPcbLayerName {
  return layer.replace(/[\s_-]/gu, "").toUpperCase()
}

export function isKnownAltiumPcbLayerName(
  layer: string,
  stack?: AltiumPcbLayerStack,
): boolean {
  const normalized = normalizeAltiumPcbLayerName(layer)
  if (STANDARD_PCB_LAYERS.has(normalized)) return true
  if (matchesNumberedLayer(normalized, "MID", 30)) return true
  if (matchesNumberedLayer(normalized, "MIDLAYER", 30)) return true
  if (matchesNumberedLayer(normalized, "PLANE", 16)) return true
  if (matchesNumberedLayer(normalized, "INTERNALPLANE", 16)) return true
  if (matchesNumberedLayer(normalized, "MECHANICAL", 32)) return true

  return (
    stack?.entries.some(({ name }) => {
      if (!name) return false
      const normalizedName = normalizeAltiumPcbLayerName(name)
      return (
        !normalizedName.startsWith("DIELECTRIC") &&
        normalizedName === normalized
      )
    }) ?? false
  )
}

export function isAltiumPcbCopperLayerName(
  layer: string,
  stack?: AltiumPcbLayerStack,
): boolean {
  const normalized = normalizeAltiumPcbLayerName(layer)
  if (
    normalized === "TOP" ||
    normalized === "TOPLAYER" ||
    normalized === "BOTTOM" ||
    normalized === "BOTTOMLAYER" ||
    normalized === "MULTILAYER" ||
    matchesNumberedLayer(normalized, "MID", 30) ||
    matchesNumberedLayer(normalized, "MIDLAYER", 30) ||
    matchesNumberedLayer(normalized, "PLANE", 16) ||
    matchesNumberedLayer(normalized, "INTERNALPLANE", 16)
  ) {
    return true
  }

  const entry = stack?.entries.find(
    ({ name }) =>
      name !== undefined && normalizeAltiumPcbLayerName(name) === normalized,
  )
  const layerId = Number(entry?.layerId)
  if (!Number.isSafeInteger(layerId) || layerId < 0) return false
  const family = Math.floor(layerId / 0x1_0000)
  return family === 0x100 || family === 0x101
}

export function isAltiumPcbNoLayerSentinel(layer: string): boolean {
  const normalized = normalizeAltiumPcbLayerName(layer)
  return normalized === "LAYER255" || normalized === "NOLAYER"
}

function matchesNumberedLayer(
  normalized: string,
  prefix: string,
  maximum: number,
): boolean {
  if (!normalized.startsWith(prefix)) return false
  const number = Number(normalized.slice(prefix.length))
  return Number.isInteger(number) && number >= 1 && number <= maximum
}
