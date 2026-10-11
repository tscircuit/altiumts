import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("reproduces inactive polarized capacitor display modes on a real board", async () => {
  const source = await readReferenceBytes("altium-dsp-fpga-power.SchDoc")
  const document = parseAltiumSchDoc(source)
  const alternateDisplayModeComponents = document.components.filter(
    (component) => (component.getNumber("DISPLAYMODE") ?? 0) > 0,
  )

  expect(alternateDisplayModeComponents).toHaveLength(10)
  expect(
    alternateDisplayModeComponents.every((component) =>
      document
        .getOwnedRecords(component)
        .some(
          (record) =>
            record.recordKind === "12" &&
            record.getNumber("OWNERPARTDISPLAYMODE") === 1,
        ),
    ),
  ).toBe(true)

  const svg = serializeAltiumSheetToSvg(document, {
    title: "Altium DSP/FPGA power schematic display-mode reproduction",
  })

  expect(svg).not.toContain("@DESIGNATOR")
  expect(svg).not.toContain("INITIAL VOLTAGE")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
