import type { AltiumPcbDocument } from "./altium-pcb-document"
import { normalizeAltiumPcbLayerName } from "./pcb-layers"
import { AltiumComponentRecord } from "./records/altium-component-record"
import { AltiumNetRecord } from "./records/altium-net-record"
import type { AltiumPolygonRecord } from "./records/altium-polygon-record"
import type { AltiumRecord } from "./records/altium-record"
import type { AltiumRuleRecord } from "./records/altium-rule-record"

export const ALTIUM_NO_INDEX = 0xffff

export type AltiumPcbReferenceField = "COMPONENT" | "NET" | "POLYGON" | "RULE"

export interface AltiumPcbDanglingReference {
  field: AltiumPcbReferenceField
  index: number
  record: AltiumRecord
}

export interface AltiumPcbResolvedReference<T extends AltiumRecord> {
  field: AltiumPcbReferenceField
  index: number
  record: AltiumRecord
  target?: T
}

interface CachedPcbDocumentIndex {
  index: AltiumPcbDocumentIndex
  revision: number
}

const INDEX_CACHE = new WeakMap<AltiumPcbDocument, CachedPcbDocumentIndex>()

export class AltiumPcbDocumentIndex {
  readonly byComponent = new Map<number, AltiumRecord[]>()
  readonly byKind = new Map<string, AltiumRecord[]>()
  readonly byLayer = new Map<string, AltiumRecord[]>()
  readonly byNet = new Map<number, AltiumRecord[]>()
  readonly byPolygon = new Map<number, AltiumRecord[]>()
  readonly byRule = new Map<number, AltiumRecord[]>()
  readonly components: AltiumComponentRecord[]
  readonly duplicateUniqueIds = new Map<string, AltiumRecord[]>()
  readonly nets: AltiumNetRecord[]
  readonly polygons: AltiumPolygonRecord[]
  readonly rules: AltiumRuleRecord[]
  readonly uniqueIds = new Map<string, AltiumRecord>()

  private readonly componentTargets: ReadonlyMap<number, AltiumComponentRecord>
  private readonly netTargets: ReadonlyMap<number, AltiumNetRecord>
  private readonly polygonTargets: ReadonlyMap<number, AltiumPolygonRecord>
  private readonly ruleTargets: ReadonlyMap<number, AltiumRuleRecord>

  constructor(readonly document: AltiumPcbDocument) {
    this.components = document
      .getRecordsByKind("Component")
      .filter(
        (record): record is AltiumComponentRecord =>
          record instanceof AltiumComponentRecord,
      )
    this.nets = document
      .getRecordsByKind("Net")
      .filter(
        (record): record is AltiumNetRecord =>
          record instanceof AltiumNetRecord,
      )
    this.polygons = document.getRecordsByKind(
      "Polygon",
    ) as AltiumPolygonRecord[]
    this.rules = [
      ...document.getRecordsByKind("Rule"),
      ...document.getRecordsByKind("DXPRule"),
    ] as AltiumRuleRecord[]
    this.componentTargets = buildTargetMap(this.components)
    this.netTargets = buildTargetMap(this.nets)
    this.polygonTargets = buildTargetMap(this.polygons)
    this.ruleTargets = buildTargetMap(this.rules)

    for (const record of document.records) {
      appendMapValue(this.byKind, record.recordKind ?? "Unknown", record)
      const layer = record.getDecoded("LAYER")
      if (layer !== undefined) {
        appendMapValue(this.byLayer, normalizeAltiumPcbLayerName(layer), record)
      }
      appendReference(this.byComponent, record, "COMPONENT")
      appendReference(this.byNet, record, "NET")
      appendReference(this.byPolygon, record, "POLYGON")
      appendReference(this.byRule, record, "RULE")

      const uniqueId = record.getDecoded("UNIQUEID")
      if (!uniqueId) continue
      const normalized = uniqueId.toUpperCase()
      const existing = this.uniqueIds.get(normalized)
      if (!existing) {
        this.uniqueIds.set(normalized, record)
        continue
      }
      const duplicates = this.duplicateUniqueIds.get(normalized) ?? [existing]
      duplicates.push(record)
      this.duplicateUniqueIds.set(normalized, duplicates)
    }
  }

  getComponent(index: number): AltiumComponentRecord | undefined {
    return isReferenceIndex(index)
      ? this.componentTargets.get(index)
      : undefined
  }

  getNet(index: number): AltiumNetRecord | undefined {
    return isReferenceIndex(index) ? this.netTargets.get(index) : undefined
  }

  getPolygon(index: number): AltiumPolygonRecord | undefined {
    return isReferenceIndex(index) ? this.polygonTargets.get(index) : undefined
  }

