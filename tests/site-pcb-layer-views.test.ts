import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbLayerToSvg } from "../lib"
import { TI_POWER_REFERENCE_PCB_FILENAMES } from "../scripts/references/ti-power-references"
import { parseBrowserProjectFiles } from "../site/src/parse-project"
import { getPcbLayerViews } from "../site/src/pcb-layer-views"
import { readReferenceBytes } from "./svg/read-reference"

const board =
  "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=1000mil|VY1=0mil|VX2=1000mil|VY2=1000mil|VX3=0mil|VY3=1000mil"
const track = "|X1=100mil|Y1=100mil|X2=900mil|Y2=100mil|WIDTH=10mil"

test("uses stack IDs and physical order, retaining empty enabled layers and mechanical names", () => {
  const source = [
    board,
    "|RECORD=Board|LAYER_V8_3LAYERID=16777217|LAYER_V8_3NAME=Top Layer|LAYER_V8_4LAYERID=17039361|LAYER_V8_4NAME=Core|LAYER_V8_5LAYERID=16777220|LAYER_V8_5NAME=GND 1|LAYER_V8_7LAYERID=16842753|LAYER_V8_7NAME=Power Plane|LAYER_V8_7USEDBYPRIMS=FALSE|LAYER_V8_9LAYERID=16777218|LAYER_V8_9NAME=Signals|LAYER_V8_11LAYERID=16842751|LAYER_V8_11NAME=Bottom Layer",
    "|RECORD=Board|LAYER_V8_12LAYERID=16908289|LAYER_V8_12NAME=Assembly Top|LAYER_V8_12MECHENABLED=TRUE|LAYER_V8_12USEDBYPRIMS=FALSE|LAYER_V8_13LAYERID=16908290|LAYER_V8_13NAME=Unused Mechanical|LAYER_V8_13MECHENABLED=FALSE|LAYER_V8_14LAYERID=16908291|LAYER_V8_14NAME=Occupied Mechanical|LAYER_V8_14MECHENABLED=FALSE",
    "|RECORD=Board|LAYERV7_0LAYERID=16777220|LAYERV7_0NAME=Old Ground Name",
    `|RECORD=Track|LAYER=MID3${track}`,
    `|RECORD=Track|LAYER=MID-LAYER3${track}`,
    `|RECORD=Track|LAYER=GND 1${track}`,
    `|RECORD=Track|LAYER=MECHANICAL3${track}`,
    `|RECORD=Track|LAYER=Future Signal${track}`,
  ].join("\r\n")
  const document = parseAltiumPcbDoc(source)
  const views = getPcbLayerViews(document)
  expect(views.map(({ layer, label }) => [layer, label])).toEqual([
    ["TOP", "Top copper"],
    ["MID3", "GND 1"],
    ["INTERNALPLANE1", "Power Plane"],
    ["MID1", "Signals"],
    ["BOTTOM", "Bottom copper"],
    ["MECHANICAL1", "Assembly Top"],
    ["MECHANICAL3", "Occupied Mechanical"],
    ["FUTURESIGNAL", "Future Signal"],
  ])
  expect(document.getString()).toBe(source)
})

test("resolves custom names in SVG filtering while preserving the inner-layer pad ordinal", () => {
  const source = [
    board,
    "|RECORD=Board|LAYER_V8_0LAYERID=16777220|LAYER_V8_0NAME=GND 1",
    `|RECORD=Track|LAYER=MID3${track}`,
    `|RECORD=Track|LAYER=GND 1${track}`,
    `|RECORD=Track|LAYER=MID1${track}`,
    "|RECORD=Pad|NAME=P|LAYER=MULTILAYER|X=500mil|Y=500mil|PADMODE=2|XSIZE=80mil|YSIZE=80mil|SHAPE=RECTANGLE|LAYER3XSIZE=40mil|LAYER3YSIZE=40mil|LAYER3SHAPE=ROUND",
  ].join("\n")
  const document = parseAltiumPcbDoc(source)
  const options = { title: "Ground layer" }
  const svg = serializeAltiumPcbLayerToSvg(document, "GND 1", options)
  expect(svg).toBe(serializeAltiumPcbLayerToSvg(document, "MID3", options))
  expect(svg).toContain('data-layer="GND 1"')
  expect(svg).toContain('data-layer="MID3"')
  expect(svg).not.toContain('data-layer="MID1"')
  expect(svg).toContain('data-pad-stack-layer="3"')
  expect(svg).toContain('data-pad-shape="ROUND"')
  expect(document.getString()).toBe(source)
})

