import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbDocToBinary } from "../lib"
import {
  binaryCopperPrimitiveBoardSource,
  binaryCopperRegionSource,
  binaryPolygonCutoutRegionSource,
} from "./fixtures/binary-pcb-copper-primitives"

test("creates native binary PCB regions with holes", () => {
  const bytes = serializeAltiumPcbDocToBinary(
    [binaryCopperPrimitiveBoardSource, binaryCopperRegionSource].join("\r\n"),
  )
  const document = parseAltiumBinaryPcbDoc(bytes)
  const region = document.regions[0]

  expect(document.regions).toHaveLength(1)
  expect(document.getStreamSummary("ShapeBasedRegions6")).toMatchObject({
    declaredRecordCount: 1,
    decodedPrimitiveRecordCount: 1,
  })
  expect(region?.regionKind).toBe("COPPER")
  expect(region?.netIndex).toBe(0)
  expect(region?.polygonIndex).toBe(0)
  expect(region?.geometry.outline.isExplicitlyClosed).toBeTrue()
  expect(region?.geometry.outline.vertices).toHaveLength(5)
  expect(region?.geometry.holes).toHaveLength(1)
  expect(region?.geometry.holes[0]?.vertices).toHaveLength(4)
})

test("creates native binary PCB polygon-cutout regions", () => {
  const bytes = serializeAltiumPcbDocToBinary(
    [binaryCopperPrimitiveBoardSource, binaryPolygonCutoutRegionSource].join(
      "\r\n",
    ),
  )
  const document = parseAltiumBinaryPcbDoc(bytes)
  const region = document.regions[0]

  expect(document.regions).toHaveLength(1)
  expect(document.getStreamSummary("ShapeBasedRegions6")).toMatchObject({
    declaredRecordCount: 1,
    decodedPrimitiveRecordCount: 1,
  })
  expect(region?.regionKind).toBe("POLYGON_CUTOUT")
  expect(region?.isPolygonCutout).toBeTrue()
  expect(region?.netIndex).toBe(0)
  expect(region?.polygonIndex).toBe(0)
  expect(region?.geometry.outline.isExplicitlyClosed).toBeTrue()
  expect(region?.geometry.outline.vertices).toHaveLength(5)
  expect(region?.geometry.holes).toHaveLength(0)
})
