import type { AltiumRecord } from "../records/altium-record"
import type { AltiumSchSheetRecord } from "../records/altium-schematic-records"
import { escapeXml, formatSvgNumber } from "./svg-utils"

type GetSchematicFontInput = {
  fallbackSize: number
  fontIdFieldName?: string
  record: AltiumRecord
  sheetRecord: AltiumSchSheetRecord | undefined
}

export type SchematicFont = {
  attributes: string
  family: string
  size: number
}

// Altium stores schematic font sizes in points, but schematic geometry uses
// 10 mil coordinate units. One point is 1/72 inch, or 100/72 schematic units.
const ALTIUM_SCHEMATIC_UNITS_PER_POINT = 100 / 72

export function getSchematicFont({
  fallbackSize,
  fontIdFieldName = "FONTID",
  record,
  sheetRecord,
}: GetSchematicFontInput): SchematicFont {
  const fontId = Math.max(
    Math.round(Number(record.getCaseInsensitive(fontIdFieldName) ?? 1)),
    1,
  )
  const sizePoints = Math.max(
    Number(sheetRecord?.getCaseInsensitive(`SIZE${fontId}`) ?? fallbackSize),
    1,
  )
  const size = sizePoints * ALTIUM_SCHEMATIC_UNITS_PER_POINT
  const family =
    sheetRecord?.getDecoded(`FONTNAME${fontId}`) ?? "Arial, sans-serif"
  const weight =
    sheetRecord?.getBoolean(`BOLD${fontId}`) === true ? "bold" : "normal"
  const style =
    sheetRecord?.getBoolean(`ITALIC${fontId}`) === true ? "italic" : "normal"
  const decoration =
    sheetRecord?.getBoolean(`UNDERLINE${fontId}`) === true
      ? "underline"
      : "none"
  return {
    attributes: `font-family="${escapeXml(family)}" font-size="${formatSvgNumber(size)}" font-style="${style}" font-weight="${weight}" text-decoration="${decoration}"`,
    family,
    size,
  }
}
