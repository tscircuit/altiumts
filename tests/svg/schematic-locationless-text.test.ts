import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"

test("does not render locationless simulation-model parameters", async () => {
  const document = parseAltiumSchDoc(
    [
      "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
      "|RECORD=31|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Arial|CUSTOMX=240|CUSTOMY=160",
      "|RECORD=1|CURRENTPARTID=1|LOCATION.X=120|LOCATION.Y=80",
      "|RECORD=44|OWNERINDEX=1|OWNERPARTID=-1",
      "|RECORD=45|OWNERINDEX=2|OWNERPARTID=-1",
      "|RECORD=48|OWNERINDEX=3|OWNERPARTID=-1",
      '|RECORD=41|OWNERINDEX=4|INDEXINSHEET=-1|OWNERPARTID=-1|FONTID=1|TEXT=@DESIGNATOR %1 %2 @VALUE ?"INITIAL VOLTAGE"|NAME=Netlist',
      "|RECORD=25|LOCATION.X=120|LOCATION.Y=80|FONTID=1|TEXT=Visible annotation",
    ].join("\n"),
  )
  const svg = serializeAltiumSheetToSvg(document)

  expect(svg).toContain("Visible annotation")
  expect(svg).not.toContain("INITIAL VOLTAGE")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
