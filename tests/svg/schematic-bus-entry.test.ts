import { expect, test } from "bun:test"
import {
  AltiumSchBusEntryRecord,
  parseAltiumSchDoc,
  serializeAltiumSheetToSvg,
} from "../../lib"

test("renders a wire entering a schematic bus through a 45-degree bus entry", () => {
  const source = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31|CUSTOMX=180|CUSTOMY=120",
    "|RECORD=26|LINEWIDTH=1|COLOR=8388608|LOCATIONCOUNT=2|X1=100|Y1=20|X2=100|Y2=100",
    "|RECORD=27|LINEWIDTH=1|COLOR=128|LOCATIONCOUNT=2|X1=30|Y1=60|X2=90|Y2=60",
    "|RECORD=37|LINEWIDTH=1|COLOR=128|LOCATION.X=90|LOCATION.Y=60|CORNER.X=100|CORNER.Y=70",
  ].join("\n")
  const document = parseAltiumSchDoc(source)
  const [busEntry] = document.getRecordsByKind("37")

  expect(busEntry).toBeInstanceOf(AltiumSchBusEntryRecord)

  const svg = serializeAltiumSheetToSvg(document, {
    showBorder: false,
    title: "Schematic bus entry",
    viewBox: { x: 0, y: 0, width: 180, height: 120 },
  })

  expect(svg).toContain(
    '<polyline data-record="26" points="100,100 100,20" fill="none" stroke="#000080" stroke-width="3"/>',
  )
  expect(svg).toContain(
    '<polyline data-record="27" points="30,60 90,60" fill="none" stroke="#800000" stroke-width="1"/>',
  )
  expect(svg).toContain(
    '<line data-record="37" x1="90" y1="60" x2="100" y2="50" stroke="#800000" stroke-width="1"/>',
  )
})
