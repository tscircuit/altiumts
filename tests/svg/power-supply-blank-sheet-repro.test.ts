import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("renders the complete predefined PowerSupply sheet", async () => {
  const source = await readReferenceBytes("PowerSupply.SchDoc")
  const document = parseAltiumSchDoc(source)
  const svg = serializeAltiumSheetToSvg(document, {
    title: "PowerSupply.SchDoc blank sheet reproduction",
  })

  expect(document.records.length).toBe(307)
  expect(svg).toContain('viewBox="0 0 1658.5 1218.5"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
