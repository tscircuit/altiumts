import opentype, { type Font } from "opentype.js"
import { AltiumBinaryPcbDoc } from "../altium-binary-pcb-doc"
import type { AltiumEmbeddedFont } from "../altium-embedded-font"
import type { AltiumPcbDocument } from "../altium-pcb-document"
import type { AltiumRecord } from "../records/altium-record"
import type { PcbTextPositioning } from "./pcb-text-positioning"

// Limits apply per text record, before building the combined glyph outline.
const MAX_TEXT_LENGTH = 4096
const MAX_PATH_COMMANDS = 32_768
const MAX_PATH_LENGTH = 512 * 1024

const documentFonts = new WeakMap<
  AltiumPcbDocument,
  readonly AltiumEmbeddedFont[]
>()
const parsedFonts = new WeakMap<AltiumEmbeddedFont, Font | null>()

export function getPcbEmbeddedFont(
  document: AltiumPcbDocument,
  record: AltiumRecord,
): AltiumEmbeddedFont | undefined {
  if (
    record.recordKind !== "Text" ||
    !(record.getBoolean("USETTFONTS") ?? record.getNumber("FONTTYPE") === 1)
  )
    return undefined
  if (!(document instanceof AltiumBinaryPcbDoc)) return undefined
  let fonts = documentFonts.get(document)
  if (!fonts) {
    try {
      fonts = document.embeddedFonts
    } catch {
      // Damaged optional fonts must not prevent the rest of a PCB from rendering.
      fonts = []
    }
    documentFonts.set(document, fonts)
  }
  const name = record.getDecoded("FONTNAME")?.trim().toLowerCase()
  return fonts.find(
    (font) =>
      (font.name.toLowerCase() === name ||
        font.family.toLowerCase() === name) &&
      font.bold === (record.getBoolean("BOLD") === true) &&
      font.italic === (record.getBoolean("ITALIC") === true) &&
      getParsedFont(font) !== null,
  )
}

/** Use outlines so the SVG is independent of installed fonts and @font-face support. */
export function getPcbEmbeddedTextPath({
  embeddedFont,
  text,
  height,
  lineHeight,
  positioning,
}: {
  embeddedFont: AltiumEmbeddedFont
  text: string
  height: number
  lineHeight: number
  positioning: {
    anchor: PcbTextPositioning["anchor"]
    baseline: PcbTextPositioning["baseline"] | "alphabetic"
    y: number
  }
}): string | undefined {
  try {
    if (text.length > MAX_TEXT_LENGTH) return undefined
    const font = getParsedFont(embeddedFont)
    if (!font) return undefined
    const lines = text.split("\n")
    if (
      lines.some((line) =>
        Array.from(line).some((character) => !font.hasChar(character)),
      )
    )
      return undefined
    let commandCount = 0
    for (const line of lines) {
      for (const glyph of font.stringToGlyphs(line)) {
        commandCount += glyph.path.commands.length
        if (commandCount > MAX_PATH_COMMANDS) return undefined
      }
    }
    const ascent = Number(font.tables.os2?.usWinAscent ?? font.ascender)
    const descent = Number(font.tables.os2?.usWinDescent ?? -font.descender)
    if (
      ![
        ascent,
        descent,
        font.unitsPerEm,
        height,
        lineHeight,
        positioning.y,
      ].every(Number.isFinite) ||
      ascent <= 0 ||
      descent < 0 ||
      font.unitsPerEm <= 0 ||
      height <= 0
    )
      return undefined
    // Altium HEIGHT is the TrueType character cell, not the em square.
    const scale = height / (ascent + descent)
    const fontSize = font.unitsPerEm * scale
    const baseline =
      positioning.y +
      (positioning.baseline === "alphabetic"
        ? 0
        : positioning.baseline === "text-before-edge"
          ? ascent * scale
          : positioning.baseline === "central"
            ? ((ascent - descent) * scale) / 2
            : -descent * scale)
    const paths: string[] = []
    let pathLength = 0
    let renderedCommandCount = 0
    for (const [index, line] of lines.entries()) {
      const advance = font.getAdvanceWidth(line, fontSize)
      const x =
        positioning.anchor === "middle"
          ? -advance / 2
          : positioning.anchor === "end"
            ? -advance
            : 0
      const glyphPath = font.getPath(
        line,
        x,
        baseline + index * lineHeight,
        fontSize,
      )
      renderedCommandCount += glyphPath.commands.length
      if (renderedCommandCount > MAX_PATH_COMMANDS) return undefined
      const path = glyphPath.toPathData(4)
      pathLength += path.length + (index === 0 ? 0 : 1)
      if (pathLength > MAX_PATH_LENGTH) return undefined
      paths.push(path)
    }
    const path = paths.join(" ")
    return /NaN|Infinity/u.test(path) ? undefined : path
  } catch {
    // Unsupported fonts/glyphs retain the existing system-font fallback.
    return undefined
  }
}

function getParsedFont(embeddedFont: AltiumEmbeddedFont): Font | null {
  const cachedFont = parsedFonts.get(embeddedFont)
  if (cachedFont !== undefined) return cachedFont
  let font: Font | null
  try {
    font = opentype.parse(embeddedFont.getDecompressedBytes().buffer)
  } catch {
    // Cache only font parsing failures, not per-text limits or missing glyphs.
    font = null
  }
  parsedFonts.set(embeddedFont, font)
  return font
}
