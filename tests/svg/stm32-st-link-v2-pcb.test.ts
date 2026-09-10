import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { getPcbDocumentBounds } from "../../lib/svg-serialization/pcb-geometry"
import { readReferenceBytes } from "./read-reference"

test("renders the complete STM32 ST-Link V2.1 binary PCB", async () => {
  const source = await readReferenceBytes("stm32-st-link-v2.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    title: "STM32 ST-Link V2.1 PCB",
  })

  expect(getPcbDocumentBounds(document)).toEqual({
    minX: 682.875,
    minY: 1887.1889,
    maxX: 2501.1024,
    maxY: 2477.7401,
  })
  expect(svg).not.toContain(".Designator")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
}, 20_000)
