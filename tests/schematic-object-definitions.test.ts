import { expect, test } from "bun:test"
import {
  AltiumSchObjectDefinitionRecord,
  AltiumTruncatedRecordError,
  parseAltiumSchDoc,
  serializeAltiumSchDocToBinary,
  validateAltiumDocument,
} from "../lib"
import {
  customPowerDefinitions,
  customPowerSheet,
  powerDefinitionIds,
} from "./fixtures/custom-power-definitions"

test("keeps native power definitions separate from the electrical sheet", () => {
  const definitions = [
    ...customPowerDefinitions,
    "|RECORD=9000|OwnerIndex=3|VendorField=retained|VendorField=again",
  ]
  const bytes = serializeAltiumSchDocToBinary(customPowerSheet, {
    objectDefinitionRecords: definitions,
  })
  const document = parseAltiumSchDoc(bytes)
  expect(document.compoundFile?.getStream("/ObjectDefinitions")).toBeDefined()
  expect(document.getBytes()).toEqual(bytes)
  expect(document.getRecordsByKind("129")).toHaveLength(0)
  expect(document.records).toHaveLength(17)
  expect(document.powerPorts).toHaveLength(8)
  expect(document.objectDefinitionRecords).toHaveLength(definitions.length + 1)
  const definition = document.objectDefinitionRecords[1]
  expect(definition).toBeInstanceOf(AltiumSchObjectDefinitionRecord)
  expect(definition?.sourceLocation?.streamPath).toBe("/ObjectDefinitions")
  expect(definition?.document).toBe(document)
  expect(validateAltiumDocument(document, { profile: "strict" }).valid).toBe(
    true,
  )
  expect(document.objectDefinitionRecords.at(-1)?.getString()).toContain(
    "|VendorField=retained|VendorField=again",
  )
  expect(
    document.getObjectDefinitionGraphics(powerDefinitionIds.bar),
  ).toHaveLength(2)
  expect(
    document.getObjectDefinitionGraphics(
      powerDefinitionIds.ground.toLowerCase(),
    ),
  ).toHaveLength(5)
  expect(document.getObjectDefinitionGraphics("missing")).toBeUndefined()

  const fileHeader = new TextDecoder().decode(
    document.compoundFile?.getStream("/FileHeader")?.content,
  )
  expect(fileHeader).toContain(`|ObjectDefinitionId=${powerDefinitionIds.bar}`)
  expect(fileHeader).not.toContain("|RECORD=129|")
  const definitionStream = new TextDecoder().decode(
    document.compoundFile?.getStream("/ObjectDefinitions")?.content,
  )
  expect(definitionStream).toContain(`|WEIGHT=${definitions.length}`)
  expect(definitionStream).toContain("|OwnerIndex=3|OwnerPartId=-1|")
  expect(definitionStream).toContain("|VendorField=retained|VendorField=again")

  const original = parseAltiumSchDoc(customPowerSheet)
  const nets = (doc: typeof document) =>
    doc.netGraph.nets.map((net) => net.names)
  expect(nets(document)).toEqual(nets(original))
  expect(
    document.netGraph.nets.every((net) =>
      net.records.every((record) => document.records.includes(record)),
    ),
  ).toBe(true)

  document.objectDefinitionRecords[2]?.set("Color", "255")
  expect(document.isDirty).toBe(true)
  expect(() => document.getBytes()).toThrow(
    "Modified binary schematic documents",
  )
})

test("uses stream-relative ownership instead of definition record adjacency", () => {
  const bytes = serializeAltiumSchDocToBinary(customPowerSheet, {
    objectDefinitionRecords: [
      customPowerDefinitions[0],
      customPowerDefinitions[3],
      customPowerDefinitions[1],
      customPowerDefinitions[4].replace("OwnerIndex=3", "OwnerIndex=1"),
      customPowerDefinitions[2],
    ],
  })
  const document = parseAltiumSchDoc(bytes)
  const bar = document.getObjectDefinitionGraphics(powerDefinitionIds.bar)
  const ground = document.getObjectDefinitionGraphics(powerDefinitionIds.ground)
  expect(bar?.map((record) => record.getNumber("CORNER.Y"))).toEqual([0, 5])
  expect(ground).toHaveLength(1)
  expect(ground?.[0]?.getNumber("OWNERINDEX")).toBe(1)
  const [header, barDefinition, groundDefinition, barLine] =
    document.objectDefinitionRecords
  if (!header || !barDefinition || !groundDefinition || !barLine)
    throw new Error("Missing fixture records")
  expect(document.getParent(header)).toBeUndefined()
  expect(document.getParent(barLine)).toBe(barDefinition)
  expect(bar).toEqual(document.getOwnedRecords(barDefinition))
  expect(ground).toEqual(document.getOwnedRecords(groundDefinition))
  expect(document.getOwnedRecords(0)).toEqual([])
})

test("applies the record-length limit to the ObjectDefinitions stream", () => {
  const bytes = serializeAltiumSchDocToBinary(customPowerSheet, {
    objectDefinitionRecords: [
      `${customPowerDefinitions[0]}|VendorField=${"x".repeat(600)}`,
    ],
  })
  expect(() => parseAltiumSchDoc(bytes, { maxRecordLength: 500 })).toThrow(
    AltiumTruncatedRecordError,
  )
})

test("does not add an ObjectDefinitions stream when none are supplied", () => {
  const document = parseAltiumSchDoc(
    serializeAltiumSchDocToBinary(customPowerSheet),
  )
  expect(document.compoundFile?.getStream("/ObjectDefinitions")).toBeUndefined()
  expect(document.objectDefinitionRecords).toEqual([])
  expect(
    document.getObjectDefinitionGraphics(powerDefinitionIds.bar),
  ).toBeUndefined()
})
