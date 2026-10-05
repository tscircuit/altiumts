import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"

test("renders knockout backgrounds with transparent letters", () => {
  const document = parseAltiumPcbDoc(
    [
      "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=700mil|VY1=0mil|VX2=700mil|VY2=500mil|VX3=0mil|VY3=500mil",
      "|RECORD=Text|LAYER=TOPOVERLAY|X=100mil|Y=350mil|HEIGHT=70.8661mil|WIDESTRING=68,65,84,65|INVERTED=TRUE|MARGINBORDERWIDTH=7.086614mil|JUSTIFICATION=5",
      "|RECORD=Text|LAYER=TOPOVERLAY|X=350mil|Y=350mil|HEIGHT=70.8661mil|WIDESTRING=80,87,82|INVERTED=TRUE|MARGINBORDERWIDTH=7.086614mil|JUSTIFICATION=5",
      "|RECORD=Text|LAYER=BOTTOMOVERLAY|X=550mil|Y=150mil|HEIGHT=40mil|TEXT=PWR|INVERTED=TRUE|MARGINBORDERWIDTH=0mil|ROTATION=90|MIRROR=TRUE",
      "|RECORD=Text|LAYER=TOPOVERLAY|X=100mil|Y=100mil|HEIGHT=40mil|TEXT=Normal",
    ].join("\n"),
  )
  const svg = serializeAltiumPcbToSvg(document)
  expect(svg.match(/data-knockout="true"/g)).toHaveLength(3)
  const ids = [...svg.matchAll(/<mask id="([^"]+)"/g)].map((match) => match[1])
  expect(new Set(ids).size).toBe(3)
  for (const id of ids) expect(svg).toContain(`mask="url(#${id})"`)
  expect(svg).toContain("rotate(-90) scale(-1 1)")
  expect(svg).toContain('fill="black"')
  expect(svg).toContain(">Normal</text>")
})

test("uses explicit knockout rectangle dimensions", () => {
  const svg = serializeAltiumPcbToSvg(
    parseAltiumPcbDoc(
      "|RECORD=Board\n|RECORD=Text|LAYER=TOPOVERLAY|X=0mil|Y=0mil|HEIGHT=40mil|TEXT=DATA|INVERTED=TRUE|INVERTEDRECT=TRUE|TEXTBOXWIDTH=200mil|TEXTBOXHEIGHT=80mil|MARGINBORDERWIDTH=10mil",
    ),
  )
  expect(svg).toContain('width="200" height="80"')
  expect(svg).toContain('x="0" y="-80"')
})

test("uses the same text layout for ordinary and knockout text", () => {
  const source =
    "|RECORD=Board\n|RECORD=Text|LAYER=TOPOVERLAY|X=100mil|Y=100mil|HEIGHT=40mil|WIDESTRING=68,65,84,65,10,80,87,82|JUSTIFICATION=5|BOLD=TRUE|ITALIC=TRUE"
  const ordinary = serializeAltiumPcbToSvg(parseAltiumPcbDoc(source))
  const knockout = serializeAltiumPcbToSvg(
    parseAltiumPcbDoc(`${source}|INVERTED=TRUE|MARGINBORDERWIDTH=10mil`),
  )
  const text = (svg: string) => {
    const match = svg.match(/<text[^>]*>([\s\S]*?)<\/text>/)
    if (!match) throw new Error("Expected rendered PCB text")
    return match[0]
      .replace(
        / data-record="[^"]*"| data-layer="[^"]*"| transform="[^"]*"/g,
        "",
      )
      .replace(/fill="[^"]*"/, 'fill="shared"')
      .replace(/\s+/g, " ")
  }
  expect(text(knockout)).toBe(text(ordinary))
  expect(knockout).toContain('<tspan x="0" dy="48">PWR</tspan>')
  expect(knockout).not.toContain("textLength=")
  expect(knockout).not.toContain("lengthAdjust=")
})

test("aligns explicit knockout rectangles at all nine anchors", () => {
  const origins = [
    [0, 0],
    [0, -40],
    [0, -80],
    [-100, 0],
    [-100, -40],
    [-100, -80],
    [-200, 0],
    [-200, -40],
    [-200, -80],
  ]
  for (const margin of [0, 10]) {
    for (const [index, [x, y]] of origins.entries()) {
      const svg = serializeAltiumPcbToSvg(
        parseAltiumPcbDoc(
          `|RECORD=Board\n|RECORD=Text|LAYER=TOPOVERLAY|X=0mil|Y=0mil|HEIGHT=40mil|TEXT=DATA|JUSTIFICATION=${index + 1}|INVERTED=TRUE|INVERTEDRECT=TRUE|TEXTBOXWIDTH=200mil|TEXTBOXHEIGHT=80mil|MARGINBORDERWIDTH=${margin}mil|ROTATION=90|MIRROR=TRUE`,
        ),
      )
      const bounds = `x="${x}" y="${y}" width="200" height="80"`
      expect(svg).toContain(`<rect ${bounds} fill="white"/>`)
      expect(svg).toContain(
        `<mask id="pcb-knockout-1" maskUnits="userSpaceOnUse" ${bounds}`,
      )
      expect(svg).toContain(
        `<rect ${bounds} fill="#f8fafc" mask="url(#pcb-knockout-1)"/>`,
      )
      expect(svg).toContain("rotate(-90) scale(-1 1)")
    }
  }
})

test("fits Arial knockout backgrounds to character widths without changing font size", () => {
  for (const [text, textWidth, bold] of [
    ["DATA", 106.8, false],
    ["DATA", 110.8, true],
    ["III", 33.6, false],
    ["WWW", 112.8, false],
  ] as const) {
    const svg = serializeAltiumPcbToSvg(
      parseAltiumPcbDoc(
        `|RECORD=Board\n|RECORD=Text|LAYER=TOPOVERLAY|HEIGHT=40mil|TEXT=${text}|FONTNAME=Arial|BOLD=${bold}|JUSTIFICATION=5|INVERTED=TRUE|MARGINBORDERWIDTH=10mil`,
      ),
    )
    expect(svg).toContain(`width="${textWidth + 20}"`)
    expect(svg).toContain(`x="${-textWidth / 2 - 10}"`)
    expect(svg).toContain('font-size="40"')
  }
})
