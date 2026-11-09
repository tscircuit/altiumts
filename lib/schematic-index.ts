import type { AltiumSchDoc } from "./altium-sch-doc"
import type { AltiumPoint } from "./geometry/altium-geometry"
import { isPointOnSchematicSegment } from "./geometry/is-point-on-schematic-segment"
import { getSchematicPoint } from "./geometry/schematic-point"
import type { AltiumRecord } from "./records/altium-record"
import {
  type AltiumSchComponentRecord,
  type AltiumSchematicRecord,
  AltiumSchJunctionRecord,
  AltiumSchNetLabelRecord,
  AltiumSchPinRecord,
  AltiumSchPortRecord,
  AltiumSchPowerPortRecord,
  AltiumSchSheetFileNameRecord,
  AltiumSchSheetNameRecord,
  type AltiumSchSheetSymbolRecord,
} from "./records/altium-schematic-records"

interface CachedSchematicIndex {
  index: AltiumSchematicDocumentIndex
  revision: number
}

const INDEX_CACHE = new WeakMap<AltiumSchDoc, CachedSchematicIndex>()
const GRAPH_CACHE = new WeakMap<
  AltiumSchDoc,
  { graph: AltiumSchematicNetGraph; revision: number }
>()

export interface AltiumSchematicSheetLink {
  fileName?: string
  fileNameRecord?: AltiumSchSheetFileNameRecord
  name?: string
  nameRecord?: AltiumSchSheetNameRecord
  symbol: AltiumSchSheetSymbolRecord
}

export class AltiumSchematicDocumentIndex {
  readonly byOwner = new Map<number, AltiumRecord[]>()
  readonly duplicateUniqueIds = new Map<string, AltiumRecord[]>()
  readonly records: AltiumRecord[]
  readonly uniqueIds = new Map<string, AltiumRecord>()

