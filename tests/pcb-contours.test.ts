import { expect, test } from "bun:test"
import {
  AltiumRegionRecord,
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
  serializeAltiumPcbToSvg,
} from "../lib"
import { readReferenceBytes } from "./svg/read-reference"

test("models the Novena board outline and layer-stack region", async () => {
  const source = await readReferenceBytes("novena-edp-adapter-dvt1.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const geometry = document.boardGeometry

  expect(geometry.outline).toMatchObject({
    bounds: {
      minX: 5022.6372,
      minY: 4017.7159,
      maxX: 6987.2041,
      maxY: 5395.6687,
    },
    isExplicitlyClosed: true,
    winding: "counterclockwise",
  })
  expect(geometry.outline.vertices).toHaveLength(8)
  expect(geometry.outline.points).toHaveLength(8)
  expect(
    geometry.outline.vertices.every(({ kind }) => kind === "line"),
  ).toBeTrue()
  expect(geometry.cutouts).toHaveLength(0)
  expect(geometry.layerStackRegions).toHaveLength(1)
  expect(geometry.polygonCutouts).toHaveLength(0)
  expect(document.boardRegions[0]).toMatchObject({
    isBoardCutout: false,
    isLayerStackRegion: true,
    layerStackId: "{5C0C3223-D866-4955-BCD2-EB2E768135EA}",
    regionKind: "LAYER_STACK_REGION",
  })
  expect(document.getBytes()).toEqual(source)
})

test("models curved Elk Pi board contours and polygon cutouts", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const geometry = document.boardGeometry

  expect(geometry.outline.vertices).toHaveLength(39)
  expect(
    geometry.outline.vertices.filter(({ kind }) => kind === "arc"),
  ).toHaveLength(22)
  expect(geometry.outline.points).toHaveLength(147)
  expect(geometry.outline.winding).toBe("clockwise")
  expect(geometry.cutouts).toHaveLength(0)
  expect(geometry.layerStackRegions).toHaveLength(1)
  expect(geometry.polygonCutouts).toHaveLength(2)
  expect(geometry.polygonCutouts[0]?.outline.bounds).toEqual({
    minX: 7073.1891,
    minY: 4425.74,
    maxX: 7171.7404,
    maxY: 4673.5546,
  })
  expect(geometry.polygonCutouts[1]?.outline.winding).toBe("degenerate")
  expect(document.boardRegions[0]).toMatchObject({
    isBoardCutout: false,
    isLayerStackRegion: true,
    regionKind: "LAYER_STACK_REGION",
  })
  expect(document.getBytes()).toEqual(source)
}, 15_000)

test("renders explicit board-cutout regions with even-odd fill", () => {
  const source = [
    "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=1000mil|VY1=0mil|VX2=1000mil|VY2=1000mil|VX3=0mil|VY3=1000mil|VX4=0mil|VY4=0mil",
    "|RECORD=Region|ISBOARDCUTOUT=TRUE|KIND=0|VX0=300mil|VY0=300mil|VX1=700mil|VY1=300mil|VX2=700mil|VY2=700mil|VX3=300mil|VY3=700mil|VX4=300mil|VY4=300mil|HOLECOUNT=1|HOLE0COUNT=5|HOLE0VX0=450mil|HOLE0VY0=450mil|HOLE0VX1=550mil|HOLE0VY1=450mil|HOLE0VX2=550mil|HOLE0VY2=550mil|HOLE0VX3=450mil|HOLE0VY3=550mil|HOLE0VX4=450mil|HOLE0VY4=450mil",
    "|RECORD=Region|ISBOARDCUTOUT=TRUE|KIND=0|OBJECTKIND=BoardRegion|LAYERSTACKID={STACK}|VX0=0mil|VY0=0mil|VX1=1000mil|VY1=0mil|VX2=1000mil|VY2=1000mil|VX3=0mil|VY3=1000mil|VX4=0mil|VY4=0mil",
  ].join("\r\n")
  const document = parseAltiumPcbDoc(source)
  const region = document.records[1]
  const layerStackRegion = document.records[2]
  if (!(region instanceof AltiumRegionRecord)) {
    throw new Error("Expected a typed board-cutout region")
  }
  if (!(layerStackRegion instanceof AltiumRegionRecord)) {
    throw new Error("Expected a typed layer-stack region")
  }

  expect(document.boardGeometry.cutouts).toHaveLength(1)
  expect(document.boardGeometry.cutouts[0]?.holes).toHaveLength(1)
  expect(document.boardGeometry.layerStackRegions).toHaveLength(1)
  expect(region).toMatchObject({
    isBoardCutout: true,
    isLayerStackRegion: false,
    regionKind: "BOARD_CUTOUT",
  })
  expect(layerStackRegion).toMatchObject({
    isBoardCutout: false,
    isLayerStackRegion: true,
    layerStackId: "{STACK}",
    regionKind: "LAYER_STACK_REGION",
  })
  expect(document.getString()).toBe(source)

  const svg = serializeAltiumPcbToSvg(document, { title: "Board cutout" })
  expect(svg).toContain('data-record="BoardOutline"')
  expect(svg).toContain('data-board-cutouts="1"')
  expect(svg).toContain('fill-rule="evenodd"')
  expect(svg.match(/\bM /gu)).toHaveLength(3)
  expect(svg).not.toContain('data-record="Region"')

  const solidSvg = serializeAltiumPcbToSvg(document, {
    showBoardCutouts: false,
    title: "Board without cutouts",
  })
  expect(solidSvg).toContain('data-record="BoardOutline"')
  expect(solidSvg).not.toContain("data-board-cutouts")
})
