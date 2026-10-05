import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"

const source = [
  "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=4200mil|VY1=0mil|VX2=4200mil|VY2=500mil|VX3=0mil|VY3=500mil|VX4=0mil|VY4=0mil",
  "|RECORD=Track|LAYER=VISIBLEGRID1|X1=4000mil|Y1=100mil|X2=4000mil|Y2=400mil|WIDTH=80mil",
  "|RECORD=Track|LAYER=DRILLDRAWING|X1=3700mil|Y1=100mil|X2=3700mil|Y2=400mil|WIDTH=80mil",
  "|RECORD=Track|LAYER=MECHANICAL15|X1=3400mil|Y1=100mil|X2=3400mil|Y2=400mil|WIDTH=80mil",
  "|RECORD=Track|LAYER=KEEPOUT|X1=3100mil|Y1=100mil|X2=3100mil|Y2=400mil|WIDTH=80mil",
  "|RECORD=Track|LAYER=DRILLGUIDE|X1=2800mil|Y1=100mil|X2=2800mil|Y2=400mil|WIDTH=80mil",
  "|RECORD=Track|LAYER=INTERNALPLANE1|X1=2500mil|Y1=100mil|X2=2500mil|Y2=400mil|WIDTH=80mil",
  "|RECORD=Track|LAYER=BOTTOMSOLDER|X1=2200mil|Y1=100mil|X2=2200mil|Y2=400mil|WIDTH=80mil",
  "|RECORD=Track|LAYER=TOPSOLDER|X1=1900mil|Y1=100mil|X2=1900mil|Y2=400mil|WIDTH=80mil",
  "|RECORD=Track|LAYER=BOTTOMPASTE|X1=1600mil|Y1=100mil|X2=1600mil|Y2=400mil|WIDTH=80mil",
  "|RECORD=Track|LAYER=TOPPASTE|X1=1300mil|Y1=100mil|X2=1300mil|Y2=400mil|WIDTH=80mil",
  "|RECORD=Track|LAYER=BOTTOM|X1=1000mil|Y1=100mil|X2=1000mil|Y2=400mil|WIDTH=80mil",
  "|RECORD=Fill|LAYER=TOP|X1=850mil|Y1=150mil|X2=1150mil|Y2=350mil",
  "|RECORD=Track|LAYER=CONNECTIONS|X1=700mil|Y1=100mil|X2=700mil|Y2=400mil|WIDTH=80mil",
  "|RECORD=Track|LAYER=BOTTOMOVERLAY|X1=400mil|Y1=100mil|X2=400mil|Y2=400mil|WIDTH=80mil",
  "|RECORD=Track|LAYER=TOPOVERLAY|X1=250mil|Y1=100mil|X2=550mil|Y2=400mil|WIDTH=80mil",
  "|RECORD=Track|LAYER=MULTILAYER|X1=100mil|Y1=100mil|X2=100mil|Y2=400mil|WIDTH=80mil",
].join("\n")

function getSvgLayerIndex(svg: string, layerName: string): number {
  return svg.indexOf(`data-layer="${layerName}"`)
}

test("renders PCB layers in the default top-side drawing order", async () => {
  const document = parseAltiumPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    title: "Default top-side PCB layer drawing order",
  })
  expect(getSvgLayerIndex(svg, "VISIBLEGRID1")).toBeLessThan(
    getSvgLayerIndex(svg, "DRILLDRAWING"),
  )
  expect(getSvgLayerIndex(svg, "DRILLDRAWING")).toBeLessThan(
    getSvgLayerIndex(svg, "MECHANICAL15"),
  )
  expect(getSvgLayerIndex(svg, "MECHANICAL15")).toBeLessThan(
    getSvgLayerIndex(svg, "KEEPOUT"),
  )
  expect(getSvgLayerIndex(svg, "KEEPOUT")).toBeLessThan(
    getSvgLayerIndex(svg, "DRILLGUIDE"),
  )
  expect(getSvgLayerIndex(svg, "DRILLGUIDE")).toBeLessThan(
    getSvgLayerIndex(svg, "INTERNALPLANE1"),
  )
  expect(getSvgLayerIndex(svg, "INTERNALPLANE1")).toBeLessThan(
    getSvgLayerIndex(svg, "BOTTOMSOLDER"),
  )
  expect(getSvgLayerIndex(svg, "BOTTOMSOLDER")).toBeLessThan(
    getSvgLayerIndex(svg, "TOPSOLDER"),
  )
  expect(getSvgLayerIndex(svg, "TOPSOLDER")).toBeLessThan(
    getSvgLayerIndex(svg, "BOTTOMPASTE"),
  )
  expect(getSvgLayerIndex(svg, "BOTTOMPASTE")).toBeLessThan(
    getSvgLayerIndex(svg, "TOPPASTE"),
  )
  expect(getSvgLayerIndex(svg, "TOPPASTE")).toBeLessThan(
    getSvgLayerIndex(svg, "BOTTOMOVERLAY"),
  )
  expect(getSvgLayerIndex(svg, "BOTTOMOVERLAY")).toBeLessThan(
    getSvgLayerIndex(svg, "BOTTOM"),
  )
  expect(getSvgLayerIndex(svg, "BOTTOM")).toBeLessThan(
    getSvgLayerIndex(svg, "TOP"),
  )
  expect(getSvgLayerIndex(svg, "TOP")).toBeLessThan(
    getSvgLayerIndex(svg, "CONNECTIONS"),
  )
  expect(getSvgLayerIndex(svg, "CONNECTIONS")).toBeLessThan(
    getSvgLayerIndex(svg, "TOPOVERLAY"),
  )
  expect(getSvgLayerIndex(svg, "TOPOVERLAY")).toBeLessThan(
    getSvgLayerIndex(svg, "MULTILAYER"),
  )
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})

test("paints the opposite overlay behind copper in side views", () => {
  const document = parseAltiumPcbDoc(source)
  const topView = serializeAltiumPcbToSvg(document, { viewSide: "top" })
  const bottomView = serializeAltiumPcbToSvg(document, {
    viewSide: "bottom",
  })

  expect(getSvgLayerIndex(topView, "BOTTOMOVERLAY")).toBeLessThan(
    getSvgLayerIndex(topView, "TOP"),
  )
  expect(getSvgLayerIndex(topView, "TOP")).toBeLessThan(
    getSvgLayerIndex(topView, "TOPOVERLAY"),
  )
  expect(getSvgLayerIndex(bottomView, "TOPOVERLAY")).toBeLessThan(
    getSvgLayerIndex(bottomView, "BOTTOM"),
  )
  expect(getSvgLayerIndex(bottomView, "BOTTOM")).toBeLessThan(
    getSvgLayerIndex(bottomView, "BOTTOMOVERLAY"),
  )
})
