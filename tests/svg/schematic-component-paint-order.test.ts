import { expect, test } from "bun:test"
import { parseAltiumAscii, serializeAltiumSheetToSvg } from "../../lib"

test("renders opaque schematic component graphics behind pins", () => {
  const source = [
    "|RECORD=31|CUSTOMX=140|CUSTOMY=100",
    "|RECORD=1|LOCATION.X=70|LOCATION.Y=50",
    "|RECORD=2|OWNERINDEX=1|PINCONGLOMERATE=58|PINLENGTH=20|LOCATION.X=40|LOCATION.Y=50|NAME=INPUT|DESIGNATOR=1",
    "|RECORD=6|OWNERINDEX=1|LOCATIONCOUNT=2|X1=60|Y1=40|X2=80|Y2=60",
    "|RECORD=7|OWNERINDEX=1|LOCATIONCOUNT=3|X1=40|Y1=30|X2=100|Y2=30|X3=70|Y3=70|ISSOLID=T|AREACOLOR=16777136",
    "|RECORD=8|OWNERINDEX=1|LOCATION.X=70|LOCATION.Y=50|RADIUS=30|SECONDARYRADIUS=20|ISSOLID=T|AREACOLOR=16777136",
    "|RECORD=10|OWNERINDEX=1|LOCATION.X=40|LOCATION.Y=30|CORNER.X=100|CORNER.Y=70|ISSOLID=T|AREACOLOR=16777136",
    "|RECORD=14|OWNERINDEX=1|LOCATION.X=40|LOCATION.Y=30|CORNER.X=100|CORNER.Y=70|ISSOLID=T|AREACOLOR=16777136",
    "|RECORD=34|OWNERINDEX=1|LOCATION.X=40|LOCATION.Y=75|TEXT=U1",
  ].join("\n")

  const svg = serializeAltiumSheetToSvg(parseAltiumAscii(source), {
    title: "Schematic component paint order",
  })
  const pinIndex = svg.indexOf('<g data-record="2">')
  const lineIndex = svg.indexOf('<polyline data-record="6"')
  const designatorIndex = svg.indexOf('<text data-record="34"')

  for (const selector of [
    '<polygon data-record="7"',
    '<ellipse data-record="8"',
    '<rect data-record="10"',
    '<rect data-record="14"',
  ]) {
    const bodyIndex = svg.indexOf(selector)
    expect(bodyIndex).toBeGreaterThan(-1)
    expect(pinIndex).toBeGreaterThan(bodyIndex)
  }
  expect(lineIndex).toBeGreaterThan(pinIndex)
  expect(designatorIndex).toBeGreaterThan(lineIndex)
  expect(svg).toContain(">INPUT</text>")
})

test("preserves transparent component graphic order", () => {
  const source = [
    "|RECORD=31|CUSTOMX=140|CUSTOMY=100",
    "|RECORD=1|LOCATION.X=70|LOCATION.Y=50",
    "|RECORD=2|OWNERINDEX=1|PINCONGLOMERATE=58|PINLENGTH=20|LOCATION.X=40|LOCATION.Y=50|NAME=INPUT|DESIGNATOR=1",
    "|RECORD=14|OWNERINDEX=1|LOCATION.X=40|LOCATION.Y=30|CORNER.X=100|CORNER.Y=70|ISSOLID=F",
  ].join("\n")

  const svg = serializeAltiumSheetToSvg(parseAltiumAscii(source))
  expect(svg.indexOf('<rect data-record="14"')).toBeGreaterThan(
    svg.indexOf('<g data-record="2">'),
  )
})

test("preserves outline-only polygon paint order", () => {
  const source = [
    "|RECORD=31|CUSTOMX=140|CUSTOMY=100",
    "|RECORD=1|LOCATION.X=70|LOCATION.Y=50",
    "|RECORD=2|OWNERINDEX=1|PINCONGLOMERATE=58|PINLENGTH=20|LOCATION.X=40|LOCATION.Y=50|NAME=INPUT|DESIGNATOR=1",
    "|RECORD=7|OWNERINDEX=1|LOCATIONCOUNT=3|X1=40|Y1=30|X2=100|Y2=30|X3=70|Y3=70|ISSOLID=F|AREACOLOR=16777136",
  ].join("\n")

  const svg = serializeAltiumSheetToSvg(parseAltiumAscii(source))
  const pinIndex = svg.indexOf('<g data-record="2">')
  const polygonIndex = svg.indexOf('<polygon data-record="7"')

  expect(polygonIndex).toBeGreaterThan(pinIndex)
  expect(svg.slice(polygonIndex, svg.indexOf("/>", polygonIndex))).toContain(
    'fill="none"',
  )
})
