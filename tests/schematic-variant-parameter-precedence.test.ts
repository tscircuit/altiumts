import { expect, test } from "bun:test"
import {
  parseAltiumPrjPcb,
  parseAltiumSchDoc,
  resolveSchematicParameterReferenceWithContext,
  serializeAltiumSheetToSvg,
} from "../lib"

test("selected variant parameters override document and project parameters", () => {
  const project = parseAltiumPrjPcb(
    [
      "[ProjectVariant1]",
      "Description=Production",
      "ParameterCount=1",
      "[Parameter2_1]",
      "Name=Assembly",
      "Value=Variant assembly",
      "[Parameter1]",
      "Name=Assembly",
      "Value=Project assembly",
    ].join("\n"),
  )
  const document = parseAltiumSchDoc(
    [
      "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
      "|RECORD=31|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Arial|CUSTOMX=320|CUSTOMY=170",
      "|RECORD=41|OWNERINDEX=-1|ISHIDDEN=T|NAME=Assembly|TEXT=Document assembly",
      "|RECORD=4|LOCATION.X=20|LOCATION.Y=20|FONTID=1|TEXT==Assembly",
    ].join("\n"),
  )

  expect(
    resolveSchematicParameterReferenceWithContext({
      document,
      project,
      reference: "=Assembly",
    }),
  ).toBe("Document assembly")
  expect(
    resolveSchematicParameterReferenceWithContext({
      document,
      project,
      reference: "=Assembly",
      variantName: "Production",
    }),
  ).toBe("Variant assembly")
  expect(
    serializeAltiumSheetToSvg(document, {
      project,
      variantName: "Production",
    }),
  ).toContain(">Variant assembly</text>")
})
