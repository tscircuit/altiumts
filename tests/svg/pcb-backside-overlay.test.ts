import { expect, test } from "bun:test"
import sharp from "sharp"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"

// Both overlays remain visible in side views, including areas without copper.
const document = parseAltiumPcbDoc(
  [
    "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=100mil|VY1=0mil|VX2=100mil|VY2=100mil|VX3=0mil|VY3=100mil",
    "|RECORD=Fill|LAYER=TOPOVERLAY|X1=20mil|Y1=40mil|X2=40mil|Y2=60mil",
    "|RECORD=Region|LAYER=BOTTOMOVERLAY|VX0=60mil|VY0=40mil|VX1=80mil|VY1=40mil|VX2=80mil|VY2=60mil|VX3=60mil|VY3=60mil",
  ].join("\n"),
)

async function pixel(svg: string, x: number) {
  const { data, info } = await sharp(Buffer.from(svg))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return [
    ...data.subarray(
      (50 * info.width + x) * info.channels,
      (50 * info.width + x) * info.channels + 3,
    ),
  ]
}

for (const viewSide of ["top", "bottom"] as const) {
  test(`retains the opposite silkscreen in the ${viewSide} view`, async () => {
    const svg = serializeAltiumPcbToSvg(document, {
      viewSide,
      width: 100,
      height: 100,
      margin: 0,
    })
    const backLayer = viewSide === "top" ? "BOTTOMOVERLAY" : "TOPOVERLAY"
    expect(svg.indexOf(`data-layer="${backLayer}"`)).toBeGreaterThan(
      svg.indexOf('data-record="BoardOutline"'),
    )
    const backX = viewSide === "top" ? 70 : 30
    const frontX = viewSide === "top" ? 30 : 70
    expect(await pixel(svg, backX)).not.toEqual([18, 61, 50])
    expect(await pixel(svg, frontX)).not.toEqual([18, 61, 50])
  })
}

test("retains both overlays in the all-layer overview", async () => {
  const svg = serializeAltiumPcbToSvg(document, {
    width: 100,
    height: 100,
    margin: 0,
  })
  expect(await pixel(svg, 30)).not.toEqual([18, 61, 50])
  expect(await pixel(svg, 70)).not.toEqual([18, 61, 50])
})

test("paints bottom silkscreen behind top copper without selecting a view side", async () => {
  const withCopper = parseAltiumPcbDoc(
    `${document.getString()}\n|RECORD=Track|LAYER=TOP|X1=70mil|Y1=40mil|X2=70mil|Y2=60mil|WIDTH=6mil`,
  )
  const svg = serializeAltiumPcbToSvg(withCopper, {
    width: 100,
    height: 100,
    margin: 0,
  })
  expect(await pixel(svg, 70)).toEqual([239, 68, 68])
  expect(await pixel(svg, 63)).not.toEqual([18, 61, 50])
  expect(svg.indexOf('data-layer="BOTTOMOVERLAY"')).toBeLessThan(
    svg.indexOf('data-layer="TOP"'),
  )
})
