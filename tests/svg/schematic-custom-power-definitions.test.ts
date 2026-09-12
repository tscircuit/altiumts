import { expect, test } from "bun:test"
import {
  parseAltiumSchDoc,
  serializeAltiumSchDocToBinary,
  serializeAltiumSheetToSvg,
} from "../../lib"
import {
  customPowerDefinitions,
  customPowerSheet,
  powerDefinitionIds,
} from "../fixtures/custom-power-definitions"

test("renders native custom power hairlines at all four orientations", async () => {
  const bytes = await Bun.file(
    new URL("../fixtures/native-custom-power-symbols.SchDoc", import.meta.url),
  ).bytes()
  expect(
    serializeAltiumSchDocToBinary(customPowerSheet, {
      objectDefinitionRecords: customPowerDefinitions,
    }),
  ).toEqual(bytes)
  const document = parseAltiumSchDoc(bytes)
  const svg = serializeAltiumSheetToSvg(document, {
    width: 900,
    height: 540,
    margin: 0,
    showBorder: false,
  })
  expect(
    svg.match(/<line data-record="13" vector-effect="non-scaling-stroke"/g),
  ).toHaveLength(24)
  for (const angle of [0, -90, -180, -270]) {
    expect(svg.match(new RegExp(`rotate\\(${angle}\\)`, "g"))).toHaveLength(2)
  }
  expect(svg.match(/>VDD<\/text>/g)).toHaveLength(4)
  expect(svg.match(/>GND<\/text>/g)).toHaveLength(4)
  expect(svg.match(/font-size="4"/g)).toHaveLength(8)
  expect(document.getBytes()).toEqual(bytes)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})

test("renders definition primitives independently of the power-port name and style", () => {
  const id = "custom-polygon"
  const sheet = `|RECORD=31|FONTIDCOUNT=1|FONTNAME1=Arial|SIZE1=4\n|RECORD=17|LOCATION.X=40|LOCATION.Y=30|STYLE=2|TEXT=OTHER_NET|FONTID=1|ObjectDefinitionId=${id}`
  const document = parseAltiumSchDoc(
    serializeAltiumSchDocToBinary(sheet, {
      objectDefinitionRecords: [
        `|RECORD=129|ObjectDefinitionId=${id}|OwnerPartId=-1`,
        "|RECORD=7|OwnerIndex=0|OwnerPartId=-1|LocationCount=3|X1=0|Y1=0|X2=10|Y2=5|X3=10|Y3=-5|LineWidth=0|Color=255|AreaColor=255|IsSolid=T",
      ],
    }),
  )
  const svg = serializeAltiumSheetToSvg(document)
  expect(svg).toContain('data-record="7" vector-effect="non-scaling-stroke"')
  expect(svg).toContain('points="0,0 10,-5 10,5" fill="#ff0000"')
  expect(svg).toContain(">OTHER_NET</text>")
})

test("distinguishes missing and intentionally empty custom definitions", () => {
  const sheet = customPowerSheet.replaceAll("SHOWNETNAME=T", "SHOWNETNAME=F")
  const fallback = serializeAltiumSheetToSvg(
    parseAltiumSchDoc(serializeAltiumSchDocToBinary(sheet)),
    { showBorder: false },
  )
  const empty = serializeAltiumSheetToSvg(
    parseAltiumSchDoc(
      serializeAltiumSchDocToBinary(sheet, {
        objectDefinitionRecords: [
          customPowerDefinitions[0],
          customPowerDefinitions[3],
        ],
      }),
    ),
    { showBorder: false },
  )
  expect(fallback.match(/<path /g)).toHaveLength(8)
  expect(empty).not.toContain("<path ")
  expect(empty).not.toContain("<text ")
  expect(empty).not.toContain(powerDefinitionIds.bar)
})

test("renders only the active part of a custom power definition", () => {
  const sheet = `|RECORD=31\n|RECORD=17|LOCATION.X=50|LOCATION.Y=50|STYLE=2|SHOWNETNAME=F|ObjectDefinitionId=parts`
  const document = parseAltiumSchDoc(
    serializeAltiumSchDocToBinary(sheet, {
      objectDefinitionRecords: [
        "|RECORD=129|ObjectDefinitionId=parts|CurrentPartId=2|DisplayMode=0",
        "|RECORD=13|OwnerIndex=0|OwnerPartId=1|Location.X=0|Location.Y=0|Corner.X=4|Corner.Y=0|LineWidth=0|Color=255",
        "|RECORD=13|OwnerIndex=0|OwnerPartId=2|Location.X=0|Location.Y=0|Corner.X=8|Corner.Y=0|LineWidth=0|Color=16711680",
      ],
    }),
  )
  const svg = serializeAltiumSheetToSvg(document, { showBorder: false })
  expect(svg.match(/<line data-record="13"/g)).toHaveLength(1)
  expect(svg).toContain('x2="8" y2="0" stroke="#0000ff"')
  expect(svg).not.toContain('stroke="#ff0000"')
})
