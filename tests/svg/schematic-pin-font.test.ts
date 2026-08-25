import { expect, test } from "bun:test"
import { parseAltiumAscii, serializeAltiumSheetToSvg } from "../../lib"

test("renders schematic pin text with its sheet font", async () => {
  const source = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31|FONTIDCOUNT=2|SIZE2=4|FONTNAME2=Helvetica|BOLD2=T|ITALIC2=T|CUSTOMX=100|CUSTOMY=80",
    "|RECORD=2|PINCONGLOMERATE=58|PINLENGTH=10|LOCATION.X=40|LOCATION.Y=40|FONTID=2|NAME=INPUT|DESIGNATOR=1",
  ].join("\n")
  const svg = serializeAltiumSheetToSvg(parseAltiumAscii(source), {
    title: "Schematic pin font",
  })
  const renderedPin = svg.match(/<g data-record="2">.*?<\/g>/su)?.[0]

  expect(renderedPin).toContain(
    'font-family="Helvetica" font-size="4" font-style="italic" font-weight="bold"',
  )
  expect(renderedPin).not.toContain('font-size="6"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
