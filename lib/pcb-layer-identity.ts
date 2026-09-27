import type { AltiumPcbDocument } from "./altium-pcb-document"
import { getAltiumPcbLayerName } from "./parser/parse-altium-binary-pcb-primitives"
import type { AltiumPcbLayerStackEntry } from "./pcb-layer-stack"
import {
  isKnownAltiumPcbLayerName,
  normalizeAltiumPcbLayerName,
} from "./pcb-layers"
import { AltiumBoardRecord } from "./records/altium-board-record"

const OTHER_LAYER_NAMES: Readonly<Record<number, string>> = {
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

export function getCanonicalLayerNameFromStackId(
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
  if (family === 0x102 && ordinal >= 1 && ordinal <= 32) {
    return `MECHANICAL${ordinal}`
  }
  if (family === 0x103) return OTHER_LAYER_NAMES[ordinal]
  return undefined
}

export function getPcbDocumentLayerStackEntries(
  document: AltiumPcbDocument,
): AltiumPcbLayerStackEntry[] {
  return document.records.flatMap((record) =>
    record instanceof AltiumBoardRecord ? record.layerStack.entries : [],
  )
}

export function getPcbStackEntryLayerName(
  entry: AltiumPcbLayerStackEntry,
): string | undefined {
  if (entry.source === "legacy") {
    const name = getAltiumPcbLayerName(entry.index)
    return isKnownAltiumPcbLayerName(name)
      ? getPcbLayerIdentity(name)
      : undefined
  }
  if (entry.layerId !== undefined) {
    return getCanonicalLayerNameFromStackId(entry.layerId)
  }
  // Older/incomplete stack declarations may only carry a standard name.
  return entry.name && isKnownAltiumPcbLayerName(entry.name)
    ? getPcbLayerIdentity(entry.name)
    : undefined
}

/** Resolve display names without conflating duplicate labels or native IDs. */
export function createPcbLayerNameResolver(
  entries: readonly AltiumPcbLayerStackEntry[],
): (name: string) => string {
  const aliases = new Map<string, string | undefined>()
  for (const entry of entries) {
    const canonical = getPcbStackEntryLayerName(entry)
    if (!canonical || !entry.name?.trim()) continue
    const alias = getPcbLayerIdentity(entry.name)
    if (isKnownAltiumPcbLayerName(alias)) continue
    if (!aliases.has(alias)) aliases.set(alias, canonical)
    else if (aliases.get(alias) !== canonical) aliases.set(alias, undefined)
  }
  return (name) => {
    const key = getPcbLayerIdentity(name)
    return aliases.get(key) ?? key
  }
}

export function getPcbLayerIdentity(layerName: string): string {
  const normalizedLayerName = normalizeAltiumPcbLayerName(layerName)
  if (normalizedLayerName === "TOPLAYER") return "TOP"
  if (normalizedLayerName === "BOTTOMLAYER") return "BOTTOM"
  if (normalizedLayerName === "KEEPOUTLAYER") return "KEEPOUT"
  if (normalizedLayerName === "DRCERROR") return "DRCERRORMARKERS"

  const midLayerMatch = /^(?:MID|MIDLAYER)(\d{1,2})$/u.exec(normalizedLayerName)
  if (midLayerMatch) return `MID${midLayerMatch[1]}`

  const planeLayerMatch = /^(?:PLANE|INTERNALPLANE)(\d{1,2})$/u.exec(
    normalizedLayerName,
  )
  if (planeLayerMatch) return `INTERNALPLANE${planeLayerMatch[1]}`

  return normalizedLayerName
}
