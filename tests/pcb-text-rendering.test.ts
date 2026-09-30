import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../lib"

function renderText(properties: string, options = {}) {
  return serializeAltiumPcbToSvg(
    parseAltiumPcbDoc(
      `|RECORD=Board\n|RECORD=Text|LAYER=TOPOVERLAY|X=100mil|Y=100mil|HEIGHT=100mil|TEXT=Annotation|${properties}`,
    ),
    options,
  )
}

test("converts Arial TrueType cell height to SVG em size", () => {
  for (const properties of [
    "FONTTYPE=1|FONTNAME=Arial",
    "USETTFONTS=TRUE|FONTNAME=arial|BOLD=TRUE|ITALIC=TRUE",
  ]) {
    const svg = renderText(properties)
    expect(svg).toContain('font-size="89.5105"')
    expect(renderText(properties, { width: 400, height: 300 })).toContain(
      'font-size="89.5105"',
    )
  }
})

test("keeps stroke fonts and uncalibrated TrueType families at their source size", () => {
  for (const properties of [
    "FONTTYPE=0|FONTNAME=Arial",
    "FONTNAME=Arial",
    "USETTFONTS=FALSE|FONTTYPE=1|FONTNAME=Arial",
    "FONTTYPE=1|FONTNAME=Arial Black",
    "FONTTYPE=1|FONTNAME=Courier New",
  ]) {
    expect(renderText(properties)).toContain('font-size="100"')
  }
})

test("scales multiline spacing with the rendered TrueType size", () => {
  const svg = renderText(
    "FONTTYPE=1|FONTNAME=Arial|WIDESTRING=65,10,66|ROTATION=90|MIRROR=TRUE",
  )
  expect(svg).toContain('<tspan x="0" dy="107.4126">B</tspan>')
  expect(svg).toContain("rotate(-90) scale(-1 1)")
})
