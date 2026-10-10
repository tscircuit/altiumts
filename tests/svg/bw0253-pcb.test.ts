import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import {
  getPcbDocumentBounds,
  getPcbRecordBounds,
} from "../../lib/svg-serialization/pcb-geometry"
import {
  boundsIntersect,
  createSvgViewport,
  mergeBounds,
} from "../../lib/svg-serialization/svg-utils"
import { readReferenceBytes } from "./read-reference"

test("reproduces BW0253 keepout fill rendered as copper on the full board", async () => {
  const source = await readReferenceBytes("bw0253.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const keepoutFills = document.records.filter(
    (record) =>
      record.recordKind === "Fill" && record.getBoolean("KEEPOUT") === true,
  )
  expect(keepoutFills).toHaveLength(1)
  expect(keepoutFills[0]?.get("LAYER")).toBe("TOP")
  expect(document.getBytes()).toEqual(source)
  const boardBounds = keepoutFills.reduce(
    (bounds, record) =>
      mergeBounds(bounds, getPcbRecordBounds(record)) ?? bounds,
    getPcbDocumentBounds(document),
  )
  let bounds = boardBounds
  for (const record of document.records) {
    const recordBounds = getPcbRecordBounds(record)
    if (recordBounds && boundsIntersect(recordBounds, boardBounds)) {
      bounds = mergeBounds(bounds, recordBounds) ?? bounds
    }
  }
  const viewport = createSvgViewport(bounds)
  const svg = serializeAltiumPcbToSvg(document, {
    title: "BW0253 PCB",
    viewBox: {
      x: bounds.minX - viewport.margin,
      y: bounds.minY - viewport.margin,
      width: viewport.width,
      height: viewport.height,
    },
  })
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
}, 20_000)
