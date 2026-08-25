import { expect, test } from "bun:test"
import { parseAltiumAscii, serializeAltiumSheetToSvg } from "../../lib"

test("does not render disabled schematic sheet chrome", () => {
  const source = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31|CUSTOMX=300|CUSTOMY=200|USECUSTOMSHEET=T|BORDERON=F|TITLEBLOCKON=F",
  ].join("\r\n")

  const svg = serializeAltiumSheetToSvg(parseAltiumAscii(source))

  expect(svg).not.toContain('data-record="SheetBorder"')
  expect(svg).not.toContain('data-record="SheetTitleBlock"')
})
