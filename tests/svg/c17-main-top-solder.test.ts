import { expect, test } from "bun:test"
import {
  type AltiumPcbDocument,
  parseAltiumFile,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("renders top-solder pad openings in c17-main.PcbDoc", async () => {
  const source = await readReferenceBytes("c17-main.PcbDoc")
  const result = parseAltiumFile(source)

  expect(result.detection.documentKind).toBe("pcb-document")
  const document = result.document as AltiumPcbDocument
  const pads = document.records.filter(
    (record) =>
      record.recordKind === "Pad" &&
      ["MULTILAYER", "TOP"].includes(record.getCaseInsensitive("LAYER") ?? ""),
  )
  const vias = document.records.filter(
    (record) =>
      record.recordKind === "Via" && record.getBoolean("TENTEDTOP") !== true,
  )
  const svg = serializeAltiumPcbLayerToSvg(document, "TOPSOLDER", {
    title: "c17-main.PcbDoc — Top Solder Mask",
  })

  expect(pads).toHaveLength(189)
  expect(vias).toHaveLength(0)
  expect(svg.match(/data-record="Pad"/g)).toHaveLength(pads.length)
  expect(svg).toContain(
    'data-layer="TOPSOLDER" data-solder-mask-opening="true"',
  )
  expect(svg).not.toContain('data-record="Via"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
}, 30_000)
