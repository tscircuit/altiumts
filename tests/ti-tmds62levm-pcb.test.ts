import { expect, test } from "bun:test"
import {
  AltiumBinaryPcbDoc,
  detectAltiumFile,
  parseAltiumFile,
  validateAltiumDocument,
} from "../lib"
import { readReferenceBytes } from "./svg/read-reference"

test("parses and strictly validates the TI TMDS62LEVM Rev. B PCB", async () => {
  const source = await readReferenceBytes("ti-tmds62levm-rev-b.PcbDoc")
  expect(detectAltiumFile(source)).toMatchObject({
    confidence: 1,
    container: "cfb",
    documentKind: "pcb-document",
    encoding: "binary",
  })

  const result = parseAltiumFile(source)
  expect(result.document).toBeInstanceOf(AltiumBinaryPcbDoc)
  const document = result.document as AltiumBinaryPcbDoc

  expect(document.records).toHaveLength(424_275)
  expect(document.streamSummaries).toHaveLength(47)
  expect(document.components).toHaveLength(1_585)
  expect(document.nets).toHaveLength(1_000)
  expect(document.tracks).toHaveLength(265_476)
  expect(document.arcs).toHaveLength(94_909)
  expect(document.vias).toHaveLength(3_267)
  expect(document.pads).toHaveLength(14_464)
  expect(document.fills).toHaveLength(83)
  expect(document.regions).toHaveLength(3_903)
  expect(
    Math.max(...document.regions.map((region) => region.items.length)),
  ).toBe(73_111)
  expect(document.regionFills).toHaveLength(3_903)
  expect(document.boardRegions).toHaveLength(1)
  expect(document.texts).toHaveLength(18_556)

  expect(document.boardGeometry.outline).toMatchObject({
    bounds: {
      minX: -0.515,
      minY: -200.515,
      maxX: 5354.9486,
      maxY: 5424.515,
    },
    isExplicitlyClosed: true,
    winding: "counterclockwise",
  })
  expect(document.boardGeometry.outline.vertices).toHaveLength(8)
  expect(document.boardGeometry.cutouts).toHaveLength(0)
  expect(document.boardGeometry.layerStackRegions).toHaveLength(1)
  expect(document.boardGeometry.polygonCutouts).toHaveLength(156)

  expect(document.getStreamSummary("Dimensions6")).toMatchObject({
    declaredRecordCount: 4,
    decodedPrimitiveRecordCount: 0,
    decodedPropertyRecordCount: 0,
    hasData: true,
  })
  expect(document.getStreamSummary("DifferentialPairs6")).toMatchObject({
    declaredRecordCount: 18,
    decodedPrimitiveRecordCount: 0,
    decodedPropertyRecordCount: 0,
    hasData: true,
  })

  expect(validateAltiumDocument(document, { profile: "strict" })).toEqual({
    issues: [],
    profile: "strict",
    summary: { errors: 0, fatals: 0, warnings: 0 },
    valid: true,
  })
  expect(document.getBytes()).toEqual(source)
}, 45_000)
