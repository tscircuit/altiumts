import type { AltiumPcbDocument } from "../../lib"
import {
  type AltiumPcbLayerStackEntry,
  getAltiumPcbDocumentLayerStackEntries,
  getAltiumPcbLayerAliasKey,
  getAltiumPcbLayerAliasMap,
  getAltiumPcbSystemLayerNameFromId,
  type NormalizedAltiumPcbLayerName,
} from "../../lib"
import type {
  ProjectDocumentView,
  ProjectPcbViewGroup,
} from "./project-viewer-types"

interface PcbLayerViewCandidate {
  layer: NormalizedAltiumPcbLayerName
  primitiveCount: number
  stackEntry?: AltiumPcbLayerStackEntry
}

const VIEW_GROUP_ORDER: ProjectPcbViewGroup[] = [
  "copper",
  "solder_mask",
  "paste_mask",
  "silkscreen",
  "mechanical",
  "other",
]

const OTHER_LAYER_ORDER: Readonly<
  Partial<Record<NormalizedAltiumPcbLayerName, number>>
> = {
  MULTILAYER: 0,
  DRILLGUIDE: 1,
  KEEPOUT: 2,
  DRILLDRAWING: 3,
}

export function getPcbLayerViews(
  document: AltiumPcbDocument,
): ProjectDocumentView[] {
  const layerStackEntries = getAltiumPcbDocumentLayerStackEntries(document)
  const layerAliases = getAltiumPcbLayerAliasMap(layerStackEntries)
  const candidates = new Map<
    NormalizedAltiumPcbLayerName,
    PcbLayerViewCandidate
  >()

  for (const stackEntry of layerStackEntries) {
    const layer = getAltiumPcbSystemLayerNameFromId(stackEntry.layerId)
    if (!layer || !getPcbViewGroup(layer)) continue
    const candidate = candidates.get(layer) ?? { layer, primitiveCount: 0 }
    if (isPreferredStackEntry(stackEntry, candidate.stackEntry)) {
      candidate.stackEntry = stackEntry
    }
    candidates.set(layer, candidate)
  }

  for (const record of document.records) {
    const recordLayer = record.getCaseInsensitive("LAYER")?.trim()
    if (!recordLayer || recordLayer.toUpperCase() === "UNKNOWN") continue
    const layer = getAltiumPcbLayerAliasKey(recordLayer, layerAliases)
    if (!getPcbViewGroup(layer)) continue
    const candidate = candidates.get(layer) ?? { layer, primitiveCount: 0 }
    candidate.primitiveCount += 1
    candidates.set(layer, candidate)
  }

  return [...candidates.values()]
    .filter(isVisibleLayerCandidate)
    .sort(compareLayerCandidates)
    .map(({ layer, primitiveCount, stackEntry }) => ({
      group: getPcbViewGroup(layer),
      hasPrimitives: primitiveCount > 0,
      id: `layer:${layer}`,
      label: stackEntry?.name?.trim() || getFallbackLayerLabel(layer),
      layer,
    }))
}

function isPreferredStackEntry(
  candidate: AltiumPcbLayerStackEntry,
  current: AltiumPcbLayerStackEntry | undefined,
): boolean {
  if (!current) return true
  return getStackEntryPreference(candidate) > getStackEntryPreference(current)
}

function getStackEntryPreference(entry: AltiumPcbLayerStackEntry): number {
  const sourcePreference = { legacy: 1, v7: 2, v8: 3 }[entry.source]
  return (
    sourcePreference * 10 +
    (entry.name ? 4 : 0) +
    (entry.mechanicalEnabled === true ? 2 : 0) +
    (entry.usedByPrimitives === true ? 1 : 0)
  )
}

function isVisibleLayerCandidate({
  layer,
  primitiveCount,
  stackEntry,
}: PcbLayerViewCandidate): boolean {
  if (primitiveCount > 0) return true
  const group = getPcbViewGroup(layer)
  if (group === "mechanical") return stackEntry?.mechanicalEnabled === true
  return stackEntry !== undefined
}

