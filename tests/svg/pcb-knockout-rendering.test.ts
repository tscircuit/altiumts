import { expect, test } from "bun:test"
import sharp from "sharp"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { getPcbRecordBounds } from "../../lib/svg-serialization/pcb-geometry"
import type { AltiumPcbSvgOptions } from "../../lib/svg-serialization/svg-types"

const board =
  "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=600mil|VY1=0mil|VX2=600mil|VY2=400mil|VX3=0mil|VY3=400mil"
function render(
  text: string,
  fields = "|TEXTBOXWIDTH=200mil|TEXTBOXHEIGHT=120mil",
  options: AltiumPcbSvgOptions = {},
) {
  return serializeAltiumPcbToSvg(
    parseAltiumPcbDoc(
      `${board}\n|RECORD=Text|LAYER=TOPOVERLAY|X=100mil|Y=250mil|HEIGHT=40mil|WIDESTRING=${[...text].map((c) => c.charCodeAt(0)).join(",")}|JUSTIFICATION=3|INVERTED=TRUE|INVERTEDRECT=TRUE${fields}`,
    ),
    { width: 600, height: 400, margin: 0, ...options },
  )
}
async function pixels(svg: string) {
  return sharp(Buffer.from(svg))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
}

test("keeps the visible background of a cropped explicit knockout rectangle", async () => {
  const svg = render("DATA", "|TEXTBOXWIDTH=400mil|TEXTBOXHEIGHT=80mil", {
    width: 100,
    height: 40,
    viewBox: { x: 300, y: 260, width: 100, height: 40 },
  })
  expect(svg).toContain('data-knockout="true"')
  const { data, info } = await pixels(svg)
  const offset = (20 * info.width + 50) * info.channels
  expect([...data.subarray(offset, offset + 3)]).toEqual([248, 250, 252])
})

test("renders both lines inside a bottom-aligned knockout rectangle", async () => {
  const svg = render("DATA\nPWR")
  const single = await pixels(render("DATA"))
  const multi = await pixels(svg)
  expect(multi.data.equals(single.data)).toBe(false)
  for (const [top, bottom] of [
    [65, 100],
    [115, 145],
  ] as const) {
    let darkPixels = 0
    for (let y = top; y < bottom; y++) {
      for (let x = 105; x < 200; x++) {
        if (
          (multi.data[(y * multi.info.width + x) * multi.info.channels] ??
            255) < 100
        )
          darkPixels++
      }
    }
    expect(darkPixels).toBeGreaterThan(0)
  }
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})

test("keeps masks independent when two boards are embedded inline", async () => {
  const first = render("AAAA")
  expect(render("AAAA")).toBe(first)
  const second = render("BBBB")
  const ids = [first, second].map((svg) => svg.match(/<mask id="([^"]+)"/)?.[1])
  expect(ids[0]).toBeDefined()
  expect(ids[1]).toBeDefined()
  expect(ids[0]).not.toBe(ids[1])
  const inline = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400"><title>Independent PCB masks</title>${first}${second.replace("<svg ", '<svg x="600" ')}</svg>`
  const combined = await sharp(Buffer.from(inline))
    .extract({ left: 600, top: 0, width: 600, height: 400 })
    .removeAlpha()
    .raw()
    .toBuffer()
  expect(combined.equals((await pixels(second)).data)).toBe(true)
})

test("uses rotated and mirrored knockout rectangles for crop bounds", async () => {
  for (const [rotation, mirror, expected, crop] of [
    [
      0,
      false,
      { minX: 100, minY: 250, maxX: 500, maxY: 330 },
      { x: 300, y: 260 },
    ],
    [
      90,
      false,
      { minX: 20, minY: 250, maxX: 100, maxY: 650 },
      { x: 50, y: 500 },
    ],
    [90, true, { minX: 20, minY: -150, maxX: 100, maxY: 250 }, { x: 50, y: 0 }],
  ] as const) {
    const fields = `|TEXTBOXWIDTH=400mil|TEXTBOXHEIGHT=80mil|ROTATION=${rotation}|MIRROR=${mirror}`
    const document = parseAltiumPcbDoc(
      `${board}\n|RECORD=Text|X=100mil|Y=250mil|HEIGHT=40mil|TEXT=DATA|JUSTIFICATION=3|INVERTED=TRUE|INVERTEDRECT=TRUE${fields}`,
    )
    const record = document.records[1]
    if (!record) throw new Error("Missing test text record")
    const bounds = getPcbRecordBounds(record)
    if (!bounds) throw new Error("Missing knockout bounds")
    for (const key of ["minX", "minY", "maxX", "maxY"] as const)
      expect(bounds[key]).toBeCloseTo(expected[key], 6)
    const svg = render("DATA", fields, {
      width: 20,
      height: 20,
      viewBox: { ...crop, width: 20, height: 20 },
    })
    const { data, info } = await pixels(svg)
    const offset = (10 * info.width + 10) * info.channels
    expect([...data.subarray(offset, offset + 3)]).toEqual([248, 250, 252])
  }
})
