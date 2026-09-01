import { expect, test } from "bun:test"
import { parseAltiumAscii, serializeAltiumSheetToSvg } from "../../lib"

function createSchematicSource(areaColor?: number): string {
  return [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    `|RECORD=31|CUSTOMX=200|CUSTOMY=160${areaColor === undefined ? "" : `|AREACOLOR=${areaColor}`}`,
  ].join("\n")
}

test("uses the native schematic sheet area color as the SVG background", () => {
  const svg = serializeAltiumSheetToSvg(
    parseAltiumAscii(createSchematicSource(0xf8_fc_ff)),
  )

  expect(svg).toContain('<rect width="100%" height="100%" fill="#fffcf8"/>')
})

test("renders a missing schematic sheet area color as black", () => {
  const svg = serializeAltiumSheetToSvg(
    parseAltiumAscii(createSchematicSource()),
  )

  expect(svg).toContain('<rect width="100%" height="100%" fill="#000000"/>')
})

test("allows callers to override the native schematic sheet area color", () => {
  const svg = serializeAltiumSheetToSvg(
    parseAltiumAscii(createSchematicSource(0xf8_fc_ff)),
    { backgroundColor: "#abcdef" },
  )

  expect(svg).toContain('<rect width="100%" height="100%" fill="#abcdef"/>')
})
