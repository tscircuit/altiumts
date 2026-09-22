import type { AltiumPcbDocument } from "../altium-pcb-document"
import { getAltiumPcbPadGeometry } from "../pcbPadGeometry"
import { AltiumPadRecord } from "../records/altium-pad-record"
import type { AltiumRecord } from "../records/altium-record"
import type { AltiumRuleRecord } from "../records/altium-rule-record"
import { AltiumViaRecord } from "../records/altium-via-record"
import { parsePcbMeasurement } from "./altium-values"
import { normalizeLayerName } from "./pcb-layer"

export function isPcbSolderMaskLayer(layer: string | undefined): boolean {
  const normalized = normalizeLayerName(layer ?? "")
  return normalized === "TOPSOLDER" || normalized === "BOTTOMSOLDER"
}

/** Create render-only openings without modifying the source document. */
export function getPcbSolderMaskRecords(
  document: AltiumPcbDocument,
  requestedLayers: string[] | undefined,
): AltiumRecord[] {
  const layers = [...new Set(requestedLayers?.map(normalizeLayerName))].filter(
    isPcbSolderMaskLayer,
  )
  if (layers.length === 0) return []
  const rules = document.rules
    .filter(
      (rule) =>
        rule.ruleKind?.toUpperCase() === "SOLDERMASKEXPANSION" &&
        rule.enabled !== false,
    )
    .toSorted((a, b) => (a.priority ?? Infinity) - (b.priority ?? Infinity))
  const openings: AltiumRecord[] = []

  for (const record of document.records) {
    if (
      !(record instanceof AltiumPadRecord) &&
      !(record instanceof AltiumViaRecord)
    ) {
      continue
    }
    if (isPcbSolderMaskLayer(record.getCaseInsensitive("LAYER"))) continue
    for (const layer of layers) {
      const side = layer === "TOPSOLDER" ? "TOP" : "BOTTOM"
      if (!reachesSide(record, side)) continue
      if (
        (record.getBoolean(`TENTED${side}`) ??
          record.getBoolean(`TENTING${side}`)) === true
      ) {
        continue
      }
      const expansion = getMaskExpansion(record, rules)
      let opening: AltiumRecord
      if (record instanceof AltiumPadRecord) {
        const geometry = getAltiumPcbPadGeometry({
          record,
          requestedLayers: [side],
        })
        const width = geometry.widthMils + expansion * 2
        const height = geometry.heightMils + expansion * 2
        if (width <= 0 || height <= 0) continue
        opening = new AltiumPadRecord()
          .set("RECORD", "Pad")
          .setMeasurement("XSIZE", width)
          .setMeasurement("YSIZE", height)
          .set("SHAPE", geometry.shape)
          .set("ROTATION", String(geometry.ccwRotationDegrees))
        if (
          geometry.shape === "ROUNDRECT" ||
          geometry.shape === "ROUNDEDRECTANGLE"
        ) {
          const padRadius =
            geometry.cornerRadiusMils ||
            Math.min(geometry.widthMils, geometry.heightMils) * 0.18
          const radius = Math.min(
            Math.max(padRadius + expansion, 0),
            Math.min(width, height) / 2,
          )
          opening.set("SHAPE", radius === 0 ? "RECTANGLE" : "ROUNDRECT")
          if (radius > 0) {
            const ordinal = side === "TOP" ? 0 : 31
            opening
              .set(`LAYER${ordinal}ALTSHAPE`, "ROUNDRECT")
              .set(
                `LAYER${ordinal}CORNERRADIUS`,
                String((radius * 200) / Math.min(width, height)),
              )
          }
        }
      } else {
        const diameter =
          (parsePcbMeasurement(record.getCaseInsensitive("DIAMETER")) ??
            parsePcbMeasurement(record.getCaseInsensitive("TOPLAYERSIZE")) ??
            20) +
          expansion * 2
        if (diameter <= 0) continue
        opening = new AltiumViaRecord()
          .set("RECORD", "Via")
          .setMeasurement("DIAMETER", diameter)
      }
      opening.set("LAYER", layer)
      for (const key of ["X", "Y", "NAME", "COMPONENT", "NET", "PLATED"]) {
        const fieldContent = record.getCaseInsensitive(key)
        if (fieldContent !== undefined) opening.set(key, fieldContent)
      }
      openings.push(opening)
    }
  }
  return openings
}

function reachesSide(record: AltiumRecord, side: string): boolean {
  if (record instanceof AltiumPadRecord) {
    const layer = normalizeLayerName(record.getCaseInsensitive("LAYER") ?? "")
    return layer === "MULTILAYER" || layer === side || layer === `${side}LAYER`
  }
  const start = normalizeLayerName(
    record.getCaseInsensitive("STARTLAYER") ??
      record.getCaseInsensitive("FROMLAYER") ??
      "TOP",
  )
  const end = normalizeLayerName(
    record.getCaseInsensitive("ENDLAYER") ??
      record.getCaseInsensitive("TOLAYER") ??
      "BOTTOM",
  )
  return [start, end].some(
    (layer) => layer === side || layer === `${side}LAYER`,
  )
}

function getMaskExpansion(
  record: AltiumRecord,
  rules: AltiumRuleRecord[],
): number {
  const mode = record
    .getCaseInsensitive("SOLDERMASKEXPANSIONMODE")
    ?.toUpperCase()
  const manual = parsePcbMeasurement(
    record.getCaseInsensitive("SOLDERMASKEXPANSION_MANUAL"),
  )
  if (mode === "NONE" || mode === "0") return 0
  if (mode === "MANUAL" || mode === "2") return manual ?? 0

  // Only apply scopes we can evaluate; never treat a scoped rule as global.
  const rule = rules.find((candidate) => {
    const scope = candidate.scope1Expression?.trim().toUpperCase() ?? "ALL"
    return scope === "ALL" || scope === `IS${record.recordKind?.toUpperCase()}`
  })
  return rule?.maskExpansionMils ?? manual ?? 0
}
