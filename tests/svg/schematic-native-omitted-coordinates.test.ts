import { expect, test } from "bun:test"
import { render } from "../fixtures/native-schematic-rendering"

test("reads omitted zero coordinates and small signed fractions", () => {
  const svg = render([
    "|RECORD=6|LOCATIONCOUNT=3|Y1=10|X2=20|X3_FRAC=5|Y3_FRAC=-8000",
  ])
  expect(svg).toContain('points="0,290 20,300 0.0001,300.08"')
})
