import { expect, test } from "bun:test"
import {
  fonts,
  pin,
  render,
  textElement,
} from "../fixtures/native-schematic-rendering"

test("pins use SYSTEMFONT and independent enabled custom name/designator fonts", () => {
  const svg = render(
    [
      `${pin}|FONTID=3|PINNAME_POSITIONCONGLOMERATE=16|NAME_CUSTOMFONTID=2|DESIGNATOR_CUSTOMFONTID=3`,
    ],
    `${fonts}|SYSTEMFONT=1`,
  )
  expect(textElement(svg, "SIGNAL")).toContain('font-family="Courier New"')
  expect(textElement(svg, "SIGNAL")).toContain('font-size="6"')
  // A custom ID without its enable bit must not override the system font.
  expect(textElement(svg, "1")).toContain('font-size="4"')
  const designatorOverride = render(
    [`${pin}|PINDESIGNATOR_POSITIONCONGLOMERATE=16|DESIGNATOR_CUSTOMFONTID=2`],
    `${fonts}|SYSTEMFONT=1`,
  )
  expect(textElement(designatorOverride, "1")).toContain('font-size="6"')
  expect(textElement(designatorOverride, "SIGNAL")).toContain('font-size="4"')
})
