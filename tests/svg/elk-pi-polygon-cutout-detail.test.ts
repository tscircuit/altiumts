import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("reproduces an Elk Pi polygon cutout painted over solid copper", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const svg = serializeAltiumPcbLayerToSvg(document, "TOP", {
    title: "Elk Pi polygon cutout painted over solid copper reproduction",
    viewBox: {
      x: 7000,
      y: 4350,
      width: 250,
      height: 400,
    },
  })

  expect(svg).toContain('viewBox="0 0 250 400"')
  expect(svg).toContain('data-record="Region" data-layer="MULTILAYER"')
  expect(svg).toContain('data-region-kind="POLYGON_CUTOUT"')
  expect(svg).toContain('fill="#123d32"')
  expect(svg).toContain('stroke="#123d32"')
  expect(svg).toMatch(
    /<path data-record="Region" data-layer="TOP"[^>]*fill="#ef4444"/,
  )
  expect(svg.indexOf('data-region-kind="POLYGON_CUTOUT"')).toBeGreaterThan(
    svg.indexOf('data-record="Region" data-layer="TOP"'),
  )
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
}, 15_000)
