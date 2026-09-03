import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"

const source = [
  "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=1000mil|VY1=0mil|VX2=1000mil|VY2=1000mil|VX3=0mil|VY3=1000mil|VX4=0mil|VY4=0mil",
  "|RECORD=Region|ISBOARDCUTOUT=TRUE|KIND=0|VX0=300mil|VY0=300mil|VX1=700mil|VY1=300mil|VX2=700mil|VY2=700mil|VX3=300mil|VY3=700mil|VX4=300mil|VY4=300mil",
  "|RECORD=Fill|LAYER=TOP|X1=100mil|Y1=100mil|X2=900mil|Y2=900mil",
].join("\n")

test("paints board-cutout contours over board records", async () => {
  const document = parseAltiumPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    title: "Visible board-cutout contour",
  })

  const fillIndex = svg.indexOf('data-record="Fill"')
  const cutoutIndex = svg.indexOf('data-record="BoardCutoutOutline"')
  expect(fillIndex).toBeGreaterThan(-1)
  expect(cutoutIndex).toBeGreaterThan(fillIndex)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
