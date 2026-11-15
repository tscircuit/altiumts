import { expect, test } from "bun:test"
import {
  parseAltiumSchDoc,
  serializeAltiumSheetToSvg,
  validateAltiumDocument,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"

const sheetNumbers = Array.from({ length: 57 }, (_, index) =>
  String(index + 1).padStart(2, "0"),
)
const imageSheets = new Set([
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "15",
  "57",
])
const vectorImageSheets = new Set(["05", "06", "07", "08", "10", "11"])

for (const sheetNumber of sheetNumbers) {
  test(`renders TI TMDS62LEVM Rev. B schematic sheet ${sheetNumber}`, async () => {
    const source = await readReferenceBytes(
      `ti-tmds62levm-rev-b/${sheetNumber}.SchDoc`,
    )
    const document = parseAltiumSchDoc(source)
    const validation = validateAltiumDocument(document, {
      profile: "strict",
    })
    const svg = serializeAltiumSheetToSvg(document, {
      title: `TI TMDS62LEVM Rev. B schematic sheet ${sheetNumber}`,
    })

    expect(document.getBytes()).toEqual(source)
    expect(validation.valid).toBe(true)
    expect(validation.summary).toEqual({
      errors: 0,
      fatals: 0,
      warnings: 0,
    })
    expect(svg).toContain('class="altium-sheet"')
    expect(svg).toContain('data-record="SheetBorder"')
    expect(svg).toContain('clip-path="url(#altium-sheet-paper)"')
    if (imageSheets.has(sheetNumber)) {
      expect(svg).toContain('<image data-record="30"')
      let expectedImagePrefix = "data:image/png;base64,iVBORw0KGgo"
      if (vectorImageSheets.has(sheetNumber)) {
        expectedImagePrefix = "data:image/svg+xml;base64,"
      }
      expect(svg).toContain(expectedImagePrefix)
    }
    // Native image payloads are large and are covered by focused extraction
    // and renderer tests instead of duplicating megabytes of data URLs here.
    // Sheet 57 is snapshotted to verify text sizing and component image layout.
    if (!imageSheets.has(sheetNumber) || sheetNumber === "57") {
      await expect(svg).toMatchSvgSnapshot(
        import.meta.path,
        `sheet-${sheetNumber}`,
      )
    }
  }, 45_000)
}
