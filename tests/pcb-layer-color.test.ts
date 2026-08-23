import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../lib"

test("renders the bottom courtyard mechanical layer in cyan", () => {
  const document = parseAltiumPcbDoc(
    [
      "|RECORD=Board",
      "|RECORD=Track|LAYER=MECHANICAL15|X1=0mil|Y1=0mil|X2=10mil|Y2=0mil|WIDTH=1mil",
      "|RECORD=Track|LAYER=MECHANICAL16|X1=0mil|Y1=10mil|X2=10mil|Y2=10mil|WIDTH=1mil",
      "|RECORD=Track|LAYER=MECHANICAL13|X1=0mil|Y1=20mil|X2=10mil|Y2=20mil|WIDTH=1mil",
    ].join("\n"),
  )
  const svg = serializeAltiumPcbToSvg(document)

  expect(svg).toMatch(/data-layer="MECHANICAL15"[^>]*stroke="#ec4899"/u)
  expect(svg).toMatch(/data-layer="MECHANICAL16"[^>]*stroke="#26e9ff"/u)
  expect(svg).toMatch(/data-layer="MECHANICAL13"[^>]*stroke="#ec4899"/u)
})
