import { expect, test } from "bun:test"
import {
  AltiumSerializationError,
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
  serializeAltiumPcbDocToBinary,
  serializeAltiumPcbToSvg,
} from "../lib"

const outline =
  "|RECORD=Board|VERSION=5.0|VX0=0mil|VY0=0mil|VX1=320mil|VY1=0mil|VX2=320mil|VY2=160mil|VX3=0mil|VY3=160mil"
const pad =
  "|RECORD=Pad|LAYER=TOP|XSIZE=60mil|YSIZE=40mil|SHAPE=RECTANGLE|HOLESIZE=0mil|PLATED=TRUE|Y=80mil"
const source = `${outline}\n${pad}|X=80mil|TENTEDTOP=TRUE\n${pad}|X=240mil|SOLDERMASKEXPANSIONMODE=Manual|SOLDERMASKEXPANSION_MANUAL=11.8110236mil`
const options = { layers: ["TOPSOLDER"], width: 480, height: 240 }

function panel(svg: string, x: number): string {
  return `<image x="${x}" y="36" width="480" height="240" href="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"/>`
}

test("snapshots mask expansion input and actual binary export", async () => {
  const input = serializeAltiumPcbToSvg(parseAltiumPcbDoc(source), options)
  let output: string
  try {
    output = serializeAltiumPcbToSvg(
      parseAltiumBinaryPcbDoc(serializeAltiumPcbDocToBinary(source)),
      options,
    )
  } catch (error) {
    if (
      !(error instanceof AltiumSerializationError) ||
      !error.message.includes(
        "does not support fields: SOLDERMASKEXPANSIONMODE, SOLDERMASKEXPANSION_MANUAL",
      )
    )
      throw error
    output = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240"><rect width="480" height="240" fill="#fff1f2"/><g font-family="sans-serif" font-size="17" fill="#9f1239"><text x="24" y="90">Binary export rejected</text><text x="24" y="130">Unsupported mask-expansion fields</text><text x="24" y="170">No PCB file produced</text></g></svg>`
  }
  await expect(
    `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="276"><title>Solder mask input and binary export comparison</title><rect width="960" height="276" fill="white"/><g font-family="sans-serif" font-size="16"><text x="12" y="24">Input mask: left covered; right +0.3 mm margin</text><text x="492" y="24">Actual binary mask export</text></g>${panel(input, 0)}${panel(output, 480)}</svg>`,
  ).toMatchSvgSnapshot(import.meta.path)
})

for (const margin of [-0.1, 0, 0.3]) {
  test(`writes signed manual solder mask expansion ${margin} mm`, () => {
    const pcb = parseAltiumBinaryPcbDoc(
      serializeAltiumPcbDocToBinary(
        `${outline}\n${pad}|X=80mil|SOLDERMASKEXPANSIONMODE=Manual|SOLDERMASKEXPANSION_MANUAL=${margin}mm`,
      ),
    )
    const exported = pcb.getRecordsByKind("Pad")[0]!
    expect(exported.get("SOLDERMASKEXPANSIONMODE")).toBe("Manual")
    expect(
      exported
        .getAltiumMeasurement("SOLDERMASKEXPANSION_MANUAL")
        ?.toMillimeters(),
    ).toBeCloseTo(margin, 5)
  })
}

for (const [mode, expected] of [
  ["None", "None"],
  ["0", "None"],
  ["Rule", "Rule"],
  ["1", "Rule"],
  ["manual", "Manual"],
  ["2", "Manual"],
]) {
  test(`round-trips solder mask mode ${mode}`, () => {
    const pcb = parseAltiumBinaryPcbDoc(
      serializeAltiumPcbDocToBinary(
        `${outline}\n${pad}|SOLDERMASKEXPANSIONMODE=${mode}`,
      ),
    )
    expect(pcb.getRecordsByKind("Pad")[0]?.get("SOLDERMASKEXPANSIONMODE")).toBe(
      expected,
    )
  })
}

test("rejects unknown mask modes instead of silently changing fabrication intent", () => {
  expect(() =>
    serializeAltiumPcbDocToBinary(
      `${outline}\n${pad}|SOLDERMASKEXPANSIONMODE=unexpected`,
    ),
  ).toThrow("Unsupported solder mask expansion mode")
})

test("omitted mask fields preserve the zero/default encoding", () => {
  expect(serializeAltiumPcbDocToBinary(`${outline}\n${pad}`)).toEqual(
    serializeAltiumPcbDocToBinary(
      `${outline}\n${pad}|SOLDERMASKEXPANSIONMODE=None|SOLDERMASKEXPANSION_MANUAL=0mil`,
    ),
  )
})
