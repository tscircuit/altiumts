import { expect, test } from "bun:test"
import { parseAltiumAscii, serializeAltiumSheetToSvg } from "../../lib"

test("renders schematic notes as multiline text frames", () => {
  const source = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31|FONTIDCOUNT=1|SIZE1=12|FONTNAME1=Times New Roman|CUSTOMX=300|CUSTOMY=200",
    "|RECORD=209|LOCATION.X=40|LOCATION.Y=40|CORNER.X=220|CORNER.Y=120|AREACOLOR=9895935|FONTID=1|ISSOLID=T|SHOWBORDER=T|ALIGNMENT=1|WORDWRAP=T|CLIPTORECT=T|TEXT=[page 17 of 21 - PDF]~1~1- Create: SOT.SchLib~1~1- No footprint: J19, J32, J33, X1|TEXTMARGIN=5",
  ].join("\n")

  const svg = serializeAltiumSheetToSvg(parseAltiumAscii(source))

  expect(svg).toContain('<g data-record="209">')
  expect(svg).toContain('fill="#ffff96"')
  expect(svg).toContain('font-family="Times New Roman" font-size="12"')
  expect(svg).toContain(
    '<tspan x="55.5" y="107.5">[page 17 of 21 - PDF]</tspan>',
  )
  expect(svg).toContain('<tspan x="55.5" y="119.5"></tspan>')
  expect(svg).toContain(
    '<tspan x="55.5" y="131.5">- Create: SOT.SchLib</tspan>',
  )
  expect(svg).toContain(
    '<tspan x="55.5" y="155.5">- No footprint: J19, J32, J33, X1</tspan>',
  )
  expect(svg).not.toContain("~1")
})
