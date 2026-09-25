import { expect, test } from "bun:test"
import assert from "node:assert/strict"
import {
  getSchematicCoordinate,
  getSchematicRecordPoints,
  parseAltiumSchDoc,
} from "../lib"
import { document, render } from "./fixtures/native-schematic-rendering"

test.each([
  ["10", "8000", 10.08],
  ["10", "-8000", 9.92],
  ["-10", "8000", -9.92],
  ["-10", "-8000", -10.08],
  ["0", "-5", -0.00005],
  ["+10", "+08000", 10.08],
])(
  "shares signed fixed-point coordinates for %s and %s",
  (integer, fraction, expected) => {
    const records = [
      `|RECORD=4|LOCATION.X=${integer}|LOCATION.X_FRAC=${fraction}|LOCATION.Y=20|TEXT=coordinate`,
      `|RECORD=6|LOCATIONCOUNT=2|X1=${integer}|X1_FRAC=${fraction}|Y1=20|X2=30|Y2=40`,
    ]
    const parsed = document(records)
    expect(parsed.labels[0]?.position).toEqual({ x: expected, y: 20 })
    const polyline = parsed.records[2]
    assert(polyline)
    expect(getSchematicRecordPoints(polyline)[0]).toEqual({
      x: expected,
      y: 20,
    })
    const ascii = `${["|RECORD=31", ...records].join("\r\n")}\r\n`
    const textDocument = parseAltiumSchDoc(ascii)
    expect(textDocument.labels[0]?.position).toEqual({ x: expected, y: 20 })
    expect(textDocument.getString()).toBe(ascii)
  },
)

test("typed geometry and native SVG agree on short fractions and malformed fields", () => {
  const records = [
    "|RECORD=7|LOCATIONCOUNT=3|X1=258|X1_FRAC=8000|Y1=10|X2=258.08|Y2=20|X3=-2|X3_FRAC=-8000|Y3=30",
    "|RECORD=4|LOCATION.X=258.8|LOCATION.Y=50|TEXT=bad coordinate",
  ]
  const parsed = document(records)
  const polygon = parsed.records[1]
  assert(polygon)
  expect(getSchematicRecordPoints(polygon)).toEqual([
    { x: 258.08, y: 10 },
    { x: 0, y: 20 },
    { x: -2.08, y: 30 },
  ])
  expect(parsed.labels[0]?.position).toEqual({ x: 0, y: 50 })
  expect(render(records)).toContain('points="258.08,290 0,280 -2.08,270"')
})

test("omitted axes default to zero without inventing absent positions", () => {
  const parsed = document([
    "|RECORD=4|LOCATION.X_FRAC=-8000|TEXT=fraction only",
    "|RECORD=4|TEXT=no position",
    "|RECORD=6|LOCATIONCOUNT=4|Y1=10|X2=20|X3_FRAC=5|Y3_FRAC=-8000",
    "|RECORD=6|X1_FRAC=-8000|Y2=20",
  ])
  expect(parsed.labels.map((label) => label.position)).toEqual([
    { x: -0.08, y: 0 },
    undefined,
  ])
  const countedPolyline = parsed.records[3]
  const uncountedPolyline = parsed.records[4]
  assert(countedPolyline && uncountedPolyline)
  expect(getSchematicRecordPoints(countedPolyline)).toEqual([
    { x: 0, y: 10 },
    { x: 20, y: 0 },
    { x: 0.00005, y: -0.08 },
    { x: 0, y: 0 },
  ])
  expect(getSchematicRecordPoints(uncountedPolyline)).toEqual([
    { x: -0.08, y: 0 },
    { x: 0, y: 20 },
  ])
  expect(render(["|RECORD=6|X1_FRAC=-8000|Y2=20"])).toContain(
    'points="-0.08,300 0,280"',
  )
})

test("pin lengths include signed fractions and preserve the native default", () => {
  const parsed = document([
    "|RECORD=2|PINLENGTH=10|PINLENGTH_FRAC=-8000",
    "|RECORD=2|PINLENGTH_FRAC=8000",
    "|RECORD=2",
  ])
  expect(parsed.pins.map((pin) => pin.pinLengthSchematicUnits)).toEqual([
    9.92,
    10.08,
    undefined,
  ])
})

test.each(["1.5", "1e2", "NaN", "Infinity", "9007199254740992", ""])(
  "invalid or unsafe integer fields use the native fallback: %s",
  (raw) => {
    const parsed = document([
      `|RECORD=4|LOCATION.X=${raw}|LOCATION.X_FRAC=-8000|LOCATION.Y=10|LOCATION.Y_FRAC=${raw}`,
    ])
    const label = parsed.labels[0]
    assert(label)
    expect(
      getSchematicCoordinate(label, { key: "LOCATION.X", fallback: 5 }),
    ).toBe(4.92)
    expect(parsed.labels[0]?.position).toEqual({ x: -0.08, y: 10 })
  },
)

test("electrically equivalent signed coordinates connect in the typed net graph", () => {
  const parsed = document([
    "|RECORD=27|LOCATIONCOUNT=2|X1=0|Y1=10|X2=10|X2_FRAC=8000|Y2=10",
    "|RECORD=25|LOCATION.X=11|LOCATION.X_FRAC=-92000|LOCATION.Y=10|TEXT=SIGNAL",
  ])
  const wire = parsed.wires[0]
  const label = parsed.netLabels[0]
  assert(wire && label)
  expect(parsed.netGraph.getNetForRecord(wire)?.names).toEqual(["SIGNAL"])
  expect(parsed.netGraph.getNetForRecord(label)).toBe(
    parsed.netGraph.getNetForRecord(wire),
  )
})
