import { expect, test } from "bun:test"
import {
  parseAltiumSchDoc,
  resolveSchematicParameterReference,
  serializeAltiumSheetToSvg,
} from "../../lib"

test("renders the BeaglePlay power-tree title block", async () => {
  const document = parseAltiumSchDoc(
    await Bun.file(
      new URL("../fixtures/beagleplay-power-tree.SchDoc", import.meta.url),
    ).bytes(),
  )
  const svg = serializeAltiumSheetToSvg(document, {
    viewBox: { x: 1200, y: 0, width: 453, height: 200 },
  })

  expect(resolveSchematicParameterReference(document, "=Schematic Name")).toBe(
    "BeaglePlay",
  )
  expect(resolveSchematicParameterReference(document, "=Page Number")).toBe("3")
  expect(resolveSchematicParameterReference(document, "=Page Count")).toBe("22")
  expect(resolveSchematicParameterReference(document, "=Drawing")).toBe("qxn")
  expect(resolveSchematicParameterReference(document, "=RevCode")).toBe("v0.2")
  expect(svg).toContain(">BeaglePlay</text>")
  expect(svg).not.toContain(">=Page Number</text>")

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
