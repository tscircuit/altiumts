import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"

test("renders custom power ports in the converted SimpleFOC Mini schematic", async () => {
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
  await expect(
    serializeAltiumSheetToSvg(document, {
      width: 1000,
      height: 700,
      showBorder: false,
      viewBox: { x: 135, y: 185, width: 250, height: 175 },
      title: "SimpleFOC Mini power input and motor-driver detail",
    }),
  ).toMatchSvgSnapshot(import.meta.path, "power-detail")
})
