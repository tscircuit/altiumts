import { expect, test } from "bun:test"
import {
  AltiumBinaryPcbDoc,
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
  serializeAltiumPcbDocToBinary,
  serializeAltiumPcbLayerToSvg,
} from "../lib"
import { TI_POWER_REFERENCE_PCB_FILENAMES } from "../scripts/references/ti-power-references"
import {
  parseBrowserProjectFiles,
  renderProjectDocument,
} from "../site/src/parse-project"
import { readReferenceBytes } from "./svg/read-reference"

const outline =
  "|VX0=0mil|VY0=0mil|VX1=1000mil|VY1=0mil|VX2=1000mil|VY2=1000mil|VX3=0mil|VY3=1000mil"
const board = `|RECORD=Board${outline}`
const track = "|X1=100mil|Y1=100mil|X2=900mil|Y2=100mil|WIDTH=10mil"
const source = [
  board,
  `|RECORD=Polygon|ID=0|LAYER=MID1${outline}`,
  `|RECORD=Region|POLYGON=0|LAYER=MID-LAYER1|REGIONKIND=COPPER${outline}`,
  `|RECORD=Track|LAYER=mid_layer_1${track}`,
  `|RECORD=Track|LAYER=MID2${track}`,
  `|RECORD=Track|LAYER=MID10${track}`,
  `|RECORD=Track|LAYER=INTERNALPLANE1${track}`,
  `|RECORD=Track|LAYER=Mid Layer 1 Custom${track}`,
  "|RECORD=Pad|NAME=1|LAYER=MULTILAYER|X=500mil|Y=500mil|PADMODE=1|XSIZE=80mil|YSIZE=80mil|SHAPE=RECTANGLE|MIDXSIZE=40mil|MIDYSIZE=40mil|MIDSHAPE=ROUND",
].join("\r\n")
const aliases = ["MID1", "MID-LAYER1", "Mid Layer 1", "mid_layer_1"]

test("indexes mixed inner-layer spellings together without changing the source", () => {
  const document = parseAltiumPcbDoc(source)
  const expected = document.records.slice(1, 4)
  for (const alias of aliases) {
    expect(document.getRecordsByLayer(alias)).toEqual(expected)
  }
  expect(document.index.byLayer.get("MID1")).toEqual(expected)
  expect(document.index.byLayer.has("MID-LAYER1")).toBeFalse()
  expect(document.getString()).toBe(source)

  const region = expected[1]
  if (!region) throw new Error("Expected a region")
  region.set("LAYER", "MID-LAYER2")
  expect(document.getRecordsByLayer("MID-LAYER1")).toEqual(
    expected.filter((record) => record !== region),
  )
  expect(document.getRecordsByLayer("MID2")).toContain(region)
  expect(document.getRecordsByLayer("MID-LAYER2")).toHaveLength(2)
})

test("renders a polygon, its poured region, tracks and pad stack through either alias", () => {
  const document = parseAltiumPcbDoc(source)
  const options = { title: "Inner signal layer 1" }
  const expected = serializeAltiumPcbLayerToSvg(document, "MID1", options)
  for (const alias of aliases) {
    const svg = serializeAltiumPcbLayerToSvg(document, alias, options)
    expect(svg).toBe(expected)
    expect(svg).toContain('data-record="Polygon" data-layer="MID1"')
    expect(svg).toContain('data-record="Region" data-layer="MID-LAYER1"')
    expect(svg).toContain('data-record="Track" data-layer="mid_layer_1"')
    expect(svg).toContain('data-pad-stack-layer="1"')
    expect(svg).toContain('data-pad-shape="ROUND"')
    for (const otherLayer of [
      "MID2",
      "MID10",
      "INTERNALPLANE1",
      "Mid Layer 1 Custom",
    ]) {
      expect(svg).not.toContain(`data-layer="${otherLayer}"`)
    }
  }
  expect(document.getString()).toBe(source)
})

