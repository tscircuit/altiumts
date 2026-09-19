import {
  AltiumLine,
  type AltiumLineInit,
  type AltiumLineTerminator,
} from "../base/altium-line"
import { AltiumNode } from "../base/altium-node"
import {
  type AltiumTextEncoding,
  encodeAltiumText,
} from "../parser/decode-altium-text"

export abstract class AltiumIniLine extends AltiumLine {
  abstract override readonly type: string
}

export class AltiumIniSectionLine extends AltiumIniLine {
  override readonly type = "ini-section-line"
  private _name: string
  readonly leading: string
  readonly trailing: string

  constructor(
    init: {
      leading?: string
      name: string
      trailing?: string
    } & AltiumLineInit,
  ) {
    super(init)
    this._name = init.name
    this.leading = init.leading ?? ""
    this.trailing = init.trailing ?? ""
  }

  get name(): string {
    return this._name
  }

  set name(name: string) {
    if (/[\]\r\n]/u.test(name)) {
      throw new Error("INI section names cannot contain closing brackets")
    }
    if (name === this._name) return
    this._name = name
    this.markDirty()
  }

  override getChildren(): AltiumNode[] {
    return []
  }

  override getString(): string {
    return `${this.leading}[${this.name}]${this.trailing}`
  }
}

export class AltiumIniKeyValueLine extends AltiumIniLine {
  override readonly type = "ini-key-value-line"
  private _key: string
  private _value: string
  readonly afterEquals: string
  readonly beforeEquals: string
  readonly leading: string

  constructor(
    init: {
      afterEquals?: string
      beforeEquals?: string
      key: string
      leading?: string
      value?: string
    } & AltiumLineInit,
  ) {
    super(init)
    this._key = init.key
    this._value = init.value ?? ""
    this.leading = init.leading ?? ""
    this.beforeEquals = init.beforeEquals ?? ""
    this.afterEquals = init.afterEquals ?? ""
  }

  get key(): string {
    return this._key
  }

  set key(key: string) {
    if (key.length === 0 || /[=\r\n]/u.test(key)) {
      throw new Error("INI keys must be non-empty and cannot contain '='")
    }
    if (key === this._key) return
    this._key = key
    this.markDirty()
  }

  get value(): string {
    return this._value
  }

  set value(value: string) {
    if (/[\r\n]/u.test(value)) {
      throw new Error("INI values cannot contain line terminators")
    }
    if (value === this._value) return
    this._value = value
    this.markDirty()
  }

  override getChildren(): AltiumNode[] {
    return []
  }

  override getString(): string {
    return `${this.leading}${this.key}${this.beforeEquals}=${this.afterEquals}${this.value}`
  }
}

export class AltiumIniCommentLine extends AltiumIniLine {
  override readonly type: string = "ini-comment-line"
  private _raw: string

  constructor(init: { raw: string } & AltiumLineInit) {
    super(init)
    this._raw = init.raw
  }

  get raw(): string {
    return this._raw
  }

  set raw(raw: string) {
    if (/[\r\n]/u.test(raw)) {
      throw new Error("INI comments cannot contain line terminators")
    }
    if (raw === this._raw) return
    this._raw = raw
    this.markDirty()
  }

  override getChildren(): AltiumNode[] {
    return []
  }

  override getString(): string {
    return this.raw
  }
}

export class AltiumIniRawLine extends AltiumIniCommentLine {
  override readonly type = "ini-raw-line"
}

export interface AltiumIniSection {
  entries: AltiumIniKeyValueLine[]
  header?: AltiumIniSectionLine
  name: string
}

export class AltiumIniDocument extends AltiumNode {
  override readonly type: string = "ini-document"
  private _lines: AltiumIniLine[]
  private originalBytes?: Uint8Array
  private readonly originalSource?: string
  private sourceEncoding?: AltiumTextEncoding

