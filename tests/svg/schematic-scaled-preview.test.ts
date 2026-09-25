import { expect, test } from "bun:test"
import sharp from "sharp"
import {
  parseAltiumSchDoc,
  serializeAltiumSchDocToBinary,
  serializeAltiumSheetToSvg,
} from "../../lib"

// Converted TI TPS61288 board, circuit-json-to-altium commit 6adb119.
// Exact SchDoc used for native Viewer verification; render without re-exporting.
test("renders the real scaled TI board without changing its native content", async () => {
  const bytes = await Bun.file(
    new URL("../fixtures/ti-tps61288-scaled-schematic.SchDoc", import.meta.url),
  ).bytes()
  const doc = parseAltiumSchDoc(bytes)
  const svg = serializeAltiumSheetToSvg(doc, { width: 1400, showBorder: false })
  expect(doc.pins).toHaveLength(145)
  expect(doc.powerPorts).toHaveLength(21)
  expect(doc.getBytes()).toEqual(bytes)
  // Geometry and text retain the native values; only device hairlines depend
  // on output pixels, not on how many schematic units fit on the paper.
  expect(svg).toContain('width="133" height="160"')
  expect(svg).toContain('font-size="10"')
  expect(svg).not.toContain('vector-effect="non-scaling-stroke"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})

test("hairlines stay one output pixel at different document scales and aspect ratios", async () => {
  for (const scale of [1, 10 / 3]) {
    for (const [width, height] of [
      [200, 100],
      [100, 200],
    ]) {
      const svg = serializeAltiumSheetToSvg(
        parseAltiumSchDoc(
          [
            `|RECORD=31|USECUSTOMSHEET=T|CUSTOMX=${Math.round(200 * scale)}|CUSTOMY=${Math.round(100 * scale)}|AREACOLOR=16777215`,
            `|RECORD=27|LINEWIDTH=0|COLOR=0|LOCATIONCOUNT=2|X1=0|Y1=${Math.round(50 * scale)}|X2=${Math.round(200 * scale)}|Y2=${Math.round(50 * scale)}`,
          ].join("\n"),
        ),
        { width, height, margin: 0, showBorder: false },
      )
      const viewBox = svg
        .match(/viewBox="([^"]+)"/)![1]!
        .split(" ")
        .map(Number)
      const fit = Math.min(width! / viewBox[2]!, height! / viewBox[3]!)
      const stroke = Number(svg.match(/stroke-width="([^"]+)"/)![1])
      expect(stroke * fit).toBeCloseTo(1, 4)
      const { data, info } = await sharp(Buffer.from(svg))
        .flatten({ background: "white" })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
      let coverage = 0
      for (let y = 0; y < info.height; y++) {
        coverage +=
          1 -
          data[(y * info.width + Math.floor(info.width / 2)) * info.channels]! /
            255
      }
      expect(coverage).toBeCloseTo(1, 1)
    }
  }
})

test("custom power labels follow visible symbol bounds in every orientation", () => {
  for (const [kind, primitive, rightEdge] of [
    [
      "bar",
      "|RECORD=13|LOCATION.X=0|CORNER.X=33|CORNER.X_FRAC=33333|LOCATION.Y=0|CORNER.Y=0",
      100 / 3,
    ],
    [
      "ground",
      "|RECORD=13|LOCATION.X=40|CORNER.X=40|LOCATION.Y=-7|CORNER.Y=7",
      40,
    ],
    ["circle", "|RECORD=8|LOCATION.X=30|LOCATION.Y=0|RADIUS=10", 40],
    [
      "polygon",
      "|RECORD=7|LOCATIONCOUNT=3|X1=0|Y1=0|X2=35|Y2=7|X3=35|Y3=-7",
      35,
    ],
  ] as const) {
    for (const orientation of [0, 1, 2, 3]) {
      const doc = parseAltiumSchDoc(
        serializeAltiumSchDocToBinary(
          `|RECORD=31|USECUSTOMSHEET=T|CUSTOMX=200|CUSTOMY=200|FONTIDCOUNT=1|SIZE1=12|FONTNAME1=Arial\n|RECORD=17|LOCATION.X=100|LOCATION.Y=100|STYLE=2|FONTID=1|ORIENTATION=${orientation}|TEXT=${kind}|ObjectDefinitionId=custom`,
          {
            objectDefinitionRecords: [
              "|RECORD=129|ObjectDefinitionId=custom|CurrentPartId=1|DisplayMode=0",
              `${primitive}|OwnerIndex=0|OwnerPartId=1|LineWidth=0`,
              // Hidden parts must not push the label away from the visible symbol.
              "|RECORD=13|OwnerIndex=0|OwnerPartId=2|Location.X=0|Corner.X=900|Location.Y=0|Corner.Y=0|LineWidth=0",
            ],
          },
        ),
      )
      const svg = serializeAltiumSheetToSvg(doc, {
        margin: 0,
        showBorder: false,
      })
      const label = svg.match(/<text x="([^"]+)" y="([^"]+)"[^>]*>/)!
      const [dx, dy] = [
        [1, 0],
        [0, -1],
        [-1, 0],
        [0, 1],
      ][orientation]!
      expect(Number(label[1])).toBeCloseTo(100 + dx! * (rightEdge + 2), 3)
      expect(Number(label[2])).toBeCloseTo(100 + dy! * (rightEdge + 2), 3)
      expect(label[0]).toContain('font-size="12"')
    }
  }
})
