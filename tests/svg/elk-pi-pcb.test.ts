import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"
import { renderAltiumReferenceComparison } from "./render-altium-reference-comparison"

test("renders the complete binary Elk Pi PCB", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    title: "Elk Pi PCB",
  })

  expect(svg).toContain('data-record="Region"')
  expect(svg).toContain('data-record="ComponentBody"')
  expect(svg).toContain('data-record="Text"')
  expect(svg).toContain('fill-rule="evenodd"')
  expect(svg).toContain(">DOUT</text>")
  for (const name of ["elk_logo_new", "open-hardware-logo-neg"]) {
    expect(svg).toContain(
      `data-font-source="embedded" data-font-name="${name}" aria-label="a"`,
    )
    expect(svg).not.toContain(`font-family="${name}, sans-serif"`)
  }
  const comparison = await renderAltiumReferenceComparison({
    reference: "elk-pi-pcb",
    converterSvg: svg,
  })
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
}, 20_000)
