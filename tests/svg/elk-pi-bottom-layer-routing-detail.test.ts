import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"
import { renderAltiumReferenceComparison } from "./render-altium-reference-comparison"

test("renders dense Elk Pi bottom routing in a board-unit crop", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbLayerToSvg(document, "BOTTOM", {
    title: "Elk Pi bottom routing detail",
    viewBox: {
      x: 4300,
      y: 2500,
      width: 1400,
      height: 1100,
    },
  })

  expect(svg).toContain('viewBox="0 0 1400 1100"')
  expect(svg).toContain('data-layer="BOTTOM"')
  expect(svg).not.toContain('data-layer="TOP"')
  // Pixel comparisons alone cannot detect missing pads hidden by other copper.
  expect(svg.match(/data-record="Pad"/gu)).toHaveLength(42)
  expect(svg.match(/data-record="Pad" data-layer="MULTILAYER"/gu)).toHaveLength(
    20,
  )
  const comparison = await renderAltiumReferenceComparison({
    reference: "elk-pi-bottom-layer-routing-detail",
    converterSvg: svg,
  })
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
}, 15_000)

test("rejects invalid PCB viewBox dimensions", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)

  expect(() =>
    serializeAltiumPcbLayerToSvg(document, "BOTTOM", {
      viewBox: { x: 0, y: 0, width: 0, height: 100 },
    }),
  ).toThrow(RangeError)
})
