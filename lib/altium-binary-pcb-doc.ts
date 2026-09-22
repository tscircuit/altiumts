import { AltiumEmbeddedModel } from "./altium-embedded-model"
import { AltiumNode } from "./base/altium-node"
import type { AltiumCompoundFile } from "./compound-file/altium-compound-file"
import { AltiumSerializationError } from "./errors/altium-error"
import type { AltiumBounds } from "./geometry/altium-geometry"
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
import { AltiumArcRecord } from "./records/altium-arc-record"
import type { AltiumBoardRecord } from "./records/altium-board-record"
import type { AltiumComponentRecord } from "./records/altium-component-record"
import { AltiumFillRecord } from "./records/altium-fill-record"
import type { AltiumModelRecord } from "./records/altium-model-record"
import type { AltiumNetRecord } from "./records/altium-net-record"
import { AltiumPadRecord } from "./records/altium-pad-record"
import type { AltiumPolygonRecord } from "./records/altium-polygon-record"
import type { AltiumRecord } from "./records/altium-record"
import { AltiumRegionRecord } from "./records/altium-region-record"
import type { AltiumRuleRecord } from "./records/altium-rule-record"
import { AltiumTextRecord } from "./records/altium-text-record"
import { AltiumTrackRecord } from "./records/altium-track-record"
import { AltiumViaRecord } from "./records/altium-via-record"

export interface AltiumPcbStreamSummary {
  dataSize?: number
  declaredRecordCount?: number
  decodedPrimitiveRecordCount: number
  decodedPropertyRecordCount: number
  family: string
  hasData: boolean
  hasHeader: boolean
}

export class AltiumBinaryPcbDoc extends AltiumNode {
  override readonly type = "binary-pcb-document"

  readonly compoundFile: AltiumCompoundFile
  readonly embeddedModels: AltiumEmbeddedModel[]
  readonly primitiveRecords: ReadonlyMap<string, AltiumRecord[]>
  readonly propertyRecords: ReadonlyMap<string, AltiumRecord[]>
  readonly streamSummaries: AltiumPcbStreamSummary[]
  readonly wideStrings: ReadonlyMap<number, string>

  constructor(init: {
    compoundFile: AltiumCompoundFile
    primitiveRecords: Map<string, AltiumRecord[]>
    propertyRecords: Map<string, AltiumRecord[]>
    streamSummaries: AltiumPcbStreamSummary[]
    wideStrings?: ReadonlyMap<number, string>
  }) {
    super({ sourceLocation: { byteOffset: 0, streamPath: "/" } })
    this.compoundFile = init.compoundFile
    this.primitiveRecords = init.primitiveRecords
    this.propertyRecords = init.propertyRecords
    this.streamSummaries = init.streamSummaries
    this.wideStrings = init.wideStrings ?? new Map()
    this.embeddedModels = this.models.flatMap((record, index) => {
      const stream = this.compoundFile.getStream(["Models", String(index)])
      return stream ? [new AltiumEmbeddedModel({ index, record, stream })] : []
    })
    this.adoptChildren([this.compoundFile, ...this.records])
    this.clearDirty(true)
  }

  get records(): AltiumRecord[] {
    return [
      ...this.propertyRecords.values(),
      ...this.primitiveRecords.values(),
    ].flat()
  }

  get board(): AltiumBoardRecord | undefined {
    return this.propertyRecords.get("Board6")?.[0] as
      | AltiumBoardRecord
      | undefined
  }

  get components(): AltiumComponentRecord[] {
    return (this.propertyRecords.get("Components6") ??
      []) as AltiumComponentRecord[]
  }

  get componentBodies(): AltiumRecord[] {
    return (
      this.primitiveRecords.get("ShapeBasedComponentBodies6") ??
      this.primitiveRecords.get("ComponentBodies6") ??
      []
    )
  }

  get legacyComponentBodies(): AltiumRecord[] {
    return this.primitiveRecords.get("ComponentBodies6") ?? []
  }

  get nets(): AltiumNetRecord[] {
    return (this.propertyRecords.get("Nets6") ?? []) as AltiumNetRecord[]
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
    return (this.propertyRecords.get("Polygons6") ??
      []) as AltiumPolygonRecord[]
  }

