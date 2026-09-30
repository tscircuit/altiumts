import { expect, test } from "bun:test"
import {
  parseAltiumPrjPcb,
  parseAltiumSchDoc,
  resolveSchematicParameterReferenceWithContext,
} from "../lib"

test("resolves parameters only from the selected project variant", () => {
  const project = parseAltiumPrjPcb(
    [
      "[ProjectVariant1]",
      "Description=001",
      "ParameterCount=1",
      "[Parameter2_1]",
      "Name=EVM_Orderable",
      "Value=LMX2694EPEVM",
      "[ProjectVariant2]",
      "Description=002",
      "ParameterCount=1",
      "[Parameter3_1]",
      "Name=EVM_Orderable",
      "Value=LMX2694SEPEVM",
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
      variantName: "001",
    }),
  ).toBe("LMX2694EPEVM")
  expect(
    resolveSchematicParameterReferenceWithContext({
      document,
      project,
      reference: "=EVM_orderable",
      variantName: "002",
    }),
  ).toBe("LMX2694SEPEVM")
  expect(
    resolveSchematicParameterReferenceWithContext({
      document,
      project,
      reference: "=VariantName",
      variantName: "002",
    }),
  ).toBe("002")
})
