import { expect, test } from "bun:test"
import {
  AltiumTextRecord,
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbDocToBinary,
  serializeAltiumPcbToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("preserves native PCB text rotation and local mirroring on both overlays", async () => {
  const rotations = [0, 90, 180, 270]
  const source = [
    "|RECORD=Board|KIND0=0|VX0=0mil|VY0=0mil|KIND1=0|VX1=1400mil|VY1=0mil|KIND2=0|VX2=1400mil|VY2=900mil|KIND3=0|VX3=0mil|VY3=900mil",
    ...[false, true].flatMap((mirrored) =>
      rotations.flatMap((rotation, index) => {
        const x = 200 + index * 330
        const y = mirrored ? 200 : 700
        const layer = mirrored ? "BOTTOMOVERLAY" : "TOPOVERLAY"
        return [
          `|RECORD=Track|LAYER=${layer}|X1=${x - 15}mil|Y1=${y}mil|X2=${x + 15}mil|Y2=${y}mil|WIDTH=2mil`,
          `|RECORD=Track|LAYER=${layer}|X1=${x}mil|Y1=${y - 15}mil|X2=${x}mil|Y2=${y + 15}mil|WIDTH=2mil`,
          `|RECORD=Text|LAYER=${layer}|X=${x}mil|Y=${y}mil|HEIGHT=40mil|WIDTH=4mil|ROTATION=${rotation}|MIRROR=${mirrored ? "TRUE" : "FALSE"}|TEXT=F12 ${rotation}`,
        ]
      }),
    ),
  ].join("\n")
  const bytes = serializeAltiumPcbDocToBinary(source)
  const document = parseAltiumBinaryPcbDoc(bytes)
  const svg = serializeAltiumPcbToSvg(document, {
    title: "Native PCB text: rotation and mirror",
    margin: 0,
  })
  expect(
    document.texts
      .filter((record) => record instanceof AltiumTextRecord)
      .map((record) => [record.rotation, record.mirrored]),
  ).toEqual([
    [0, false],
    [90, false],
    [180, false],
    [270, false],
    [0, true],
    [90, true],
    [180, true],
    [270, true],
  ])
  for (const mirrored of [false, true]) {
    for (const [index, rotation] of rotations.entries()) {
      // Local X reflection precedes rotation; the anchor stays fixed.
      expect(svg).toContain(
        `translate(${200 + index * 330} ${mirrored ? 700 : 200}) rotate(${-rotation}) scale(${mirrored ? -1 : 1} 1)`,
      )
    }
  }
  expect(document.getBytes()).toEqual(bytes)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})

test("keeps PMP22712 bottom-side labels mirrored as shown in the Altium reference", async () => {
  const document = parseAltiumBinaryPcbDoc(
    await readReferenceBytes("ti-pmp22712.PcbDoc"),
  )
  const text = document.texts.find(
    (record): record is AltiumTextRecord =>
      record instanceof AltiumTextRecord &&
      record.layer === "BOTTOMOVERLAY" &&
      record.text === "T2",
  )!
  expect(text.mirrored).toBe(true)
  expect(text.rotation).toBe(0)
  const svg = serializeAltiumPcbToSvg(document, { layers: ["BOTTOMOVERLAY"] })
  expect(svg).toMatch(/<text[^>]+rotate\(0\) scale\(-1 1\)[^>]*>T2<\/text>/)
})
