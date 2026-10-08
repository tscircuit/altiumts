import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"
import { renderAltiumReferenceComparison } from "./render-altium-reference-comparison"

test("renders the binary Elk Pi top overlay", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbLayerToSvg(document, "TOPOVERLAY", {
    title: "Elk Pi top overlay",
  })

  expect(svg).toContain('data-record="Text"')
  expect(svg).toContain('data-layer="TOPOVERLAY"')
  expect(svg).toContain(">DOUT</text>")
  expect(svg).not.toContain(">T491C107K010AT</text>")
  const comparison = await renderAltiumReferenceComparison({
    reference: "elk-pi-top-overlay",
    converterSvg: svg,
  })
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
}, 15_000)
