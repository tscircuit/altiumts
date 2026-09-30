import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbPrimitiveStream,
  parseAltiumPcbDoc,
  serializeAltiumPcbToSvg,
} from "../lib"
import { serializeAltiumTextRecord } from "../lib/serialization/serialize-altium-pcb-primitives"

function readText(length: number, valid: boolean) {
  const [properties, legacy] = serializeAltiumTextRecord(
    "|RECORD=Text|LAYER=TOPOVERLAY|X=100mil|Y=100mil|HEIGHT=60mil|JUSTIFICATION=5|TEXT=Label",
    0,
  )
  if (!properties || !legacy) throw new Error("Expected text subrecords")
  const bytes = new Uint8Array(1 + 4 + length + 4 + legacy.length)
  const view = new DataView(bytes.buffer)
  bytes[0] = 5
  view.setUint32(1, length, true)
  bytes.set(properties, 5)
  if (length > 240) bytes[5 + 240] = Number(valid)
  view.setUint32(5 + length, legacy.length, true)
  bytes.set(legacy, 9 + length)
  const record = parseAltiumBinaryPcbPrimitiveStream("Texts6", bytes)[0]
  if (!record) throw new Error("Expected a text record")
  return record
}

test("uses bottom-left placement when native center justification is invalid", () => {
  const record = readText(252, false)
  expect(record.getNumber("JUSTIFICATION")).toBe(5)
  expect(record.getBoolean("JUSTIFICATIONVALID")).toBeFalse()
  const svg = serializeAltiumPcbToSvg(
    parseAltiumPcbDoc(`|RECORD=Board\n${record.getString()}`),
  )
  expect(svg).toContain('text-anchor="start"')
  expect(svg).toContain('dominant-baseline="text-after-edge"')
})

test("honors valid alignment and safely handles older, shorter text payloads", () => {
  for (const length of [137, 240, 241, 252]) {
    const record = readText(length, true)
    expect(record.getBoolean("JUSTIFICATIONVALID")).toBe(
      length > 240 ? true : undefined,
    )
    const svg = serializeAltiumPcbToSvg(
      parseAltiumPcbDoc(`|RECORD=Board\n${record.getString()}`),
    )
    expect(svg).toContain('text-anchor="middle"')
    expect(svg).toContain('dominant-baseline="central"')
  }
})
