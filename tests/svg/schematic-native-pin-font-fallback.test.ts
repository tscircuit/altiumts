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

test("modern pin records without custom fonts use SYSTEMFONT", () => {
  const svg = render(
    [
      `${pin}|FONTID=2|PINNAME_POSITIONCONGLOMERATE=0|PINDESIGNATOR_POSITIONCONGLOMERATE=0`,
    ],
    `${fonts}|SYSTEMFONT=1`,
  )
  for (const text of ["SIGNAL", "1"]) {
    expect(textElement(svg, text)).toContain('font-family="Arial"')
    expect(textElement(svg, text)).toContain('font-size="4"')
  }
})

test("legacy pin records ignore undefined font table entries", () => {
  const svg = render([`${pin}|FONTID=99`], `${fonts}|SYSTEMFONT=1`)
  for (const text of ["SIGNAL", "1"]) {
    expect(textElement(svg, text)).toContain('font-family="Arial"')
    expect(textElement(svg, text)).toContain('font-size="4"')
  }
})
