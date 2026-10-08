import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"
import { renderAltiumReferenceComparison } from "./render-altium-reference-comparison"

test("isolates the owned primitives of Novena component U10C", async () => {
  const source = await readReferenceBytes("novena-edp-adapter-dvt1.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    componentIndices: [102],
    showBoardOutline: false,
    title: "Novena U10C owned primitives",
    viewBox: {
      x: 5_700,
      y: 4_450,
      width: 760,
      height: 760,
    },
  })

  expect(svg).not.toContain('data-record="BoardOutline"')
  expect(svg.match(/data-record="ComponentBody"/gu)).toHaveLength(1)
  expect(svg.match(/data-record="Pad"/gu)).toHaveLength(65)
  expect(svg.match(/data-record="Track"/gu)).toHaveLength(18)
  expect(svg.match(/data-record="Arc"/gu)).toHaveLength(2)
  const comparison = await renderAltiumReferenceComparison({
    reference: "novena-edp-adapter-u10c-component",
    converterSvg: svg,
  })
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
})
