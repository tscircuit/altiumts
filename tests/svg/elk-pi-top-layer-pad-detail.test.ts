import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"
import { renderAltiumReferenceComparison } from "./render-altium-reference-comparison"

test("renders rotated Elk Pi top-layer pads in a board-unit crop", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbLayerToSvg(document, "TOP", {
    title: "Elk Pi rotated top-pad detail",
    viewBox: {
      x: 3800,
      y: 4250,
      width: 500,
      height: 400,
    },
  })

  expect(svg).toContain('viewBox="0 0 500 400"')
  expect(svg).toContain('height="800"')
  expect(svg).toContain('transform="rotate(-270')
  expect(svg).toContain('rx="11.811" ry="11.811"')
  expect(svg).not.toContain("<ellipse")
  expect(svg).toContain('data-layer="TOP"')
  const comparison = await renderAltiumReferenceComparison({
    reference: "elk-pi-top-layer-pad-detail",
    converterSvg: svg,
  })
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
}, 15_000)
