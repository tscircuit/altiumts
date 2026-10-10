import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../lib"
import { getPcbLayerColor } from "../lib/svg-serialization/pcb-layer"

test("crosshatches keepout fills while preserving copper fills and layer filtering", () => {
  const source = [
    "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=250mil|VY1=0mil|VX2=250mil|VY2=200mil|VX3=0mil|VY3=200mil",
    "|RECORD=Fill|LAYER=TOP|KEEPOUT=FALSE|X1=0mil|Y1=0mil|X2=100mil|Y2=50mil",
    "|RECORD=Fill|LAYER=TOP|KEEPOUT=TRUE|X1=100mil|Y1=0mil|X2=200mil|Y2=50mil|ROTATION=30",
    "|RECORD=Fill|LAYER=BOTTOM|KEEPOUT=TRUE|X1=0mil|Y1=100mil|X2=100mil|Y2=150mil",
  ].join("\n")
  const document = parseAltiumPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document)
  expect(svg.match(/<pattern /g)).toHaveLength(1)
  const patternId = svg.match(/<pattern id="([^"]+)"/)?.[1]
  expect(patternId).toBeDefined()
  const keepoutFills = [...svg.matchAll(/<rect[^>]*data-keepout="true"[^>]*>/g)]
  expect(keepoutFills).toHaveLength(2)
  for (const [keepoutFill] of keepoutFills) {
    expect(keepoutFill).toContain(`fill="url(#${patternId})"`)
    expect(keepoutFill).toContain(`stroke="${getPcbLayerColor("KEEPOUT")}"`)
    expect(keepoutFill).not.toContain("fill-opacity")
  }
  expect(svg).toContain(`fill="${getPcbLayerColor("TOP")}" fill-opacity="0.6"`)
  expect(svg).toContain("rotate(-30 ")
  const bottom = serializeAltiumPcbToSvg(document, { layers: ["BOTTOM"] })
  expect(bottom).not.toContain('data-layer="TOP"')
  expect(bottom.match(/<rect[^>]*data-keepout="true"/g)).toHaveLength(1)
  expect(bottom.match(/<pattern /g)).toHaveLength(1)
  const overlay = serializeAltiumPcbToSvg(document, {
    layers: ["TOPOVERLAY"],
  })
  expect(overlay).not.toContain("<pattern ")
  expect(overlay).not.toContain('fill="url(')
  expect(document.getString()).toBe(source)
})
