import type { AltiumPcbDocument } from "./altium-pcb-document"
import type {
  AltiumPcbLayerStack,
  AltiumPcbLayerStackEntry,
} from "./pcb-layer-stack"
import { AltiumBoardRecord } from "./records/altium-board-record"

export type NormalizedAltiumPcbLayerName = string

export type AltiumPcbLayerAliasMap = ReadonlyMap<
  NormalizedAltiumPcbLayerName,
  NormalizedAltiumPcbLayerName
>

const OTHER_SYSTEM_LAYER_NAMES: Readonly<
  Record<number, NormalizedAltiumPcbLayerName>
> = {
  6: "TOPOVERLAY",
  7: "BOTTOMOVERLAY",
  8: "TOPPASTE",
  9: "BOTTOMPASTE",
  10: "TOPSOLDER",
  11: "BOTTOMSOLDER",
  12: "DRILLGUIDE",
  13: "KEEPOUT",
  14: "DRILLDRAWING",
  15: "MULTILAYER",
  16: "CONNECTIONS",
  17: "BACKGROUND",
  18: "DRCERRORMARKERS",
  19: "SELECTIONS",
  20: "VISIBLEGRID1",
  21: "VISIBLEGRID2",
  22: "PADHOLES",
  23: "VIAHOLES",
  24: "TOPPADMASTER",
  25: "BOTTOMPADMASTER",
  26: "DRCDETAILMARKERS",
}

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

/**
 * Returns a stable key for names that Altium uses for the same system layer.
 *
 * Binary PcbDoc streams can mix legacy names such as `MID-LAYER1` with their
 * modern aliases such as `MID1`. Those are labels for one physical layer, not
 * separate layers.
 */
export function getAltiumPcbLayerAliasKey(
  layer: string,
  layerAliases?: AltiumPcbLayerAliasMap,
): NormalizedAltiumPcbLayerName {
  const normalizedLayerName = normalizeAltiumPcbLayerName(layer)
  let aliasKey = normalizedLayerName
  if (normalizedLayerName === "TOPLAYER") aliasKey = "TOP"
  if (normalizedLayerName === "BOTTOMLAYER") aliasKey = "BOTTOM"
  if (normalizedLayerName === "KEEPOUTLAYER") aliasKey = "KEEPOUT"
  if (normalizedLayerName === "DRCERROR") aliasKey = "DRCERRORMARKERS"

  const midLayerMatch = /^(?:MID|MIDLAYER)(\d{1,2})$/u.exec(normalizedLayerName)
  if (midLayerMatch) aliasKey = `MID${midLayerMatch[1]}`

  const planeLayerMatch = /^(?:PLANE|INTERNALPLANE)(\d{1,2})$/u.exec(
    normalizedLayerName,
  )
  if (planeLayerMatch) aliasKey = `INTERNALPLANE${planeLayerMatch[1]}`

  return (
    layerAliases?.get(aliasKey) ??
    layerAliases?.get(normalizedLayerName) ??
    aliasKey
  )
}

export function getAltiumPcbLayerAliasMap(
  layerStackEntries: readonly AltiumPcbLayerStackEntry[],
): AltiumPcbLayerAliasMap {
  const layerAliases = new Map<
    NormalizedAltiumPcbLayerName,
    NormalizedAltiumPcbLayerName
  >()
  for (const entry of layerStackEntries) {
    const systemLayerName = getAltiumPcbSystemLayerNameFromId(entry.layerId)
    if (!systemLayerName) continue
    layerAliases.set(systemLayerName, systemLayerName)
    if (entry.name) {
      layerAliases.set(normalizeAltiumPcbLayerName(entry.name), systemLayerName)
    }
  }
  return layerAliases
}

export function getAltiumPcbDocumentLayerStackEntries(
  document: AltiumPcbDocument,
): AltiumPcbLayerStackEntry[] {
  return document.records.flatMap((record) =>
    record instanceof AltiumBoardRecord ? record.layerStack.entries : [],
  )
}

export function getAltiumPcbSystemLayerNameFromId(
  layerId: number | string | undefined,
): NormalizedAltiumPcbLayerName | undefined {
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
  if (family === 0x102 && ordinal >= 1 && ordinal <= 32) {
    return `MECHANICAL${ordinal}`
  }
  if (family === 0x103) return OTHER_SYSTEM_LAYER_NAMES[ordinal]
  return undefined
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