  constructor(
    init: {
      lines?: AltiumIniLine[]
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

  get lines(): AltiumIniLine[] {
    return this._lines
  }

  set lines(lines: AltiumIniLine[]) {
    if (lines === this._lines) return
    this._lines = lines
    this.adoptChildren(lines)
    this.markDirty()
  }

  get sections(): AltiumIniSection[] {
    const sections: AltiumIniSection[] = [{ entries: [], name: "" }]
    for (const line of this.lines) {
      if (line instanceof AltiumIniSectionLine) {
        sections.push({ entries: [], header: line, name: line.name })
      } else if (line instanceof AltiumIniKeyValueLine) {
        sections.at(-1)?.entries.push(line)
      }
    }
    return sections
  }

  getSection(name: string): AltiumIniSection | undefined {
    const normalized = name.toUpperCase()
    return this.sections.find(
      (section) => section.name.toUpperCase() === normalized,
    )
  }

  getAll(sectionName: string, key: string): string[] {
    const normalized = key.toUpperCase()
    return (
      this.getSection(sectionName)
        ?.entries.filter((entry) => entry.key.toUpperCase() === normalized)
        .map((entry) => entry.value) ?? []
    )
  }

  get(sectionName: string, key: string): string | undefined {
    return this.getAll(sectionName, key)[0]
  }

  set(sectionName: string, key: string, value: string): this {
    const section = this.getSection(sectionName)
    const normalized = key.toUpperCase()
    const existing = section?.entries.find(
      (entry) => entry.key.toUpperCase() === normalized,
    )
    if (existing) {
      existing.value = value
      return this
    }

    const terminator = inferTerminator(this)
    let insertionIndex = this.lines.length
    if (!section) {
      const previous = this.lines.at(-1)
      if (previous && previous.terminator === "") {
        previous.terminator = terminator
        previous.markDirty()
      }
      const header = new AltiumIniSectionLine({
        name: sectionName,
        terminator,
      }).setParent(this)
      this.lines.push(header)
      insertionIndex = this.lines.length
    } else {
      const headerIndex = section.header
        ? this.lines.indexOf(section.header)
        : -1
      const nextSectionIndex = this.lines.findIndex(
        (line, index) =>
          index > headerIndex && line instanceof AltiumIniSectionLine,
      )
      insertionIndex =
        nextSectionIndex < 0 ? this.lines.length : nextSectionIndex
    }
    const previous = this.lines[insertionIndex - 1]
    if (previous && previous.terminator === "") {
      previous.terminator = terminator
      previous.markDirty()
    }
    const entry = new AltiumIniKeyValueLine({
      key,
      terminator,
      value,
    }).setParent(this)
    this.lines.splice(insertionIndex, 0, entry)
    this.markDirty()
    return this
  }

  removeSection(name: string): boolean {
    const section = this.getSection(name)
    if (!section) return false
    const firstIndex = section.header ? this.lines.indexOf(section.header) : 0
    const nextSectionIndex = this.lines.findIndex(
      (line, index) =>
        index > firstIndex && line instanceof AltiumIniSectionLine,
    )
    const deleteCount =
      (nextSectionIndex < 0 ? this.lines.length : nextSectionIndex) - firstIndex
    const removed = this.lines.splice(firstIndex, deleteCount)
    for (const line of removed) line.setParent(undefined)
    this.markDirty()
    return true
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

export function parseAltiumIni(source: string): AltiumIniDocument {
  return new AltiumIniDocument({
    lines: parseAltiumIniLines(source),
    originalSource: source,
  })
}

export function parseAltiumIniLines(source: string): AltiumIniLine[] {
  return splitIniLines(source).map(
    ({ content, lineNumber, startOffset, terminator }) => {
      const location = {
        column: 1,
        endColumn: content.length + 1,
        endLine: lineNumber,
        endOffset: startOffset + content.length,
        line: lineNumber,
        startOffset,
      }
      const common = {
        nodeId: `ini:${startOffset}`,
        sourceLocation: location,
        terminator,
      }
      const section = /^(\s*)\[([^\]]*)\](\s*)$/u.exec(content)
      if (section?.[2] !== undefined) {
        return new AltiumIniSectionLine({
          ...common,
          leading: section[1],
          name: section[2],
          trailing: section[3],
        })
      }
      if (/^\s*[;#]/u.test(content)) {
        return new AltiumIniCommentLine({ ...common, raw: content })
      }
      const equals = content.indexOf("=")
      if (equals > 0) {
        const rawKey = content.slice(0, equals)
        const leading = /^\s*/u.exec(rawKey)?.[0] ?? ""
        const keyAndSpace = rawKey.slice(leading.length)
        const key = keyAndSpace.trimEnd()
        const beforeEquals = keyAndSpace.slice(key.length)
        const rawValue = content.slice(equals + 1)
        const afterEquals = /^\s*/u.exec(rawValue)?.[0] ?? ""
        return new AltiumIniKeyValueLine({
          ...common,
          afterEquals,
          beforeEquals,
          key,
          leading,
          value: rawValue.slice(afterEquals.length),
        })
      }
      return new AltiumIniRawLine({ ...common, raw: content })
    },
  )
}

function splitIniLines(source: string): Array<{
  content: string
  lineNumber: number
  startOffset: number
  terminator: AltiumLineTerminator
}> {
  const lines: Array<{
    content: string
    lineNumber: number
    startOffset: number
    terminator: AltiumLineTerminator
  }> = []
  let start = 0
  let lineNumber = 1
  for (let index = 0; index < source.length; index++) {
    const character = source[index]
    if (character !== "\r" && character !== "\n") continue
    const crlf = character === "\r" && source[index + 1] === "\n"
    lines.push({
      content: source.slice(start, index),
      lineNumber,
      startOffset: start,
      terminator: crlf ? "\r\n" : character,
    })
    if (crlf) index++
    start = index + 1
    lineNumber++
  }
  if (start < source.length) {
    lines.push({
      content: source.slice(start),
      lineNumber,
      startOffset: start,
      terminator: "",
    })
  }
  return lines
}

function inferTerminator(document: AltiumIniDocument): AltiumLineTerminator {
  return (
    document.lines.find((line) => line.terminator !== "")?.terminator ?? "\n"
  )
}
