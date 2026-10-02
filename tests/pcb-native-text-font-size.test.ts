import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
  serializeAltiumPcbToSvg,
} from "../lib"
import { getPcbTextFontSize } from "../lib/svg-serialization/pcb-text-font-size"
import { readReferenceBytes } from "./svg/read-reference"

test("uses Arial em height for the real PMP22712 title and warning", async () => {
  const bytes = await readReferenceBytes("ti-pmp22712.PcbDoc")
  const board = parseAltiumBinaryPcbDoc(bytes)
  for (const [index, height, expectedSize] of [
    [3, 108.2677, 96.91094825],
    [2, 60, 53.70629371],
  ]) {
    const text = board.texts.find(
      (record) => record.getNumber("WIDESTRINGINDEX") === index,
    )!
    expect(text.getAltiumMeasurement("HEIGHT")?.toMils()).toBe(height)
    expect(getPcbTextFontSize(text)).toBeCloseTo(expectedSize!, 5)
    const svg = serializeAltiumPcbToSvg(
      parseAltiumPcbDoc(`|RECORD=Board\n${text.getString()}`),
    )
    const renderedSize = Number(/font-size="([^"]+)"/u.exec(svg)?.[1])
    expect(renderedSize).toBeCloseTo(expectedSize!, 2)
  }
  expect(board.getBytes()).toEqual(bytes)
})

test("keeps stroke/unknown font sizing and honors explicit TrueType selection", () => {
  for (const [fields, expected] of [
    ["USETTFONTS=TRUE|FONTNAME=Arial", 53.70629371],
    ["FONTTYPE=1|FONTNAME=Arial|BOLD=TRUE|ITALIC=TRUE", 53.70629371],
    ["USETTFONTS=FALSE|FONTTYPE=1|FONTNAME=Arial", 60],
    ["FONTTYPE=0|FONTNAME=Arial", 60],
    ["FONTTYPE=1|FONTNAME=Courier New", 60],
  ] as const) {
    const board = parseAltiumPcbDoc(
      `|RECORD=Board\n|RECORD=Text|TEXT=Label|HEIGHT=60|ROTATION=270|MIRROR=TRUE|${fields}`,
    )
    const text = board.getRecordsByKind("Text")[0]!
    expect(getPcbTextFontSize(text)).toBeCloseTo(expected, 5)
    const svg = serializeAltiumPcbToSvg(board)
    expect(svg).toContain("rotate(-270) scale(-1 1)")
    expect(text.getNumber("HEIGHT")).toBe(60)
  }
})
