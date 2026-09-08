import { expect, test } from "bun:test"
import {
  parseAltiumSchDoc,
  serializeAltiumSchDocToBinary,
  serializeAltiumSheetToSvg,
} from "../../lib"

// Exercise the source renderer through a native SchDoc. These cases must
// not go through Circuit JSON: that would give the exporter a chance to hide
// the malformed fields whose effects we need to see in visual regressions.
function document(records: string[], sheetFields = "") {
  return parseAltiumSchDoc(
    serializeAltiumSchDocToBinary(
      [
        "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
        `|RECORD=31|USECUSTOMSHEET=T|CUSTOMX=400|CUSTOMY=300${sheetFields}`,
        ...records,
      ].join("\n"),
    ),
  )
}

function render(records: string[], sheetFields = "") {
  return serializeAltiumSheetToSvg(document(records, sheetFields), {
    margin: 0,
  })
}

function textElement(svg: string, text: string) {
  const element = svg
    .match(/<text\b[^>]*>.*?<\/text>/gu)
    ?.find((candidate) => candidate.endsWith(`>${text}</text>`))
  expect(element).toBeDefined()
  return element ?? ""
}

const fonts =
  "|FONTIDCOUNT=3|SIZE1=4|FONTNAME1=Arial|SIZE2=6|FONTNAME2=Courier New|SIZE3=3.6000|FONTNAME3=Arial"
const pin =
  "|RECORD=2|LOCATION.X=100|LOCATION.Y=100|PINLENGTH=10|PINCONGLOMERATE=56|NAME=SIGNAL|DESIGNATOR=1"

test("renders signed fixed-point coordinates and does not repair decimal base fields", () => {
  const svg = render([
    "|RECORD=7|LOCATIONCOUNT=3|X1=258|X1_FRAC=8000|Y1=10|X2=258.08|Y2=20|X3=-2|X3_FRAC=-8000|Y3=30",
    "|RECORD=4|LOCATION.X=258.8|LOCATION.Y=50|TEXT=bad coordinate",
  ])
  expect(svg).toContain('points="258.08,290 0,280 -2.08,270"')
  expect(textElement(svg, "bad coordinate")).toContain("translate(0 250)")
})

test("reads omitted zero coordinates and small signed fractions", () => {
  const svg = render([
    "|RECORD=6|LOCATIONCOUNT=3|Y1=10|X2=20|X3_FRAC=5|Y3_FRAC=-8000",
  ])
  expect(svg).toContain('points="0,290 20,300 0.0001,300.08"')
})

test("invalid font SIZE falls back without changing valid integer fonts", () => {
  const svg = render(
    ["|RECORD=4|FONTID=1|TEXT=valid", "|RECORD=4|FONTID=3|TEXT=invalid"],
    fonts,
  )
  expect(textElement(svg, "valid")).toContain('font-size="4"')
  expect(textElement(svg, "invalid")).toContain('font-size="10"')
  expect(textElement(svg, "invalid")).toContain('font-family="Arial"')
})

test("pin FONTID does not override the missing system font", () => {
  const svg = render([`${pin}|FONTID=1`], fonts)
  for (const text of ["SIGNAL", "1"]) {
    expect(textElement(svg, text)).toContain('font-family="Times New Roman"')
    expect(textElement(svg, text)).toContain('font-size="10"')
  }
})

test("pins use SYSTEMFONT and independent enabled custom name/designator fonts", () => {
  const svg = render(
    [
      `${pin}|FONTID=3|PINNAME_POSITIONCONGLOMERATE=16|NAME_CUSTOMFONTID=2|DESIGNATOR_CUSTOMFONTID=3`,
    ],
    `${fonts}|SYSTEMFONT=1`,
  )
  expect(textElement(svg, "SIGNAL")).toContain('font-family="Courier New"')
  expect(textElement(svg, "SIGNAL")).toContain('font-size="6"')
  // A custom ID without its enable bit must not override the system font.
  expect(textElement(svg, "1")).toContain('font-size="4"')
  const designatorOverride = render(
    [`${pin}|PINDESIGNATOR_POSITIONCONGLOMERATE=16|DESIGNATOR_CUSTOMFONTID=2`],
    `${fonts}|SYSTEMFONT=1`,
  )
  expect(textElement(designatorOverride, "1")).toContain('font-size="6"')
  expect(textElement(designatorOverride, "SIGNAL")).toContain('font-size="4"')
})

