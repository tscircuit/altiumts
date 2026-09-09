import { expect, test } from "bun:test"
import { render } from "../fixtures/native-schematic-rendering"

test("native line-width enum applies equally to wires and rectangles", () => {
  for (const [width, expected] of [1, 1, 3, 5].entries()) {
    const svg = render([
      `|RECORD=27|LINEWIDTH=${width}|LOCATIONCOUNT=2|X1=10|Y1=10|X2=20|Y2=10`,
      `|RECORD=14|LINEWIDTH=${width}|LOCATION.X=10|LOCATION.Y=20|CORNER.X=20|CORNER.Y=30`,
    ])
    if (width === 0) expect(svg).toContain('vector-effect="non-scaling-stroke"')
    for (const kind of ["27", "14"]) {
      expect(
        svg.match(new RegExp(`<[^>]+data-record="${kind}"[^>]*>`))?.[0],
      ).toContain(`stroke-width="${expected}"`)
    }
  }
})
