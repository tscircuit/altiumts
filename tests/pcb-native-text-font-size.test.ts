import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
  parseAltiumPrjPcb,
  serializeAltiumPcbToSvg,
} from "../lib"
import { getPcbTextFontSize } from "../lib/svg-serialization/pcb-text-font-size"
import { readReference, readReferenceBytes } from "./svg/read-reference"

test("uses Arial em height for native titles and warnings across TI boards", async () => {
  for (const [name, index, height, expectedSize, label] of [
    ["ti-pmp22712", 3, 108.2677, 96.91094825, "PMP22712E2"],
    [
      "ti-pmp22712",
      2,
      60,
      53.70629371,
      "For evaluation only; not FCC approved for resale.",
    ],
    ["ti-pmp22773", 110, 108.2677, 96.91094825, "PMP22773E3"],
    ["ti-pmp23595", 97, 78.7402, 70.48073846, "CAUTION HOT SURFACE"],
  ] as const) {
    const bytes = await readReferenceBytes(`${name}.PcbDoc`)
    const board = parseAltiumBinaryPcbDoc(bytes)
    const projectSource = await readReference(`${name}.PrjPcb`)
    const project = parseAltiumPrjPcb(projectSource)
    const text = board.texts.find(
      (record) => record.getNumber("WIDESTRINGINDEX") === index,
    )
    if (!text) throw new Error(`Missing ${name} text ${index}`)
    const originalText = text.getString()
    expect(text.getAltiumMeasurement("HEIGHT")?.toMils()).toBe(height)
    expect(getPcbTextFontSize(text)).toBeCloseTo(expectedSize, 5)
    const svg = serializeAltiumPcbToSvg(
      parseAltiumPcbDoc(`|RECORD=Board\n${originalText}`),
      { project },
    )
    const renderedSize = Number(/font-size="([^"]+)"/u.exec(svg)?.[1])
    expect(renderedSize).toBeCloseTo(expectedSize, 2)
    expect(svg).toContain(`>${label}</text>`)
    expect(text.getString()).toBe(originalText)
    expect(board.getBytes()).toEqual(bytes)
    expect(project.getString()).toBe(projectSource)
  }
})

test("keeps stroke/unknown font sizing and honors explicit TrueType selection", () => {
  for (const [fields, expected] of [
    ["USETTFONTS=TRUE|FONTNAME=Arial", 53.70629371],
    ["FONTTYPE=1|FONTNAME=Arial|BOLD=TRUE", 53.70629371],
    ["FONTTYPE=1|FONTNAME=Arial|ITALIC=TRUE", 53.70629371],
    ["FONTTYPE=1|FONTNAME=Arial|BOLD=TRUE|ITALIC=TRUE", 53.70629371],
    ["FONTTYPE=1|FONTNAME=arial", 53.70629371],
    ["FONTTYPE=1", 53.70629371],
    ["USETTFONTS=TRUE|FONTTYPE=0|FONTNAME=Arial", 53.70629371],
    ["USETTFONTS=FALSE|FONTTYPE=1|FONTNAME=Arial", 60],
    ["FONTTYPE=0|FONTNAME=Arial", 60],
    ["FONTTYPE=1|FONTNAME=Courier New", 60],
    ["FONTTYPE=1|FONTNAME=Arial Narrow", 60],
    ["FONTNAME=Arial", 60],
  ] as const) {
    const board = parseAltiumPcbDoc(
      `|RECORD=Board\n|RECORD=Text|TEXT=Label|HEIGHT=60|ROTATION=270|MIRROR=TRUE|${fields}`,
    )
    const text = board.getRecordsByKind("Text")[0]
    if (!text) throw new Error("Missing PCB text")
    expect(getPcbTextFontSize(text)).toBeCloseTo(expected, 5)
    const svg = serializeAltiumPcbToSvg(board)
    expect(svg).toContain("rotate(-270) scale(-1 1)")
    expect(svg).toContain(
      `font-weight="${fields.includes("BOLD=TRUE") ? "bold" : "normal"}"`,
    )
    expect(svg).toContain(
      `font-style="${fields.includes("ITALIC=TRUE") ? "italic" : "normal"}"`,
    )
    expect(text.getNumber("HEIGHT")).toBe(60)
  }
})

test("scales multiline Arial spacing without changing saved coordinates or alignment", () => {
  const source =
    "|RECORD=Board\n|RECORD=Text|LAYER=TOPOVERLAY|X=100mil|Y=200mil|HEIGHT=1.524mm|JUSTIFICATION=5|ROTATION=90|MIRROR=TRUE|FONTTYPE=1|FONTNAME=Arial|WIDESTRING=65,10,66"
  const board = parseAltiumPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(board, {
    viewBox: { x: 0, y: 0, width: 400, height: 400 },
  })
  expect(svg).toContain('font-size="53.7063"')
  expect(svg).toContain('<tspan x="0" dy="0">A</tspan>')
  expect(svg).toContain('<tspan x="0" dy="64.4476">B</tspan>')
  expect(svg).toContain('text-anchor="middle" dominant-baseline="central"')
  expect(svg).toContain(
    'transform="translate(100 200) rotate(-90) scale(-1 1)"',
  )
  expect(board.getString()).toBe(source)
})
