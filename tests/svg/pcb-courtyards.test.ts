import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"

const courtyardRecords = [
  "|RECORD=Board|VERSION=5.0|KIND0=0|VX0=-100mil|VY0=-100mil|KIND1=0|VX1=450mil|VY1=-100mil|KIND2=0|VX2=450mil|VY2=450mil|KIND3=0|VX3=-100mil|VY3=450mil|KIND4=0|VX4=-100mil|VY4=-100mil",
  "|RECORD=Component|ID=4|LAYER=TOP|X=0mil|Y=0mil|HEIGHT=20mil",
  "|RECORD=Track|COMPONENT=4|LAYER=MECHANICAL15|X1=0mil|Y1=0mil|X2=100mil|Y2=0mil|WIDTH=2mil",
  "|RECORD=Track|COMPONENT=4|LAYER=MECHANICAL15|X1=100mil|Y1=100mil|X2=0mil|Y2=100mil|WIDTH=2mil",
  "|RECORD=Track|COMPONENT=4|LAYER=MECHANICAL15|X1=100mil|Y1=0mil|X2=100mil|Y2=100mil|WIDTH=2mil",
  "|RECORD=Track|COMPONENT=4|LAYER=MECHANICAL15|X1=0mil|Y1=0mil|X2=0mil|Y2=100mil|WIDTH=2mil",
  "|RECORD=Arc|COMPONENT=4|LAYER=MECHANICAL16|LOCATION.X=200mil|LOCATION.Y=200mil|RADIUS=50mil|STARTANGLE=0|ENDANGLE=360|WIDTH=2mil",
  "|RECORD=Region|COMPONENT=4|LAYER=MECHANICAL15|REGIONKIND=COPPER|HOLECOUNT=0|KIND0=0|VX0=300mil|VY0=300mil|KIND1=0|VX1=350mil|VY1=300mil|KIND2=0|VX2=325mil|VY2=350mil|KIND3=0|VX3=300mil|VY3=300mil",
]

const courtyardPcbDoc = parseAltiumPcbDoc(courtyardRecords.join("\n"))

test("repro: Mechanical 16 bottom courtyard uses the top courtyard color", async () => {
  const svg = serializeAltiumPcbToSvg(courtyardPcbDoc, {
    height: 800,
    title: "PCB courtyard layer colors",
    width: 800,
  })

  const mechanical15Color = svg.match(
    /data-layer="MECHANICAL15"[^>]+stroke="([^"]+)"/,
  )?.[1]
  const mechanical16Color = svg.match(
    /data-layer="MECHANICAL16"[^>]+stroke="([^"]+)"/,
  )?.[1]

  // Repro: Mechanical 16 is the bottom courtyard, but it currently uses the
  // same magenta color as the Mechanical 15 top courtyard.
  expect(mechanical15Color).toBe("#ec4899")
  expect(mechanical16Color).toBe(mechanical15Color)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
