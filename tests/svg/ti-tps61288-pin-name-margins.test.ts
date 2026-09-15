import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"

// TI TPS61288 conversion exported by circuit-json-to-altium #163 (310327e).
// Source: https://github.com/tscircuit/circuit-json-to-altium/pull/163
// This earlier export uses NAME_CUSTOMPOSITION_MARGIN=-2. Native Altium's
// base inset of 2 cancels it, placing names on the body edge, not 2 units inside.
test("reproduces native pin-name margins on the converted TI TPS61288 sheet", async () => {
  const bytes = await Bun.file(
    new URL("../fixtures/ti-tps61288-pin-name-margins.SchDoc", import.meta.url),
  ).bytes()
  const document = parseAltiumSchDoc(bytes)
  const svg = serializeAltiumSheetToSvg(document, { margin: 0 })
  const groups = [...svg.matchAll(/<g data-record="2">([\s\S]*?)<\/g>/gu)]
  const visibleNames = groups.filter(([, group]) =>
    group!.includes('dominant-baseline="central"'),
  )
  expect(visibleNames.length).toBeGreaterThan(20)
  for (const [, group] of visibleNames) {
    const body = group!.match(/<line x1="([\d.-]+)" y1="([\d.-]+)"/u)!
    const name = group!.match(
      /dominant-baseline="central" transform="translate\(([\d.-]+) ([\d.-]+)\)/u,
    )!
    expect([Number(name[1]), Number(name[2])]).toEqual([
      Number(body[1]),
      Number(body[2]),
    ])
  }
  expect(document.getBytes()).toEqual(bytes)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
