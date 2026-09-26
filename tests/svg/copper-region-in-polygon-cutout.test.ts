import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"

test("renders independent copper inside a polygon cutout", async () => {
  const source = [
    "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=1000mil|VY1=0mil|VX2=1000mil|VY2=1000mil|VX3=0mil|VY3=1000mil|VX4=0mil|VY4=0mil",
    "|RECORD=Polygon|ID=0|LAYER=TOP|VX0=100mil|VY0=100mil|VX1=900mil|VY1=100mil|VX2=900mil|VY2=900mil|VX3=100mil|VY3=900mil",
    "|RECORD=Region|POLYGON=0|LAYER=TOP|REGIONKIND=POLYGON_CUTOUT|VX0=300mil|VY0=300mil|VX1=700mil|VY1=300mil|VX2=700mil|VY2=700mil|VX3=300mil|VY3=700mil",
    "|RECORD=Region|LAYER=TOP|REGIONKIND=COPPER|VX0=450mil|VY0=350mil|VX1=550mil|VY1=350mil|VX2=550mil|VY2=650mil|VX3=450mil|VY3=650mil",
  ].join("\n")
  const svg = serializeAltiumPcbToSvg(parseAltiumPcbDoc(source))
  const regionPaths = [
    ...svg.matchAll(/<path data-record="Region" data-layer="TOP"[^>]*>/g),
  ]

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
  expect(regionPaths).toHaveLength(2)
  expect(regionPaths[0]?.[0]).toContain('data-region-kind="POLYGON_CUTOUT"')
  expect(regionPaths[1]?.[0]).not.toContain('data-region-kind="POLYGON_CUTOUT"')
})