test("serializes either inner-layer spelling to the same binary layer ID", () => {
  for (const ordinal of [1, 14, 30]) {
    const document = parseAltiumPcbDoc(
      [
        board,
        `|RECORD=Track|LAYER=MID${ordinal}${track}`,
        `|RECORD=Track|LAYER=MID-LAYER${ordinal}${track}`,
      ].join("\n"),
    )
    const binary = parseAltiumBinaryPcbDoc(
      serializeAltiumPcbDocToBinary(document),
    )
    expect(binary.tracks.map((record) => record.getDecoded("LAYER"))).toEqual([
      `MID-LAYER${ordinal}`,
      `MID-LAYER${ordinal}`,
    ])
    expect(binary.getRecordsByLayer(`MID${ordinal}`)).toEqual(binary.tracks)
    expect(binary.getRecordsByLayer(`MID-LAYER${ordinal}`)).toEqual(
      binary.tracks,
    )
  }
})

const references = [
  { filename: TI_POWER_REFERENCE_PCB_FILENAMES.pmp22650, innerLayers: 6 },
  { filename: TI_POWER_REFERENCE_PCB_FILENAMES.pmp22712, innerLayers: 2 },
  { filename: TI_POWER_REFERENCE_PCB_FILENAMES.pmp22773, innerLayers: 2 },
  { filename: TI_POWER_REFERENCE_PCB_FILENAMES.pmp23595, innerLayers: 4 },
  { filename: TI_POWER_REFERENCE_PCB_FILENAMES.pmp23653Main, innerLayers: 2 },
  {
    filename: TI_POWER_REFERENCE_PCB_FILENAMES.pmp23653PlanarTransformer,
    innerLayers: 4,
  },
]

for (const { filename, innerLayers } of references) {
  test(`offers one complete view per inner layer in ${filename}`, async () => {
    const bytes = await readReferenceBytes(filename)
    const state = parseBrowserProjectFiles([
      { path: filename, bytes: Uint8Array.from(bytes).buffer },
    ])
    expect(state.manifest.failures).toEqual([])
    const entry = [...state.documents.values()][0]
    if (!entry || !(entry.document instanceof AltiumBinaryPcbDoc)) {
      throw new Error("Expected a binary PCB document")
    }
    const { document, manifest } = entry
    const innerViews = manifest.views.filter(({ layer }) =>
      /^MID(?:-LAYER)?\d+$/u.test(layer ?? ""),
    )
    expect(innerViews).toHaveLength(innerLayers)

    for (let ordinal = 1; ordinal <= innerLayers; ordinal++) {
      const shortName = `MID${ordinal}`
      const longName = `MID-LAYER${ordinal}`
      const shortRecords = document.records.filter(
        (record) => record.getDecoded("LAYER") === shortName,
      )
      const longRecords = document.records.filter(
        (record) => record.getDecoded("LAYER") === longName,
      )
      expect(shortRecords.length).toBeGreaterThan(0)
      expect(longRecords.length).toBeGreaterThan(0)
      const expected = document.records.filter(
        (record) =>
          record.getDecoded("LAYER") === shortName ||
          record.getDecoded("LAYER") === longName,
      )
      expect(document.getRecordsByLayer(shortName)).toEqual(expected)
      expect(document.getRecordsByLayer(longName)).toEqual(expected)
      expect(
        innerViews.filter(
          ({ layer }) => layer === shortName || layer === longName,
        ),
      ).toHaveLength(1)
    }

    const firstView = innerViews.find(
      ({ layer }) => layer === "MID1" || layer === "MID-LAYER1",
    )
    if (!firstView) throw new Error("Expected an inner layer 1 view")
    const svg = renderProjectDocument(state, manifest.id, firstView.id)
    expect(svg).toContain('data-record="Polygon" data-layer="MID1"')
    expect(svg).toContain('data-record="Region" data-layer="MID-LAYER1"')
    expect(svg).not.toContain('data-layer="MID2"')
    expect(svg).not.toContain('data-layer="MID-LAYER2"')
    expect(document.getBytes()).toEqual(bytes)
  }, 30_000)
}
