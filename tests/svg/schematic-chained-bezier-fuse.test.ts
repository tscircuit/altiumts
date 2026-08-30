import { expect, test } from "bun:test"
import {
  AltiumSchBezierRecord,
  parseAltiumSchDoc,
  serializeAltiumSheetToSvg,
} from "../../lib"

test("renders a chained Bezier fuse body", async () => {
  const source = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Arial|CUSTOMX=160|CUSTOMY=130",
    "|RECORD=1|LIBREFERENCE=FUSE|CURRENTPARTID=1|LOCATION.X=80|LOCATION.Y=80",
    "|RECORD=2|OWNERINDEX=1|OWNERPARTID=1|PINCONGLOMERATE=2|PINLENGTH=30|LOCATION.X=60|LOCATION.Y=80",
    "|RECORD=2|OWNERINDEX=1|OWNERPARTID=1|PINCONGLOMERATE=0|PINLENGTH=30|LOCATION.X=100|LOCATION.Y=80",
    "|RECORD=5|OWNERINDEX=1|OWNERPARTID=1|LINEWIDTH=1|COLOR=16711680|LOCATIONCOUNT=7|X1=60|Y1=80|X2=65|Y2=95|X3=70|Y3=95|X4=80|Y4=80|X5=90|Y5=65|X6=95|Y6=65|X7=100|Y7=80",
    "|RECORD=34|OWNERINDEX=1|OWNERPARTID=1|LOCATION.X=70|LOCATION.Y=110|COLOR=8388608|FONTID=1|TEXT=F1",
    "|RECORD=41|OWNERINDEX=1|OWNERPARTID=1|LOCATION.X=65|LOCATION.Y=55|COLOR=8388608|FONTID=1|TEXT=6V 0.5A",
    "|RECORD=25|LOCATION.X=27|LOCATION.Y=80|JUSTIFICATION=2|COLOR=128|FONTID=1|TEXT=VIN-F",
    "|RECORD=25|LOCATION.X=133|LOCATION.Y=80|COLOR=128|FONTID=1|TEXT=VIN",
  ].join("\n")
  const document = parseAltiumSchDoc(source)
  const [bezier] = document.getRecordsByKind("5")

  expect(bezier).toBeDefined()
  expect(bezier).toBeInstanceOf(AltiumSchBezierRecord)
  expect(bezier?.getNumber("LOCATIONCOUNT")).toBe(7)

  const svg = serializeAltiumSheetToSvg(document, {
    backgroundColor: "#fffdf8",
    height: 520,
    showBorder: false,
    title: "Chained Bezier fuse body reproduction",
    width: 640,
  })

  expect(svg).toContain(">F1</text>")
  expect(svg).toContain(">6V 0.5A</text>")
  expect(svg.match(/data-record="2"/g)).toHaveLength(2)
  expect(svg).toContain(
    '<path data-record="5" d="M 65.6 55.6 C 70.6 40.6 75.6 40.6 85.6 55.6 C 95.6 70.6 100.6 70.6 105.6 55.6" fill="none" stroke="#0000ff" stroke-width="1"/>',
  )
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
