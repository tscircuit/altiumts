import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { readReference } from "./read-reference"

test("reproduces bottom overlay painted over top pads on SimpleFOC Mini", async () => {
  const source = await readReference("simplefocmini-2024-04-26.PcbDoc")
  const document = parseAltiumPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    title: "SimpleFOC Mini bottom overlay over top pads",
    viewBox: { x: 1750, y: 1950, width: 550, height: 500 },
  })

  const topPadIndex = svg.indexOf('data-record="Pad" data-layer="TOP"')
  const bottomOverlayIndex = svg.indexOf(
    'data-record="Track" data-layer="BOTTOMOVERLAY"',
  )
  expect(topPadIndex).toBeGreaterThan(-1)
  expect(bottomOverlayIndex).toBeGreaterThan(topPadIndex)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
