import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../lib"

test("applies pad-stack offsets to SMD copper without shifting through-hole copper", () => {
  const document = parseAltiumPcbDoc(
    [
      "|RECORD=Board",
      "|RECORD=Pad|NAME=SMD|LAYER=TOP|X=100mil|Y=100mil|XSIZE=40mil|YSIZE=20mil|HOLESIZE=0mil|LAYER0HOLEXOFFSET=30mil|LAYER0HOLEYOFFSET=10mil|SHAPE=RECTANGLE",
      "|RECORD=Pad|NAME=PTH|LAYER=MULTILAYER|X=200mil|Y=100mil|XSIZE=40mil|YSIZE=20mil|HOLESIZE=10mil|LAYER0HOLEXOFFSET=30mil|LAYER0HOLEYOFFSET=10mil|SHAPE=RECTANGLE",
    ].join("\n"),
  )

  const svg = serializeAltiumPcbToSvg(document, {
    margin: 0,
    viewBox: { x: 0, y: 0, width: 300, height: 200 },
  })

  expect(svg).toContain(
    'data-pad-name="SMD" data-pad-shape="RECTANGLE" data-pad-stack-layer="0" data-plated="true"><rect x="110" y="80" width="40" height="20"',
  )
  expect(svg).toContain(
    'data-pad-name="PTH" data-pad-shape="RECTANGLE" data-pad-stack-layer="0" data-plated="true"><rect x="180" y="90" width="40" height="20"',
  )
  expect(svg).toContain(
    '<circle data-hole-shape="ROUND" cx="230" cy="90" r="5"',
  )
})
