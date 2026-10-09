import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
  parseAltiumPrjPcb,
  serializeAltiumPcbToSvg,
} from "../lib"
import { parseAltiumBinaryPcbPrimitiveStream } from "../lib/parser/parse-altium-binary-pcb-primitives"
import { readReference, readReferenceBytes } from "./svg/read-reference"

test("anchors resolved PMP22712/PMP22773 titles at their saved origins, including mirrored text", async () => {
  for (const { name, index, label, transform } of [
    {
      name: "ti-pmp22712",
      index: 3,
      label: "PMP22712E2",
      transform: "translate(739.0984 1570.3307) rotate(0) scale(1 1)",
    },
    {
      name: "ti-pmp22773",
      index: 110,
      label: "PMP22773E3",
      transform: "translate(1892 1491) rotate(-360) scale(-1 1)",
    },
  ]) {
    const bytes = await readReferenceBytes(`${name}.PcbDoc`)
    const projectSource = await readReference(`${name}.PrjPcb`)
    const project = parseAltiumPrjPcb(projectSource)
    const document = parseAltiumBinaryPcbDoc(bytes)
    const title = document.texts.find(
      (record) => record.getNumber("WIDESTRINGINDEX") === index,
    )!
    expect(title.getNumber("JUSTIFICATION")).toBe(5)
    expect(title.getBoolean("JUSTIFICATIONVALID")).toBe(false)
    const svg = serializeAltiumPcbToSvg(
      parseAltiumPcbDoc(`|RECORD=Board\n${title.getString()}`),
      { project, viewBox: { x: 0, y: 0, width: 4000, height: 4000 } },
    )
    expect(svg).toContain(`>${label}</text>`)
    expect(svg).toContain(
      'text-anchor="start" dominant-baseline="text-after-edge"',
    )
    expect(svg).toContain(`transform="${transform}"`)
    expect(document.getBytes()).toEqual(bytes)
    expect(project.getString()).toBe(projectSource)
  }
})

test("honors modern validity flags without reinterpreting shorter native text records", () => {
  for (const { length, active, expectedValid, anchor, baseline, y } of [
    // Shorter layouts have no modern flag; retain their explicit alignment.
    {
      length: 137,
      active: false,
      y: 0,
      expectedValid: undefined,
      anchor: "middle",
      baseline: "central",
    },
    {
      length: 251,
      active: false,
      y: 0,
      expectedValid: undefined,
      anchor: "middle",
      baseline: "central",
    },
    {
      length: 252,
      active: false,
      y: 0,
      expectedValid: false,
      anchor: "start",
      baseline: "text-after-edge",
    },
    {
      length: 252,
      active: true,
      y: -20,
      expectedValid: true,
      anchor: "start",
      baseline: "central",
    },
  ]) {
    const bytes = new Uint8Array(1 + 4 + length + 4 + 2)
    const view = new DataView(bytes.buffer)
    bytes[0] = 5
    view.setUint32(1, length, true)
    bytes[5] = 21 // Top overlay
    view.setUint16(5 + 7, 0xffff, true)
    view.setInt32(5 + 13, 1_000_000, true) // X = 100 mil
    view.setInt32(5 + 17, 2_000_000, true) // Y = 200 mil
    view.setInt32(5 + 21, 400_000, true) // Height = 40 mil
    view.setFloat64(5 + 27, 90, true)
    bytes[5 + 35] = 1 // Mirrored
    bytes[5 + 132] = 5
    if (length >= 252) bytes[5 + 240] = active ? 1 : 0
    view.setUint32(5 + length, 2, true)
    bytes[9 + length] = 1
    bytes[10 + length] = 65 // Legacy Pascal string "A"
    const record = parseAltiumBinaryPcbPrimitiveStream("Texts6", bytes)[0]!
    expect(record.getBoolean("JUSTIFICATIONVALID")).toBe(expectedValid)
    const svg = serializeAltiumPcbToSvg(
      parseAltiumPcbDoc(`|RECORD=Board\n${record.getString()}`),
      { viewBox: { x: 0, y: 0, width: 400, height: 400 } },
    )
    expect(svg).toContain(
      `text-anchor="${anchor}" dominant-baseline="${baseline}"`,
    )
    expect(svg).toContain(`x="0" y="${y}"`)
    expect(svg).toContain(
      'transform="translate(100 200) rotate(-90) scale(-1 1)"',
    )
    expect(svg).toContain(">A</text>")
    expect(record.originalBinaryPayload).toEqual(bytes.subarray(5, 5 + length))
  }
})