function compareLayerCandidates(
  left: PcbLayerViewCandidate,
  right: PcbLayerViewCandidate,
): number {
  const leftGroup = getPcbViewGroup(left.layer)
  const rightGroup = getPcbViewGroup(right.layer)
  if (!leftGroup || !rightGroup) return left.layer.localeCompare(right.layer)
  return (
    VIEW_GROUP_ORDER.indexOf(leftGroup) -
      VIEW_GROUP_ORDER.indexOf(rightGroup) ||
    getLayerOrder(left) - getLayerOrder(right) ||
    left.layer.localeCompare(right.layer, undefined, { numeric: true })
  )
}

function getLayerOrder(candidate: PcbLayerViewCandidate): number {
  const { layer, stackEntry } = candidate
  const group = getPcbViewGroup(layer)
  if (group === "copper") {
    if (stackEntry) return stackEntry.index
    if (layer === "TOP") return 0
    if (layer === "BOTTOM") return 1_000
    return getLayerOrdinal(layer) ?? 500
  }
  if (group === "mechanical") return getLayerOrdinal(layer) ?? 1_000
  if (group === "other") return OTHER_LAYER_ORDER[layer] ?? 1_000
  return layer.startsWith("TOP") ? 0 : 1
}

function getPcbViewGroup(
  layer: NormalizedAltiumPcbLayerName,
): ProjectPcbViewGroup | undefined {
  if (
    layer === "TOP" ||
    layer === "BOTTOM" ||
    /^(?:MID|INTERNALPLANE)\d+$/u.test(layer)
  ) {
    return "copper"
  }
  if (layer === "TOPSOLDER" || layer === "BOTTOMSOLDER") {
    return "solder_mask"
  }
  if (layer === "TOPPASTE" || layer === "BOTTOMPASTE") return "paste_mask"
  if (layer === "TOPOVERLAY" || layer === "BOTTOMOVERLAY") {
    return "silkscreen"
  }
  if (/^MECHANICAL\d+$/u.test(layer)) return "mechanical"
  if (layer in OTHER_LAYER_ORDER) return "other"
  return undefined
}

function getLayerOrdinal(
  layer: NormalizedAltiumPcbLayerName,
): number | undefined {
  const ordinal = /\d+$/u.exec(layer)?.[0]
  return ordinal === undefined ? undefined : Number(ordinal)
}

function getFallbackLayerLabel(layer: NormalizedAltiumPcbLayerName): string {
  const knownLabels: Readonly<
    Partial<Record<NormalizedAltiumPcbLayerName, string>>
  > = {
    BOTTOM: "Bottom Layer",
    BOTTOMOVERLAY: "Bottom Overlay",
    BOTTOMPASTE: "Bottom Paste",
    BOTTOMSOLDER: "Bottom Solder",
    DRILLDRAWING: "Drill Drawing",
    DRILLGUIDE: "Drill Guide",
    KEEPOUT: "Keep-Out Layer",
    MULTILAYER: "Multi-Layer",
    TOP: "Top Layer",
    TOPOVERLAY: "Top Overlay",
    TOPPASTE: "Top Paste",
    TOPSOLDER: "Top Solder",
  }
  const knownLabel = knownLabels[layer]
  if (knownLabel) return knownLabel
  const midLayerOrdinal = /^MID(\d+)$/u.exec(layer)?.[1]
  if (midLayerOrdinal) return `Signal Layer ${midLayerOrdinal}`
  const planeOrdinal = /^INTERNALPLANE(\d+)$/u.exec(layer)?.[1]
  if (planeOrdinal) return `Internal Plane ${planeOrdinal}`
  const mechanicalOrdinal = /^MECHANICAL(\d+)$/u.exec(layer)?.[1]
  if (mechanicalOrdinal) return `Mechanical ${mechanicalOrdinal}`
  return layer
}
