import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
  serializeAltiumPcbToSvg,
} from "../../lib"
import { getPcbDimensionGeometry } from "../../lib/svg-serialization/pcb-dimension-geometry"
import { renderPcbDimension } from "../../lib/svg-serialization/render-pcb-dimension"
import { createSvgViewport } from "../../lib/svg-serialization/svg-utils"
import { readReferenceBytes } from "./read-reference"

test("renders PMP22712 linear dimensions at saved text positions and angles", async () => {
  const document = parseAltiumBinaryPcbDoc(
    await readReferenceBytes("ti-pmp22712.PcbDoc"),
  )
  const dimensions = document.getRecordsByKind("Dimension")
  const original = dimensions.map((record) => record.getString())
  const geometry = dimensions.map(getPcbDimensionGeometry)
  expect(geometry.map((value) => value?.label)).toEqual([
    "1000.00mil",
    "26.00mm",
    "33.25mm",
  ])
  expect(geometry[1]?.textPosition).toEqual({ x: 627.9903, y: 1834.8742 })
  expect(geometry[1]?.textAngle).toBe(90)
  expect(geometry[2]?.dimensionStart).toEqual({ x: 692, y: 1433 })
  expect(geometry[2]?.dimensionEnd).toEqual({ x: 2001.0552, y: 1433 })
  expect(geometry[2]?.extensionLines).toEqual([
    { start: { x: 692, y: 1524 }, end: { x: 692, y: 1423 } },
    { start: { x: 2001.0552, y: 1474.7869 }, end: { x: 2001.0552, y: 1423 } },
  ])
  // Isolate the three native records; the large uploaded board is already a pinned fixture.
  const repro = parseAltiumPcbDoc(["|RECORD=Board", ...original].join("\n"))
  const svg = serializeAltiumPcbToSvg(repro, {
    title: "PMP22712 native dimensions",
    width: 700,
    height: 700,
  })
  expect(svg).not.toContain(">10mil</text>")
  expect(svg).toContain("rotate(-90) scale(1 1)")
  expect(svg).not.toContain("NaN")
  expect(dimensions.map((record) => record.getString())).toEqual(original)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})

test("honors outside arrows, extension width and mirrored dimension labels", () => {
  const document = parseAltiumPcbDoc(
    "|RECORD=Board\n|RECORD=Dimension|DIMENSIONKIND=1|LAYER=MECHANICAL2|ANGLE=0|REFERENCE0POINTX=100mil|REFERENCE0POINTY=100mil|REFERENCE1POINTX=900mil|REFERENCE1POINTY=200mil|X1=100mil|Y1=0mil|TEXTX=9999mil|TEXTY=9999mil|TEXT1X=500mil|TEXT1Y=0mil|TEXT1ANGLE=90|TEXT1MIRROR=TRUE|TEXTFORMAT=10mil|ARROWPOSITION=Outside|ARROWSIZE=40mil|ARROWLENGTH=100mil|EXTENSIONPICKGAP=10mil|EXTENSIONOFFSET=20mil|EXTENSIONLINEWIDTH=3mil",
  )
  const record = document.getRecordsByKind("Dimension")[0]!
  const svg = renderPcbDimension({
    record,
    color: "pink",
    metadata: 'data-record="Dimension"',
    viewport: createSvgViewport(
      { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
      { margin: 0 },
    ),
  })!
  expect(svg).toContain(
    'd="M 100 910 L 100 1020 M 900 810 L 900 1020" fill="none" stroke="pink" stroke-width="3"',
  )
  expect(svg).toContain('d="M 0 1000 L 100 1000 M 900 1000 L 1000 1000"')
  expect(svg).toContain('d="M 62.4123 1013.6808 L 100 1000 L 62.4123 986.3192"')
  expect(svg).toContain(
    'd="M 937.5877 1013.6808 L 900 1000 L 937.5877 986.3192"',
  )
  expect(svg).toContain("rotate(-90) scale(-1 1)")
  expect(svg).toContain(
    'text-anchor="start" dominant-baseline="text-after-edge"',
  )
})

test("does not extend a dimension line to text entirely outside the measured span", () => {
  const doc = parseAltiumPcbDoc(
    "|RECORD=Board\n|RECORD=Dimension|X1=0mil|Y1=0mil|X2=100mil|Y2=0mil|TEXTX=1000mil|TEXTY=0mil|TEXTHEIGHT=10mil|TEXTFORMAT=label",
  )
  const svg = renderPcbDimension({
    record: doc.getRecordsByKind("Dimension")[0]!,
    color: "pink",
    metadata: "",
    viewport: createSvgViewport(
      { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
      { margin: 0 },
    ),
  })!
  expect(svg).toContain('d="M 0 1000 L 100 1000"')
  expect(svg).not.toContain("L 975")
})
