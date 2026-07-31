import { expect, test } from "bun:test"
import {
  AltiumBinaryPcbDoc,
  AltiumFormatDetectionError,
  detectAltiumFile,
  parseAltiumBinaryPcbDoc,
  parseAltiumBinaryPcbPrimitiveStream,
  parseAltiumBinaryPcbWideStrings,
  parseAltiumFile,
} from "../lib"
import { readReferenceBytes } from "./svg/read-reference"

test("detects and parses binary PCB properties and primitive streams", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const detection = detectAltiumFile(source)

  expect(detection).toMatchObject({
    confidence: 1,
    container: "cfb",
    documentKind: "pcb-document",
    encoding: "binary",
  })

  const result = parseAltiumFile(source)
  expect(result.document).toBeInstanceOf(AltiumBinaryPcbDoc)
  const document = result.document as AltiumBinaryPcbDoc

  expect(document.streamSummaries).toHaveLength(46)
  expect(document.components).toHaveLength(440)
  expect(document.nets).toHaveLength(387)
  expect(document.tracks).toHaveLength(10_762)
  expect(document.arcs).toHaveLength(147)
  expect(document.vias).toHaveLength(499)
  expect(document.pads).toHaveLength(1_550)
  expect(document.regions).toHaveLength(131)
  expect(document.regionFills).toHaveLength(131)
  expect(document.boardRegions).toHaveLength(1)
  expect(document.texts).toHaveLength(1_122)
  expect(document.wideStrings.size).toBe(1_122)
  expect(document.getRecordsByKind("Track")).toHaveLength(10_762)
  expect(document.getRecordsByKind("Pad")).toHaveLength(1_550)
  expect(document.getRecordsByKind("Region")).toHaveLength(131)
  expect(document.getRecordsByKind("RegionFill")).toHaveLength(131)
  expect(document.getRecordsByKind("BoardRegion")).toHaveLength(1)
  expect(document.getRecordsByKind("Text")).toHaveLength(1_122)
  expect(document.board?.getCaseInsensitive("KIND")).toBe("Protel_Advanced_PCB")
  expect(document.getStreamSummary("tracks6")).toMatchObject({
    dataSize: 581_148,
    declaredRecordCount: 10_762,
    decodedPrimitiveRecordCount: 10_762,
    decodedPropertyRecordCount: 0,
  })
  expect(document.getStreamSummary("Texts6")).toMatchObject({
    declaredRecordCount: 1_122,
    decodedPrimitiveRecordCount: 1_122,
  })
  expect(document.getStreamSummary("Regions6")).toMatchObject({
    declaredRecordCount: 131,
    decodedPrimitiveRecordCount: 131,
  })
  expect(document.getStreamSummary("ShapeBasedRegions6")).toMatchObject({
    declaredRecordCount: 131,
    decodedPrimitiveRecordCount: 131,
  })
  expect(document.getStreamSummary("BoardRegions")).toMatchObject({
    declaredRecordCount: 1,
    decodedPrimitiveRecordCount: 1,
  })
  expect(document.getBytes()).toEqual(source)

  expect(document.pads[0]).toMatchObject({
    recordKind: "Pad",
  })
  expect(document.pads[0]?.getCaseInsensitive("NAME")).toBe("1")
  expect(document.pads[0]?.getCaseInsensitive("LAYER")).toBe("MULTILAYER")
  expect(document.pads[0]?.getMeasurement("HOLESIZE")).toEqual({
    unit: "mil",
    value: 39.3701,
  })
  expect(document.pads[0]?.getCaseInsensitive("PADSTACKMODE")).toBe(
    "TOP_MIDDLE_BOTTOM",
  )
  expect(document.pads[255]?.getCaseInsensitive("HOLESHAPE")).toBe("SLOT")
  expect(document.pads[255]?.getMeasurement("SLOTLENGTH")).toEqual({
    unit: "mil",
    value: 59.0551,
  })
  expect(document.pads[255]?.getNumber("SLOTROTATION")).toBe(0)
  expect(document.pads[255]?.getNumber("UNPARSEDSTACKBYTES")).toBe(55)
  expect(document.pads[257]?.getBoolean("PLATED")).toBeFalse()
  expect(document.pads[834]?.getCaseInsensitive("LAYER0ALTSHAPE")).toBe(
    "ROUNDRECT",
  )
  expect(document.pads[834]?.getNumber("LAYER0CORNERRADIUS")).toBe(50)
  expect(document.vias[0]?.getCaseInsensitive("STARTLAYER")).toBe("TOP")
  expect(document.vias[0]?.getCaseInsensitive("ENDLAYER")).toBe("BOTTOM")
  expect(document.vias[0]?.getNumber("NET")).toBe(370)
  expect(document.wideStrings.get(0)).toBe("DOUT")
  expect(document.texts[0]?.getCaseInsensitive("WIDESTRINGINDEX")).toBe("0")
  expect(document.texts[0]?.getCaseInsensitive("FONTNAME")).toBe("Arial")
  expect(document.regions[0]?.getCaseInsensitive("SOURCESTREAM")).toBe(
    "ShapeBasedRegions6",
  )
  expect(document.regionFills[0]?.getCaseInsensitive("SOURCESTREAM")).toBe(
    "Regions6",
  )
  expect(document.boardRegions[0]?.getCaseInsensitive("SOURCESTREAM")).toBe(
    "BoardRegions",
  )
  expect(document.boardRegions[0]?.getCaseInsensitive("REGIONKIND")).toBe(
    "LAYER_STACK_REGION",
  )
  expect(document.boardRegions[0]?.isLayerStackRegion).toBeTrue()
  expect(document.boardRegions[0]?.isBoardCutout).toBeFalse()
  expect(
    document.regions.filter((record) => record.getNumber("HOLECOUNT")),
  ).toHaveLength(83)
})

