import { expect, test } from "bun:test"
import { render } from "../fixtures/native-schematic-rendering"

test("net labels remain visible alongside graphics while hidden parameters stay hidden", () => {
  const svg = render([
    "|RECORD=25|TEXT=VDD|ISHIDDEN=T",
    "|RECORD=4|TEXT=VDD",
    "|RECORD=41|NAME=Comment|TEXT=hidden comment|ISHIDDEN=T",
  ])
  expect(svg.match(/>VDD<\/text>/gu)).toHaveLength(2)
  expect(svg).not.toContain("hidden comment")
})
