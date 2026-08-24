import { expect, test } from "bun:test"
import {
  parseAltiumSchDoc,
  resolveSchematicParameterReference,
  serializeAltiumSheetToSvg,
} from "../../lib"

test("renders schematic document parameter references as their values", async () => {
  const source = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Arial|CUSTOMX=240|CUSTOMY=140",
    "|RECORD=39|FILENAME=title-block.SchDot",
    "|RECORD=4|OWNERINDEX=1|LOCATION.X=20|LOCATION.Y=110|FONTID=1|TEXT==title",
    "|RECORD=4|OWNERINDEX=1|LOCATION.X=20|LOCATION.Y=80|FONTID=1|TEXT==Revision",
    "|RECORD=4|OWNERINDEX=1|LOCATION.X=20|LOCATION.Y=50|FONTID=1|TEXT==DocumentNumber",
    "|RECORD=4|OWNERINDEX=1|LOCATION.X=20|LOCATION.Y=20|FONTID=1|TEXT==ProjectName",
    "|RECORD=41|OWNERINDEX=-1|ISHIDDEN=T|NAME=Title|TEXT=Power Distribution",
    "|RECORD=41|OWNERINDEX=-1|ISHIDDEN=T|NAME=Revision|TEXT=B",
    "|RECORD=41|OWNERINDEX=-1|ISHIDDEN=T|NAME=DocumentNumber|TEXT==SheetNumber",
    "|RECORD=41|OWNERINDEX=-1|ISHIDDEN=T|NAME=SheetNumber|TEXT=7",
  ].join("\n")
  const document = parseAltiumSchDoc(source)
  const svg = serializeAltiumSheetToSvg(document, {
    title: "Resolved schematic parameter references",
  })

  expect(resolveSchematicParameterReference(document, "=TITLE")).toBe(
    "Power Distribution",
  )
  expect(svg).toContain(">Power Distribution</text>")
  expect(svg).toContain(">B</text>")
  expect(svg).toContain(">7</text>")
  expect(svg).toContain(">=ProjectName</text>")
  expect(svg).not.toContain(">=title</text>")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