  getRule(index: number): AltiumRuleRecord | undefined {
    return isReferenceIndex(index) ? this.ruleTargets.get(index) : undefined
  }

  getRecordByUniqueId(uniqueId: string): AltiumRecord | undefined {
    return this.uniqueIds.get(uniqueId.toUpperCase())
  }

  getDanglingReferences(): AltiumPcbDanglingReference[] {
    const dangling: AltiumPcbDanglingReference[] = []
    const targets: Array<
      [AltiumPcbReferenceField, ReadonlyMap<number, AltiumRecord>]
    > = [
      ["COMPONENT", this.componentTargets],
      ["NET", this.netTargets],
      ["POLYGON", this.polygonTargets],
      ["RULE", this.ruleTargets],
    ]
    for (const record of this.document.records) {
      for (const [field, targetMap] of targets) {
        const index = readReferenceIndex(record, field)
        if (index !== undefined && !targetMap.has(index)) {
          dangling.push({ field, index, record })
        }
      }
    }
    return dangling
  }
}

export function getPcbDocumentIndex(
  document: AltiumPcbDocument,
): AltiumPcbDocumentIndex {
  const cached = INDEX_CACHE.get(document)
  if (cached?.revision === document.revision) return cached.index
  const index = new AltiumPcbDocumentIndex(document)
  INDEX_CACHE.set(document, { index, revision: document.revision })
  return index
}

export function clearPcbDocumentIndex(document: AltiumPcbDocument): void {
  INDEX_CACHE.delete(document)
}

export function getPcbComponents(
  document: AltiumPcbDocument,
): AltiumComponentRecord[] {
  return getPcbDocumentIndex(document).components
}

export function getPcbNets(document: AltiumPcbDocument): AltiumNetRecord[] {
  return getPcbDocumentIndex(document).nets
}

export function getPcbComponentByIndex(
  document: AltiumPcbDocument,
  index: number,
): AltiumComponentRecord | undefined {
  return getPcbDocumentIndex(document).getComponent(index)
}

export function getPcbNetByIndex(
  document: AltiumPcbDocument,
  index: number,
): AltiumNetRecord | undefined {
  return getPcbDocumentIndex(document).getNet(index)
}

export function getPcbPolygonByIndex(
  document: AltiumPcbDocument,
  index: number,
): AltiumPolygonRecord | undefined {
  return getPcbDocumentIndex(document).getPolygon(index)
}

export function getPcbRuleByIndex(
  document: AltiumPcbDocument,
  index: number,
): AltiumRuleRecord | undefined {
  return getPcbDocumentIndex(document).getRule(index)
}

export function getPcbRecordComponentIndex(
  document: AltiumPcbDocument,
  record: AltiumRecord,
): number | undefined {
  if (record instanceof AltiumComponentRecord) {
    return getRecordIndex(getPcbDocumentIndex(document).components, record)
  }
  return readReferenceIndex(record, "COMPONENT")
}

export function getPcbRecordNetIndex(
  document: AltiumPcbDocument,
  record: AltiumRecord,
): number | undefined {
  if (record instanceof AltiumNetRecord) {
    return getRecordIndex(getPcbDocumentIndex(document).nets, record)
  }
  return readReferenceIndex(record, "NET")
}

export function getPcbRecordPolygonIndex(
  document: AltiumPcbDocument,
  record: AltiumRecord,
): number | undefined {
  if (record.recordKind === "Polygon") {
    return getRecordIndex(getPcbDocumentIndex(document).polygons, record)
  }
  return readReferenceIndex(record, "POLYGON")
}

export function getPcbRecordRuleIndex(
  document: AltiumPcbDocument,
  record: AltiumRecord,
): number | undefined {
  if (record.recordKind === "Rule" || record.recordKind === "DXPRule") {
    return getRecordIndex(getPcbDocumentIndex(document).rules, record)
  }
  return (
    readReferenceIndex(record, "RULE") ??
    readReferenceIndex(record, "RULEINDEX")
  )
}

export function getPcbRecordComponent(
  document: AltiumPcbDocument,
  record: AltiumRecord,
): AltiumComponentRecord | undefined {
  const index = getPcbRecordComponentIndex(document, record)
  return index === undefined
    ? undefined
    : getPcbDocumentIndex(document).getComponent(index)
}

export function getPcbRecordNet(
  document: AltiumPcbDocument,
  record: AltiumRecord,
): AltiumNetRecord | undefined {
  const index = getPcbRecordNetIndex(document, record)
  return index === undefined
    ? undefined
    : getPcbDocumentIndex(document).getNet(index)
}

export function getPcbRecordPolygon(
  document: AltiumPcbDocument,
  record: AltiumRecord,
): AltiumPolygonRecord | undefined {
  const index = getPcbRecordPolygonIndex(document, record)
  return index === undefined
    ? undefined
    : getPcbDocumentIndex(document).getPolygon(index)
}

