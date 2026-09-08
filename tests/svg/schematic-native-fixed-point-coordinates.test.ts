import { expect, test } from "bun:test"
import { render, textElement } from "../fixtures/native-schematic-rendering"

test("renders signed fixed-point coordinates and does not repair decimal base fields", () => {
  const svg = render([
    "|RECORD=7|LOCATIONCOUNT=3|X1=258|X1_FRAC=8000|Y1=10|X2=258.08|Y2=20|X3=-2|X3_FRAC=-8000|Y3=30",
    "|RECORD=4|LOCATION.X=258.8|LOCATION.Y=50|TEXT=bad coordinate",
  ])
  expect(svg).toContain('points="258.08,290 0,280 -2.08,270"')
  expect(textElement(svg, "bad coordinate")).toContain("translate(0 250)")
})