  get rules(): AltiumRuleRecord[] {
    return (this.propertyRecords.get("Rules6") ?? []) as AltiumRuleRecord[]
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

  get models(): AltiumModelRecord[] {
    return (this.propertyRecords.get("Models") ?? []) as AltiumModelRecord[]
  }

  getModelsById(id: string): AltiumModelRecord[] {
    const normalizedId = id.toUpperCase()
    return this.models.filter(
      (model) => model.getDecoded("ID")?.toUpperCase() === normalizedId,
    )
  }

  getModelForComponentBody(body: AltiumRecord): AltiumModelRecord | undefined {
    const id = body.getDecoded("MODELID")
    if (!id) return undefined
    const candidates = this.getModelsById(id)
    if (candidates.length <= 1) return candidates[0]

    return (
      candidates.find(
        (model) =>
          sameNumber(
            model.getNumber("ROTX"),
            body.getNumber("MODEL.3D.ROTX"),
          ) &&
          sameNumber(
            model.getNumber("ROTY"),
            body.getNumber("MODEL.3D.ROTY"),
          ) &&
          sameNumber(model.getNumber("ROTZ"), body.getNumber("MODEL.3D.ROTZ")),
      ) ?? candidates[0]
    )
  }

  getEmbeddedModelForComponentBody(
    body: AltiumRecord,
  ): AltiumEmbeddedModel | undefined {
    const model = this.getModelForComponentBody(body)
    return this.embeddedModels.find((embedded) => embedded.record === model)
  }

  get tracks(): AltiumTrackRecord[] {
    return recordsOfType(
      this.primitiveRecords.get("Tracks6"),
      AltiumTrackRecord,
    )
  }

  get arcs(): AltiumArcRecord[] {
    return recordsOfType(this.primitiveRecords.get("Arcs6"), AltiumArcRecord)
  }

  get vias(): AltiumViaRecord[] {
    return recordsOfType(this.primitiveRecords.get("Vias6"), AltiumViaRecord)
  }

  get pads(): AltiumPadRecord[] {
    return recordsOfType(this.primitiveRecords.get("Pads6"), AltiumPadRecord)
  }

  get fills(): AltiumFillRecord[] {
    return recordsOfType(this.primitiveRecords.get("Fills6"), AltiumFillRecord)
  }

  get regions(): AltiumRegionRecord[] {
    return recordsOfType(
      this.primitiveRecords.get("ShapeBasedRegions6") ??
        this.primitiveRecords.get("Regions6"),
      AltiumRegionRecord,
    )
  }

  get regionFills(): AltiumRegionRecord[] {
    return recordsOfType(
      this.primitiveRecords.get("Regions6"),
      AltiumRegionRecord,
    )
  }

  get boardRegions(): AltiumRegionRecord[] {
    return recordsOfType(
      this.primitiveRecords.get("BoardRegions"),
      AltiumRegionRecord,
    )
  }

  get texts(): AltiumTextRecord[] {
    return recordsOfType(this.primitiveRecords.get("Texts6"), AltiumTextRecord)
  }

  getRecordsByKind(kind: string): AltiumRecord[] {
    return this.records.filter((record) => record.recordKind === kind)
  }

  getStreamSummary(family: string): AltiumPcbStreamSummary | undefined {
    return this.streamSummaries.find(
      (summary) => summary.family.toLowerCase() === family.toLowerCase(),
    )
  }

  getBytes(): Uint8Array {
    if (this.isDirty) {
      throw new AltiumSerializationError(
        "Modified binary PCB documents cannot yet be serialized safely",
      )
    }
    return this.compoundFile.getBytes()
  }

  override getChildren(): AltiumNode[] {
    return [this.compoundFile, ...this.records]
  }

  override getString(): string {
    return this.records.map((record) => record.getString()).join("\n")
  }
}

function recordsOfType<RecordType extends AltiumRecord>(
  records: AltiumRecord[] | undefined,
  RecordClass: new (...constructorArgs: never[]) => RecordType,
): RecordType[] {
  return (records ?? []).filter(
    (record): record is RecordType => record instanceof RecordClass,
  )
}

function sameNumber(
  left: number | undefined,
  right: number | undefined,
): boolean {
  return (
    left !== undefined &&
    right !== undefined &&
    Math.abs(left - right) < Number.EPSILON
  )
}
