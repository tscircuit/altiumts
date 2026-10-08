import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"
import { renderAltiumReferenceComparison } from "./render-altium-reference-comparison"

test("renders the Elk Pi multilayer polygon cutout in a board-unit crop", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbLayerToSvg(document, "TOP", {
    title: "Elk Pi polygon-cutout detail",
    viewBox: {
      x: 7000,
      y: 4350,
      width: 250,
      height: 400,
    },
  })

  expect(svg).toContain('viewBox="0 0 250 400"')
  expect(svg).toContain('data-record="Region" data-layer="MULTILAYER"')
  expect(svg).toContain('data-region-kind="POLYGON_CUTOUT"')
  expect(svg).toContain('fill="#123d32"')
  expect(svg).toContain('stroke="#123d32"')
  const comparison = await renderAltiumReferenceComparison({
    reference: "elk-pi-polygon-cutout-detail",
    converterSvg: svg,
  })
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
}, 15_000)
