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
  const logo = document.records.filter(
    (record) =>
      record.recordKind === "Region" &&
      record.getCaseInsensitive("LAYER") === "BOTTOMOVERLAY",
  )
  expect(logo).toHaveLength(1)
  const logoTag = 'data-record="Region" data-layer="BOTTOMOVERLAY"'
  expect(rendered.indexOf(logoTag)).toBeGreaterThan(-1)
  expect(rendered.indexOf(logoTag)).toBeGreaterThan(
    rendered.indexOf('data-record="BoardOutline"'),
  )
  expect(rendered.indexOf(logoTag)).toBeLessThan(
    rendered.indexOf('data-record="Region" data-layer="TOP"'),
  )
  const bottom = serializeAltiumPcbToSvg(document, { viewSide: "bottom" })
  expect(bottom.indexOf(logoTag)).toBeGreaterThan(
    bottom.indexOf('data-record="BoardOutline"'),
  )
  const panel = (svg: string, x: number) =>
    svg.replace(
      /<svg\b([^>]*)>/,
      (_, attributes: string) =>
        `<svg x="${x}" y="30" ${attributes.replace(/\s(?:width|height)="[^"]*"/g, "")} width="800" height="800">`,
    )
  const comparison = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="830" viewBox="0 0 1600 830"><title>NEMA17 knockout comparison</title><rect width="1600" height="830" fill="#f1f5f9"/><text x="12" y="20" font-family="Arial" font-size="14">NEMA17 Circuit JSON reference</text><text x="812" y="20" font-family="Arial" font-size="14">NEMA17 Altium knockout rendering</text>${panel(reference, 0)}${panel(rendered, 800)}</svg>`
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
}, 10_000)

test("preserves NEMA17 DATA and PWR knockout backgrounds", async () => {
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
