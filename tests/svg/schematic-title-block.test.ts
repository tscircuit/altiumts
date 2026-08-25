import { expect, test } from "bun:test"
import { parseAltiumAscii, serializeAltiumSheetToSvg } from "../../lib"

test("renders the standard schematic title block and reference zones", async () => {
  const source = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31|CUSTOMX=600|CUSTOMY=400|USECUSTOMSHEET=T|BORDERON=T|TITLEBLOCKON=T|CUSTOMMARGINWIDTH=20|CUSTOMXZONES=4|CUSTOMYZONES=3|FONTIDCOUNT=1|FONTNAME1=Times New Roman|SIZE1=10",
  ].join("\r\n")

  const svg = serializeAltiumSheetToSvg(parseAltiumAscii(source), {
    backgroundColor: "#fff",
  })

  expect(svg).toContain('data-record="SheetTitleBlock"')
  expect(svg).toContain(">Title</text>")
  expect(svg).toContain(">Revision</text>")
  expect(svg).toContain(">Sheet</text>")
  expect(svg).toContain(">1</text>")
  expect(svg).toContain(">A</text>")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
