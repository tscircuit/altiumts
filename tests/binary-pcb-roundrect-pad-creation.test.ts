import { expect, test } from "bun:test"
import {
  AltiumPadRecord,
  getAltiumPcbPadGeometry,
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbDocToBinary,
  serializeAltiumPcbToSvg,
} from "../lib"

test("serializes rounded-rectangle pad stack metadata", () => {
  const source = [
    "|RECORD=Board|KIND0=0|VX0=0mil|VY0=0mil|KIND1=0|VX1=400mil|VY1=0mil|KIND2=0|VX2=400mil|VY2=200mil|KIND3=0|VX3=0mil|VY3=200mil|KIND4=0|VX4=0mil|VY4=0mil",
    "|RECORD=Pad|NAME=1|LAYER=TOP|X=100mil|Y=100mil|XSIZE=80mil|YSIZE=40mil|SHAPE=RECTANGLE|LAYER0ALTSHAPE=ROUNDRECT|LAYER0CORNERRADIUS=100|HOLESIZE=0mil|PLATED=TRUE|LOCKED=FALSE",
    "|RECORD=Pad|NAME=2|LAYER=BOTTOM|X=300mil|Y=100mil|XSIZE=80mil|YSIZE=40mil|SHAPE=RECTANGLE|LAYER31ALTSHAPE=ROUNDRECT|LAYER31CORNERRADIUS=50|HOLESIZE=0mil|PLATED=TRUE|LOCKED=FALSE",
  ].join("\r\n")

  const document = parseAltiumBinaryPcbDoc(
    serializeAltiumPcbDocToBinary(source),
  )

  expect(document.pads[0]?.getCaseInsensitive("LAYER0ALTSHAPE")).toBe(
    "ROUNDRECT",
  )
  expect(document.pads[0]?.getNumber("LAYER0CORNERRADIUS")).toBe(100)
  expect(document.pads[1]?.getCaseInsensitive("LAYER31ALTSHAPE")).toBe(
    "ROUNDRECT",
  )
  expect(document.pads[1]?.getNumber("LAYER31CORNERRADIUS")).toBe(50)

  const topPad = document.pads[0]
  const bottomPad = document.pads[1]
  if (
    !(topPad instanceof AltiumPadRecord) ||
    !(bottomPad instanceof AltiumPadRecord)
  ) {
    throw new Error("Expected two serialized pads")
  }
  const topGeometry = getAltiumPcbPadGeometry({
    record: topPad,
    requestedLayers: ["TOP"],
  })
  const bottomGeometry = getAltiumPcbPadGeometry({
    record: bottomPad,
    requestedLayers: ["BOTTOM"],
  })
  expect(topGeometry).toMatchObject({
    ccwRotationDegrees: 0,
    cornerRadiusMils: 20,
    heightMils: 40,
    holeCcwRotationDegrees: 0,
    layerOrdinal: 0,
    shape: "ROUNDRECT",
    widthMils: 80,
  })
  expect(bottomGeometry).toMatchObject({
    ccwRotationDegrees: 0,
    cornerRadiusMils: 10,
    heightMils: 40,
    holeCcwRotationDegrees: 0,
    layerOrdinal: 31,
    shape: "ROUNDRECT",
    widthMils: 80,
  })

  expect(serializeAltiumPcbToSvg(document, { layers: ["TOP"] })).toContain(
    'data-pad-shape="ROUNDRECT"',
  )
  expect(serializeAltiumPcbToSvg(document, { layers: ["BOTTOM"] })).toContain(
    'data-pad-shape="ROUNDRECT"',
  )
})
