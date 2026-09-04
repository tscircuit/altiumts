import { expect, test } from "bun:test"
import {
  AltiumRecord,
  parseAltiumSchDoc,
  serializeAltiumSheetToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"

function getComponentPins(
  document: ReturnType<typeof parseAltiumSchDoc>,
  designator: string,
) {
  const designatorRecord = document.lines.find(
    (line) =>
      line instanceof AltiumRecord &&
      line.recordKind === "34" &&
      line.getDecoded("TEXT") === designator,
  )
  if (!(designatorRecord instanceof AltiumRecord)) {
    throw new Error(`Component ${designator} was not found`)
  }
  const componentIndex = designatorRecord.getNumber("OWNERINDEX")
  return document.lines.filter(
    (line): line is AltiumRecord =>
      line instanceof AltiumRecord &&
      line.recordKind === "2" &&
      line.getNumber("OWNERINDEX") === componentIndex,
  )
}

function renderPins(pins: AltiumRecord[]): string {
  return serializeAltiumSheetToSvg(pins, {
    showBorder: false,
  })
}

function countPinDirections(svg: string, direction: string): number {
  return (
    svg.match(new RegExp(`data-pin-direction="${direction}"`, "g"))?.length ?? 0
  )
}

function getPinDesignatorOffsetsFromBody(svg: string): number[] {
  return [...svg.matchAll(/<g data-record="2">[^\n]+/g)].flatMap(([pinSvg]) => {
    const line = pinSvg.match(/<line x1="([^"]+)" y1="([^"]+)"/)
    const designator = pinSvg.match(
      /dominant-baseline="text-after-edge" transform="translate\(([^ ]+) ([^)]+)\)/,
    )
    if (!line || !designator) return []
    return [
      Number(
        Math.max(
          Math.abs(Number(designator[1]) - Number(line[1])),
          Math.abs(Number(designator[2]) - Number(line[2])),
        ).toFixed(3),
      ),
    ]
  })
}

function getDirectionSymbolLength(pinSvg: string): number | undefined {
  const pointsAttribute = pinSvg.match(
    /class="altium-schematic-pin-direction-symbol"[^>]*><polygon points="([^"]+)"/,
  )?.[1]
  if (!pointsAttribute) return undefined
  const points = pointsAttribute.split(" ").map((point) => {
    const [x, y] = point.split(",")
    return { x: Number(x), y: Number(y) }
  })
  const xCoordinates = points.map(({ x }) => x)
  const yCoordinates = points.map(({ y }) => y)
  return Math.max(
    Math.max(...xCoordinates) - Math.min(...xCoordinates),
    Math.max(...yCoordinates) - Math.min(...yCoordinates),
  )
}

test("renders pin directions from real binary schematic records", async () => {
  const sheet12 = parseAltiumSchDoc(
    await readReferenceBytes("ti-tmds62levm-rev-b/12.SchDoc"),
  )
  const sheet13 = parseAltiumSchDoc(
    await readReferenceBytes("ti-tmds62levm-rev-b/13.SchDoc"),
  )
  const sheet14 = parseAltiumSchDoc(
    await readReferenceBytes("ti-tmds62levm-rev-b/14.SchDoc"),
  )

  const memorySvg = renderPins(getComponentPins(sheet12, "U61"))
  expect(countPinDirections(memorySvg, "input")).toBe(2)
  expect(countPinDirections(memorySvg, "bidirectional")).toBe(4)
  const bidirectionalPinSvg =
    memorySvg
      .split("\n")
      .find((line) => line.includes('data-pin-direction="bidirectional"')) ?? ""
  expect(getDirectionSymbolLength(bidirectionalPinSvg)).toBe(9)
  expect([...new Set(getPinDesignatorOffsetsFromBody(memorySvg))]).toEqual([
    7.425,
  ])

  const gatePins = getComponentPins(sheet13, "U57")
  const gateSvg = renderPins(gatePins)
  expect(countPinDirections(gateSvg, "input")).toBe(2)
  expect(countPinDirections(gateSvg, "output")).toBe(1)
  const gateWithoutDirections = serializeAltiumSheetToSvg(gatePins, {
    showBorder: false,
    showPinDirections: false,
  })
  expect(gateWithoutDirections).not.toContain(
    'class="altium-schematic-pin-direction-symbol"',
  )

  const regulatorSvg = renderPins(getComponentPins(sheet14, "U121"))
  expect(countPinDirections(regulatorSvg, "input")).toBe(1)
  expect(countPinDirections(regulatorSvg, "output")).toBe(5)
  expect([...new Set(getPinDesignatorOffsetsFromBody(regulatorSvg))]).toEqual([
    7.425,
  ])
})

test("renders electrical directions with an inner-edge clock symbol", async () => {
  const sheet33 = parseAltiumSchDoc(
    await readReferenceBytes("ti-tmds62levm-rev-b/33.SchDoc"),
  )
  const ethernetPhySvg = renderPins(getComponentPins(sheet33, "U71"))

  expect(countPinDirections(ethernetPhySvg, "input")).toBe(3)
  expect(countPinDirections(ethernetPhySvg, "bidirectional")).toBe(4)
  expect(countPinDirections(ethernetPhySvg, "output")).toBe(3)
  expect(ethernetPhySvg).toContain('class="altium-schematic-pin-clock-symbol"')
  const jtagClockPinSvg =
    ethernetPhySvg
      .split("\n")
      .find(
        (line) =>
          line.includes('data-record="2"') && line.includes(">20</text>"),
      ) ?? ""
  expect(jtagClockPinSvg).toContain(
    'class="altium-schematic-pin-direction-symbol"',
  )
  expect(jtagClockPinSvg).toContain('class="altium-schematic-pin-clock-symbol"')
  expect(getDirectionSymbolLength(jtagClockPinSvg)).toBe(7)
})
