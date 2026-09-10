import { expect, test } from "bun:test"
import { parseAltiumAscii, serializeAltiumSheetToSvg } from "../../lib"

test("renders implementation map definer in schematic SVG snapshot", async () => {
  const source = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31|CUSTOMX=240|CUSTOMY=180",
    "|RECORD=1|LIBREFERENCE=SW-SPST|LOCATION.X=105|LOCATION.Y=260|CURRENTPARTID=1",
    "|RECORD=2|OWNERINDEX=0|LOCATION.X=105|LOCATION.Y=250|NAME=COMMON|DESIGNATOR=1",
    "|RECORD=2|OWNERINDEX=0|LOCATION.X=125|LOCATION.Y=250|NAME=NO|DESIGNATOR=2",
    "|RECORD=44|OWNERINDEX=0",
    "|RECORD=45|OWNERINDEX=3|MODELNAME=DIP-6|MODELTYPE=PCBLIB",
    "|RECORD=46|OWNERINDEX=4",
    "|RECORD=47|OWNERINDEX=5|DESINTF=2|DESIMPCOUNT=1|DESIMP0=6",
  ].join("\n")

  const svg = serializeAltiumSheetToSvg(parseAltiumAscii(source), {
    title: "Altium schematic implementation map definer",
  })

  expect(svg).toContain('data-record="47"')
  expect(svg).toContain('data-desintf="2"')
  expect(svg).toContain('data-desimpcount="1"')
  expect(svg).toContain('data-desimp0="6"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
