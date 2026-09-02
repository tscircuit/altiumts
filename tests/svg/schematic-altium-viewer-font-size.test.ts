import { expect, test } from "bun:test"
import { parseAltiumAscii, serializeAltiumSheetToSvg } from "../../lib"

test("renders schematic font point sizes in Altium coordinate units", () => {
  const source = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31|FONTIDCOUNT=2|SIZE1=3.6|FONTNAME1=Arial|SIZE2=4|FONTNAME2=Arial|CUSTOMX=120|CUSTOMY=80",
    "|RECORD=34|LOCATION.X=30|LOCATION.Y=60|FONTID=1|TEXT=U6",
    "|RECORD=4|LOCATION.X=30|LOCATION.Y=50|FONTID=1|TEXT=TCAN1042HGVDRBQ1",
    "|RECORD=2|PINCONGLOMERATE=56|PINLENGTH=8|LOCATION.X=70|LOCATION.Y=40|FONTID=2|NAME=CANH|DESIGNATOR=7",
  ].join("\n")

  const svg = serializeAltiumSheetToSvg(parseAltiumAscii(source))

  // SchDoc font-table sizes are points, while one schematic coordinate unit
  // is 10 mil. Altium therefore displays 3.6 pt as 5 coordinate units and
  // 4 pt as 5.5556 coordinate units.
  expect(svg).toContain('font-size="5"')
  expect(svg).toContain('font-size="5.5556"')
})
