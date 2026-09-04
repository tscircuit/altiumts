import { expect, test } from "bun:test"
import { parseAltiumAscii, serializeAltiumSheetToSvg } from "../../lib"

test("renders schematic clock and inversion pin symbols", async () => {
  const source = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31|CUSTOMX=140|CUSTOMY=140",
    "|RECORD=14|LOCATION.X=40|LOCATION.Y=40|CORNER.X=100|CORNER.Y=100|ISSOLID=T|AREACOLOR=16777215",
    "|RECORD=2|PINCONGLOMERATE=2|PINLENGTH=20|LOCATION.X=40|LOCATION.Y=70|NAME=CLOCK|DESIGNATOR=1|SYMBOL_INNEREDGE=3",
    "|RECORD=2|PINCONGLOMERATE=0|PINLENGTH=20|LOCATION.X=100|LOCATION.Y=70|NAME=INVERTED|DESIGNATOR=2|SYMBOL_OUTEREDGE=1",
    "|RECORD=2|PINCONGLOMERATE=1|PINLENGTH=20|LOCATION.X=70|LOCATION.Y=100|NAME=BOTH|DESIGNATOR=3|SYMBOL_INNEREDGE=3|SYMBOL_OUTEREDGE=1",
    "|RECORD=2|PINCONGLOMERATE=3|PINLENGTH=20|LOCATION.X=70|LOCATION.Y=40|NAME=CLOCK|DESIGNATOR=4|SYMBOL_INNEREDGE=3",
  ].join("\n")
  const svg = serializeAltiumSheetToSvg(parseAltiumAscii(source), {
    showBorder: false,
    title: "Schematic pin symbols",
  })

  expect(svg.match(/class="altium-schematic-pin-clock-symbol"/g)).toHaveLength(
    3,
  )
  expect(
    svg.match(/class="altium-schematic-pin-inversion-symbol"/g),
  ).toHaveLength(2)
  expect(
    svg.match(/class="altium-schematic-pin-direction-symbol"/g),
  ).toHaveLength(2)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
