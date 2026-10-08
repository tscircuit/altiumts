import { expect, test } from "bun:test"
import CFB from "cfb"
import { zlibSync } from "fflate"
import { Font, Glyph, Path } from "opentype.js"
import {
  AltiumCorruptContainerError,
  AltiumEmbeddedFont,
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbDocToBinary,
  serializeAltiumPcbToSvg,
} from "../lib"
import { AltiumBinaryWriter } from "../lib/binary/altium-binary-io"
import { parseAltiumEmbeddedFonts } from "../lib/parser/parse-altium-embedded-fonts"
import {
  addAltiumBinarySection,
  writeAltiumCompoundFile,
} from "../lib/serialization/altium-binary-container"
import { getPcbEmbeddedFont } from "../lib/svg-serialization/pcb-embedded-font"
import { readReferenceBytes } from "./svg/read-reference"

test("reads Elk Pi embedded font metadata without changing the original PCB bytes", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const fonts = document.embeddedFonts
  expect(fonts.map(({ name }) => name)).toEqual([
    "Arial",
    "elk_logo_new",
    "Inter Bold",
    "Inter Regular",
    "Open Sans",
    "open-hardware-logo-neg",
  ])
  expect(fonts[2]).toMatchObject({
    family: "Inter",
    style: "Bold",
    bold: true,
    italic: false,
  })
  expect(fonts[1]?.getDecompressedBytes()).toHaveLength(1272)
  expect(fonts[5]?.getDecompressedBytes()).toHaveLength(4000)
  expect(fonts[1]?.sourceLocation).toMatchObject({
    streamPath: "/EmbeddedFonts6/Data",
    recordIndex: 1,
    byteOffset: 539267,
  })
  expect(fonts.every((font) => font.parent === document)).toBeTrue()
  expect(document.embeddedFonts).toBe(fonts)
  expect(document.isDirty).toBeFalse()
  expect(document.getBytes()).toEqual(source)
})

test("renders arbitrary embedded font names with the matching style and native text transforms", () => {
  const document = makeFontDocument({ bold: true, italic: true })
  const record = document.texts[0]
  if (!record) throw new Error("Expected a text record")
  const font = getPcbEmbeddedFont(document, record)
  expect(font).toMatchObject({
    family: "Test Symbols",
    bold: true,
    italic: true,
  })
  const svg = serializeAltiumPcbToSvg(document)
  expect(svg).toContain(
    'data-font-source="embedded" data-font-name="test symbols" aria-label="a"',
  )
  expect(svg).toContain("rotate(-90) scale(-1 1)")
  expect(svg).toContain('fill="#f8fafc"')
  expect(svg).toContain('<path d="M0-20L60-20L30-100"/>')
  expect(svg).not.toContain(">a</text>")
  // Full-name and family-name matching both work, without mixing regular/bold/italic.
  record.set("FONTNAME", "Test Symbols Bold Italic")
  expect(getPcbEmbeddedFont(document, record)).toBe(font)
  record.set("BOLD", "FALSE")
  expect(getPcbEmbeddedFont(document, record)).toBeUndefined()
  expect(serializeAltiumPcbToSvg(document)).toContain(">a</text>")
})

test("uses embedded font cell metrics for centered and multiline text", () => {
  const document = makeFontDocument()
  const record = document.texts[0]
  if (!record) throw new Error("Expected a text record")
  record.set("JUSTIFICATION", "5")
  expect(serializeAltiumPcbToSvg(document)).toContain(
    '<path d="M-30 30L30 30L0-50"/>',
  )
  record.set("JUSTIFICATION", "3")
  record.set("WIDESTRING", "97,10,97")
  expect(serializeAltiumPcbToSvg(document)).toContain(
    '<path d="M0-20L60-20L30-100 M0 100L60 100L30 20"/>',
  )
})

test("keeps system-font fallback for missing glyphs, missing styles, stroke text, and corrupt fonts", () => {
  const document = makeFontDocument()
  const record = document.texts[0]
  if (!record) throw new Error("Expected a text record")
  record.set("WIDESTRING", "98") // The generated font contains only 'a'.
  expect(serializeAltiumPcbToSvg(document)).toContain(">b</text>")
  record.set("WIDESTRING", "97")
  record.set("FONTNAME", "Not embedded")
  expect(serializeAltiumPcbToSvg(document)).toContain(">a</text>")
  record.set("FONTNAME", "Test Symbols")
  record.set("FONTTYPE", "0")
  expect(serializeAltiumPcbToSvg(document)).toContain(">a</text>")
  const corrupt = makeFontDocument({
    compressedBytes: Uint8Array.of(0x78, 0x9c, 0),
  })
  expect(serializeAltiumPcbToSvg(corrupt)).toContain(">a</text>")
  expect(serializeAltiumPcbToSvg(corrupt)).toContain(">a</text>")
  const invalidFont = makeFontDocument({
    compressedBytes: zlibSync(Uint8Array.of(1, 2, 3)),
  })
  expect(serializeAltiumPcbToSvg(invalidFont)).toContain(">a</text>")
})

