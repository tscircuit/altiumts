import { expect, test } from "bun:test"
import { parseAltiumAscii, serializeAltiumSheetToSvg } from "../../lib"

test("renders schematic pin name and designator with their custom fonts", async () => {
  const source = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31|FONTIDCOUNT=3|SIZE1=10|FONTNAME1=Times New Roman|SIZE2=4|FONTNAME2=Helvetica|BOLD2=T|SIZE3=6|FONTNAME3=Courier New|ITALIC3=T|CUSTOMX=100|CUSTOMY=80",
    "|RECORD=2|PINCONGLOMERATE=58|PINLENGTH=10|LOCATION.X=40|LOCATION.Y=40|FONTID=1|NAME_CUSTOMFONTID=2|DESIGNATOR_CUSTOMFONTID=3|NAME=INPUT|DESIGNATOR=1",
  ].join("\n")
  const svg = serializeAltiumSheetToSvg(parseAltiumAscii(source), {
    title: "Schematic pin custom fonts",
  })

  expect(svg).toContain(
    'font-family="Courier New" font-size="6" font-style="italic" font-weight="normal" text-decoration="none" text-anchor="end" dominant-baseline="text-after-edge" transform="translate(41.5 43.5) rotate(0)">1</text>',
  )
  expect(svg).toContain(
    'font-family="Helvetica" font-size="4" font-style="normal" font-weight="bold" text-decoration="none" text-anchor="start" dominant-baseline="central" transform="translate(45.5 43.5) rotate(0)">INPUT</text>',
  )
  expect(svg).not.toContain('font-family="Times New Roman"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
