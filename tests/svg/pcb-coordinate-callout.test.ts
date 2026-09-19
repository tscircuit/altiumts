import { expect, test } from "bun:test"
import {
  AltiumCoordinateRecord,
  parseAltiumPcbDoc,
  serializeAltiumPcbToSvg,
} from "../../lib"

test("renders a PCB coordinate callout as a crosshair marker", async () => {
  const source = [
    "|RECORD=Board|KIND0=0|VX0=0mil|VY0=0mil|KIND1=0|VX1=1000mil|VY1=0mil|KIND2=0|VX2=1000mil|VY2=1000mil|KIND3=0|VX3=0mil|VY3=1000mil|KIND4=0|VX4=0mil|VY4=0mil",
    "|RECORD=Coordinate|LAYER=MECHANICAL15|X=500mil|Y=500mil",
  ].join("\r\n")
  const document = parseAltiumPcbDoc(source)
  const coordinate = document.getRecordsByKind("Coordinate")[0]

  expect(coordinate).toBeInstanceOf(AltiumCoordinateRecord)
  if (!(coordinate instanceof AltiumCoordinateRecord)) {
    throw new Error("Expected a typed Altium coordinate record")
  }
  expect(coordinate.position).toEqual({ x: 500, y: 500 })

  const svg = serializeAltiumPcbToSvg(document, {
    title: "Coordinate callout",
  })
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
