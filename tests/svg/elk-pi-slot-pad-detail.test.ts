import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"
import { renderAltiumReferenceComparison } from "./render-altium-reference-comparison"

test("renders Elk Pi plated slot holes as rotated obrounds", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbLayerToSvg(document, "TOP", {
    title: "Elk Pi plated slot-pad detail",
    viewBox: {
      x: 3000,
      y: 5140,
      width: 490,
      height: 165,
    },
  })

  expect(svg).toContain('viewBox="0 0 490 165"')
  expect(svg).toContain('data-pad-name="S1"')
  expect(svg).toContain('data-pad-name="S2"')
  expect(svg).toContain('data-hole-shape="SLOT"')
  expect(svg).toContain('width="59.0551"')
  expect(svg).toContain('height="27.5591"')
  expect(svg).toContain('transform="rotate(-270')
  expect(svg).toContain('data-plated="false"')
  expect(svg).toContain('stroke="#f8fafc"')
  const comparison = await renderAltiumReferenceComparison({
    reference: "elk-pi-slot-pad-detail",
    converterSvg: svg,
  })
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
}, 15_000)
