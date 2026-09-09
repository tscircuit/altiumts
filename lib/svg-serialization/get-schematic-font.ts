import type { AltiumRecord } from "../records/altium-record"
import type { AltiumSchSheetRecord } from "../records/altium-schematic-records"
import { readSchematicInteger } from "./altium-values"
import { escapeXml, formatSvgNumber } from "./svg-utils"

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
    ? readSchematicInteger(sheetRecord?.getCaseInsensitive("SYSTEMFONT"), 0)
    : 0
  // Pin name and number each have an independent custom-font flag and ID.
  // Older pin records instead store their shared font in FONTID.
  const customPinFont = pinText
    ? (readSchematicInteger(
        record.getCaseInsensitive(`PIN${pinText}_POSITIONCONGLOMERATE`),
        0,
      ) &
        0x10) !==
      0
    : false
  const recordFontId = readSchematicInteger(
    record.getCaseInsensitive("FONTID"),
    systemFontId,
  )
  const legacyPinFontId =
    pinText &&
    record.getCaseInsensitive("PINNAME_POSITIONCONGLOMERATE") === undefined &&
    record.getCaseInsensitive("PINDESIGNATOR_POSITIONCONGLOMERATE") ===
      undefined &&
    sheetRecord?.getCaseInsensitive(`SIZE${recordFontId}`) !== undefined
      ? recordFontId
      : systemFontId
  const requestedFontId = pinText
    ? customPinFont
      ? readSchematicInteger(
          record.getCaseInsensitive(`${pinText}_CUSTOMFONTID`),
          systemFontId,
        )
      : legacyPinFontId
    : readSchematicInteger(
        record.getCaseInsensitive(fontIdFieldName),
        systemFontId,
      )
  // A missing system font uses Altium's Times New Roman 10 default. An
  // invalid SIZE token falls back to 10, retaining the selected family;
  // this reproduces the fallback seen in the supplied Altium 365 capture.
  const fontId = requestedFontId > 0 ? requestedFontId : systemFontId
  // SIZE is a native integer font-table entry, not a coordinate.
  // In particular, SIZE*_FRAC does not increase the native font size.
  const selectedSize = sheetRecord
    ? readSchematicInteger(sheetRecord.getCaseInsensitive(`SIZE${fontId}`), 10)
    : 10
  const size = selectedSize > 0 ? selectedSize : 10
  const family =
    sheetRecord?.getDecoded(`FONTNAME${fontId}`) ?? "Times New Roman"
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
