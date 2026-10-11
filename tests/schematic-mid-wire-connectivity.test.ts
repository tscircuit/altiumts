import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSchDocToBinary } from "../lib"

const horizontalWire = "|RECORD=27|LOCATIONCOUNT=2|X1=0|Y1=50|X2=100|Y2=50"
const verticalWire = "|RECORD=27|LOCATIONCOUNT=2|X1=50|Y1=0|X2=50|Y2=100"

test.each([
  ["net label", "|RECORD=25|TEXT=SIGNAL"],
  ["power port", "|RECORD=17|TEXT=SIGNAL"],
  ["port", "|RECORD=18|NAME=SIGNAL|CONNECTEDEND=1"],
])("connects a %s at the middle of a wire", (_kind, record) => {
  const source = [
    "|RECORD=31",
    horizontalWire,
    `${record}|LOCATION.X=50|LOCATION.Y=50`,
  ].join("\n")
  const document = parseAltiumSchDoc(source)
  const graph = document.netGraph
  expect(graph.nets).toHaveLength(1)
  expect(graph.nets[0]?.names).toEqual(["SIGNAL"])
  expect(graph.nets[0]?.points).toContainEqual({ x: 50, y: 50 })
  for (const electricalRecord of document.records.slice(1)) {
    expect(graph.getNetForRecord(electricalRecord)).toBe(graph.nets[0])
  }
  expect(document.getString()).toBe(source)
})

test.each([
  [
    "horizontal",
    horizontalWire,
    "|RECORD=27|LOCATIONCOUNT=2|X1=50|Y1=50|X2=50|Y2=100",
  ],
  [
    "vertical",
    verticalWire,
    "|RECORD=27|LOCATIONCOUNT=2|X1=50|Y1=50|X2=100|Y2=50",
  ],
  [
    "diagonal",
    "|RECORD=27|LOCATIONCOUNT=2|X1=0|Y1=0|X2=100|Y2=100",
    "|RECORD=27|LOCATIONCOUNT=2|X1=50|Y1=50|X2=100|Y2=0",
  ],
  [
    "reversed",
    "|RECORD=27|LOCATIONCOUNT=2|X1=100|Y1=50|X2=0|Y2=50",
    "|RECORD=27|LOCATIONCOUNT=2|X1=50|Y1=100|X2=50|Y2=50",
  ],
  [
    "overlapping",
    horizontalWire,
    "|RECORD=27|LOCATIONCOUNT=2|X1=25|Y1=50|X2=75|Y2=50",
  ],
  [
    "polyline vertex",
    horizontalWire,
    "|RECORD=27|LOCATIONCOUNT=3|X1=50|Y1=0|X2=50|Y2=50|X3=50|Y3=100",
  ],
])("joins wires at a %s connection", (_kind, firstWire, secondWire) => {
  const document = parseAltiumSchDoc(
    ["|RECORD=31", firstWire, secondWire].join("\n"),
  )
  expect(document.netGraph.nets).toHaveLength(1)
  expect(document.netGraph.nets[0]?.records).toEqual(document.wires)
})

test.each(["", "|RECORD=4|TEXT=NOTE|LOCATION.X=50|LOCATION.Y=50"])(
  "keeps mid-segment crossings disconnected without an electrical join: %s",
  (annotation) => {
    const document = parseAltiumSchDoc(
      ["|RECORD=31", horizontalWire, verticalWire, annotation].join("\n"),
    )
    expect(document.netGraph.nets).toHaveLength(2)
    expect(document.netGraph.nets.map((net) => net.records)).toEqual(
      document.wires.map((wire) => [wire]),
    )
    for (const label of document.labels)
      expect(document.netGraph.getNetForRecord(label)).toBeUndefined()
  },
)

test.each([false, true])(
  "joins crossings at an explicit junction (binary=%s)",
  (binary) => {
    const source = [
      "|RECORD=31",
      horizontalWire,
      verticalWire,
      "|RECORD=29|LOCATION.X=50|LOCATION.Y=50",
    ].join("\n")
    const input = binary ? serializeAltiumSchDocToBinary(source) : source
    const document = parseAltiumSchDoc(input)
    expect(document.netGraph.nets).toHaveLength(1)
    expect(document.netGraph.nets[0]?.records).toEqual(
      document.records.slice(1),
    )
    for (const record of document.records.slice(1)) {
      expect(document.netGraph.getNetForRecord(record)).toBe(
        document.netGraph.nets[0],
      )
    }
    if (typeof input === "string") expect(document.getString()).toBe(input)
    else expect(document.getBytes()).toEqual(input)
  },
)

