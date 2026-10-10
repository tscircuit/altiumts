import type { AltiumRecord } from "../records/altium-record"
import { getPcbMeasurement } from "./altium-values"

export function isArialTrueTypePcbText(record: AltiumRecord): boolean {
  const usesTrueType =
    record.getBoolean("USETTFONTS") ?? record.getNumber("FONTTYPE") === 1
  const family = (record.getDecoded("FONTNAME") || "Arial").trim().toLowerCase()
  return usesTrueType && family === "arial"
}

/** Convert Altium's TrueType cell height to the em size expected by SVG. */
export function getPcbTextFontSize(record: AltiumRecord): number {
  const height = Math.max(getPcbMeasurement(record, "HEIGHT", 30), 3)
  if (!isArialTrueTypePcbText(record)) return height

  // Arial regular, bold, italic and bold-italic share head.unitsPerEm=2048
  // and OS/2 Windows ascent/descent=1854/434. HEIGHT includes both, whereas
  // SVG font-size specifies the em. Do not guess metrics for other fonts.
  return (height * 2048) / (1854 + 434)
}
