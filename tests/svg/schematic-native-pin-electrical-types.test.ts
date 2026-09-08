import { expect, test } from "bun:test"
import { pin, render } from "../fixtures/native-schematic-rendering"

test("missing electrical type renders input indicator; passive and power do not", () => {
  expect(render([pin])).toContain('data-electrical="0"')
  for (const electrical of [1, 2]) {
    expect(render([`${pin}|ELECTRICAL=${electrical}`])).toContain(
      `data-electrical="${electrical}"`,
    )
  }
  for (const electrical of [4, 7]) {
    expect(render([`${pin}|ELECTRICAL=${electrical}`])).not.toContain(
      "altium-schematic-pin-electrical-symbol",
    )
  }
})
