import { expect, test } from "bun:test"
import sharp from "sharp"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"

test("junction SIZE uses the native radius presets, including the omitted default", () => {
  const doc = parseAltiumSchDoc(
    [
      "|RECORD=31|USECUSTOMSHEET=T|CUSTOMX=200|CUSTOMY=100",
      ...[undefined, 0, 1, 2, 3].map(
        (size, i) =>
          `|RECORD=29|LOCATION.X=${20 + i * 35}|LOCATION.Y=50|COLOR=34816|LOCKED=T${size === undefined ? "" : `|SIZE=${size}`}`,
      ),
    ].join("\n"),
  )
  const svg = serializeAltiumSheetToSvg(doc)
  expect(
    [...svg.matchAll(/<circle data-record="29"[^>]+ r="([^"]+)"/g)].map(
      (match) => Number(match[1]),
    ),
  ).toEqual([2, 2, 3, 5, 10])
})

test("the real TI board keeps visible green junctions at the default snapshot size", async () => {
  const bytes = await Bun.file(
    new URL("../fixtures/ti-tps61288-scaled-schematic.SchDoc", import.meta.url),
  ).bytes()
  const doc = parseAltiumSchDoc(bytes)
  const svg = serializeAltiumSheetToSvg(doc)
  const dots = svg.match(/<circle data-record="29"[^>]+\/>/g) ?? []
  expect(doc.getRecordsByKind("29")).toHaveLength(62)
  expect(dots).toHaveLength(62)
  expect(dots.every((dot) => dot.includes('r="2" fill="#008800"'))).toBe(true)
  expect(doc.getBytes()).toEqual(bytes)

  // R2's top T-junction was almost indistinguishable from the wires even
  // though the SVG contained a circle. Measure its extra ink after rasterizing.
  const withDots = await sharp(Buffer.from(svg))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const withoutDots = await sharp(
    Buffer.from(svg.replace(/<circle data-record="29"[^>]+\/>/g, "")),
  )
    .ensureAlpha()
    .raw()
    .toBuffer()
  const viewport = svg
    .match(/viewBox="([^"]+)"/)![1]!
    .split(" ")
    .map(Number)
  const fit = Math.min(
    withDots.info.width / viewport[2]!,
    withDots.info.height / viewport[3]!,
  )
  const x = Math.floor(1592.01 * fit)
  const y = Math.floor(414.01 * fit)
  let extraGreenCoverage = 0
  for (let row = y - 3; row <= y + 3; row++) {
    for (let column = x - 3; column <= x + 3; column++) {
      const offset = (row * withDots.info.width + column) * 4
      extraGreenCoverage +=
        (withoutDots[offset]! - withDots.data[offset]!) / 255
    }
  }
  // Previous radius 1.5 + 1px wires contributed less than 0.1 extra pixel.
  expect(extraGreenCoverage).toBeGreaterThan(0.7)
})
