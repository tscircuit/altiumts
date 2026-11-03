import { expect, test } from "bun:test"
import {
  AltiumTextRecord,
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbToSvg,
} from "../lib"
import { getPcbRecordComponent } from "../lib/pcb-reference-resolution"
import { escapeXml } from "../lib/svg-serialization/svg-utils"
import { readReferenceBytes } from "./svg/read-reference"

test("resolves quoted component designators in the BW0253 PCB", async () => {
  const source = await readReferenceBytes("bw0253.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const quotedDesignators = document.texts.filter(
    (record): record is AltiumTextRecord =>
      record instanceof AltiumTextRecord && record.text === "'.Designator'",
  )
  expect(quotedDesignators).toHaveLength(49)
  const svg = serializeAltiumPcbToSvg(document)
  expect(svg).not.toContain("&apos;.Designator&apos;")
  for (const layer of ["MECHANICAL2", "MECHANICAL3"]) {
    const layerSvg = serializeAltiumPcbToSvg(document, { layers: [layer] })
    const layerDesignators = quotedDesignators.filter(
      (record) => record.layer === layer,
    )
    expect(layerSvg).not.toContain("&apos;.Designator&apos;")
    expect(layerSvg.match(/<text\b/g)).toHaveLength(layerDesignators.length)
    for (const record of layerDesignators) {
      const component = getPcbRecordComponent(document, record)
      expect(component?.designator).toBeDefined()
      expect(layerSvg).toContain(
        `>${escapeXml(component?.designator ?? "")}</text>`,
      )
    }
  }
  expect(document.getBytes()).toEqual(source)
}, 20_000)
