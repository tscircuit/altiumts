import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"
import { renderAltiumReferenceComparison } from "./render-altium-reference-comparison"

test("renders rotated Novena top-paste fills in a board-unit crop", async () => {
  const source = await readReferenceBytes("novena-edp-adapter-dvt1.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbLayerToSvg(document, "TOPPASTE", {
    title: "Novena eDP adapter rotated top-paste fills",
    viewBox: {
      x: 6_750,
      y: 4_730,
      width: 180,
      height: 200,
    },
  })

  expect(svg).toContain('viewBox="0 0 180 200"')
  expect(svg).toContain('data-record="Fill"')
  expect(svg).toContain('data-layer="TOPPASTE"')
  expect(svg).toContain('data-keepout="false"')
  expect(svg).toContain('transform="rotate(-270')
  expect(svg).toContain('transform="rotate(-90')
  const comparison = await renderAltiumReferenceComparison({
    reference: "novena-edp-adapter-top-paste-fill-detail",
    converterSvg: svg,
  })
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
})
