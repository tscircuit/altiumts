import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"
import { renderAltiumReferenceComparison } from "./render-altium-reference-comparison"

test("renders the complete Novena eDP adapter binary PCB", async () => {
  const source = await readReferenceBytes("novena-edp-adapter-dvt1.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    title: "Novena eDP adapter DVT1 PCB",
  })

  expect(svg).toContain('data-record="Fill"')
  expect(svg).toContain('data-record="ComponentBody"')
  expect(svg).toContain('data-layer="TOPPASTE"')
  expect(svg).toContain('transform="rotate(-270')
  const comparison = await renderAltiumReferenceComparison({
    reference: "novena-edp-adapter-pcb",
    converterSvg: svg,
  })
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
}, 20_000)