  constructor(readonly document: AltiumSchDoc) {
    this.records = document.records
    for (const record of this.records) {
      const ownerIndex = record.getNumber("OWNERINDEX")
      if (ownerIndex !== undefined && ownerIndex >= 0) {
        const owned = this.byOwner.get(ownerIndex)
        if (owned) owned.push(record)
        else this.byOwner.set(ownerIndex, [record])
      }

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

  getParent(record: AltiumRecord): AltiumRecord | undefined {
    const ownerIndex = record.getNumber("OWNERINDEX")
    return ownerIndex === undefined || ownerIndex < 0
      ? undefined
      : this.records[ownerIndex]
  }

  getOwnedRecords(owner: AltiumRecord | number): AltiumRecord[] {
    const ownerIndex =
      typeof owner === "number" ? owner : this.records.indexOf(owner)
    return ownerIndex < 0 ? [] : [...(this.byOwner.get(ownerIndex) ?? [])]
  }

  getRecordByUniqueId(uniqueId: string): AltiumRecord | undefined {
    return this.uniqueIds.get(uniqueId.toUpperCase())
  }

  getOwnershipCycles(): AltiumRecord[][] {
    const cycles: AltiumRecord[][] = []
    const globallyVisited = new Set<AltiumRecord>()
    for (const start of this.records) {
      if (globallyVisited.has(start)) continue
      const path: AltiumRecord[] = []
      const indexes = new Map<AltiumRecord, number>()
      let current: AltiumRecord | undefined = start
      while (current) {
        const cycleStart = indexes.get(current)
        if (cycleStart !== undefined) {
          cycles.push(path.slice(cycleStart))
          break
        }
        if (globallyVisited.has(current)) break
        indexes.set(current, path.length)
        path.push(current)
        current = this.getParent(current)
      }
      for (const record of path) globallyVisited.add(record)
    }
    return cycles
  }
}

export interface AltiumSchematicNet {
  id: string
  names: string[]
  points: AltiumPoint[]
  records: AltiumRecord[]
}

export class AltiumSchematicNetGraph {
  readonly nets: AltiumSchematicNet[]
  private readonly recordNets = new Map<AltiumRecord, AltiumSchematicNet>()

  constructor(readonly document: AltiumSchDoc) {
    const disjointSet = new DisjointSet()
    const pointRecords = new Map<string, AltiumRecord[]>()
    const pointValues = new Map<string, AltiumPoint>()
    const segments: Array<{ start: AltiumPoint; end: AltiumPoint }> = []

    for (const wire of document.wires) {
      const points = getSchematicRecordPoints(wire)
      for (const point of points) {
        const key = pointKey(point)
        disjointSet.add(key)
        pointValues.set(key, point)
        appendRecord(pointRecords, key, wire)
      }
      for (let index = 1; index < points.length; index++) {
        const previous = points[index - 1]
        const point = points[index]
        if (previous && point) {
          disjointSet.union(pointKey(previous), pointKey(point))
          segments.push({ start: previous, end: point })
        }
      }
    }

    const positionedRecords: AltiumSchematicRecord[] = [
      ...document.pins,
      ...document.netLabels,
      ...document.ports,
      ...document.powerPorts,
      ...document.records.filter(
        (record): record is AltiumSchJunctionRecord =>
          record instanceof AltiumSchJunctionRecord,
      ),
    ]
    for (const record of positionedRecords) {
      const position = record.position
      if (!position) continue
      const key = pointKey(position)
      disjointSet.add(key)
      pointValues.set(key, position)
      appendRecord(pointRecords, key, record)
    }

    // Electrical points and wire vertices may meet a segment at its interior.
    // Do not create points at bare crossings: they need a vertex or junction.
    for (const [key, point] of pointValues) {
      for (const segment of segments) {
        if (isPointOnSchematicSegment({ point, ...segment })) {
          disjointSet.union(key, pointKey(segment.start))
        }
      }
    }

    const grouped = new Map<
      string,
      {
        names: Set<string>
        points: Map<string, AltiumPoint>
        records: Set<AltiumRecord>
      }
    >()
    for (const [key, records] of pointRecords) {
      const root = disjointSet.find(key)
      const group = grouped.get(root) ?? {
        names: new Set<string>(),
        points: new Map<string, AltiumPoint>(),
        records: new Set<AltiumRecord>(),
      }
      const point = pointValues.get(key)
      if (point) group.points.set(key, point)
      for (const record of records) {
        group.records.add(record)
        const name = getSchematicNetName(record)
        if (name) group.names.add(name)
      }
      grouped.set(root, group)
    }

    const mergedGroups: Array<{
      id: string
      names: Set<string>
      points: Map<string, AltiumPoint>
      records: Set<AltiumRecord>
    }> = []
    for (const [id, group] of grouped) {
      const normalizedNames = new Set(
        [...group.names].map((name) => name.toUpperCase()),
      )
      const matches = mergedGroups.filter((candidate) =>
        [...candidate.names].some((name) =>
          normalizedNames.has(name.toUpperCase()),
        ),
      )
      if (matches.length === 0 || normalizedNames.size === 0) {
        mergedGroups.push({ id, ...group })
        continue
      }
      const target = matches[0]
      if (!target) continue
      mergeSchematicGroup(target, group)
      for (const duplicate of matches.slice(1)) {
        mergeSchematicGroup(target, duplicate)
        const duplicateIndex = mergedGroups.indexOf(duplicate)
        if (duplicateIndex >= 0) mergedGroups.splice(duplicateIndex, 1)
      }
    }

    this.nets = mergedGroups.map((group) => ({
      id: group.id,
      names: [...group.names],
      points: [...group.points.values()],
      records: [...group.records],
    }))
    for (const net of this.nets) {
      for (const record of net.records) this.recordNets.set(record, net)
    }
  }

  getNetForRecord(record: AltiumRecord): AltiumSchematicNet | undefined {
    return this.recordNets.get(record)
  }

  getNetsByName(name: string): AltiumSchematicNet[] {
    const normalized = name.toUpperCase()
    return this.nets.filter((net) =>
      net.names.some((candidate) => candidate.toUpperCase() === normalized),
    )
  }

  getPinsForComponent(
    component: AltiumSchComponentRecord,
  ): AltiumSchPinRecord[] {
    return getSchematicDocumentIndex(this.document)
      .getOwnedRecords(component)
      .filter(
        (record): record is AltiumSchPinRecord =>
          record instanceof AltiumSchPinRecord,
      )
  }
}

export function getSchematicDocumentIndex(
  document: AltiumSchDoc,
): AltiumSchematicDocumentIndex {
  const cached = INDEX_CACHE.get(document)
  if (cached?.revision === document.revision) return cached.index
  const index = new AltiumSchematicDocumentIndex(document)
  INDEX_CACHE.set(document, { index, revision: document.revision })
  return index
}

export function getSchematicNetGraph(
  document: AltiumSchDoc,
): AltiumSchematicNetGraph {
  const cached = GRAPH_CACHE.get(document)
  if (cached?.revision === document.revision) return cached.graph
  const graph = new AltiumSchematicNetGraph(document)
  GRAPH_CACHE.set(document, { graph, revision: document.revision })
  return graph
}

export function getSchematicSheetLinks(
  document: AltiumSchDoc,
): AltiumSchematicSheetLink[] {
  const index = getSchematicDocumentIndex(document)
  return document.sheetSymbols.map((symbol) => {
    const owned = index.getOwnedRecords(symbol)
    const nameRecord = owned.find(
      (record): record is AltiumSchSheetNameRecord =>
        record instanceof AltiumSchSheetNameRecord,
    )
    const fileNameRecord = owned.find(
      (record): record is AltiumSchSheetFileNameRecord =>
        record instanceof AltiumSchSheetFileNameRecord,
    )
    return {
      fileName: fileNameRecord?.getDecoded("TEXT"),
      fileNameRecord,
      name: nameRecord?.getDecoded("TEXT"),
      nameRecord,
      symbol,
    }
  })
}

export function getSchematicRecordPoints(record: AltiumRecord): AltiumPoint[] {
  const declaredCount = record.getNumber("LOCATIONCOUNT")
  const maximum =
    declaredCount === undefined
      ? 100_000
      : Math.min(Math.max(declaredCount, 0), 100_000)
  const points: AltiumPoint[] = []
  for (let index = 1; index <= maximum; index++) {
    const point = getSchematicPoint(record, {
      xKey: `X${index}`,
      yKey: `Y${index}`,
    })
    if (!point && declaredCount === undefined) break
    points.push(point ?? { x: 0, y: 0 })
  }
  return points
}

function getSchematicNetName(record: AltiumRecord): string | undefined {
  if (
    record instanceof AltiumSchNetLabelRecord ||
    record instanceof AltiumSchPowerPortRecord
  ) {
    return record.getDecoded("TEXT")
  }
  if (record instanceof AltiumSchPortRecord) {
    return record.getDecoded("NAME")
  }
  return undefined
}

function pointKey(point: AltiumPoint): string {
  return `${normalizeCoordinate(point.x)},${normalizeCoordinate(point.y)}`
}

function normalizeCoordinate(value: number): string {
  return value.toFixed(6).replace(/\.?0+$/u, "")
}

function appendRecord(
  map: Map<string, AltiumRecord[]>,
  key: string,
  record: AltiumRecord,
): void {
  const records = map.get(key)
  if (records) records.push(record)
  else map.set(key, [record])
}

function mergeSchematicGroup(
  target: {
    names: Set<string>
    points: Map<string, AltiumPoint>
    records: Set<AltiumRecord>
  },
  source: {
    names: Set<string>
    points: Map<string, AltiumPoint>
    records: Set<AltiumRecord>
  },
): void {
  for (const name of source.names) target.names.add(name)
  for (const [key, point] of source.points) target.points.set(key, point)
  for (const record of source.records) target.records.add(record)
}

class DisjointSet {
  private readonly parents = new Map<string, string>()

  add(value: string): void {
    if (!this.parents.has(value)) this.parents.set(value, value)
  }

  find(value: string): string {
    this.add(value)
    const parent = this.parents.get(value)
    if (parent === undefined || parent === value) return value
    const root = this.find(parent)
    this.parents.set(value, root)
    return root
  }

  union(left: string, right: string): void {
    const leftRoot = this.find(left)
    const rightRoot = this.find(right)
    if (leftRoot !== rightRoot) this.parents.set(rightRoot, leftRoot)
  }
}
