import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbLayerToSvg } from "../lib"

const document = parseAltiumPcbDoc(
  [
    "|RECORD=Board",
    "|RECORD=Via|X=10mil|Y=10mil|DIAMETER=8mil|HOLESIZE=4mil|STARTLAYER=TOP|ENDLAYER=BOTTOM",
    "|RECORD=Via|X=20mil|Y=10mil|DIAMETER=8mil|HOLESIZE=4mil|STARTLAYER=TOP|ENDLAYER=MID-LAYER2",
    "|RECORD=Via|X=30mil|Y=10mil|DIAMETER=8mil|HOLESIZE=4mil|STARTLAYER=MID-LAYER1|ENDLAYER=MID-LAYER3",
    "|RECORD=Via|X=40mil|Y=10mil|DIAMETER=8mil|HOLESIZE=4mil|STARTLAYER=BOTTOM|ENDLAYER=MID-LAYER3",
  ].join("\n"),
)

const options = {
  showBoardOutline: false,
  viewBox: { x: 0, y: 0, width: 50, height: 20 },
}

function renderedViaXs(layer: string): number[] {
  const svg = serializeAltiumPcbLayerToSvg(document, layer, options)
  return [
    ...svg.matchAll(/data-record="Via"[^>]*><circle cx="([\d.]+)"/gu),
  ].map((match) => Number(match[1]))
}

test("renders vias only on copper layers within their drill span", () => {
  expect(renderedViaXs("TOP")).toEqual([10, 20])
  expect(renderedViaXs("MID-LAYER1")).toEqual([10, 20, 30])
  expect(renderedViaXs("MID-LAYER2")).toEqual([10, 20, 30])
  expect(renderedViaXs("MID-LAYER3")).toEqual([10, 30, 40])
  expect(renderedViaXs("MID-LAYER4")).toEqual([10, 40])
  expect(renderedViaXs("BOTTOM")).toEqual([10, 40])
})

test("retains legacy rendering for vias without explicit span fields", () => {
  const spanlessDocument = parseAltiumPcbDoc(
    [
      "|RECORD=Board",
      "|RECORD=Via|X=10mil|Y=10mil|DIAMETER=8mil|HOLESIZE=4mil",
    ].join("\n"),
  )
  const svg = serializeAltiumPcbLayerToSvg(
    spanlessDocument,
    "MID-LAYER2",
    options,
  )
  expect(svg).toContain('data-record="Via"')
})

test("uses custom layer-stack names when resolving a via span", () => {
  const customStackDocument = parseAltiumPcbDoc(
    [
      "|RECORD=Board|LAYER_V8_0NAME=Surface Copper|LAYER_V8_0LAYERID=16777217|LAYER_V8_1NAME=Buried Plane|LAYER_V8_1LAYERID=16842753|LAYER_V8_2NAME=Back Copper|LAYER_V8_2LAYERID=16842751",
      "|RECORD=Via|X=10mil|Y=10mil|DIAMETER=8mil|HOLESIZE=4mil|STARTLAYER=Surface Copper|ENDLAYER=Buried Plane",
    ].join("\n"),
  )

  expect(
    serializeAltiumPcbLayerToSvg(customStackDocument, "Buried Plane", options),
  ).toContain('data-record="Via"')
  expect(
    serializeAltiumPcbLayerToSvg(customStackDocument, "Back Copper", options),
  ).not.toContain('data-record="Via"')
})
