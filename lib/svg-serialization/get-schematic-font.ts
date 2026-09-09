import type { AltiumRecord } from "../records/altium-record"
import type { AltiumSchSheetRecord } from "../records/altium-schematic-records"
import { readSchematicInteger } from "./altium-values"
import { escapeXml, formatSvgNumber } from "./svg-utils"

const DEFAULT_SCHEMATIC_FONT_ID = 0
const DEFAULT_SCHEMATIC_FONT_SIZE = 10
const DEFAULT_SCHEMATIC_FONT_FAMILY = "Times New Roman"
const PIN_CUSTOM_FONT_ID_FLAG = 0x10

type GetSchematicFontInput = {
  fontIdFieldName?: string
  inheritSystemFont?: boolean
  pinText?: "NAME" | "DESIGNATOR"
  record: AltiumRecord
  sheetRecord: AltiumSchSheetRecord | undefined
}

export type SchematicFont = {
  attributes: string
  family: string
  size: number
}

export function getSchematicFont({
  fontIdFieldName = "FONTID",
  inheritSystemFont = true,
  pinText,
  record,
  sheetRecord,
}: GetSchematicFontInput): SchematicFont {
  const systemFontId = inheritSystemFont
    ? readSchematicInteger(
        sheetRecord?.getCaseInsensitive("SYSTEMFONT"),
        DEFAULT_SCHEMATIC_FONT_ID,
      )
    : DEFAULT_SCHEMATIC_FONT_ID
  // Pin name and number each have an independent custom-font flag and ID.
  // Older pin records instead store their shared font in FONTID.
  const hasCustomPinFont = pinText
    ? (readSchematicInteger(
        record.getCaseInsensitive(`PIN${pinText}_POSITIONCONGLOMERATE`),
        0,
      ) &
        PIN_CUSTOM_FONT_ID_FLAG) !==
      0
    : false
  const recordFontId = readSchematicInteger(
    record.getCaseInsensitive("FONTID"),
    systemFontId,
  )
  const isLegacyPinRecord =
    record.getCaseInsensitive("PINNAME_POSITIONCONGLOMERATE") === undefined &&
    record.getCaseInsensitive("PINDESIGNATOR_POSITIONCONGLOMERATE") ===
      undefined
  const legacyFontIsDefined =
    sheetRecord?.getCaseInsensitive(`SIZE${recordFontId}`) !== undefined
  const legacyPinFontId =
    pinText && isLegacyPinRecord && legacyFontIsDefined
      ? recordFontId
      : systemFontId

  let requestedFontId = readSchematicInteger(
    record.getCaseInsensitive(fontIdFieldName),
    systemFontId,
  )
  if (pinText) {
    requestedFontId = hasCustomPinFont
      ? readSchematicInteger(
          record.getCaseInsensitive(`${pinText}_CUSTOMFONTID`),
          systemFontId,
        )
      : legacyPinFontId
  }
  // A missing system font uses Altium's Times New Roman 10 default. An
  // invalid SIZE token falls back to 10, retaining the selected family;
  // this reproduces the fallback seen in the supplied Altium 365 capture.
  const fontId = requestedFontId > 0 ? requestedFontId : systemFontId
  // SIZE is a native integer font-table entry, not a coordinate.
  // In particular, SIZE*_FRAC does not increase the native font size.
  const selectedSize = sheetRecord
    ? readSchematicInteger(
        sheetRecord.getCaseInsensitive(`SIZE${fontId}`),
        DEFAULT_SCHEMATIC_FONT_SIZE,
      )
    : DEFAULT_SCHEMATIC_FONT_SIZE
  const size = selectedSize > 0 ? selectedSize : DEFAULT_SCHEMATIC_FONT_SIZE
  const family =
    sheetRecord?.getDecoded(`FONTNAME${fontId}`) ??
    DEFAULT_SCHEMATIC_FONT_FAMILY
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
