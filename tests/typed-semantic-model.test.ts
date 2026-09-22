import { expect, test } from "bun:test"
import {
  AltiumRuleRecord,
  AltiumSchComponentRecord,
  getAltiumRoundTripLevel,
  parseAltiumBinaryPcbDoc,
  parseAltiumSchDoc,
  serializeAltiumDocument,
  validateAltiumDocument,
} from "../lib"
import { readReferenceBytes } from "./svg/read-reference"

test("models binary PCB rules, layers, connectivity, bounds, and raw payloads", async () => {
  const source = await readReferenceBytes("novena-edp-adapter-dvt1.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)

  expect(document.rules).toHaveLength(39)
  expect(
    document.rules.every((record) => record instanceof AltiumRuleRecord),
  ).toBeTrue()
  expect(document.rules[0]?.sourceLocation).toMatchObject({
    byteOffset: 0,
    recordIndex: 0,
    streamPath: "/Rules6/Data",
  })
  expect(document.rules[0]?.originalBinaryPayload?.byteLength).toBeGreaterThan(
    100,
  )
  const reparsed = parseAltiumBinaryPcbDoc(source)
  expect(reparsed.rules[0]?.nodeId).toBe(document.rules[0]?.nodeId)
  const firstRule = document.rules[0]
  if (!firstRule) throw new Error("Expected a decoded PCB rule")
  expect(new Set(firstRule.items.map((item) => item.nodeId)).size).toBe(
    firstRule.items.length,
  )
  expect(document.board?.layerStack.entries).toHaveLength(76)
  expect(document.board?.layerStack.entries[0]).toMatchObject({
    index: 0,
    name: "Top Paste",
    source: "v8",
    usedByPrimitives: true,
  })

  const component = document.getComponentByIndex(102)
  if (!component) throw new Error("Expected Novena component U10C")
  expect(component.designator).toBe("U10C")
  expect(document.connectivity.getNetsForComponent(component)).toHaveLength(51)
  expect(
    document.connectivity.getConnectedComponents(component).length,
  ).toBeGreaterThan(100)
  expect(document.getComponentBounds(component)).toEqual({
    minX: 5773.4094,
    minY: 4474.2395,
    maxX: 6370.4009,
    maxY: 5168.5906,
  })

  expect(
    validateAltiumDocument(document, { profile: "strict" }).valid,
  ).toBeTrue()
  expect(getAltiumRoundTripLevel(document)).toBe("exact")
  expect(serializeAltiumDocument(document).bytes).toEqual(source)
})

test("models schematic ownership and named electrical connectivity", async () => {
  const source = await readReferenceBytes(
    "simplefoc-shield-v3-2024-06-23.SchDoc",
  )
  const document = parseAltiumSchDoc(source)

  expect(document.components).toHaveLength(47)
  expect(
    document.components.every(
      (component) => component instanceof AltiumSchComponentRecord,
    ),
  ).toBeTrue()
  expect(document.pins).toHaveLength(178)
  expect(document.wires).toHaveLength(146)
  expect(document.ports).toHaveLength(91)
  expect(document.index.getOwnershipCycles()).toEqual([])
  expect(document.netGraph.nets).toHaveLength(314)
  expect(
    document.netGraph.nets.filter((net) => net.names.length > 0),
  ).toHaveLength(59)

  const component = document.components.find(
    (candidate) => document.netGraph.getPinsForComponent(candidate).length > 0,
  )
  if (!component) throw new Error("Expected a component with owned pins")
  expect(
    document.netGraph.getPinsForComponent(component).length,
  ).toBeGreaterThan(0)
  expect(
    validateAltiumDocument(document, { profile: "strict" }).valid,
  ).toBeTrue()
  expect(document.getBytes()).toEqual(source)
})

test("exposes common component and pin fields through typed records", () => {
  const document = parseAltiumSchDoc(
    [
      "|RECORD=31",
      "|RECORD=1|LIBREFERENCE=Resistor|DESIGNATOR=R1|COMMENT=10k|DESIGNITEMID=RES-10K|CURRENTPARTID=2",
      "|RECORD=2|OWNERINDEX=1|NAME=A|DESIGNATOR=1|PINCONGLOMERATE=11|ORIENTATION=2|PINLENGTH=30",
    ].join("\n"),
  )
  const [component] = document.components
  const [pin] = document.pins

  expect(component).toMatchObject({
    comment: "10k",
    currentPartId: 2,
    designator: "R1",
    designItemId: "RES-10K",
    libraryReference: "Resistor",
  })
  expect(pin).toMatchObject({
    designator: "1",
    name: "A",
    orientationQuarterTurns: 2,
    pinConglomerate: 11,
    pinLengthSchematicUnits: 30,
  })
})
