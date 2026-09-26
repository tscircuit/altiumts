import type { AltiumPcbDocument } from "../altium-pcb-document"
import { getPcbRegionSemanticKind } from "../pcb-contours"
import type { AltiumRecord } from "../records/altium-record"
import {
  getPcbLayerDrawingOrder,
  getPcbLayerDrawingOrderKey,
} from "./get-pcb-layer-drawing-order"

const PCB_RECORD_KIND_PAINT_ORDER: Readonly<Record<string, number>> = {
  ComponentBody: 5,
  Polygon: 10,
  Region: 20,
  Fill: 30,
  Track: 40,
  Arc: 45,
  Pad: 50,
  Via: 60,
  Text: 70,
  Dimension: 75,
  Component: 80,
}

export function sortPcbRecordsForPainting({
  currentLayer,
  document,
  layerDrawingOrder,
  records,
}: {
  currentLayer?: string
  document: AltiumPcbDocument
  layerDrawingOrder?: readonly string[]
  records: AltiumRecord[]
}): AltiumRecord[] {
  const layerGroups = getPcbLayerDrawingOrder({
    currentLayer,
    document,
    layerDrawingOrder,
  })
  const layerPaintPriorities = getLayerPaintPriorities(layerGroups)

  return records.toSorted((leftRecord, rightRecord) => {
    const layerOrderDifference =
      getPcbRecordLayerPaintOrder(leftRecord, layerPaintPriorities) -
      getPcbRecordLayerPaintOrder(rightRecord, layerPaintPriorities)
    if (layerOrderDifference !== 0) return layerOrderDifference

    return (
      getPcbRecordKindPaintOrder(leftRecord) -
      getPcbRecordKindPaintOrder(rightRecord)
    )
  })
}

function getLayerPaintPriorities(
  layerGroups: string[][],
): Readonly<Record<string, number>> {
  const priorities: Record<string, number> = {}

  for (const [groupIndex, layerNames] of layerGroups.entries()) {
    const paintPriority = layerGroups.length - groupIndex
    for (const layerName of layerNames) {
      const layerDrawingOrderKey = getPcbLayerDrawingOrderKey(layerName)
      // Current Layer also belongs to its ordinary Altium category. Preserve
      // its first, higher-priority occurrence in the drawing-order list.
      priorities[layerDrawingOrderKey] ??= paintPriority
    }
  }

  return priorities
}

function getPcbRecordLayerPaintOrder(
  record: AltiumRecord,
  layerPaintPriorities: Readonly<Record<string, number>>,
): number {
  const layerName = getEffectiveRecordLayerName(record)
  return layerPaintPriorities[getPcbLayerDrawingOrderKey(layerName)] ?? 0
}

function getEffectiveRecordLayerName(record: AltiumRecord): string {
  const layerName = record.getCaseInsensitive("LAYER")
  if (layerName) return layerName
  if (record.recordKind === "Pad" || record.recordKind === "Via") {
    return "MULTILAYER"
  }
  if (record.recordKind === "Component") return "SELECTIONS"
  return "BACKGROUND"
}

function getPcbRecordKindPaintOrder(record: AltiumRecord): number {
  if (
    record.recordKind === "Region" &&
    getPcbRegionSemanticKind(record) === "POLYGON_CUTOUT"
  ) {
    return 15
  }
  return PCB_RECORD_KIND_PAINT_ORDER[record.recordKind ?? ""] ?? 100
}
