import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"
import { renderAltiumReferenceComparison } from "./render-altium-reference-comparison"

test("renders 45-degree Novena top-solder fills in a board-unit crop", async () => {
  const source = await readReferenceBytes("novena-edp-adapter-dvt1.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbLayerToSvg(document, "TOPSOLDER", {
    title: "Novena eDP adapter 45-degree top-solder fills",
    viewBox: {
      x: 5_850,
      y: 4_600,
      width: 480,
      height: 480,
    },
  })

  expect(svg).toContain('viewBox="0 0 480 480"')
  expect(svg).toContain('data-record="Fill"')
  expect(svg).toContain('data-layer="TOPSOLDER"')
  expect(svg).toContain('transform="rotate(-45')
  expect(svg.match(/data-record="Fill"/g)).toHaveLength(16)
  expect(svg).toContain('data-solder-mask-opening="true"')
  expect(svg).toContain('data-pad-name="63"')
  expect(svg).toContain('width="15.3543" height="35.0394"')
  // The thermal pad's negative manual expansion closes its default opening;
  // the sixteen explicit solder fills define the openings over that pad.
  expect(svg).not.toContain('data-pad-name="65"')
  expect(svg).not.toContain('data-record="Via"')
  expect(document.getBytes()).toEqual(source)
  const comparison = await renderAltiumReferenceComparison({
    reference: "novena-edp-adapter-top-solder-fill-detail",
    converterSvg: svg,
  })
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
})