test("follows legacy NEXT links across Board records instead of sorting ordinals", () => {
  const document = parseAltiumPcbDoc(
    [
      board,
      "|RECORD=Board|LAYER1NAME=Top Layer|LAYER1NEXT=4|LAYER2NAME=Empty Signal|LAYER2PREV=4|LAYER2NEXT=32",
      "|RECORD=Board|LAYER3NAME=Disabled Signal|LAYER3PREV=0|LAYER3NEXT=0|LAYER4NAME=Ground|LAYER4PREV=1|LAYER4NEXT=2|LAYER32NAME=Bottom Layer|LAYER32PREV=2|LAYER32NEXT=0",
      `|RECORD=Track|LAYER=MID3${track}`,
    ].join("\n"),
  )
  expect(
    getPcbLayerViews(document).map(({ layer, label }) => [layer, label]),
  ).toEqual([
    ["TOP", "Top copper"],
    ["MID3", "Ground"],
    ["MID1", "Empty Signal"],
    ["BOTTOM", "Bottom copper"],
  ])
})

test("follows V7 IDs and terminates safely on cyclic stack links", () => {
  const document = parseAltiumPcbDoc(
    [
      board,
      "|RECORD=Board|LAYERV7_0LAYERID=16777217|LAYERV7_0NAME=Top Layer|LAYERV7_0NEXT=16777220|LAYERV7_1LAYERID=16777218|LAYERV7_1NAME=Second Signal|LAYERV7_1NEXT=16777217|LAYERV7_2LAYERID=16777220|LAYERV7_2NAME=First Signal|LAYERV7_2NEXT=16777218",
    ].join("\n"),
  )
  expect(getPcbLayerViews(document).map(({ layer }) => layer)).toEqual([
    "TOP",
    "MID3",
    "MID1",
  ])
})

test("does not merge distinct physical layers that share a display name", () => {
  const document = parseAltiumPcbDoc(
    [
      board,
      "|RECORD=Board|LAYER_V8_0LAYERID=16777218|LAYER_V8_0NAME=Ground|LAYER_V8_1LAYERID=16777219|LAYER_V8_1NAME=Ground",
      `|RECORD=Track|LAYER=MID1${track}`,
      `|RECORD=Track|LAYER=MID2${track}`,
    ].join("\n"),
  )
  expect(getPcbLayerViews(document)).toEqual([
    { id: "layer:MID1", layer: "MID1", label: "Ground" },
    { id: "layer:MID2", layer: "MID2", label: "Ground" },
  ])
  const svg = serializeAltiumPcbLayerToSvg(document, "MID1")
  expect(svg).toContain('data-layer="MID1"')
  expect(svg).not.toContain('data-layer="MID2"')
})

test("keeps occupied fallback layers beyond the former 64-entry limit", () => {
  const document = parseAltiumPcbDoc(
    [
      board,
      ...Array.from(
        { length: 70 },
        (_, index) => `|RECORD=Track|LAYER=Artwork ${index}${track}`,
      ),
    ].join("\n"),
  )
  expect(getPcbLayerViews(document)).toHaveLength(70)
})

for (const filename of Object.values(TI_POWER_REFERENCE_PCB_FILENAMES)) {
  test(`snapshots physical layer choices in ${filename}`, async () => {
    const bytes = await readReferenceBytes(filename)
    const state = parseBrowserProjectFiles([
      { path: filename, bytes: Uint8Array.from(bytes).buffer },
    ])
    const views = state.manifest.documents[0]?.views
    if (!views) throw new Error("Expected PCB views")
    expect(new Set(views.map(({ id }) => id)).size).toBe(views.length)
    expect(
      views.map(({ layer, label }) => `${layer ?? "board"}: ${label}`),
    ).toMatchSnapshot()
    const document = [...state.documents.values()][0]?.document
    expect(document?.getBytes()).toEqual(bytes)
  }, 30_000)
}
