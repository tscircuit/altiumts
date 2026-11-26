import {
  AltiumLine,
  type AltiumLineInit,
  type AltiumLineTerminator,
} from "../base/altium-line"
import type { AltiumNode } from "../base/altium-node"
import { AltiumField } from "../fields/altium-field"
import type { AltiumRawField } from "../fields/altium-raw-field"
import type { AltiumPoint, AltiumSize } from "../geometry/altium-geometry"
import { normalizeAltiumAngle } from "../geometry/altium-geometry"
import {
  type AltiumMeasurementInput,
  type AltiumMeasurementUnit,
  type AltiumMeasurement as AltiumMeasurementValue,
  formatAltiumMeasurement,
  parseAltiumMeasurement,
} from "../measurement/altium-measurement"

export type AltiumRecordItem = AltiumField | AltiumRawField

export interface AltiumMeasurementParts {
  value: number
  unit?: string
}

export interface AltiumRecordInit extends AltiumLineInit {
  items?: AltiumRecordItem[]
  originalBinaryPayload?: Uint8Array
  terminator?: AltiumLineTerminator
}

/** Shared syntax contract for records decoded from either text or binary. */
export interface AltiumRecordNode {
  readonly originalBinaryPayload?: Uint8Array
  readonly recordKind?: string
  readonly type: string
  getString(): string
}

export class AltiumRecord extends AltiumLine implements AltiumRecordNode {
  override readonly type: string = "record"

  items: AltiumRecordItem[]
  private _originalBinaryPayload?: Uint8Array

  constructor(init: AltiumRecordInit = {}) {
    super(init)
    this.items = init.items ?? []
    this._originalBinaryPayload = init.originalBinaryPayload?.slice()
    this.adoptChildren(this.items)
  }

  /**
   * Returns a defensive copy of the binary payload that produced this record.
   * The payload is syntax-level evidence and is never regenerated from the
   * semantic fields.
   */
  get originalBinaryPayload(): Uint8Array | undefined {
    return this._originalBinaryPayload?.slice()
  }

  setOriginalBinaryPayload(payload: Uint8Array | undefined): this {
    this._originalBinaryPayload = payload?.slice()
    return this
  }

  getAltiumMeasurement(key: string): AltiumMeasurementValue | undefined {
    return parseAltiumMeasurement(this.getCaseInsensitive(key))
  }

  get recordKind(): string | undefined {
    return this.get("RECORD")
  }

  get fields(): AltiumField[] {
    return this.items.filter(
      (item): item is AltiumField => item instanceof AltiumField,
    )
  }

  get(key: string): string | undefined {
    return this.fields.find((field) => field.key === key)?.value
  }

  getCaseInsensitive(key: string): string | undefined {
    const normalizedKey = key.toUpperCase()
    return this.fields.find(
      (field) => field.key.toUpperCase() === normalizedKey,
    )?.value
  }

  getDecoded(key: string): string | undefined {
    const utf8Value = this.getCaseInsensitive(`%UTF8%${key}`)
    return utf8Value === undefined
      ? this.getCaseInsensitive(key)
      : decodeEmbeddedUtf8Mojibake(utf8Value)
  }

  getAll(key: string): string[] {
    return this.fields
      .filter((field) => field.key === key)
      .map((field) => field.value)
  }

  getFirstField(key: string): AltiumField | undefined {
    return this.fields.find((field) => field.key === key)
  }

  getLastField(key: string): AltiumField | undefined {
    return this.fields.findLast((field) => field.key === key)
  }

  getAllFields(key: string): AltiumField[] {
    return this.fields.filter((field) => field.key === key)
  }

  getBoolean(key: string): boolean | undefined {
    const value = this.getCaseInsensitive(key)?.toUpperCase()
    if (value === "TRUE" || value === "T") return true
    if (value === "FALSE" || value === "F") return false
    return undefined
  }

  getNumber(key: string): number | undefined {
    const value = this.getCaseInsensitive(key)
    if (value === undefined || !isPlainNumber(value)) return undefined
    return Number(value)
  }

