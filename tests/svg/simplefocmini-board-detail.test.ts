import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { readReference } from "./read-reference"

test("renders the populated SimpleFOC Mini board area", async () => {
  const source = await readReference("simplefocmini-2024-04-26.PcbDoc")
  const document = parseAltiumPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    title: "SimpleFOC Mini populated board detail",
    viewBox: {
      x: 1550,
      y: 1800,
      width: 1100,
      height: 950,
    },
  })

  expect(svg).toContain('viewBox="0 0 1100 950"')
  expect(svg).toContain('data-layer="TOP"')
  expect(svg).toContain('data-layer="BOTTOM"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
