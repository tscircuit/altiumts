import { expect, test } from "bun:test"
import {
  parseAltiumPrjPcb,
  parseAltiumSchDoc,
  resolveSchematicParameterReferenceWithContext,
} from "../lib"

test("resolves project parameters stored in suffixed sections", () => {
  const project = parseAltiumPrjPcb(
    ["[Parameter2_1]", "Name=EVM_Orderable", "Value=LM5155EVM-FLY"].join("\n"),
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
  ).toBe("LM5155EVM-FLY")
})
