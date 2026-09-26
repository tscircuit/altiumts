import {
  type AltiumPcbDocument,
  type AltiumPcbLayerStackEntry,
  createPcbLayerNameResolver,
  getPcbDocumentLayerStackEntries,
  getPcbLayerIdentity,
  getPcbStackEntryLayerName,
} from "../../lib"
import type { ProjectDocumentView } from "./project-viewer-types"

const SOURCE_PRIORITY = { v8: 0, v7: 1, legacy: 2 }
const SURFACE_LAYERS = new Set([
  "TOPOVERLAY",
  "BOTTOMOVERLAY",
  "TOPPASTE",
  "BOTTOMPASTE",
  "TOPSOLDER",
  "BOTTOMSOLDER",
  "DRILLGUIDE",
  "DRILLDRAWING",
  "KEEPOUT",
])

/** Use physical IDs for selection; names are presentation metadata. */
export function getPcbLayerViews(
  document: AltiumPcbDocument,
): ProjectDocumentView[] {
  const entries = getPcbDocumentLayerStackEntries(document).sort(
    (a, b) =>
      SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source] ||
      a.index - b.index,
  )
  const resolveLayerName = createPcbLayerNameResolver(entries)
  const occupied = new Map<string, string>()
  for (const record of document.records) {
    const name = record.getCaseInsensitive("LAYER")?.trim()
    if (!name || /^(?:UNKNOWN|NOLAYER|LAYER255)$/iu.test(name)) continue
    const layer = resolveLayerName(name)
    if (!occupied.has(layer)) occupied.set(layer, name)
  }

  const byLayer = new Map<string, AltiumPcbLayerStackEntry>()
  for (const entry of entries) {
    const layer = getPcbStackEntryLayerName(entry)
    if (layer && !byLayer.has(layer)) byLayer.set(layer, entry)
  }

  const views = new Map<string, ProjectDocumentView>()
  const add = (layer: string) => {
    if (views.has(layer)) return
    const name =
      byLayer.get(layer)?.name?.trim() || occupied.get(layer) || layer
    views.set(layer, {
      id: `layer:${layer}`,
      label: formatLayerName(layer, name),
      layer,
    })
  }

  for (const entry of getPhysicalCopperEntries(entries)) {
    const layer = getPcbStackEntryLayerName(entry)
    if (layer) add(layer)
  }
  for (const layer of [...occupied.keys()]
    .filter(isCopper)
    .sort(compareFallbackLayers)) {
    add(layer)
  }
  for (const [layer, entry] of byLayer) {
    if (isCopper(layer)) continue
    if (
      occupied.has(layer) ||
      entry.mechanicalEnabled === true ||
      (entry.mechanicalEnabled !== false && SURFACE_LAYERS.has(layer))
    )
      add(layer)
  }
  // Preserve occupied layers even if stack metadata is missing or disabled.
  // Do not truncate: an arbitrary cap can hide real fabrication layers.
  for (const layer of [...occupied.keys()].sort(compareFallbackLayers))
    add(layer)
  return [...views.values()]
}

function getPhysicalCopperEntries(
  entries: AltiumPcbLayerStackEntry[],
): AltiumPcbLayerStackEntry[] {
  const copper = entries.filter((entry) =>
    isCopper(getPcbStackEntryLayerName(entry) ?? ""),
  )
  const source = copper[0]?.source
  const candidates = copper.filter((entry) => entry.source === source)
  if (source === "v8") return candidates
  if (
    !candidates.some(
      (entry) => entry.next !== undefined || entry.previous !== undefined,
    )
  ) {
    return candidates
  }

  const reference = (entry: AltiumPcbLayerStackEntry) =>
    source === "legacy" ? String(entry.index) : entry.layerId
  const byReference = new Map<string, AltiumPcbLayerStackEntry>()
  for (const entry of candidates) {
    const id = reference(entry)
    if (id !== undefined) byReference.set(id, entry)
  }
  const lookup = (id: string | undefined) =>
    id === undefined ? undefined : byReference.get(id)
  const ordered: AltiumPcbLayerStackEntry[] = []
  const seen = new Set<AltiumPcbLayerStackEntry>()
  let entry =
    candidates.find((item) => getPcbStackEntryLayerName(item) === "TOP") ??
    candidates.find((item) => !lookup(item.previous) && lookup(item.next))
  while (entry && !seen.has(entry)) {
    seen.add(entry)
    ordered.push(entry)
    const currentReference = reference(entry)
    entry =
      entry.next !== undefined
        ? lookup(entry.next)
        : candidates.find(
            (item) =>
              currentReference !== undefined &&
              item.previous === currentReference,
          )
  }
  return ordered
}

function isCopper(layer: string): boolean {
  return /^(?:TOP|BOTTOM|MID\d+|INTERNALPLANE\d+)$/u.test(layer)
}

function compareFallbackLayers(left: string, right: string): number {
  const priority = (layer: string) => {
    if (layer === "TOP") return 0
    if (/^(?:MID|INTERNALPLANE)\d+$/u.test(layer)) return 1
    if (layer === "BOTTOM") return 2
    if (SURFACE_LAYERS.has(layer)) return 3
    if (layer === "MULTILAYER") return 4
    return 5
  }
  return (
    priority(left) - priority(right) ||
    left.localeCompare(right, undefined, { numeric: true })
  )
}

function formatLayerName(layer: string, name: string): string {
  // Keep existing friendly labels for default names, and custom names verbatim.
  if (getPcbLayerIdentity(name) !== layer) return name
  const knownNames: Record<string, string> = {
    BOTTOM: "Bottom copper",
    BOTTOMOVERLAY: "Bottom overlay",
    BOTTOMPASTE: "Bottom paste",
    BOTTOMSOLDER: "Bottom solder mask",
    KEEPOUT: "Keepout",
    MULTILAYER: "Multi-layer",
    TOP: "Top copper",
    TOPOVERLAY: "Top overlay",
    TOPPASTE: "Top paste",
    TOPSOLDER: "Top solder mask",
  }
  return knownNames[layer] ?? name.replace(/([a-z])([A-Z])/gu, "$1 $2")
}
