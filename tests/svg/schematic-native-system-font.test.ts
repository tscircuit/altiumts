import { expect, test } from "bun:test"
import { render, textElement } from "../fixtures/native-schematic-rendering"

test("zero font ID inherits SYSTEMFONT and unsupported font fractions are ignored", () => {
  const svg = render(
    ["|RECORD=4|FONTID=0|TEXT=system"],
    "|SYSTEMFONT=1|FONTIDCOUNT=1|SIZE1=4|SIZE1_FRAC=50000|FONTNAME1=Arial",
  )
  expect(textElement(svg, "system")).toContain('font-size="4"')
})
