import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
  serializeAltiumPcbToSvg,
} from "../lib"
import { parseAltiumBinaryPcbPrimitiveStream } from "../lib/parser/parse-altium-binary-pcb-primitives"
import { getPcbTextPositioning } from "../lib/svg-serialization/pcb-text-positioning"
import { readReferenceBytes } from "./svg/read-reference"

test("anchors the PMP22712 board title at its saved lower-left origin", async () => {
  const bytes = await readReferenceBytes("ti-pmp22712.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(bytes)
  const title = document.texts.find(
    (record) => record.getNumber("WIDESTRINGINDEX") === 3,
  )!
  expect(title.getNumber("JUSTIFICATION")).toBe(5)
  expect(title.getBoolean("JUSTIFICATIONVALID")).toBe(false)
  const svg = serializeAltiumPcbToSvg(
    parseAltiumPcbDoc(`|RECORD=Board\n${title.getString()}`),
  )
  expect(svg).toContain(
    'text-anchor="start" dominant-baseline="text-after-edge"',
  )
  expect(document.getBytes()).toEqual(bytes)
})

test("distinguishes active modern justification from saved inactive text-box values", () => {
  for (const active of [false, true]) {
    const bytes = new Uint8Array(1 + 4 + 252 + 4 + 1)
    const view = new DataView(bytes.buffer)
    bytes[0] = 5
    view.setUint32(1, 252, true)
    bytes[5 + 132] = 5
    bytes[5 + 240] = active ? 1 : 0
    view.setUint32(257, 1, true)
    const record = parseAltiumBinaryPcbPrimitiveStream("Texts6", bytes)[0]!
    expect(record.getBoolean("JUSTIFICATIONVALID")).toBe(active)
    expect(
      getPcbTextPositioning(
        record.getNumber("JUSTIFICATION"),
        record.getBoolean("JUSTIFICATIONVALID"),
      ),
    ).toEqual(
      active
        ? { anchor: "middle", baseline: "central" }
        : { anchor: "start", baseline: "text-after-edge" },
    )
  }
  // ASCII and legacy callers without a modern flag keep their explicit alignment.
  expect(getPcbTextPositioning(9)).toEqual({
    anchor: "end",
    baseline: "text-after-edge",
  })
})
