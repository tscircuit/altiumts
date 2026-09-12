import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"

// Fixture derived from SimpleFOCMini (MIT), Copyright (c) 2022 SimpleFOCproject.
// Source: https://github.com/simplefoc/SimpleFOCMini/tree/8e10d4ba398624bd0ef970e82c03d7a6bcc2220d
// Exported by circuit-json-to-altium 54b28c4 using altiumts 2cee1e0.
test("renders the converted SimpleFOC Mini power-symbol repro", async () => {
  const bytes = await Bun.file(
    new URL("../fixtures/simplefoc-mini-native-power.SchDoc", import.meta.url),
  ).bytes()
  const document = parseAltiumSchDoc(bytes)

  expect(document.compoundFile?.getStream("/ObjectDefinitions")).toBeDefined()
  expect(document.components).toHaveLength(14)
  expect(document.pins).toHaveLength(64)
  expect(document.wires).toHaveLength(146)
  expect(document.powerPorts).toHaveLength(15)
  const definitionIds = document.powerPorts.map((port) =>
    port.getCaseInsensitive("ObjectDefinitionId"),
  )
  expect(definitionIds.every(Boolean)).toBe(true)
  expect(new Set(definitionIds).size).toBe(2)
  expect(document.getBytes()).toEqual(bytes)

  const svg = serializeAltiumSheetToSvg(document, {
    width: 1500,
    height: 940,
    showBorder: false,
    title: "SimpleFOC Mini converted schematic — native power definitions",
  })
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
