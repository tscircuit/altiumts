import { expect, test } from "bun:test"
import {
  AltiumTextRecord,
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbToSvg,
} from "../../lib"

// Full real-board source: tscircuit/circuit-json-to-altium at 13c32e7,
// tests/assets/nema17.circuit.json. PcbDoc is that commit's native export;
// the independent reference is circuit-to-svg 0.0.403 rendering the source.
test("compares complete nema17 knockout text with the Circuit JSON reference", async () => {
  const document = parseAltiumBinaryPcbDoc(
    new Uint8Array(
      await Bun.file(
        new URL("../fixtures/nema17-knockout.PcbDoc", import.meta.url),
      ).arrayBuffer(),
    ),
  )
  const labels = document.records.filter(
    (record): record is AltiumTextRecord =>
      record instanceof AltiumTextRecord && record.inverted === true,
  )
  expect(labels.map((record) => record.text).sort()).toEqual(["DATA", "PWR"])
  for (const record of labels)
    expect(
      record.getAltiumMeasurement("MARGINBORDERWIDTH")?.toMillimeters(),
    ).toBeCloseTo(0.18, 4)
  const reference = await Bun.file(
    new URL("../fixtures/nema17-circuit-json-reference.svg", import.meta.url),
  ).text()
  const rendered = serializeAltiumPcbToSvg(document, {
    width: 800,
    height: 800,
  })
  const panel = (svg: string, x: number) =>
    svg.replace(
      /<svg\b([^>]*)>/,
      (_, attributes: string) =>
        `<svg x="${x}" y="30" ${attributes.replace(/\s(?:width|height)="[^"]*"/g, "")} width="800" height="800">`,
    )
  const comparison = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="830" viewBox="0 0 1600 830"><title>NEMA17 knockout comparison</title><rect width="1600" height="830" fill="#f1f5f9"/><text x="12" y="20" font-family="Arial" font-size="14">NEMA17 Circuit JSON reference</text><text x="812" y="20" font-family="Arial" font-size="14">NEMA17 Altium knockout rendering</text>${panel(reference, 0)}${panel(rendered, 800)}</svg>`
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
})

test.failing("preserves NEMA17 DATA and PWR knockout backgrounds", async () => {
  const document = parseAltiumBinaryPcbDoc(
    new Uint8Array(
      await Bun.file(
        new URL("../fixtures/nema17-knockout.PcbDoc", import.meta.url),
      ).arrayBuffer(),
    ),
  )
  const svg = serializeAltiumPcbToSvg(document)
  expect(svg.match(/data-knockout="true"/g)).toHaveLength(2)
})
