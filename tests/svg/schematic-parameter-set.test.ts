import { expect, test } from "bun:test"
import { parseAltiumAscii, serializeAltiumSheetToSvg } from "../../lib"

test("renders differential pair directive in schematic SVG snapshot", async () => {
  const source = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31|CUSTOMX=240|CUSTOMY=180",
    "|RECORD=27|LINEWIDTH=1|COLOR=8388608|LOCATIONCOUNT=2|X1=30|Y1=100|X2=210|Y2=100",
    "|RECORD=27|LINEWIDTH=1|COLOR=8388608|LOCATIONCOUNT=2|X1=30|Y1=70|X2=210|Y2=70",
    "|RECORD=25|Location.X=50|Location.Y=100|Text=USB_DP|Color=8388608",
    "|RECORD=25|Location.X=50|Location.Y=70|Text=USB_DM|Color=8388608",
    "|RECORD=43|Location.X=120|Location.Y=100|Color=255|Name=DIFFPAIR",
    "|RECORD=43|Location.X=120|Location.Y=70|Color=255|Name=DIFFPAIR",
  ].join("\n")

  const svg = serializeAltiumSheetToSvg(parseAltiumAscii(source), {
    title: "Altium schematic differential pair directive",
  })

  expect(svg).toContain('data-record="43"')
  expect(svg).toContain("DIFFPAIR")
  expect(svg.match(/data-record="43"/g)).toHaveLength(4)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
