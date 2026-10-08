import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"
import { renderAltiumReferenceComparison } from "./render-altium-reference-comparison"

test("renders Elk Pi middle-layer pad-stack geometry", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbLayerToSvg(document, "MID-LAYER1", {
    title: "Elk Pi middle-layer pad-stack detail",
    viewBox: {
      x: 5430,
      y: 2490,
      width: 120,
      height: 120,
    },
  })

  expect(svg).toContain('viewBox="0 0 120 120"')
  expect(svg).toContain('data-pad-name="1"')
  expect(svg).toContain('data-pad-shape="ROUND"')
  expect(svg).toContain('data-pad-stack-layer="1"')
  expect(svg).toContain('data-pad-stack-mode="TOP_MIDDLE_BOTTOM"')
  expect(svg).toContain("<circle")

  const topSvg = serializeAltiumPcbLayerToSvg(document, "TOP", {
    viewBox: {
      x: 5430,
      y: 2490,
      width: 120,
      height: 120,
    },
  })
  expect(topSvg).toContain('data-pad-shape="RECTANGLE"')
  expect(topSvg).toContain('data-pad-stack-layer="0"')
  const comparison = await renderAltiumReferenceComparison({
    reference: "elk-pi-mid-layer-pad-stack-detail",
    converterSvg: svg,
  })
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
}, 25_000)
