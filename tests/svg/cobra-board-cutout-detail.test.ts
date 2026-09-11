import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("keeps Cobra board cutouts above later-painted PCB records", async () => {
  const source = await readReferenceBytes("cobra.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    title: "Cobra board cutout detail",
    viewBox: {
      x: 3360,
      y: 2475,
      width: 110,
      height: 110,
    },
  })

  expect(document.boardGeometry.cutouts).toHaveLength(6)
  expect(svg).toContain('data-record="BoardCutoutMask"')
  expect(svg.lastIndexOf('data-record="BoardCutoutMask"')).toBeGreaterThan(
    svg.lastIndexOf('data-record="Region"'),
  )
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
}, 15_000)
