import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"

/**
 * Reproduction: Opaque Connections6 semantic decoding gap
 *
 * File: references/dsp5509-ciii.PcbDoc (DSP5509 CIII board)
 * Source: AmirhosseinR/Altium_DSP_FPGA (MIT)
 *
 * The Connections6 stream contains 717 binary airwire/ratsnest records
 * (25,095 bytes) but 100% are opaque — the parser skips them because
 * they don't start with "|". Zero decoded, zero rendered.
 *
 * When semantic decoding is implemented, update assertions and snapshot.
 */

test("DSP5509 CIII: SVG contains zero airwire/ratsnest elements (Connections6 gap)", async () => {
  const source = await readReferenceBytes("dsp5509-ciii.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)

  // --- Structural gap assertions ---

  // 717 declared, 0 decoded — all opaque
  const summary = document.getStreamSummary("Connections6")
  expect(summary!.declaredRecordCount).toBe(717)
  expect(summary!.decodedPropertyRecordCount).toBe(0)

  // Raw binary preserved (25,095 bytes) for future decoder
  const rawStream = document.compoundFile.getStream("/Connections6/Data")
  expect(rawStream!.content.byteLength).toBe(25095)

  // 272 nets exist but zero connection topology
  expect(document.getRecordsByKind("Net").length).toBe(272)
  expect(document.getRecordsByKind("Connection")).toHaveLength(0)

  // --- SVG rendering gap ---

  const svg = serializeAltiumPcbToSvg(document, {
    fitToContent: true,
    title: "DSP5509 CIII — Connections6 Gap Repro",
  })

  // Board renders with tracks, pads, vias
  expect(svg).toContain('data-record="Track"')
  expect(svg).toContain('data-record="Pad"')
  expect(svg).toContain('data-record="Via"')

  // But zero connection/airwire/ratsnest elements
  expect(svg).not.toContain('data-record="Connection"')
  expect(svg).not.toContain('data-record="Airwire"')
  expect(svg).not.toContain('data-record="Ratsnest"')

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
