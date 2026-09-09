import { expect, test } from "bun:test"
import {
  fonts,
  render,
  textElement,
} from "../fixtures/native-schematic-rendering"

test("power ports without font IDs use the default text font", () => {
  const svg = render(
    ["|RECORD=17|LOCATION.X=100|LOCATION.Y=100|TEXT=VCC|STYLE=2"],
    `${fonts}|SYSTEMFONT=1`,
  )
  expect(textElement(svg, "VCC")).toContain('font-family="Times New Roman"')
  expect(textElement(svg, "VCC")).toContain('font-size="10"')
})
