import { expect, test } from "bun:test"
import {
  AltiumArcRecord,
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbDocToBinary,
} from "../lib"
import { binaryDocumentPcbSource } from "./fixtures/binary-document-creation"

test("creates native binary PCB arcs", () => {
  const asciiPcbDocument = [
    binaryDocumentPcbSource,
    "|RECORD=Arc|LAYER=TOPOVERLAY|KEEPOUT=TRUE|LOCATION.X=2000mil|LOCATION.Y=2000mil|RADIUS=20mil|STARTANGLE=30|ENDANGLE=150|WIDTH=5mil",
  ].join("\r\n")
  const binaryPcbDocument = serializeAltiumPcbDocToBinary(asciiPcbDocument)
  const parsedPcbDocument = parseAltiumBinaryPcbDoc(binaryPcbDocument)
  const arc = parsedPcbDocument.getRecordsByKind("Arc")[0]

  expect(arc).toBeInstanceOf(AltiumArcRecord)
  if (!(arc instanceof AltiumArcRecord)) {
    throw new Error("Expected a typed Altium PCB arc")
  }
  expect(arc.center).toEqual({ x: 2000, y: 2000 })
  expect(arc.radiusMils).toBe(20)
  expect(arc.startAngle).toBe(30)
  expect(arc.endAngle).toBe(150)
  expect(arc.widthMils).toBe(5)
  expect(arc.getBoolean("KEEPOUT")).toBe(true)
})
