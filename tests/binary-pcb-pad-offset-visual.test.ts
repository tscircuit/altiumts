import { expect, test } from "bun:test"
import {
  AltiumSerializationError,
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
  serializeAltiumPcbDocToBinary,
  serializeAltiumPcbToSvg,
} from "../lib"

const source = [
  "|RECORD=Board|VERSION=5.0|VX0=0mil|VY0=0mil|VX1=160mil|VY1=0mil|VX2=160mil|VY2=120mil|VX3=0mil|VY3=120mil",
  "|RECORD=Pad|LAYER=MULTILAYER|X=80mil|Y=60mil|XSIZE=80mil|YSIZE=64mil|SHAPE=RECTANGLE|HOLESIZE=24mil|PLATED=TRUE|LAYER0HOLEXOFFSET=15.7480315mil|LAYER0HOLEYOFFSET=7.8740157mil",
].join("\n")
const renderOptions = { layers: ["TOP", "MULTILAYER"], width: 480, height: 360 }

function panel(svg: string, x: number): string {
  return `<image x="${x}" y="36" width="480" height="360" href="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"/>`
}

test("snapshots input drill offsets and the actual binary export result", async () => {
  const inputSvg = serializeAltiumPcbToSvg(
    parseAltiumPcbDoc(source),
    renderOptions,
  )
  let outputSvg: string
  try {
    const bytes = serializeAltiumPcbDocToBinary(source)
    outputSvg = serializeAltiumPcbToSvg(
      parseAltiumBinaryPcbDoc(bytes),
      renderOptions,
    )
  } catch (error) {
    // Show the actual unsupported-field failure, never a simulated centered pad.
    if (
      !(error instanceof AltiumSerializationError) ||
      !error.message.includes(
        "does not support fields: LAYER0HOLEXOFFSET, LAYER0HOLEYOFFSET",
      )
    )
      throw error
    outputSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="#fff1f2"/><g fill="#9f1239" font-family="sans-serif" font-size="18"><text x="24" y="130">Binary export rejected</text><text x="24" y="170">Unsupported hole-offset fields</text><text x="24" y="210">No PCB file was produced</text></g></svg>`
  }
  const snapshot = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="396"><title>Drill-offset input and binary export comparison</title><rect width="960" height="396" fill="white"/><g font-family="sans-serif" font-size="16" fill="#0f172a"><text x="12" y="24">Input: drill offset +0.4 mm X / +0.2 mm Y</text><text x="492" y="24">Actual binary export</text></g>${panel(inputSvg, 0)}${panel(outputSvg, 480)}</svg>`
  await expect(snapshot).toMatchSvgSnapshot(import.meta.path)
})
