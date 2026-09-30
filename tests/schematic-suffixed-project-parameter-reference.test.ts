import { expect, test } from "bun:test"
import {
  parseAltiumPrjPcb,
  parseAltiumSchDoc,
  resolveSchematicParameterReferenceWithContext,
} from "../lib"

test("does not use variant parameters without a selected variant", () => {
  const project = parseAltiumPrjPcb(
    [
      "[ProjectVariant1]",
      "Description=001",
      "ParameterCount=1",
      "[Parameter2_1]",
      "Name=EVM_Orderable",
      "Value=LM5155EVM-FLY",
    ].join("\n"),
  )
  const document = parseAltiumSchDoc(
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
  )

  expect(
    resolveSchematicParameterReferenceWithContext({
      document,
      project,
      reference: "=EVM_orderable",
    }),
  ).toBeUndefined()
})
