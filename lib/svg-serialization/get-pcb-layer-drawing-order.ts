import type { AltiumPcbDocument } from "../altium-pcb-document"
import {
  getAltiumPcbDocumentLayerStackEntries,
  getAltiumPcbLayerAliasKey,
  getAltiumPcbSystemLayerNameFromId,
  normalizeAltiumPcbLayerName,
} from "../pcb-layers"

type PcbLayerGroup = string[]

const SYSTEM_OVERLAY_LAYER_GROUPS: PcbLayerGroup[] = [
  ["SELECTIONS"],
  ["DRCDETAILMARKERS"],
  ["DRCERRORMARKERS", "DRCERROR"],
  ["PADHOLES"],
  ["VIAHOLES"],
]

const SIGNAL_LAYER_NAMES = [
  "TOP",
  "TOPLAYER",
  ...Array.from({ length: 30 }, (_, index) => `MID${index + 1}`),
  ...Array.from({ length: 30 }, (_, index) => `MIDLAYER${index + 1}`),
  "BOTTOM",
  "BOTTOMLAYER",
]

const INTERNAL_PLANE_LAYER_NAMES = [
  ...Array.from({ length: 16 }, (_, index) => `PLANE${index + 1}`),
  ...Array.from({ length: 16 }, (_, index) => `INTERNALPLANE${index + 1}`),
]

const MECHANICAL_LAYER_NAMES = [
  "TOPPADMASTER",
  "BOTTOMPADMASTER",
  ...Array.from({ length: 32 }, (_, index) => `MECHANICAL${index + 1}`),
]

/**
 * Returns layer groups from front to back. The first group is painted last and
 * appears on top. The default is a top-side view, with the opposite silkscreen
 * behind copper. The active copper layer retains its own higher-priority group
 * and defaults to Top Layer unless the caller supplies another.
 */
export function getPcbLayerDrawingOrder({
  currentLayer,
  document,
  layerDrawingOrder,
  viewSide,
}: {
  currentLayer?: string
  document: AltiumPcbDocument
  layerDrawingOrder?: readonly string[]
  viewSide?: "top" | "bottom"
}): PcbLayerGroup[] {
  if (layerDrawingOrder) {
    const configuredLayerGroups = layerDrawingOrder.map((layerName) => [
      layerName,
    ])
    addLayerStackAliases(document, configuredLayerGroups)
    return configuredLayerGroups
  }

  const signalLayerGroup = [...SIGNAL_LAYER_NAMES]
  const internalPlaneLayerGroup = [...INTERNAL_PLANE_LAYER_NAMES]
  const mechanicalLayerGroup = [...MECHANICAL_LAYER_NAMES]
  const frontOverlay = viewSide === "bottom" ? "BOTTOMOVERLAY" : "TOPOVERLAY"
  const backOverlay = viewSide === "bottom" ? "TOPOVERLAY" : "BOTTOMOVERLAY"
  const layerGroups = [
    ...cloneLayerGroups(SYSTEM_OVERLAY_LAYER_GROUPS),
    ["MULTILAYER"],
    [frontOverlay],
    ["CONNECTIONS"],
    [currentLayer ?? (viewSide === "bottom" ? "BOTTOM" : "TOP")],
    signalLayerGroup,
    [backOverlay],
    ["TOPPASTE"],
    ["BOTTOMPASTE"],
    ["TOPSOLDER"],
    ["BOTTOMSOLDER"],
    internalPlaneLayerGroup,
    ["DRILLGUIDE"],
    ["KEEPOUT", "KEEPOUTLAYER"],
    mechanicalLayerGroup,
    ["DRILLDRAWING"],
    ["VISIBLEGRID1", "VISIBLEGRID2"],
    ["BACKGROUND"],
  ]

  addLayerStackAliases(document, layerGroups)
  mechanicalLayerGroup.push(...getUnknownLayerNames(document, layerGroups))
  return layerGroups
}

function addLayerStackAliases(
  document: AltiumPcbDocument,
  layerGroups: PcbLayerGroup[],
): void {
  for (const entry of getAltiumPcbDocumentLayerStackEntries(document)) {
    if (!entry.name) continue
    const canonicalLayerName = getAltiumPcbSystemLayerNameFromId(entry.layerId)
    if (!canonicalLayerName) continue
    const normalizedEntryName = normalizeAltiumPcbLayerName(entry.name)
    const group = layerGroups.find(
      (layerNames) =>
        layerNames.includes(canonicalLayerName) ||
        layerNames.some(
          (layerName) =>
            normalizeAltiumPcbLayerName(layerName) === normalizedEntryName,
        ),
    )
    if (!group) continue

    if (!group.includes(canonicalLayerName)) group.push(canonicalLayerName)
    if (!group.includes(normalizedEntryName)) group.push(normalizedEntryName)
  }
}

function getUnknownLayerNames(
  document: AltiumPcbDocument,
  knownLayerGroups: PcbLayerGroup[],
): string[] {
  const knownLayerNames = new Set(
    knownLayerGroups.flat().map(getPcbLayerDrawingOrderKey),
  )
  const unknownLayerNames = new Set<string>()

  for (const record of document.records) {
    const layerName = record.getCaseInsensitive("LAYER")
    if (!layerName) continue
    const layerDrawingOrderKey = getPcbLayerDrawingOrderKey(layerName)
    if (!knownLayerNames.has(layerDrawingOrderKey)) {
      unknownLayerNames.add(layerDrawingOrderKey)
    }
  }

  return [...unknownLayerNames].sort((left, right) => left.localeCompare(right))
}

function cloneLayerGroups(layerGroups: PcbLayerGroup[]): PcbLayerGroup[] {
  return layerGroups.map((layerNames) => [...layerNames])
}

export function getPcbLayerDrawingOrderKey(layerName: string): string {
  return getAltiumPcbLayerAliasKey(layerName)
}
