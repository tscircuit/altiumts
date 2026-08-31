import { expect, test } from "bun:test"
import {
  parseAltiumSchDoc,
  serializeAltiumSchDocToBinary,
  serializeAltiumSheetToSvg,
} from "../lib"

test("creates native binary schematic documents", () => {
  const bytes = serializeAltiumSchDocToBinary(
    [
      "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0|WEIGHT=1",
      "|RECORD=1|LIBREFERENCE=Resistor|DESIGNATOR=R1|COMMENT=10k Ω|LOCATION.X=100|LOCATION.Y=100",
    ].join("\r\n"),
  )
  const document = parseAltiumSchDoc(bytes)

  expect(bytes.slice(0, 8)).toEqual(
    Uint8Array.of(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1),
  )
  expect(document.components).toHaveLength(1)
  expect(document.components[0]?.getDecoded("COMMENT")).toBe("10k Ω")
})

test("writes embedded PNG images into native binary schematic documents", () => {
  const pngBytes = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAHnOcQAAAAABJRU5ErkJggg==",
    ),
    (character) => character.charCodeAt(0),
  )
  const bytes = serializeAltiumSchDocToBinary(
    [
      "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0|WEIGHT=1",
      "|RECORD=30|FILENAME=logo.png|LOCATION.X=100|LOCATION.Y=100|CORNER.X=200|CORNER.Y=200|KEEPASPECT=T",
    ].join("\r\n"),
    {
      embeddedPngImages: [{ name: "logo.png", pngBytes }],
    },
  )
  const document = parseAltiumSchDoc(bytes)

  expect(document.embeddedImages).toHaveLength(1)
  expect(document.embeddedImages[0]?.getPngBytes()).toEqual(pngBytes)
  expect(document.embeddedImages[0]?.getNativePngBytes()).toEqual(pngBytes)
  expect(document.embeddedImages[0]?.getBitmapBytes().subarray(0, 2)).toEqual(
    Uint8Array.of(0x42, 0x4d),
  )
  expect(serializeAltiumSheetToSvg(document)).toContain(
    "data:image/png;base64,iVBORw0KGgo",
  )
})
