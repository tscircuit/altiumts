import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("renders component =Value special strings from a real board", async () => {
  const source = await readReferenceBytes("stm32-st-link-v2.SchDoc")
  const document = parseAltiumSchDoc(source)
  const crystal = document.components.find(
    (component) => component.getDecoded("LibReference") === "XTAL",
  )
  if (!crystal) {
    throw new Error("Expected an XTAL component in stm32-st-link-v2.SchDoc")
  }
  expect(
    document
      .getOwnedRecords(crystal)
      .some((record) => record.getDecoded("Text") === "8MHz(12pF)"),
  ).toBe(true)
  const svg = serializeAltiumSheetToSvg(document, {
    title: "STM32 ST-Link V2 component value special-string reproduction",
  })

  expect(svg).not.toContain(">=Value</text>")
  expect(svg.match(/>100nF<\/text>/g)).toHaveLength(6)
  expect(svg.match(/>20pF<\/text>/g)).toHaveLength(2)
  expect(svg.match(/>47pF<\/text>/g)).toHaveLength(2)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