test("zero font ID inherits SYSTEMFONT and unsupported font fractions are ignored", () => {
  const svg = render(
    ["|RECORD=4|FONTID=0|TEXT=system"],
    "|SYSTEMFONT=1|FONTIDCOUNT=1|SIZE1=4|SIZE1_FRAC=50000|FONTNAME1=Arial",
  )
  expect(textElement(svg, "system")).toContain('font-size="4"')
})

test("net labels remain visible alongside graphics while hidden parameters stay hidden", () => {
  const svg = render([
    "|RECORD=25|TEXT=VDD|ISHIDDEN=T",
    "|RECORD=4|TEXT=VDD",
    "|RECORD=41|NAME=Comment|TEXT=hidden comment|ISHIDDEN=T",
  ])
  expect(svg.match(/>VDD<\/text>/gu)).toHaveLength(2)
  expect(svg).not.toContain("hidden comment")
})

test("missing electrical type renders input indicator; passive and power do not", () => {
  expect(render([pin])).toContain('data-electrical="0"')
  for (const electrical of [1, 2]) {
    expect(render([`${pin}|ELECTRICAL=${electrical}`])).toContain(
      `data-electrical="${electrical}"`,
    )
  }
  for (const electrical of [4, 7]) {
    expect(render([`${pin}|ELECTRICAL=${electrical}`])).not.toContain(
      "altium-schematic-pin-electrical-symbol",
    )
  }
})

test("rendering preserves original malformed fields and native serialization", () => {
  const doc = document(
    [pin, "|RECORD=25|LOCATION.X=258.8|TEXT=VDD|ISHIDDEN=T"],
    fonts,
  )
  const before = doc.getString()
  serializeAltiumSheetToSvg(doc)
  expect(doc.getString()).toBe(before)
  expect(doc.netLabels[0]?.getCaseInsensitive("LOCATION.X")).toBe("258.8")
  expect(doc.netLabels[0]?.getBoolean("ISHIDDEN")).toBe(true)
})

test("native pin text margins and custom colors are independent of the pin line", () => {
  const defaults = render([`${pin}|COLOR=132`], fonts)
  expect(textElement(defaults, "SIGNAL")).toContain("translate(93 200)")
  expect(textElement(defaults, "1")).toContain("translate(109 200)")
  const custom = render(
    [
      `${pin}|COLOR=132|PINNAME_POSITIONCONGLOMERATE=17|NAME_CUSTOMPOSITION_MARGIN=-2|NAME_CUSTOMFONTID=1|NAME_CUSTOMCOLOR=255|PINDESIGNATOR_POSITIONCONGLOMERATE=17|DESIGNATOR_CUSTOMPOSITION_MARGIN=2|DESIGNATOR_CUSTOMFONTID=1|DESIGNATOR_CUSTOMCOLOR=16711680`,
    ],
    fonts,
  )
  expect(textElement(custom, "SIGNAL")).toContain("translate(98 200)")
  expect(textElement(custom, "SIGNAL")).toContain('fill="#ff0000"')
  expect(textElement(custom, "1")).toContain("translate(102 200)")
  expect(textElement(custom, "1")).toContain('fill="#0000ff"')
  const omittedColor = render(
    [`${pin}|COLOR=132|PINNAME_POSITIONCONGLOMERATE=16|NAME_CUSTOMFONTID=1`],
    fonts,
  )
  expect(textElement(omittedColor, "SIGNAL")).toContain('fill="#000000"')
})

test("native line-width enum applies equally to wires and rectangles", () => {
  for (const [width, expected] of [1, 1, 3, 5].entries()) {
    const svg = render([
      `|RECORD=27|LINEWIDTH=${width}|LOCATIONCOUNT=2|X1=10|Y1=10|X2=20|Y2=10`,
      `|RECORD=14|LINEWIDTH=${width}|LOCATION.X=10|LOCATION.Y=20|CORNER.X=20|CORNER.Y=30`,
    ])
    if (width === 0) expect(svg).toContain('vector-effect="non-scaling-stroke"')
    for (const kind of ["27", "14"]) {
      expect(
        svg.match(new RegExp(`<[^>]+data-record="${kind}"[^>]*>`))?.[0],
      ).toContain(`stroke-width="${expected}"`)
    }
  }
})
