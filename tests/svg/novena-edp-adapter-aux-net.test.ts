import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"
import { renderAltiumReferenceComparison } from "./render-altium-reference-comparison"

test("isolates the Novena EDP_TXAUX_P net", async () => {
  const source = await readReferenceBytes("novena-edp-adapter-dvt1.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const net = document.getNetByIndex(58)
  const svg = serializeAltiumPcbToSvg(document, {
    netIndices: [58],
    viewBox: {
      x: 5425,
      y: 4585,
      width: 480,
      height: 330,
    },
    title: `Novena net — ${net?.getDecoded("NAME")}`,
  })

  expect(net?.getDecoded("NAME")).toBe("EDP_TXAUX_P")
  expect(svg).toContain('viewBox="0 0 480 330"')
  expect(svg.match(/data-record="Pad"/gu)).toHaveLength(2)
  expect(svg.match(/data-record="Track"/gu)).toHaveLength(34)
  expect(svg.match(/data-record="Via"/gu)).toHaveLength(2)
  expect(svg).not.toContain('data-record="ComponentBody"')
  const comparison = await renderAltiumReferenceComparison({
    reference: "novena-edp-adapter-aux-net",
    converterSvg: svg,
  })
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
})
