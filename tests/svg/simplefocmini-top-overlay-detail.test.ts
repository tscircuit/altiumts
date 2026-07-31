import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbLayerToSvg } from "../../lib"
import { readReference } from "./read-reference"

test("renders the SimpleFOC Mini top overlay at board scale", async () => {
  const source = await readReference("simplefocmini-2024-04-26.PcbDoc")
  const document = parseAltiumPcbDoc(source)
  const svg = serializeAltiumPcbLayerToSvg(document, "TOPOVERLAY", {
    title: "SimpleFOC Mini top overlay detail",
    viewBox: {
      x: 1550,
      y: 1800,
      width: 1100,
      height: 950,
    },
  })

  expect(svg).toContain('data-layer="TOPOVERLAY"')
  expect(svg).not.toContain('data-layer="BOTTOMOVERLAY"')
  expect(svg).toContain(">Mini</text>")
  expect(svg).not.toContain(">DRV8313PWPR</text>")

  const hiddenSvg = serializeAltiumPcbLayerToSvg(document, "TOPOVERLAY", {
    showHidden: true,
    viewBox: {
      x: 1550,
      y: 1800,
      width: 1100,
      height: 950,
    },
  })
  expect(hiddenSvg).toContain(">DRV8313PWPR</text>")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
