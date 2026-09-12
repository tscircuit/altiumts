import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"

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
  expect(svg).toContain('data-record="Pad"')
  expect(svg).toContain('data-layer="TOPSOLDER"')
  expect(svg).toContain('transform="rotate(-45')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
