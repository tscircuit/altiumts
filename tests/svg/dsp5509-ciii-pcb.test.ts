import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"
import { renderAltiumReferenceComparison } from "./render-altium-reference-comparison"

test("renders DSP5509 CIII after accepting opaque Connections6 records", async () => {
  const source = await readReferenceBytes("dsp5509-ciii.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    fitToContent: true,
    title: "DSP5509 CIII PCB",
  })

  expect(svg).toContain('data-record="Track"')
  expect(svg).toContain('data-record="Pad"')
  const viewBox = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
  expect(Number(viewBox?.[1])).toBeGreaterThan(25_000)
  expect(Number(viewBox?.[2])).toBeGreaterThan(8_000)
  const comparison = await renderAltiumReferenceComparison({
    reference: "dsp5509-ciii-pcb",
    converterSvg: svg,
  })
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
})
