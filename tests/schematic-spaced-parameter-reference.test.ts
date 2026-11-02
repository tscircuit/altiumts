import { expect, test } from "bun:test"
import { parseAltiumSchDoc, resolveSchematicParameterReference } from "../lib"

test("resolves spaced parameter names and nested references without evaluating expressions", () => {
  const document = parseAltiumSchDoc(
    [
      "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
      "|RECORD=31|CUSTOMX=240|CUSTOMY=140",
      "|RECORD=41|OWNERINDEX=-1|ISHIDDEN=T|NAME=Page Name|TEXT==Sheet Title",
      "|RECORD=41|OWNERINDEX=-1|ISHIDDEN=T|NAME=Sheet Title|TEXT=Power Tree",
      "|RECORD=41|OWNERINDEX=-1|ISHIDDEN=T|NAME=Cycle Start|TEXT==Cycle End",
      "|RECORD=41|OWNERINDEX=-1|ISHIDDEN=T|NAME=Cycle End|TEXT==Cycle Start",
    ].join("\n"),
  )

  expect(resolveSchematicParameterReference(document, "=PAGE NAME")).toBe(
    "Power Tree",
  )
  expect(
    resolveSchematicParameterReference(document, "=Cycle Start"),
  ).toBeUndefined()
  expect(
    resolveSchematicParameterReference(document, "=Missing Parameter"),
  ).toBeUndefined()
  expect(
    resolveSchematicParameterReference(document, "=Page Name + 1"),
  ).toBeUndefined()
})
