import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"

test("does not render unplaced schematic parameters", async () => {
  const document = parseAltiumSchDoc(
    [
      "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
      "|RECORD=31|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Arial|CUSTOMX=300|CUSTOMY=160",
      "|RECORD=1|LIBREFERENCE=Cap|DESIGNATOR=C1|OWNERPARTID=-1|LOCATION.X=150|LOCATION.Y=80|CURRENTPARTID=1",
      "|RECORD=41|OWNERINDEX=2|OWNERPARTID=-1|INDEXINSHEET=-1|FONTID=1|COLOR=8388608|NAME=Netlist|TEXT=@DESIGNATOR %1 %2 @VALUE ? INITIAL VOLTAGE",
      "|RECORD=41|OWNERINDEX=2|OWNERPARTID=-1|LOCATION.X=120|LOCATION.Y=120|FONTID=1|COLOR=8388608|NAME=Value|TEXT=Placed parameter",
    ].join("\n"),
  )
  const svg = serializeAltiumSheetToSvg(document, {
    title: "Unplaced schematic parameter",
  })

  expect(svg).toContain(">Placed parameter</text>")
  expect(svg).not.toContain("INITIAL VOLTAGE")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
