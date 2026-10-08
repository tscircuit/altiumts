import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"
import { renderAltiumReferenceComparison } from "./render-altium-reference-comparison"

test("renders the complete TI TMDS62LEVM Rev. B top PCB layer", async () => {
  const source = await readReferenceBytes("ti-tmds62levm-rev-b.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbLayerToSvg(document, "TOP", {
    showText: false,
    title: "TI TMDS62LEVM Rev. B top PCB layer",
    viewBox: {
      x: -100.515,
      y: -300.515,
      width: 5_555.4636,
      height: 5_825.03,
    },
  })

  expect(svg).toContain('viewBox="0 0 5555.4636 5825.03"')
  expect(svg).toContain('data-record="BoardOutline"')
  expect(svg).toContain('data-record="Region"')
  expect(svg).toContain('data-record="Track"')
  expect(svg).toContain('data-record="Pad"')
  expect(svg).toContain('data-record="Via"')
  expect(svg).toContain('data-layer="TOP"')
  expect(svg).not.toContain('data-layer="BOTTOM"')
  const comparison = await renderAltiumReferenceComparison({
    reference: "ti-tmds62levm-top-layer",
    converterSvg: svg,
  })
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
}, 45_000)
