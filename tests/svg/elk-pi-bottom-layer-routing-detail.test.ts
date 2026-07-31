import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("renders dense Elk Pi bottom routing in a board-unit crop", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbLayerToSvg(document, "BOTTOM", {
    title: "Elk Pi bottom routing detail",
    viewBox: {
      x: 4300,
      y: 2500,
      width: 1400,
      height: 1100,
    },
  })

  expect(svg).toContain('viewBox="0 0 1400 1100"')
  expect(svg).toContain('data-layer="BOTTOM"')
  expect(svg).not.toContain('data-layer="TOP"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
}, 15_000)

test("rejects invalid PCB viewBox dimensions", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)

  expect(() =>
    serializeAltiumPcbLayerToSvg(document, "BOTTOM", {
      viewBox: { x: 0, y: 0, width: 0, height: 100 },
    }),
  ).toThrow(RangeError)
})
