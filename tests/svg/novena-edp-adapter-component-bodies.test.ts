import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"
import { renderAltiumReferenceComparison } from "./render-altium-reference-comparison"

test("renders Novena shape-based component bodies without legacy duplicates", async () => {
  const source = await readReferenceBytes("novena-edp-adapter-dvt1.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbLayerToSvg(document, "MECHANICAL13", {
    title: "Novena eDP adapter component bodies",
  })

  expect(svg).toContain('data-record="ComponentBody"')
  expect(svg).toContain('data-layer="MECHANICAL13"')
  expect(svg).toContain('data-component="102"')
  expect(svg.match(/data-record="ComponentBody"/gu)).toHaveLength(99)
  expect(svg).not.toContain('data-record="ComponentBodyLegacy"')
  const comparison = await renderAltiumReferenceComparison({
    reference: "novena-edp-adapter-component-bodies",
    converterSvg: svg,
  })
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
})
