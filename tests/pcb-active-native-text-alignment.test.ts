import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
  serializeAltiumPcbToSvg,
} from "../lib"
import { parseAltiumBinaryPcbPrimitiveStream } from "../lib/parser/parse-altium-binary-pcb-primitives"
import { readReferenceBytes } from "./svg/read-reference"

test("positions the PMP22712 warning and PMP23595 caution from their native lower-left origins", async () => {
  for (const { name, index, label, y, baseline, transform } of [
    {
      name: "ti-pmp22712",
      index: 2,
      label: "For evaluation only; not FCC approved for resale.",
      y: -60,
      baseline: "text-before-edge",
      transform: "translate(717.4891 1658.6708) rotate(-360) scale(1 1)",
    },
    {
      name: "ti-pmp23595",
      index: 97,
      label: "CAUTION HOT SURFACE",
      y: -39.3701,
      baseline: "central",
      transform: "translate(908.6719 140.7737) rotate(0) scale(1 1)",
    },
  ]) {
    const bytes = await readReferenceBytes(`${name}.PcbDoc`)
    const document = parseAltiumBinaryPcbDoc(bytes)
    const record = document.texts.find(
      (record) => record.getNumber("WIDESTRINGINDEX") === index,
    )!
    expect(record.getBoolean("ISFRAME")).toBe(false)
    expect(record.getBoolean("JUSTIFICATIONVALID")).toBe(true)
    const svg = renderText(record.getString())
    expect(svg).toContain(`>${label}</text>`)
    expect(svg).toContain(`x="0" y="${y}"`)
    expect(svg).toContain(`text-anchor="start" dominant-baseline="${baseline}"`)
    expect(svg).toContain(`transform="${transform}"`)
    expect(document.getBytes()).toEqual(bytes)
  }
})

test("keeps every active native justification at its local origin through rotation and mirroring", () => {
  for (let justification = 1; justification <= 9; justification++) {
    const row = (justification - 1) % 3
    const y = [-40, -20, 0][row]
    const baseline = ["text-before-edge", "central", "text-after-edge"][row]
    for (const rotation of [0, 90, 180, 270]) {
      for (const mirror of [false, true]) {
        const bytes = nativeText({ justification, rotation, mirror })
        const record = parseAltiumBinaryPcbPrimitiveStream("Texts6", bytes)[0]!
        const svg = renderText(record.getString())
        expect(svg).toContain(`x="0" y="${y}"`)
        expect(svg).toContain(
          `text-anchor="start" dominant-baseline="${baseline}"`,
        )
        expect(svg).toContain(
          `transform="translate(100 3800) rotate(${-rotation}) scale(${mirror ? -1 : 1} 1)"`,
        )
        // The text box deliberately has a stale width; free strings must
        // start at their saved origin even when their resolved text changes.
        record.set("WIDESTRING", "")
        record.set("TEXT", "A much longer resolved string")
        expect(renderText(record.getString())).toContain(`x="0" y="${y}"`)
        expect(record.originalBinaryPayload).toEqual(bytes.subarray(5, 257))
      }
    }
  }
})

test("retains ASCII, frame, inactive and older native text alignment", () => {
  const ascii =
    "|RECORD=Text|LAYER=TOPOVERLAY|X=100mil|Y=200mil|HEIGHT=40mil|JUSTIFICATION=5|TEXT=A"
  expect(renderText(ascii)).toContain(
    'text-anchor="middle" dominant-baseline="central"',
  )
  for (const options of [
    { length: 137 },
    { length: 239 },
    { length: 240 },
    { length: 251 },
    { active: false },
    { active: false, frame: true },
    { frame: true },
  ]) {
    const bytes = nativeText(options)
    const record = parseAltiumBinaryPcbPrimitiveStream("Texts6", bytes)[0]!
    const length = options.length ?? 252
    expect(record.getBoolean("ISFRAME")).toBe(
      length >= 240 ? (options.frame ?? false) : undefined,
    )
    expect(record.getBoolean("JUSTIFICATIONVALID")).toBe(
      length >= 252 ? (options.active ?? true) : undefined,
    )
    const svg = renderText(record.getString())
    expect(svg).toContain('x="0" y="0"')
    expect(svg).toContain(
      options.active === false
        ? 'text-anchor="start" dominant-baseline="text-after-edge"'
        : 'text-anchor="middle" dominant-baseline="central"',
    )
  }
})

function renderText(textRecord: string): string {
  return serializeAltiumPcbToSvg(
    parseAltiumPcbDoc(`|RECORD=Board\n${textRecord}`),
    { viewBox: { x: 0, y: 0, width: 4000, height: 4000 } },
  )
}

function nativeText({
  length = 252,
  justification = 5,
  rotation = 0,
  mirror = false,
  active = true,
  frame = false,
}: {
  length?: number
  justification?: number
  rotation?: number
  mirror?: boolean
  active?: boolean
  frame?: boolean
}): Uint8Array {
  const bytes = new Uint8Array(1 + 4 + length + 4 + 2)
  const view = new DataView(bytes.buffer)
  bytes[0] = 5
  view.setUint32(1, length, true)
  bytes[5] = 21 // Top overlay
  view.setUint16(5 + 7, 0xffff, true)
  view.setInt32(5 + 13, 1_000_000, true) // X = 100 mil
  view.setInt32(5 + 17, 2_000_000, true) // Y = 200 mil
  view.setInt32(5 + 21, 400_000, true) // Cell height = 40 mil
  view.setFloat64(5 + 27, rotation, true)
  bytes[5 + 35] = mirror ? 1 : 0
  view.setInt32(5 + 124, 90_000_000, true) // Stale cached width = 9000 mil
  bytes[5 + 132] = justification
  if (length >= 240) bytes[5 + 230] = frame ? 1 : 0
  if (length >= 252) bytes[5 + 240] = active ? 1 : 0
  view.setUint32(5 + length, 2, true)
  bytes[9 + length] = 1
  bytes[10 + length] = 65 // Legacy Pascal string "A"
  return bytes
}
