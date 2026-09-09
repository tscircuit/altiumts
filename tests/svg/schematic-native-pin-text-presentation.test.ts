import { expect, test } from "bun:test"
import {
  fonts,
  pin,
  render,
  textElement,
} from "../fixtures/native-schematic-rendering"

test("native pin text margins and custom colors are independent of the pin line", () => {
  const defaults = render([`${pin}|COLOR=132`], fonts)
  expect(textElement(defaults, "SIGNAL")).toContain("translate(93 200)")
  expect(textElement(defaults, "1")).toContain("translate(109 200)")
  const custom = render(
    [
      `${pin}|COLOR=132|PINNAME_POSITIONCONGLOMERATE=17|NAME_CUSTOMPOSITION_MARGIN=-2|NAME_CUSTOMFONTID=1|NAME_CUSTOMCOLOR=255|PINDESIGNATOR_POSITIONCONGLOMERATE=17|DESIGNATOR_CUSTOMPOSITION_MARGIN=2|DESIGNATOR_CUSTOMFONTID=1|DESIGNATOR_CUSTOMCOLOR=16711680`,
    ],
    fonts,
  )
  expect(textElement(custom, "SIGNAL")).toContain("translate(98 200)")
  expect(textElement(custom, "SIGNAL")).toContain('fill="#ff0000"')
  expect(textElement(custom, "1")).toContain("translate(102 200)")
  expect(textElement(custom, "1")).toContain('fill="#0000ff"')
  const omittedColor = render(
    [`${pin}|COLOR=132|PINNAME_POSITIONCONGLOMERATE=16|NAME_CUSTOMFONTID=1`],
    fonts,
  )
  expect(textElement(omittedColor, "SIGNAL")).toContain('fill="#000000"')
})
