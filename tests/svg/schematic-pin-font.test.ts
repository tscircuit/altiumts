import { expect, test } from "bun:test"
import { parseAltiumAscii, serializeAltiumSheetToSvg } from "../../lib"

test("renders schematic pin text with its sheet font", async () => {
  const source = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31|FONTIDCOUNT=3|SIZE2=4|FONTNAME2=Helvetica|BOLD2=T|ITALIC2=T|SIZE3=6|FONTNAME3=Courier New|CUSTOMX=100|CUSTOMY=80",
    "|RECORD=2|PINCONGLOMERATE=58|PINLENGTH=10|LOCATION.X=40|LOCATION.Y=40|FONTID=2|NAME_CUSTOMFONTID=2|DESIGNATOR_CUSTOMFONTID=3|NAME=INPUT|DESIGNATOR=1",
  ].join("\n")
  const svg = serializeAltiumSheetToSvg(parseAltiumAscii(source), {
    title: "Schematic pin font",
  })

  expect(svg).toContain(
    'font-family="Helvetica" font-size="5.5556" font-style="italic" font-weight="bold"',
  )
  expect(svg).toContain(
    'font-family="Courier New" font-size="8.3333" font-style="normal" font-weight="normal"',
  )
  expect(svg).toContain(
    'dominant-baseline="text-after-edge" transform="translate(41.5 43.5) rotate(0)">1</text>',
  )
  expect(svg).toContain(
    'dominant-baseline="central" transform="translate(45.5 43.5) rotate(0)">INPUT</text>',
  )
  expect(svg).not.toContain('font-size="4"')
  expect(svg).not.toContain('font-size="6"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