export function getPcbRecordRule(
  document: AltiumPcbDocument,
  record: AltiumRecord,
): AltiumRuleRecord | undefined {
  const index = getPcbRecordRuleIndex(document, record)
  return index === undefined
    ? undefined
    : getPcbDocumentIndex(document).getRule(index)
}

export function getPcbRecordsOwnedByComponent(
  document: AltiumPcbDocument,
  component: number | AltiumComponentRecord,
): AltiumRecord[] {
  const index =
    typeof component === "number"
      ? component
      : getRecordIndex(getPcbDocumentIndex(document).components, component)
  return index === undefined
    ? []
    : [...(getPcbDocumentIndex(document).byComponent.get(index) ?? [])]
}

export function getPcbRecordsOnNet(
  document: AltiumPcbDocument,
  net: number | AltiumNetRecord,
): AltiumRecord[] {
  const index =
    typeof net === "number"
      ? net
      : getRecordIndex(getPcbDocumentIndex(document).nets, net)
  return index === undefined
    ? []
    : [...(getPcbDocumentIndex(document).byNet.get(index) ?? [])]
}

export function getPcbRecordsForPolygon(
  document: AltiumPcbDocument,
  polygon: number | AltiumPolygonRecord,
): AltiumRecord[] {
  const index =
    typeof polygon === "number"
      ? polygon
      : getRecordIndex(getPcbDocumentIndex(document).polygons, polygon)
  return index === undefined
    ? []
    : [...(getPcbDocumentIndex(document).byPolygon.get(index) ?? [])]
}

export function getPcbRecordsForRule(
  document: AltiumPcbDocument,
  rule: number | AltiumRuleRecord,
): AltiumRecord[] {
  const index =
    typeof rule === "number"
      ? rule
      : getRecordIndex(getPcbDocumentIndex(document).rules, rule)
  return index === undefined
    ? []
    : [...(getPcbDocumentIndex(document).byRule.get(index) ?? [])]
}

export function getDanglingPcbReferences(
  document: AltiumPcbDocument,
): AltiumPcbDanglingReference[] {
  return getPcbDocumentIndex(document).getDanglingReferences()
}

export function getPcbReference<T extends AltiumRecord>(
  document: AltiumPcbDocument,
  record: AltiumRecord,
  field: AltiumPcbReferenceField,
): AltiumPcbResolvedReference<T> | undefined {
  const index = readReferenceIndex(record, field)
  if (index === undefined) return undefined
  const documentIndex = getPcbDocumentIndex(document)
  const target =
    field === "COMPONENT"
      ? documentIndex.getComponent(index)
      : field === "NET"
        ? documentIndex.getNet(index)
        : field === "POLYGON"
          ? documentIndex.getPolygon(index)
          : documentIndex.getRule(index)
  return {
    field,
    index,
    record,
    target: target as T | undefined,
  }
}

function buildTargetMap<T extends AltiumRecord>(
  records: readonly T[],
): ReadonlyMap<number, T> {
  const targets = new Map<number, T>()
  const hasExplicitIds = records.some(
    (record) => record.getNumber("ID") !== undefined,
  )
  records.forEach((record, position) => {
    const index = hasExplicitIds ? record.getNumber("ID") : position
    if (index !== undefined && isReferenceIndex(index)) {
      targets.set(index, record)
    }
  })
  return targets
}

function getRecordIndex<T extends AltiumRecord>(
  records: readonly T[],
  record: AltiumRecord,
): number | undefined {
  const hasExplicitIds = records.some(
    (candidate) => candidate.getNumber("ID") !== undefined,
  )
  if (hasExplicitIds) {
    const explicitId = record.getNumber("ID")
    return explicitId !== undefined && isReferenceIndex(explicitId)
      ? explicitId
      : undefined
  }
  const index = records.indexOf(record as T)
  return index >= 0 ? index : undefined
}

function appendReference(
  map: Map<number, AltiumRecord[]>,
  record: AltiumRecord,
  field: AltiumPcbReferenceField,
): void {
  const index = readReferenceIndex(record, field)
  if (index !== undefined) appendMapValue(map, index, record)
}

function appendMapValue<K>(
  map: Map<K, AltiumRecord[]>,
  key: K,
  record: AltiumRecord,
): void {
  const records = map.get(key)
  if (records) records.push(record)
  else map.set(key, [record])
}

function readReferenceIndex(
  record: AltiumRecord,
  field: AltiumPcbReferenceField | "RULEINDEX",
): number | undefined {
  const index = record.getNumber(field)
  return index !== undefined && isReferenceIndex(index) ? index : undefined
}

function isReferenceIndex(index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < ALTIUM_NO_INDEX
}
