import { expect } from "bun:test"
import {
  parseAltiumSchDoc,
  serializeAltiumSchDocToBinary,
  serializeAltiumSheetToSvg,
} from "../../lib"

// Exercise the source renderer through a native SchDoc. These cases must
// not go through Circuit JSON: that would give the exporter a chance to hide
// the malformed fields whose effects we need to see in visual regressions.
export function document(records: string[], sheetFields = "") {
  return parseAltiumSchDoc(
    serializeAltiumSchDocToBinary(
      [
        "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
        `|RECORD=31|USECUSTOMSHEET=T|CUSTOMX=400|CUSTOMY=300${sheetFields}`,
        ...records,
      ].join("\n"),
    ),
  )
}

export function render(records: string[], sheetFields = "") {
  return serializeAltiumSheetToSvg(document(records, sheetFields), {
    margin: 0,
  })
}

export function textElement(svg: string, text: string) {
  const element = svg
    .match(/<text\b[^>]*>.*?<\/text>/gu)
    ?.find((candidate) => candidate.endsWith(`>${text}</text>`))
  expect(element).toBeDefined()
  return element ?? ""
}

export const fonts =
  "|FONTIDCOUNT=3|SIZE1=4|FONTNAME1=Arial|SIZE2=6|FONTNAME2=Courier New|SIZE3=3.6000|FONTNAME3=Arial"
export const pin =
  "|RECORD=2|LOCATION.X=100|LOCATION.Y=100|PINLENGTH=10|PINCONGLOMERATE=56|NAME=SIGNAL|DESIGNATOR=1"
