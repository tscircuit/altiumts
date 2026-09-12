import {
  type AltiumEmbeddedSchematicImage,
  parseAltiumEmbeddedSchematicImages,
} from "./altium-embedded-schematic-image"
import type { AltiumLine } from "./base/altium-line"
import { AltiumNode } from "./base/altium-node"
import type { AltiumCompoundFile } from "./compound-file/altium-compound-file"
import { AltiumSerializationError } from "./errors/altium-error"
import {
  type AltiumTextEncoding,
  encodeAltiumText,
} from "./parser/decode-altium-text"
import { AltiumRecord } from "./records/altium-record"
import {
  AltiumSchComponentRecord,
  AltiumSchImageRecord,
  AltiumSchLabelRecord,
  AltiumSchNetLabelRecord,
  AltiumSchParameterSetRecord,
  AltiumSchPinRecord,
  AltiumSchPortRecord,
  AltiumSchPowerPortRecord,
  AltiumSchSheetSymbolRecord,
  AltiumSchWireRecord,
} from "./records/altium-schematic-records"
import {
  type AltiumSchematicDocumentIndex,
  type AltiumSchematicNetGraph,
  type AltiumSchematicSheetLink,
  getSchematicDocumentIndex,
  getSchematicNetGraph,
  getSchematicSheetLinks,
} from "./schematic-index"

export type AltiumSchDocSourceFormat = "ascii" | "binary"

export class AltiumSchDoc extends AltiumNode {
  override readonly type = "schematic-document"

  readonly compoundFile?: AltiumCompoundFile
  readonly embeddedImages: AltiumEmbeddedSchematicImage[]
  /** Native definition-stream records, including its header, in original order. */
  readonly objectDefinitionRecords: AltiumRecord[]
  readonly originalBytes?: Uint8Array
  readonly originalText?: string
  readonly sourceEncoding?: AltiumTextEncoding
  readonly sourceFormat: AltiumSchDocSourceFormat
  private _lines: AltiumLine[]

