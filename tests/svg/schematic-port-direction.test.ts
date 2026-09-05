import { expect, test } from "bun:test"
import {
  AltiumRecord,
  parseAltiumAscii,
  serializeAltiumSheetToSvg,
} from "../../lib"
import {
  getSchematicConnectionSegments,
  getSchematicPortDirection,
} from "../../lib/svg-serialization/get-schematic-port-direction"

function renderPort(fields: string, connections: string[] = []) {
  const lines = parseAltiumAscii(
    [
      "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
      "|RECORD=31|CUSTOMX=200|CUSTOMY=200|USECUSTOMSHEET=T",
      `|RECORD=18|LOCATION.X=50|LOCATION.Y=50|WIDTH=40|HEIGHT=10|NAME=SIGNAL${fields}`,
      ...connections,
    ].join("\r\n"),
  )
  const records = lines.filter(
    (line): line is AltiumRecord => line instanceof AltiumRecord,
  )
  const port = records.find((record) => record.recordKind === "18")
  if (!port) throw new Error("Missing test port")
  return {
    direction: getSchematicPortDirection({
      record: port,
      segments: getSchematicConnectionSegments(records),
      width: 40,
    }),
    svg: serializeAltiumSheetToSvg(lines, { margin: 0, showBorder: false }),
  }
}

const leftWire = "|RECORD=27|LOCATIONCOUNT=2|X1=20|Y1=50|X2=50|Y2=50"
const rightWire = "|RECORD=27|LOCATIONCOUNT=2|X1=90|Y1=50|X2=120|Y2=50"

for (const ioType of [1, 2]) {
  for (const atEnd of [false, true]) {
    test(`port IOTYPE=${ioType} follows its ${atEnd ? "right" : "left"} connection`, () => {
      const { direction, svg } = renderPort(`|IOTYPE=${ioType}`, [
        atEnd ? rightWire : leftWire,
      ])
      const pointsLeft = ioType === 1 ? atEnd : !atEnd
      expect(direction.pointAtStart).toBe(pointsLeft)
      expect(direction.pointAtEnd).toBe(!pointsLeft)
      expect(svg).toContain(pointsLeft ? 'd="M 50 150 L ' : "L 90 150 L ")
    })
  }
}

test("text alignment does not change arrow direction", () => {
  for (const alignment of [0, 1, 2]) {
    expect(
      renderPort(`|IOTYPE=1|ALIGNMENT=${alignment}`, [leftWire]).direction
        .pointAtEnd,
    ).toBe(true)
  }
})

test("unspecified ports preserve all eight saved arrow styles", () => {
  const expected = [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ]
  for (const [style, ends] of expected.entries()) {
    const { direction, svg } = renderPort(`|STYLE=${style}`, [leftWire])
    expect([direction.pointAtStart, direction.pointAtEnd]).toEqual(ends)
    expect(direction.vertical).toBe(style >= 4)
    expect(svg.includes('transform="rotate(-90 50 150)"')).toBe(style >= 4)
  }
})

test("bidirectional ports have arrowheads at both ends", () => {
  for (const connections of [[], [leftWire], [rightWire]]) {
    const { direction, svg } = renderPort("|IOTYPE=3", connections)
    expect(direction).toEqual({
      vertical: false,
      pointAtStart: true,
      pointAtEnd: true,
    })
    expect(svg).toContain('d="M 50 150 L ')
    expect(svg).toContain("L 90 150 L ")
  }
})

test("vertical input ports point toward the connected top or bottom end", () => {
  const bottom = "|RECORD=27|LOCATIONCOUNT=2|X1=50|Y1=20|X2=50|Y2=50"
  const top = "|RECORD=27|LOCATIONCOUNT=2|X1=50|Y1=90|X2=50|Y2=120"
  expect(renderPort("|STYLE=4|IOTYPE=2", [bottom]).direction.pointAtStart).toBe(
    true,
  )
  expect(renderPort("|STYLE=4|IOTYPE=2", [top]).direction.pointAtEnd).toBe(true)
})

test("connections include buses, segment interiors, and component pin tips", () => {
  const connections = [
    leftWire.replace("RECORD=27", "RECORD=26"),
    "|RECORD=27|LOCATIONCOUNT=2|X1=50|Y1=30|X2=50|Y2=70",
    "|RECORD=2|LOCATION.X=30|LOCATION.Y=50|PINLENGTH=20|PINCONGLOMERATE=56",
  ]
  for (const connection of connections) {
    expect(
      renderPort("|IOTYPE=1", [connection, rightWire]).direction.pointAtEnd,
    ).toBe(true)
  }
  expect(
    renderPort("|IOTYPE=1", [`${connections[2]}|ISHIDDEN=T`, rightWire])
      .direction.pointAtStart,
  ).toBe(true)
})

test("unconnected and doubly connected ports use a stable default", () => {
  for (const connections of [[], [leftWire, rightWire]]) {
    expect(renderPort("|IOTYPE=1", connections).direction.pointAtEnd).toBe(true)
    expect(renderPort("|IOTYPE=2", connections).direction.pointAtStart).toBe(
      true,
    )
  }
})

test("fractional port width is retained in rendering", () => {
  const { svg } = renderPort("|STYLE=2|WIDTH_FRAC=5")
  expect(svg).toContain("L 90.5 150 L ")
})

test("inactive component parts do not determine the connected end", () => {
  const { svg } = renderPort("|IOTYPE=1", [
    "|RECORD=1|CURRENTPARTID=1|PARTCOUNT=3",
    "|RECORD=2|OWNERINDEX=2|OWNERPARTID=2|LOCATION.X=30|LOCATION.Y=50|PINLENGTH=20|PINCONGLOMERATE=56",
    rightWire,
  ])
  expect(svg).toContain('d="M 50 150 L ')
})

test("nearby wires do not count as connections", () => {
  const nearbyWire = leftWire
    .replace("Y1=50", "Y1=51")
    .replace("Y2=50", "Y2=51")
  expect(
    renderPort("|IOTYPE=1", [nearbyWire, rightWire]).direction.pointAtStart,
  ).toBe(true)
})

test("fractional widths locate the far connection correctly", () => {
  const wire = rightWire.replace("X1=90", "X1=90|X1_FRAC=5")
  const { svg } = renderPort("|IOTYPE=1|WIDTH_FRAC=5", [wire])
  expect(svg).toContain('d="M 50 150 L ')
})
