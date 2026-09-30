import { expect, test } from "bun:test"
import {
  parseAltiumPrjPcb,
  parseAltiumSchDoc,
  resolveSchematicParameterReferenceWithContext,
} from "../lib"

test("an asterisk inherits schematic parameters from lower-priority scopes", () => {
  const project = parseAltiumPrjPcb(
    [
      "[Parameter1]",
      "Name=Assembly",
      "Value=Project assembly",
      "[ProjectVariant1]",
      "Description=Production",
      "ParameterCount=1",
      "[Parameter2_1]",
      "Name=Assembly",
      "Value=*",
    ].join("\n"),
  )
  const document = parseAltiumSchDoc(
    [
      "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
      "|RECORD=31|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Arial|CUSTOMX=320|CUSTOMY=170",
      "|RECORD=41|OWNERINDEX=-1|ISHIDDEN=T|NAME=Assembly|TEXT=Document assembly",
    ].join("\n"),
  )
  const inheritingDocument = parseAltiumSchDoc(
    [
      "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
      "|RECORD=31|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Arial|CUSTOMX=320|CUSTOMY=170",
      "|RECORD=41|OWNERINDEX=-1|ISHIDDEN=T|NAME=Assembly|TEXT=*",
    ].join("\n"),
  )

  expect(
    resolveSchematicParameterReferenceWithContext({
      document,
      project,
      reference: "=Assembly",
      variantName: "Production",
    }),
  ).toBe("Document assembly")
  expect(
    resolveSchematicParameterReferenceWithContext({
      document: inheritingDocument,
      project,
      reference: "=Assembly",
      variantName: "Production",
    }),
  ).toBe("Project assembly")
})
