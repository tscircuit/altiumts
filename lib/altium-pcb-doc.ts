import type { AltiumLine } from "./base/altium-line"
import { AltiumNode } from "./base/altium-node"
import type { AltiumBounds } from "./geometry/altium-geometry"
import {
  type AltiumTextEncoding,
  encodeAltiumText,
} from "./parser/decode-altium-text"
import {
  type AltiumPcbConnectivityGraph,
  getPcbComponentBounds,
  getPcbConnectivityGraph,
} from "./pcb-connectivity"
import {
  type AltiumPcbBoardGeometry,
  getPcbBoardGeometry,
} from "./pcb-contours"
import {
  type AltiumPcbDocumentIndex,
  getPcbComponentByIndex,
  getPcbDocumentIndex,
  getPcbNetByIndex,
  getPcbPolygonByIndex,
  getPcbRecordComponent,
  getPcbRecordNet,
  getPcbRecordPolygon,
  getPcbRecordRule,
  getPcbRecordsForPolygon,
  getPcbRecordsForRule,
  getPcbRecordsOnNet,
  getPcbRecordsOwnedByComponent,
  getPcbRuleByIndex,
} from "./pcb-reference-resolution"
import { AltiumBoardRecord } from "./records/altium-board-record"
import { AltiumClassRecord } from "./records/altium-class-record"
import { AltiumComponentRecord } from "./records/altium-component-record"
import { AltiumNetRecord } from "./records/altium-net-record"
import { AltiumPolygonRecord } from "./records/altium-polygon-record"
import { AltiumRecord } from "./records/altium-record"
import {
  AltiumDxpRuleRecord,
  AltiumRuleRecord,
} from "./records/altium-rule-record"

export class AltiumPcbDoc extends AltiumNode {
  override readonly type = "pcb-document"

  private _lines: AltiumLine[]
  private originalBytes?: Uint8Array
  private readonly originalSource?: string
  private sourceEncoding?: AltiumTextEncoding

  constructor(
    init: {
      lines?: AltiumLine[]
      originalBytes?: Uint8Array
      originalSource?: string
      sourceEncoding?: AltiumTextEncoding
    } = {},
  ) {
    super({
      sourceLocation: {
        column: 1,
        endOffset: init.originalSource?.length,
        line: 1,
        startOffset: 0,
      },
    })
    this._lines = init.lines ?? []
    this.originalBytes = init.originalBytes?.slice()
    this.originalSource = init.originalSource
    this.sourceEncoding = init.sourceEncoding
    this.adoptChildren(this._lines)
    this.clearDirty(true)
  }

  setOriginalBytes(bytes: Uint8Array, encoding: AltiumTextEncoding): this {
    this.originalBytes = bytes.slice()
    this.sourceEncoding = encoding
    return this
  }

  getBytes(): Uint8Array {
    if (!this.isDirty && this.originalBytes) return this.originalBytes.slice()
    return encodeAltiumText(this.getString(), this.sourceEncoding)
  }

  get lines(): AltiumLine[] {
    return this._lines
  }

  set lines(lines: AltiumLine[]) {
    if (lines === this._lines) return
    this._lines = lines
    this.adoptChildren(lines)
    this.markDirty()
  }

  get records(): AltiumRecord[] {
    return this.lines.filter(
      (line): line is AltiumRecord => line instanceof AltiumRecord,
    )
  }

  get board(): AltiumBoardRecord | undefined {
    return this.records.find(
      (record): record is AltiumBoardRecord =>
        record instanceof AltiumBoardRecord,
    )
  }

  get components(): AltiumComponentRecord[] {
    return this.records.filter(
      (record): record is AltiumComponentRecord =>
        record instanceof AltiumComponentRecord,
    )
  }

  get nets(): AltiumNetRecord[] {
    return this.records.filter(
      (record): record is AltiumNetRecord => record instanceof AltiumNetRecord,
    )
  }

  get classes(): AltiumClassRecord[] {
    return this.records.filter(
      (record): record is AltiumClassRecord =>
        record instanceof AltiumClassRecord,
    )
  }

  get index(): AltiumPcbDocumentIndex {
    return getPcbDocumentIndex(this)
  }

