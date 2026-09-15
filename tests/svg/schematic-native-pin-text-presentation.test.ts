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
  expect(textElement(custom, "SIGNAL")).toContain("translate(100 200)")
  expect(textElement(custom, "SIGNAL")).toContain('fill="#ff0000"')
  expect(textElement(custom, "1")).toContain("translate(102 200)")
  expect(textElement(custom, "1")).toContain('fill="#0000ff"')
  const omittedColor = render(
    [`${pin}|COLOR=132|PINNAME_POSITIONCONGLOMERATE=16|NAME_CUSTOMFONTID=1`],
    fonts,
  )
  expect(textElement(omittedColor, "SIGNAL")).toContain('fill="#000000"')
})

// Verified with native Altium Viewer: margin 0 starts 2 units inside the
// body; positive custom name margins increase that gap in every orientation.
for (const [orientation, dx, dy] of [
  [0, 1, 0],
  [1, 0, -1],
  [2, -1, 0],
  [3, 0, 1],
]) {
  for (const [margin, fraction, inset] of [
    [0, 0, 2],
    [4, 0, 6],
    [-2, 0, 0],
    [1, 25000, 3.25],
  ]) {
    test(`native name margin ${margin}.${fraction} in orientation ${orientation}`, () => {
      const svg = render(
        [
          `${pin.replace("PINCONGLOMERATE=56", `PINCONGLOMERATE=${56 + orientation!}`)}|PINNAME_POSITIONCONGLOMERATE=17|NAME_CUSTOMPOSITION_MARGIN=${margin}|NAME_CUSTOMPOSITION_MARGIN_FRAC=${fraction}|NAME_CUSTOMFONTID=1`,
        ],
        fonts,
      )
      expect(textElement(svg, "SIGNAL")).toContain(
        `translate(${100 - dx! * inset!} ${200 - dy! * inset!})`,
      )
      expect(textElement(svg, "1")).toContain(
        `translate(${100 + dx! * 9} ${200 + dy! * 9})`,
      )
    })
  }
}
