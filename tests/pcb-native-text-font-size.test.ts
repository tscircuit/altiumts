import { expect, test } from "bun:test"
import sharp from "sharp"
import {
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
  parseAltiumPrjPcb,
  serializeAltiumPcbToSvg,
} from "../lib"
import { getPcbTextFontSize } from "../lib/svg-serialization/pcb-text-font-size"
import { readReference, readReferenceBytes } from "./svg/read-reference"
import { renderAltiumReferenceComparison } from "./svg/render-altium-reference-comparison"
import { renderTiPowerReferencePcb } from "./svg/render-ti-power-reference-pcb"

test("matches the original Altium title and warning ink bounds on PMP22712", async () => {
  const converterSvg = await renderTiPowerReferencePcb({
    filename: "ti-pmp22712.PcbDoc",
    projectFilename: "ti-pmp22712.PrjPcb",
    title: "PMP22712 text metrics",
  })
  const comparison = await renderAltiumReferenceComparison({
    reference: "ti-pmp22712-pcb",
    converterSvg,
  })
  // Existing 800×600 comparison panels, aligned by board geometry. These
  // regions contain the title and warning in the unchanged uploaded image.
  for (const crop of [
    { left: 80, top: 45, width: 345, height: 65 },
    { left: 70, top: 110, width: 670, height: 48 },
  ]) {
    const reference = await textInkBounds(comparison, crop, true)
    const rendered = await textInkBounds(comparison, crop, false)
    for (let edge = 0; edge < 4; edge++) {
      // Allow screenshot antialiasing and subpixel board registration; the
      // old cell-edge baselines displace these strings by 9–12 pixels.
      expect(Math.abs(rendered[edge]! - reference[edge]!)).toBeLessThanOrEqual(
        5,
      )
    }
  }
})

async function textInkBounds(
  comparison: string,
  crop: { left: number; top: number; width: number; height: number },
  reference: boolean,
): Promise<number[]> {
  const { data, info } = await sharp(Buffer.from(comparison))
    .extract({
      ...crop,
      left: crop.left + (reference ? 16 : 840),
      top: crop.top + 70,
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const bounds = [info.width, info.height, -1, -1]
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const offset = (y * info.width + x) * info.channels
      // Altium top-overlay ink is bright yellow, AltiumTS text is white.
      // Exclude the dim frame/bottom-layer labels without altering the image.
      if (data[offset]! <= 200 || data[offset + 1]! <= 200) continue
      if (reference ? data[offset + 2]! >= 100 : data[offset + 2]! <= 200)
        continue
      bounds[0] = Math.min(bounds[0]!, x)
      bounds[1] = Math.min(bounds[1]!, y)
      bounds[2] = Math.max(bounds[2]!, x)
      bounds[3] = Math.max(bounds[3]!, y)
    }
  }
  expect(bounds[2]).toBeGreaterThanOrEqual(0)
  return bounds
}

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
    // Native Arial strings use their alphabetic origin for active and inactive justification.
    expect(svg).toContain('x="0" y="0"')
    expect(svg).toContain('dominant-baseline="alphabetic"')
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

test("keeps native Arial glyph origins fixed through justification, rotation and mirroring", () => {
  for (const valid of ["TRUE", "FALSE"]) {
    for (let justification = 1; justification <= 9; justification++) {
      for (const rotation of [0, 90, 180, 270]) {
        for (const mirror of ["TRUE", "FALSE"]) {
          const source = `|RECORD=Board\n|RECORD=Text|TEXT=Ag|X=100mil|Y=200mil|HEIGHT=60mil|FONTTYPE=1|FONTNAME=Arial|ISFRAME=FALSE|JUSTIFICATIONVALID=${valid}|JUSTIFICATION=${justification}|ROTATION=${rotation}|MIRROR=${mirror}`
          const svg = serializeAltiumPcbToSvg(parseAltiumPcbDoc(source), {
            viewBox: { x: 0, y: 0, width: 400, height: 400 },
          })
          expect(svg).toContain('x="0" y="0"')
          expect(svg).toContain(
            'text-anchor="start" dominant-baseline="alphabetic"',
          )
          expect(svg).toContain(
            `transform="translate(100 200) rotate(${-rotation}) scale(${mirror === "TRUE" ? -1 : 1} 1)"`,
          )
        }
      }
    }
  }

  // A family name alone must not reinterpret ASCII anchors, frame anchors,
  // older layouts without the validity flag, stroke fonts or unknown metrics.
  for (const fields of [
    "FONTTYPE=1|FONTNAME=Arial",
    "FONTTYPE=1|FONTNAME=Arial|ISFRAME=TRUE|JUSTIFICATIONVALID=TRUE",
    "FONTTYPE=1|FONTNAME=Arial|ISFRAME=FALSE",
    "FONTTYPE=1|FONTNAME=Arial|USETTFONTS=FALSE|ISFRAME=FALSE|JUSTIFICATIONVALID=TRUE",
    "FONTTYPE=0|FONTNAME=Arial|ISFRAME=FALSE|JUSTIFICATIONVALID=TRUE",
    "FONTTYPE=1|FONTNAME=Arial Narrow|ISFRAME=FALSE|JUSTIFICATIONVALID=TRUE",
  ]) {
    const svg = serializeAltiumPcbToSvg(
      parseAltiumPcbDoc(
        `|RECORD=Board\n|RECORD=Text|TEXT=Ag|HEIGHT=60mil|JUSTIFICATION=5|${fields}`,
      ),
    )
    expect(svg).toContain('dominant-baseline="central"')
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