test("validates binary primitive frame counts", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const tracks = document.compoundFile.getStream("/Tracks6/Data")?.content
  const regions = document.compoundFile.getStream("/Regions6/Data")?.content
  const shapeBasedRegions = document.compoundFile.getStream(
    "/ShapeBasedRegions6/Data",
  )?.content
  const boardRegions =
    document.compoundFile.getStream("/BoardRegions/Data")?.content
  const wideStrings =
    document.compoundFile.getStream("/WideStrings6/Data")?.content
  if (!tracks) throw new Error("Expected the Tracks6/Data fixture stream")
  if (!regions) throw new Error("Expected the Regions6/Data fixture stream")
  if (!shapeBasedRegions) {
    throw new Error("Expected the ShapeBasedRegions6/Data fixture stream")
  }
  if (!boardRegions) {
    throw new Error("Expected the BoardRegions/Data fixture stream")
  }
  if (!wideStrings) {
    throw new Error("Expected the WideStrings6/Data fixture stream")
  }

  expect(() =>
    parseAltiumBinaryPcbPrimitiveStream("Tracks6", tracks, {
      expectedRecordCount: 10_761,
    }),
  ).toThrow(AltiumFormatDetectionError)
  expect(() =>
    parseAltiumBinaryPcbPrimitiveStream("Regions6", regions, {
      expectedRecordCount: 130,
    }),
  ).toThrow(AltiumFormatDetectionError)
  expect(() =>
    parseAltiumBinaryPcbPrimitiveStream(
      "ShapeBasedRegions6",
      shapeBasedRegions,
      {
        expectedRecordCount: 130,
      },
    ),
  ).toThrow(AltiumFormatDetectionError)
  expect(() =>
    parseAltiumBinaryPcbPrimitiveStream("BoardRegions", boardRegions, {
      expectedRecordCount: 2,
    }),
  ).toThrow(AltiumFormatDetectionError)
  expect(parseAltiumBinaryPcbWideStrings(wideStrings).size).toBe(1_122)
})