  get connectivity(): AltiumPcbConnectivityGraph {
    return getPcbConnectivityGraph(this)
  }

  get boardGeometry(): AltiumPcbBoardGeometry {
    return getPcbBoardGeometry(this)
  }

  get polygons(): AltiumPolygonRecord[] {
    return this.records.filter(
      (record): record is AltiumPolygonRecord =>
        record instanceof AltiumPolygonRecord,
    )
  }

  get rules(): AltiumRuleRecord[] {
    return this.records.filter(
      (record): record is AltiumRuleRecord =>
        record instanceof AltiumRuleRecord ||
        record instanceof AltiumDxpRuleRecord,
    )
  }

  getComponentByIndex(index: number): AltiumComponentRecord | undefined {
    return getPcbComponentByIndex(this, index)
  }

  getNetByIndex(index: number): AltiumNetRecord | undefined {
    return getPcbNetByIndex(this, index)
  }

  getPolygonByIndex(index: number): AltiumPolygonRecord | undefined {
    return getPcbPolygonByIndex(this, index)
  }

  getRuleByIndex(index: number): AltiumRuleRecord | undefined {
    return getPcbRuleByIndex(this, index)
  }

  getComponentForRecord(
    record: AltiumRecord,
  ): AltiumComponentRecord | undefined {
    return getPcbRecordComponent(this, record)
  }

  getNetForRecord(record: AltiumRecord): AltiumNetRecord | undefined {
    return getPcbRecordNet(this, record)
  }

  getPolygonForRecord(record: AltiumRecord): AltiumPolygonRecord | undefined {
    return getPcbRecordPolygon(this, record)
  }

  getRuleForRecord(record: AltiumRecord): AltiumRuleRecord | undefined {
    return getPcbRecordRule(this, record)
  }

  getRecordsOwnedByComponent(
    component: number | AltiumComponentRecord,
  ): AltiumRecord[] {
    return getPcbRecordsOwnedByComponent(this, component)
  }

  getRecordsOnNet(net: number | AltiumNetRecord): AltiumRecord[] {
    return getPcbRecordsOnNet(this, net)
  }

  getRecordsForPolygon(polygon: number | AltiumPolygonRecord): AltiumRecord[] {
    return getPcbRecordsForPolygon(this, polygon)
  }

  getRecordsForRule(rule: number | AltiumRuleRecord): AltiumRecord[] {
    return getPcbRecordsForRule(this, rule)
  }

  getRecordsByLayer(layer: string): AltiumRecord[] {
    return [...(this.index.byLayer.get(layer.toUpperCase()) ?? [])]
  }

  getComponentBounds(
    component: number | AltiumComponentRecord,
    layers?: string[],
  ): AltiumBounds | undefined {
    return getPcbComponentBounds(this, component, layers)
  }

  getRecordByUniqueId(uniqueId: string): AltiumRecord | undefined {
    return this.index.getRecordByUniqueId(uniqueId)
  }

  getRecordsByKind(kind: string): AltiumRecord[] {
    return this.records.filter((record) => record.recordKind === kind)
  }

  insertRecord(record: AltiumRecord, index = this.lines.length): this {
    const boundedIndex = Math.min(Math.max(index, 0), this.lines.length)
    record.setParent(this)
    this.lines.splice(boundedIndex, 0, record)
    this.markDirty()
    return this
  }

  removeRecord(record: AltiumRecord): boolean {
    const index = this.lines.indexOf(record)
    if (index < 0) return false
    this.lines.splice(index, 1)
    record.setParent(undefined)
    this.markDirty()
    return true
  }

  allocateRecordId(kind: string, field = "ID"): number {
    const used = new Set(
      this.getRecordsByKind(kind)
        .map((record) => record.getNumber(field))
        .filter((value): value is number => value !== undefined),
    )
    let candidate = 0
    while (used.has(candidate)) candidate++
    return candidate
  }

  override getChildren(): AltiumNode[] {
    return [...this.lines]
  }

  override getString(): string {
    if (!this.isDirty && this.originalSource !== undefined) {
      return this.originalSource
    }
    return this.lines
      .map((line) => `${line.getString()}${line.terminator}`)
      .join("")
  }
}
