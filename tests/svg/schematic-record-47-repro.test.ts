import { expect, test } from "bun:test"
import {
  AltiumUnknownRecord,
  parseAltiumSchDoc,
  serializeAltiumSheetToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("renders the DSP/FPGA switch owning an untyped Record 47 mapping", async () => {
  const source = await readReferenceBytes("altium-dsp-fpga-power.SchDoc")
  const document = parseAltiumSchDoc(source)
  const mapDefiners = document.getRecordsByKind("47")

  expect(mapDefiners).toHaveLength(1)
  const mapDefiner = mapDefiners[0]
  if (!mapDefiner) throw new Error("Expected the fixture's Record 47")
  expect(mapDefiner).toBeInstanceOf(AltiumUnknownRecord)

  let component = document.getParent(mapDefiner)
  while (component && component.recordKind !== "1") {
    component = document.getParent(component)
  }
  if (!component) throw new Error("Expected the owning schematic component")
  expect(component.getDecoded("LIBREFERENCE")).toBe("SW-SPST")
  expect(
    document
      .getOwnedRecords(component)
      .find((record) => record.recordKind === "34")
      ?.getDecoded("TEXT"),
  ).toBe("S3")

  // Record 47 is non-visual pin-to-pad metadata. Capture its owning switch
  // directly from the source sheet; the data repro checks the mapping itself.
  const svg = serializeAltiumSheetToSvg(document, {
    height: 624,
    showBorder: false,
    title: "DSP/FPGA S3 switch with untyped Record 47 mapping",
    viewBox: { x: 85, y: 227, width: 75, height: 52 },
    width: 900,
  })

  await expect(svg).toMatchSvgSnapshot(import.meta.path)

  const fullSheetSvg = serializeAltiumSheetToSvg(document, {
    title: "DSP/FPGA full schematic with untyped Record 47 mapping",
  })
  await expect(fullSheetSvg).toMatchSvgSnapshot(import.meta.path, "full-sheet")
})
