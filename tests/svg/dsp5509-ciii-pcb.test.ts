import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("renders the complete DSP5509 CIII PCB", async () => {
  const source = await readReferenceBytes("dsp5509-ciii.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    title: "DSP5509 CIII PCB",
  })

  expect(svg).toContain('data-record="Track"')
  expect(svg).toContain('data-record="Pad"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
