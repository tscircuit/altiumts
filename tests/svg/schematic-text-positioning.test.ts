import { expect, test } from "bun:test"
import { parseAltiumAscii, serializeAltiumSheetToSvg } from "../../lib"

test("renders Altium text orientation and justification without font rotation", async () => {
  const source = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31|FONTIDCOUNT=1|SIZE1=14|ROTATION1=90|FONTNAME1=Arial|CUSTOMX=200|CUSTOMY=160",
    "|RECORD=25|Location.X=20|Location.Y=130|FontID=1|Orientation=0|Justification=0|Text=Right",
    "|RECORD=25|Location.X=60|Location.Y=100|FontID=1|Orientation=1|Justification=0|Text=Up",
    "|RECORD=25|Location.X=100|Location.Y=70|FontID=1|Orientation=2|Justification=0|Text=Left",
    "|RECORD=25|Location.X=140|Location.Y=40|FontID=1|Orientation=3|Justification=0|Text=Down",
    "|RECORD=4|Location.X=180|Location.Y=20|FontID=1|Orientation=0|Justification=8|Text=Top right",
  ].join("\n")
  const svg = serializeAltiumSheetToSvg(parseAltiumAscii(source), {
    title: "Altium schematic text positioning",
  })

  expect(svg).toContain('font-size="19.4444"')
  expect(svg).toContain(
    'text-anchor="start" dominant-baseline="text-after-edge"',
  )
  expect(svg).toContain('text-anchor="end" dominant-baseline="text-after-edge"')
  expect(svg).toContain(
    'text-anchor="end" dominant-baseline="text-before-edge"',
  )
  expect(svg).toContain("rotate(-90)")
  expect(svg).not.toContain("rotate(-180)")
  expect(svg).not.toContain("rotate(90)")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})

test("renders only the active component part and decodes pin orientation flags", () => {
  const source = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31|CUSTOMX=200|CUSTOMY=160",
    "|RECORD=1|CurrentPartId=2|Location.X=100|Location.Y=100",
    "|RECORD=14|OwnerIndex=1|OwnerPartId=1|Location.X=10|Location.Y=10|Corner.X=30|Corner.Y=30|IsSolid=T",
    "|RECORD=14|OwnerIndex=1|OwnerPartId=2|Location.X=80|Location.Y=60|Corner.X=120|Corner.Y=100|IsSolid=T",
    "|RECORD=2|OwnerIndex=1|OwnerPartId=1|PinConglomerate=58|PinLength=30|Location.X=80|Location.Y=70|Name=INACTIVE|Designator=A1",
    "|RECORD=2|OwnerIndex=1|OwnerPartId=2|PinConglomerate=58|PinLength=30|Location.X=80|Location.Y=80|Name=ACTIVE|Designator=B2",
  ].join("\n")
  const svg = serializeAltiumSheetToSvg(parseAltiumAscii(source))

  expect(svg).not.toContain("INACTIVE")
  expect(svg).not.toContain("A1")
  expect(svg).toContain("ACTIVE")
  expect(svg).toContain("B2")
  expect(svg.match(/data-record="14"/gu)).toHaveLength(1)
  expect(svg).toContain('x1="87" y1="87" x2="57" y2="87"')
})
