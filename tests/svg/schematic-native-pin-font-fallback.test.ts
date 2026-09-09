import { expect, test } from "bun:test"
import {
  fonts,
  pin,
  render,
  textElement,
} from "../fixtures/native-schematic-rendering"

test("legacy pin FONTID applies without custom font settings", () => {
  const svg = render([`${pin}|FONTID=1`], fonts)
  for (const text of ["SIGNAL", "1"]) {
    expect(textElement(svg, text)).toContain('font-family="Arial"')
    expect(textElement(svg, text)).toContain('font-size="4"')
  }
})
