import type { AltiumSchSheetRecord } from "../records/altium-schematic-records"

const ALTIUM_STANDARD_SHEET_SIZES: ReadonlyArray<readonly [number, number]> = [
  // A4-A0, ANSI A-E, Letter/Legal/Tabloid, and OrCAD A-E.
  [1150, 760],
  [1550, 1110],
  [2230, 1570],
  [3150, 2230],
  [4460, 3150],
  [950, 750],
  [1500, 950],
  [2000, 1500],
  [3200, 2000],
  [4200, 3200],
  [1100, 850],
  [1400, 850],
  [1700, 1100],
  [990, 790],
  [1540, 990],
  [2060, 1560],
  [3260, 2060],
  [4280, 3280],
]

export function getSchematicSheetSize(
  sheetRecord: AltiumSchSheetRecord | undefined,
): readonly [number, number] {
  const customWidth = Number(sheetRecord?.getCaseInsensitive("CUSTOMX") ?? 1000)
  const customHeight = Number(sheetRecord?.getCaseInsensitive("CUSTOMY") ?? 800)
  const sheetStyleValue = sheetRecord?.getCaseInsensitive("SHEETSTYLE")
  const useCustomSheet =
    sheetRecord?.getCaseInsensitive("USECUSTOMSHEET") === "T"

  if (useCustomSheet || sheetStyleValue === undefined) {
    return [Math.max(customWidth, 1), Math.max(customHeight, 1)]
  }

  const standardSize = ALTIUM_STANDARD_SHEET_SIZES[Number(sheetStyleValue)]
  if (!standardSize) {
    throw new RangeError(
      `Unsupported Altium schematic sheet style: ${JSON.stringify(sheetStyleValue)}`,
    )
  }

  const isPortrait =
    Number(sheetRecord?.getCaseInsensitive("WORKSPACEORIENTATION") ?? 0) !== 0
  return isPortrait
    ? [standardSize[1], standardSize[0]]
    : [standardSize[0], standardSize[1]]
}
