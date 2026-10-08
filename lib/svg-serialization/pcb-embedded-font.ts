import opentype, { type Font } from "opentype.js"
import { AltiumBinaryPcbDoc } from "../altium-binary-pcb-doc"
import type { AltiumEmbeddedFont } from "../altium-embedded-font"
import type { AltiumPcbDocument } from "../altium-pcb-document"
import type { AltiumRecord } from "../records/altium-record"
import type { PcbTextPositioning } from "./pcb-text-positioning"

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
      font.italic === (record.getBoolean("ITALIC") === true),
  )
}

/** Use outlines so the SVG is independent of installed fonts and @font-face support. */
export function getPcbEmbeddedTextPath(
  embeddedFont: AltiumEmbeddedFont,
  text: string,
  height: number,
  positioning: PcbTextPositioning,
): string | undefined {
  try {
    let font = parsedFonts.get(embeddedFont)
    if (font === undefined) {
      // Cache failure as well as success: a broken font can be used by many records.
      parsedFonts.set(embeddedFont, null)
      font = opentype.parse(embeddedFont.getDecompressedBytes().buffer)
      parsedFonts.set(embeddedFont, font)
    }
    if (!font) return undefined
    const lines = text.split("\n")
    if (
      lines.some((line) =>
        Array.from(line).some((character) => !font.hasChar(character)),
      )
    )
      return undefined
    const ascent = Number(font.tables.os2?.usWinAscent ?? font.ascender)
    const descent = Number(font.tables.os2?.usWinDescent ?? -font.descender)
    if (
      ![ascent, descent, font.unitsPerEm, height].every(Number.isFinite) ||
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
      positioning.baseline === "text-before-edge"
        ? ascent * scale
        : positioning.baseline === "central"
          ? ((ascent - descent) * scale) / 2
          : -descent * scale
    const paths = lines.map((line, index) => {
      const advance = font.getAdvanceWidth(line, fontSize)
      const x =
        positioning.anchor === "middle"
          ? -advance / 2
          : positioning.anchor === "end"
            ? -advance
            : 0
      return font
        .getPath(line, x, baseline + index * height * 1.2, fontSize)
        .toPathData(4)
    })
    const path = paths.join(" ")
    return /NaN|Infinity/u.test(path) ? undefined : path
  } catch {
    // Unsupported fonts/glyphs retain the existing system-font fallback.
    return undefined
  }
}
