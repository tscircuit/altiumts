import type { AltiumPcbDocument } from "../altium-pcb-document"
import type { AltiumRecord } from "../records/altium-record"
import type { AltiumRuleRecord } from "../records/altium-rule-record"
import { parsePcbMeasurement } from "./altium-values"
import {
  isPcbSolderMaskLayer,
  normalizeLayerName,
  type PcbSolderMaskLayer,
} from "./pcb-layer"

export function getPcbSolderMaskExpansion(
  document: AltiumPcbDocument,
  record: AltiumRecord,
  layer: string | undefined,
): number | undefined {
  if (!isPcbSolderMaskLayer(layer)) return undefined

  const mode = record
    .getCaseInsensitive("SOLDERMASKEXPANSIONMODE")
    ?.toUpperCase()
  if (mode === "MANUAL") {
    return getManualExpansion(record) ?? 0
  }

  const rule = getGlobalSolderMaskRule(document)
  if (rule) {
    const isTop = normalizeLayerName(layer ?? "") === "TOPSOLDER"
    if (rule.getBoolean(isTop ? "ISTENTINGTOP" : "ISTENTINGBOTTOM")) {
      return undefined
    }
    return getRuleExpansion(rule, isTop ? "TOPSOLDER" : "BOTTOMSOLDER")
  }

  return getManualExpansion(record) ?? 0
}

function getGlobalSolderMaskRule(
  document: AltiumPcbDocument,
): AltiumRuleRecord | undefined {
  return document.rules
    .filter(
      (rule) =>
        rule.enabled !== false &&
        rule.ruleKind?.toUpperCase() === "SOLDERMASKEXPANSION" &&
        isGlobalScope(rule.scope1Expression),
    )
    .sort(
      (left, right) =>
        (left.priority ?? Number.POSITIVE_INFINITY) -
        (right.priority ?? Number.POSITIVE_INFINITY),
    )[0]
}

function isGlobalScope(expression: string | undefined): boolean {
  if (expression === undefined) return true
  const normalized = expression.replaceAll(/\s/gu, "").toUpperCase()
  return normalized === "ALL" || normalized === "(ALL)"
}

function getManualExpansion(record: AltiumRecord): number | undefined {
  return parsePcbMeasurement(
    record.getCaseInsensitive("SOLDERMASKEXPANSION_MANUAL"),
  )
}

function getRuleExpansion(
  rule: AltiumRuleRecord,
  layer: PcbSolderMaskLayer,
): number {
  const sideExpansion = parsePcbMeasurement(
    rule.getCaseInsensitive(
      layer === "TOPSOLDER" ? "EXPANSIONTOP" : "EXPANSIONBOTTOM",
    ),
  )
  return sideExpansion ?? rule.maskExpansionMils ?? 0
}
