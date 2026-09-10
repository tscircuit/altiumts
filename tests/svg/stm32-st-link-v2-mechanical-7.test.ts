import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("resolves component designators on the ST-Link Mechanical 7 layer", async () => {
  const source = await readReferenceBytes("stm32-st-link-v2.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    layers: ["MECHANICAL7"],
    title: "STM32 ST-Link V2.1 Mechanical 7",
  })

  expect(svg).toContain('data-layer="MECHANICAL7"')
  expect(svg).not.toContain('data-layer="MECHANICAL8"')
  expect(svg).not.toContain(".Designator")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
}, 20_000)