  constructor(init: {
    compoundFile?: AltiumCompoundFile
    lines?: AltiumLine[]
    objectDefinitionRecords?: AltiumRecord[]
    originalBytes?: Uint8Array
    originalText?: string
    sourceEncoding?: AltiumTextEncoding
    sourceFormat: AltiumSchDocSourceFormat
  }) {
    super({
      sourceLocation:
        init.sourceFormat === "binary"
          ? { byteOffset: 0, streamPath: "/" }
          : {
              column: 1,
              endOffset: init.originalText?.length,
              line: 1,
              startOffset: 0,
            },
    })
    this.compoundFile = init.compoundFile
    this._lines = init.lines ?? []
    this.objectDefinitionRecords = init.objectDefinitionRecords ?? []
    this.originalBytes = init.originalBytes
    this.originalText = init.originalText
    this.sourceEncoding = init.sourceEncoding
    this.sourceFormat = init.sourceFormat
    this.embeddedImages = parseAltiumEmbeddedSchematicImages(
      this.compoundFile?.getStream("/Storage"),
      this.records.filter(
        (record): record is AltiumSchImageRecord =>
          record instanceof AltiumSchImageRecord,
      ),
    )
    this.adoptChildren([
      ...(this.compoundFile ? [this.compoundFile] : []),
      ...this._lines,
      ...this.objectDefinitionRecords,
    ])
    this.clearDirty(true)
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

  get header(): AltiumRecord | undefined {
    return this.lines.find(
      (line): line is AltiumRecord =>
        line instanceof AltiumRecord &&
        line.getCaseInsensitive("HEADER") !== undefined,
    )
  }

  get records(): AltiumRecord[] {
    return this.lines.filter(
      (line): line is AltiumRecord =>
        line instanceof AltiumRecord && line.recordKind !== undefined,
    )
  }

  get index(): AltiumSchematicDocumentIndex {
    return getSchematicDocumentIndex(this)
  }

  get netGraph(): AltiumSchematicNetGraph {
    return getSchematicNetGraph(this)
  }

  get components(): AltiumSchComponentRecord[] {
    return this.records.filter(
      (record): record is AltiumSchComponentRecord =>
        record instanceof AltiumSchComponentRecord,
    )
  }

  get pins(): AltiumSchPinRecord[] {
    return this.records.filter(
      (record): record is AltiumSchPinRecord =>
        record instanceof AltiumSchPinRecord,
    )
  }

  get wires(): AltiumSchWireRecord[] {
    return this.records.filter(
      (record): record is AltiumSchWireRecord =>
        record instanceof AltiumSchWireRecord,
    )
  }

  get labels(): AltiumSchLabelRecord[] {
    return this.records.filter(
      (record): record is AltiumSchLabelRecord =>
        record instanceof AltiumSchLabelRecord,
    )
  }

  get netLabels(): AltiumSchNetLabelRecord[] {
    return this.records.filter(
      (record): record is AltiumSchNetLabelRecord =>
        record instanceof AltiumSchNetLabelRecord,
    )
  }

  get ports(): AltiumSchPortRecord[] {
    return this.records.filter(
      (record): record is AltiumSchPortRecord =>
        record instanceof AltiumSchPortRecord,
    )
  }

  get powerPorts(): AltiumSchPowerPortRecord[] {
    return this.records.filter(
      (record): record is AltiumSchPowerPortRecord =>
        record instanceof AltiumSchPowerPortRecord,
    )
  }

  get sheetSymbols(): AltiumSchSheetSymbolRecord[] {
    return this.records.filter(
      (record): record is AltiumSchSheetSymbolRecord =>
        record instanceof AltiumSchSheetSymbolRecord,
    )
  }

  get parameterSets(): AltiumSchParameterSetRecord[] {
    return this.records.filter(
      (record): record is AltiumSchParameterSetRecord =>
        record instanceof AltiumSchParameterSetRecord,
    )
  }

  get differentialPairs(): AltiumSchParameterSetRecord[] {
    return this.parameterSets.filter((record) => record.isDifferentialPair)
  }

  get sheetLinks(): AltiumSchematicSheetLink[] {
    return getSchematicSheetLinks(this)
  }

  getEmbeddedImageForRecord(
    record: AltiumSchImageRecord,
  ): AltiumEmbeddedSchematicImage | undefined {
    return this.embeddedImages.find((image) => image.record === record)
  }

  getRecordsByKind(kind: string): AltiumRecord[] {
    return this.records.filter((record) => record.recordKind === kind)
  }

  getParent(record: AltiumRecord): AltiumRecord | undefined {
    if (this.objectDefinitionRecords.includes(record)) {
      const ownerIndex = record.getNumber("OWNERINDEX")
      return ownerIndex === undefined || ownerIndex < 0
        ? undefined
        : this.objectDefinitionRecords.filter(
            (child) => child.recordKind !== undefined,
          )[ownerIndex]
    }
    return this.index.getParent(record)
  }

  getOwnedRecords(owner: AltiumRecord | number): AltiumRecord[] {
    if (
      typeof owner !== "number" &&
      this.objectDefinitionRecords.includes(owner)
    ) {
      const records = this.objectDefinitionRecords.filter(
        (record) => record.recordKind !== undefined,
      )
      const ownerIndex = records.indexOf(owner)
      return ownerIndex < 0
        ? []
        : records.filter(
            (record) => record.getNumber("OWNERINDEX") === ownerIndex,
          )
    }
    return this.index.getOwnedRecords(owner)
  }

  getRecordByUniqueId(uniqueId: string): AltiumRecord | undefined {
    return this.index.getRecordByUniqueId(uniqueId)
  }

  /** Resolve direct children using indices local to ObjectDefinitions, excluding its header. */
  getObjectDefinitionGraphics(id: string): AltiumRecord[] | undefined {
    const definition = this.objectDefinitionRecords.find(
      (record) =>
        record.recordKind === "129" &&
        record.getCaseInsensitive("ObjectDefinitionId")?.toLowerCase() ===
          id.toLowerCase(),
    )
    return definition ? this.getOwnedRecords(definition) : undefined
  }

  getBytes(): Uint8Array {
    if (!this.isDirty && this.originalBytes) return this.originalBytes.slice()
    if (this.sourceFormat === "binary") {
      throw new AltiumSerializationError(
        "Modified binary schematic documents cannot yet be serialized safely",
      )
    }
    return encodeAltiumText(this.getString(), this.sourceEncoding)
  }

  override getChildren(): AltiumNode[] {
    return [
      ...(this.compoundFile ? [this.compoundFile] : []),
      ...this.lines,
      ...this.objectDefinitionRecords,
    ]
  }

  override getString(): string {
    if (!this.isDirty && this.originalText !== undefined) {
      return this.originalText
    }
    return this.lines
      .map((line) => `${line.getString()}${line.terminator}`)
      .join("")
  }
}
