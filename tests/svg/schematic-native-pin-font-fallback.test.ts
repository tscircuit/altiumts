import { expect, test } from "bun:test"
import {
  fonts,
  pin,
  render,
  textElement,
} from "../fixtures/native-schematic-rendering"

test("pin FONTID does not override the missing system font", () => {
  const svg = render([`${pin}|FONTID=1`], fonts)
  for (const text of ["SIGNAL", "1"]) {
    expect(textElement(svg, text)).toContain('font-family="Times New Roman"')
    expect(textElement(svg, text)).toContain('font-size="10"')
  }
})
