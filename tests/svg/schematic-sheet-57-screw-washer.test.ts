import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("renders sheet 57 screw and washer with proper text sizing and image border", async () => {
  const source = await readReferenceBytes("ti-tmds62levm-rev-b/57.SchDoc")
  const document = parseAltiumSchDoc(source)
  const svg = serializeAltiumSheetToSvg(document, {
    title: "Sheet 57 Screw and Washer",
  })

  // 1. Header text should have document font size 25
  expect(svg).toContain('font-size="25"')
  expect(svg).toContain(">SCREW &amp; WASHER FOR PCIe M.2</text>")

  // 2. Washer image should have a border rect with #800000 (Color=128)
  expect(svg).toContain(
    '<image data-record="30" x="1630.7" y="770.4349" width="95" height="81.2651"',
  )
  expect(svg).toContain(
    '<rect data-record="30" x="1630.7" y="770.4349" width="95" height="81.2651" fill="none" stroke="#800000" stroke-width="1"/>',
  )

  // 3. Screw head arcs should have valid rounded polyline points
  expect(svg).toContain('data-record="11"')
})
