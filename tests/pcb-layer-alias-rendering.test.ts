import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbLayerToSvg } from "../lib"

test("renders every record belonging to a selected physical layer alias", () => {
  const document = parseAltiumPcbDoc(
    [
      "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=500mil|VY1=0mil|VX2=500mil|VY2=500mil|VX3=0mil|VY3=500mil|VX4=0mil|VY4=0mil|LAYER_V8_0NAME=Signal Layer 1|LAYER_V8_0LAYERID=16777218",
      "|RECORD=Track|LAYER=MID1|X1=100mil|Y1=200mil|X2=400mil|Y2=200mil|WIDTH=20mil",
      "|RECORD=Track|LAYER=MID-LAYER1|X1=100mil|Y1=300mil|X2=400mil|Y2=300mil|WIDTH=20mil",
      "|RECORD=Track|LAYER=Signal Layer 1|X1=100mil|Y1=400mil|X2=400mil|Y2=400mil|WIDTH=20mil",
    ].join("\n"),
  )

  const svg = serializeAltiumPcbLayerToSvg(document, "MID1")

  expect(svg.match(/data-record="Track"/gu)).toHaveLength(3)
  expect(svg).toContain('data-layer="MID1"')
  expect(svg).toContain('data-layer="MID-LAYER1"')
  expect(svg).toContain('data-layer="Signal Layer 1"')
})
