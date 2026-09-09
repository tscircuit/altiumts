import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"

test("reproduces a component designator on Mechanical 7", async () => {
  const document = parseAltiumPcbDoc(
    [
      "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=1000mil|VY1=0mil|VX2=1000mil|VY2=700mil|VX3=0mil|VY3=700mil|VX4=0mil|VY4=0mil",
      "|RECORD=Component|ID=0|LAYER=TOP|X=500mil|Y=350mil|SOURCEDESIGNATOR=U7|NAMEON=TRUE",
      "|RECORD=Fill|LAYER=TOPOVERLAY|COMPONENT=0|X1=350mil|Y1=250mil|X2=650mil|Y2=450mil",
      "|RECORD=Text|LAYER=MECHANICAL7|COMPONENT=0|DESIGNATOR=TRUE|X=500mil|Y=500mil|HEIGHT=80mil|JUSTIFICATION=5|TEXT=.Designator",
    ].join("\n"),
  )

  const svg = serializeAltiumPcbToSvg(document, {
    title: "Mechanical 7 component designator repro",
  })

  expect(svg).toContain('data-layer="MECHANICAL7"')
  expect(svg).toContain(".Designator</text>")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
