import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"

test("renders an unpoured copper polygon with its polygon cutout", async () => {
  const source = [
    "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=5000mil|VY1=0mil|VX2=5000mil|VY2=5000mil|VX3=0mil|VY3=5000mil|VX4=0mil|VY4=0mil",
    "|RECORD=Polygon|ID=0|LAYER=TOP|KIND0=0|VX0=500mil|VY0=500mil|KIND1=0|VX1=4500mil|VY1=500mil|KIND2=0|VX2=4500mil|VY2=4500mil|KIND3=0|VX3=500mil|VY3=4500mil|KIND4=0|VX4=500mil|VY4=500mil",
    "|RECORD=Region|POLYGON=0|LAYER=TOP|REGIONKIND=POLYGON_CUTOUT|KIND0=0|VX0=2000mil|VY0=2000mil|KIND1=0|VX1=3000mil|VY1=2000mil|KIND2=0|VX2=3000mil|VY2=3000mil|KIND3=0|VX3=2000mil|VY3=3000mil|KIND4=0|VX4=2000mil|VY4=2000mil|HOLECOUNT=0",
  ].join("\r\n")
  const svg = serializeAltiumPcbToSvg(parseAltiumPcbDoc(source), {
    title: "Copper polygon with cutout",
  })

  expect(svg).toContain(
    'data-record="Polygon" data-layer="TOP" points="675,4675 4675,4675 4675,675 675,675 675,4675" fill="#ef4444" fill-opacity="0.32"',
  )
  expect(svg).toContain('data-region-kind="POLYGON_CUTOUT"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