test("merges disconnected wires by matching labels at their interiors", () => {
  const document = parseAltiumSchDoc(
    [
      "|RECORD=31",
      horizontalWire,
      "|RECORD=25|TEXT=SIGNAL|LOCATION.X=50|LOCATION.Y=50",
      "|RECORD=27|LOCATIONCOUNT=2|X1=0|Y1=100|X2=100|Y2=100",
      "|RECORD=25|TEXT=signal|LOCATION.X=50|LOCATION.Y=100",
    ].join("\n"),
  )
  expect(document.netGraph.nets).toHaveLength(1)
  expect(document.netGraph.getNetsByName("signal")).toEqual(
    document.netGraph.nets,
  )
  expect(document.netGraph.nets[0]?.records).toHaveLength(4)
})

test("uses signed fixed-point coordinates for mid-wire connections", () => {
  const document = parseAltiumSchDoc(
    [
      "|RECORD=31",
      "|RECORD=27|LOCATIONCOUNT=2|X1=-10|Y1=0|Y1_FRAC=-8000|X2=10|Y2=0|Y2_FRAC=-8000",
      "|RECORD=25|TEXT=SIGNAL|LOCATION.X=0|LOCATION.X_FRAC=8000|LOCATION.Y=-1|LOCATION.Y_FRAC=92000",
    ].join("\n"),
  )
  expect(document.netGraph.nets).toHaveLength(1)
  expect(document.netGraph.nets[0]?.names).toEqual(["SIGNAL"])
})

test.each([
  "|LOCATION.X=50|LOCATION.Y=50|LOCATION.Y_FRAC=1",
  "|LOCATION.X=101|LOCATION.Y=50",
])("does not join points off the finite segment: %s", (position) => {
  const document = parseAltiumSchDoc(
    ["|RECORD=31", horizontalWire, `|RECORD=25|TEXT=SIGNAL${position}`].join(
      "\n",
    ),
  )
  expect(document.netGraph.nets).toHaveLength(2)
})

test("duplicate wire vertices do not join unrelated electrical points", () => {
  const document = parseAltiumSchDoc(
    [
      "|RECORD=31",
      "|RECORD=27|LOCATIONCOUNT=3|X1=0|Y1=50|X2=0|Y2=50|X3=100|Y3=50",
      "|RECORD=27|LOCATIONCOUNT=2|X1=200|Y1=200|X2=200|Y2=200",
      "|RECORD=25|TEXT=SIGNAL|LOCATION.X=300|LOCATION.Y=300",
    ].join("\n"),
  )
  expect(document.netGraph.nets).toHaveLength(3)
})

test("short fixed-point segments do not absorb nearby disconnected points", () => {
  const document = parseAltiumSchDoc(
    [
      "|RECORD=31",
      "|RECORD=27|LOCATIONCOUNT=2|X1=0|Y1=0|X2=0|X2_FRAC=1|Y2=0|Y2_FRAC=1",
      "|RECORD=25|TEXT=SIGNAL|LOCATION.X=0|LOCATION.Y=0|LOCATION.Y_FRAC=1",
    ].join("\n"),
  )
  expect(document.netGraph.nets).toHaveLength(2)
})

test("rebuilds geometric connectivity after editing an electrical position", () => {
  const document = parseAltiumSchDoc(
    [
      "|RECORD=31",
      horizontalWire,
      "|RECORD=25|TEXT=SIGNAL|LOCATION.X=50|LOCATION.Y=50",
    ].join("\n"),
  )
  const joined = document.netGraph
  expect(joined.nets).toHaveLength(1)
  expect(document.netGraph).toBe(joined)
  document.netLabels[0]?.set("LOCATION.Y", "60")
  expect(document.netGraph).not.toBe(joined)
  expect(document.netGraph.nets).toHaveLength(2)
})