  getMeasurement(key: string): AltiumMeasurementParts | undefined {
    const value = this.getCaseInsensitive(key)
    if (value === undefined) return undefined

    const match =
      /^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]+)?\s*$/iu.exec(
        value,
      )
    if (!match?.[1]) return undefined

    const unit = match[2]
    return unit === undefined
      ? { value: Number(match[1]) }
      : { value: Number(match[1]), unit }
  }

  set(key: string, value: string): this {
    const existing = this.fields.find((field) => field.key === key)
    if (existing) {
      existing.value = value
    } else {
      const field = new AltiumField({ key, value }).setParent(this)
      this.items.push(field)
      this.markDirty()
    }
    return this
  }

  setMeasurement(
    key: string,
    value: AltiumMeasurementInput,
    defaultUnit: AltiumMeasurementUnit = "mil",
  ): this {
    return this.set(key, formatAltiumMeasurement(value, defaultUnit))
  }

  setPoint(
    keys: { x: string; y: string },
    point: AltiumPoint,
    unit: AltiumMeasurementUnit = "mil",
  ): this {
    this.setMeasurement(keys.x, point.x, unit)
    this.setMeasurement(keys.y, point.y, unit)
    return this
  }

  setSize(
    keys: { height: string; width: string },
    size: AltiumSize,
    unit: AltiumMeasurementUnit = "mil",
  ): this {
    this.setMeasurement(keys.width, size.width, unit)
    this.setMeasurement(keys.height, size.height, unit)
    return this
  }

  setAngle(key: string, angle: number): this {
    if (!Number.isFinite(angle)) {
      throw new RangeError("Altium angles must be finite")
    }
    return this.set(key, String(normalizeAltiumAngle(angle)))
  }

  insertField(
    key: string,
    value: string,
    options: {
      afterKey?: string
      beforeKey?: string
      index?: number
    } = {},
  ): AltiumField {
    const field = new AltiumField({ key, value }).setParent(this)
    let index = options.index
    if (index === undefined && options.beforeKey !== undefined) {
      index = this.items.findIndex(
        (item) => item instanceof AltiumField && item.key === options.beforeKey,
      )
    }
    if (index === undefined && options.afterKey !== undefined) {
      const after = this.items.findLastIndex(
        (item) => item instanceof AltiumField && item.key === options.afterKey,
      )
      index = after < 0 ? this.items.length : after + 1
    }
    const boundedIndex =
      index === undefined
        ? this.items.length
        : Math.min(Math.max(index, 0), this.items.length)
    this.items.splice(boundedIndex, 0, field)
    this.markDirty()
    return field
  }

  replaceFieldOccurrence(
    key: string,
    occurrence: number,
    value: string,
  ): boolean {
    if (!Number.isInteger(occurrence) || occurrence < 0) return false
    const field = this.getAllFields(key)[occurrence]
    if (!field) return false
    field.value = value
    return true
  }

  delete(key: string): number {
    const originalLength = this.items.length
    const removed = this.items.filter(
      (item) => item instanceof AltiumField && item.key === key,
    )
    this.items = this.items.filter(
      (item) => !(item instanceof AltiumField && item.key === key),
    )
    const deleted = originalLength - this.items.length
    if (deleted > 0) {
      for (const item of removed) item.setParent(undefined)
      this.markDirty()
    }
    return deleted
  }

  override getChildren(): AltiumNode[] {
    return [...this.items]
  }

  override getString(): string {
    return `|${this.items.map((item) => item.getString()).join("|")}`
  }

  override toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      nodeId: this.nodeId,
      sourceLocation: this.sourceLocation,
      recordKind: this.recordKind,
      originalBinaryPayloadLength: this._originalBinaryPayload?.byteLength,
      fields: this.fields.map((field) => ({
        key: field.key,
        value: field.value,
      })),
      items: this.items.map((item) => item.toJSON()),
    }
  }
}

function isPlainNumber(value: string): boolean {
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu.test(value.trim())
}

const WINDOWS_1252_SPECIAL_BYTES = new Map<string, number>([
  ["€", 0x80],
  ["‚", 0x82],
  ["ƒ", 0x83],
  ["„", 0x84],
  ["…", 0x85],
  ["†", 0x86],
  ["‡", 0x87],
  ["ˆ", 0x88],
  ["‰", 0x89],
  ["Š", 0x8a],
  ["‹", 0x8b],
  ["Œ", 0x8c],
  ["Ž", 0x8e],
  ["‘", 0x91],
  ["’", 0x92],
  ["“", 0x93],
  ["”", 0x94],
  ["•", 0x95],
  ["–", 0x96],
  ["—", 0x97],
  ["˜", 0x98],
  ["™", 0x99],
  ["š", 0x9a],
  ["›", 0x9b],
  ["œ", 0x9c],
  ["ž", 0x9e],
  ["Ÿ", 0x9f],
])

/**
 * ASCII Altium files can store UTF-8 bytes inside `%UTF8%` fields while the
 * surrounding file requires Windows-1252 decoding. Undo that one layer of
 * mojibake when the value maps back to a valid UTF-8 byte sequence.
 */
function decodeEmbeddedUtf8Mojibake(value: string): string {
  const bytes: number[] = []
  for (const character of value) {
    const specialByte = WINDOWS_1252_SPECIAL_BYTES.get(character)
    if (specialByte !== undefined) {
      bytes.push(specialByte)
      continue
    }
    const codePoint = character.codePointAt(0)
    if (codePoint === undefined || codePoint > 0xff) return value
    bytes.push(codePoint)
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(bytes),
    )
  } catch {
    return value
  }
}
