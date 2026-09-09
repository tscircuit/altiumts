import { expect, test } from "bun:test"
import {
  fonts,
  render,
  textElement,
} from "../fixtures/native-schematic-rendering"

test("invalid font SIZE falls back without changing valid integer fonts", () => {
  const svg = render(
    ["|RECORD=4|FONTID=1|TEXT=valid", "|RECORD=4|FONTID=3|TEXT=invalid"],
    fonts,
  )
  expect(textElement(svg, "valid")).toContain('font-size="4"')
  expect(textElement(svg, "invalid")).toContain('font-size="10"')
  expect(textElement(svg, "invalid")).toContain('font-family="Arial"')
})