test("skips embedded font loading when PCB text is hidden and tolerates broken font metadata", () => {
  const document = makeFontDocument()
  const stream = document.compoundFile.getStream("/EmbeddedFonts6/Data")
  if (!stream) throw new Error("Expected embedded font data")
  let reads = 0
  const getter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(document),
    "embeddedFonts",
  )?.get
  if (!getter) throw new Error("Expected embedded font accessor")
  Object.defineProperty(document, "embeddedFonts", {
    get() {
      reads++
      return getter.call(document)
    },
  })
  expect(serializeAltiumPcbToSvg(document, { showText: false })).not.toContain(
    'data-record="Text"',
  )
  expect(reads).toBe(0)
  stream.replaceContent(Uint8Array.of(255, 255, 255, 255))
  expect(serializeAltiumPcbToSvg(document)).toContain(">a</text>")
})

test("rejects truncated font records, invalid UTF-16 lengths, oversized names, and mismatched counts", () => {
  const record = fontRecord(zlibSync(Uint8Array.of(1, 2, 3)))
  expect(() => parseAltiumEmbeddedFonts(record.slice(0, -1))).toThrow()
  expect(() => parseAltiumEmbeddedFonts(record, 2)).toThrow(
    AltiumCorruptContainerError,
  )
  expect(() => parseAltiumEmbeddedFonts(Uint8Array.of(1, 0, 0, 0, 65))).toThrow(
    AltiumCorruptContainerError,
  )
  expect(() =>
    parseAltiumEmbeddedFonts(Uint8Array.of(255, 255, 255, 255)),
  ).toThrow()
  expect(parseAltiumEmbeddedFonts(new Uint8Array(), 0)).toEqual([])
})

test("bounds embedded font decompression and rejects empty or truncated zlib streams", () => {
  const font = new AltiumEmbeddedFont({
    name: "Test",
    family: "Test",
    style: "Regular",
    bold: false,
    italic: false,
    compressedBytes: zlibSync(new Uint8Array(1024)),
  })
  expect(() => font.getDecompressedBytes(100)).toThrow(
    AltiumCorruptContainerError,
  )
  expect(font.getDecompressedBytes(1024)).toHaveLength(1024)
  expect(() => font.getDecompressedBytes(0)).toThrow(RangeError)
  for (const compressedBytes of [
    new Uint8Array(),
    Uint8Array.of(0x78, 0x9c, 0),
  ]) {
    const broken = new AltiumEmbeddedFont({
      name: "Test",
      family: "Test",
      style: "Regular",
      bold: false,
      italic: false,
      compressedBytes,
    })
    expect(() => broken.getDecompressedBytes()).toThrow(
      AltiumCorruptContainerError,
    )
  }
})

function makeFontDocument(
  options: {
    bold?: boolean
    italic?: boolean
    compressedBytes?: Uint8Array
  } = {},
) {
  const path = new Path()
  path.moveTo(0, 0)
  path.lineTo(600, 0)
  path.lineTo(300, 800)
  path.close()
  const font = new Font({
    familyName: "Test Symbols",
    styleName: "Regular",
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs: [
      new Glyph({ name: ".notdef", advanceWidth: 600, path: new Path() }),
      new Glyph({ name: "a", unicode: 97, advanceWidth: 600, path }),
    ],
  })
  const os2 = font.tables.os2
  if (!os2) throw new Error("Expected generated font metrics")
  os2.usWinAscent = 800
  os2.usWinDescent = 200
  const bytes = serializeAltiumPcbDocToBinary(
    [
      "|RECORD=Board|KIND0=0|VX0=0mil|VY0=0mil|KIND1=0|VX1=1000mil|VY1=0mil|KIND2=0|VX2=1000mil|VY2=1000mil",
      `|RECORD=Text|LAYER=TOPOVERLAY|X=200mil|Y=200mil|HEIGHT=100mil|TEXT=a|FONTNAME=test symbols|USETTFONTS=TRUE|JUSTIFICATION=3|ROTATION=90|MIRROR=TRUE|BOLD=${options.bold ? "TRUE" : "FALSE"}|ITALIC=${options.italic ? "TRUE" : "FALSE"}`,
    ].join("\r\n"),
  )
  const compoundFile = CFB.read(bytes, { type: "array" })
  addAltiumBinarySection({
    compoundFile,
    name: "EmbeddedFonts6",
    recordCount: 1,
    content: fontRecord(
      options.compressedBytes ?? zlibSync(new Uint8Array(font.toArrayBuffer())),
      options.bold,
      options.italic,
    ),
  })
  return parseAltiumBinaryPcbDoc(writeAltiumCompoundFile(compoundFile))
}

function fontRecord(
  compressedBytes: Uint8Array,
  bold = false,
  italic = false,
): Uint8Array {
  const writer = new AltiumBinaryWriter()
  const style =
    [bold ? "Bold" : "", italic ? "Italic" : ""].filter(Boolean).join(" ") ||
    "Regular"
  for (const name of [`Test Symbols ${style}`, "Test Symbols", style]) {
    const bytes = Buffer.from(`${name}\0`, "utf16le")
    writer.uint32LengthPrefixedBytes(bytes)
  }
  return writer
    .uint8(Number(bold))
    .uint8(Number(italic))
    .uint8(1)
    .uint32LengthPrefixedBytes(compressedBytes)
    .toUint8Array()
}
