import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSchDocToBinary } from "../lib"

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

test("creates native schematic image storage", () => {
  const compressedBytes = Uint8Array.of(0x78, 0x9c, 0x01, 0x02, 0x03)
  const bytes = serializeAltiumSchDocToBinary(
    [
      "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0|WEIGHT=2",
      "|RECORD=31|CUSTOMX=1000|CUSTOMY=800|USECUSTOMSHEET=T",
      "|RECORD=30|OWNERINDEX=-1|FILENAME=logo.png|LOCATION.X=10|LOCATION.Y=10|CORNER.X=20|CORNER.Y=20",
    ].join("\r\n"),
    {
      embeddedImages: [{ compressedBytes, name: "logo.png" }],
    },
  )
  const document = parseAltiumSchDoc(bytes)

  expect(document.embeddedImages).toHaveLength(1)
  expect(document.embeddedImages[0]?.name).toBe("logo.png")
  expect(document.embeddedImages[0]?.getCompressedBytes()).toEqual(
    compressedBytes,
  )
})
