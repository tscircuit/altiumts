import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"

test("resolves PCB component designator and comment special strings", () => {
  const source = [
    "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=100mil|VY1=0mil|VX2=100mil|VY2=100mil|VX3=0mil|VY3=100mil|VX4=0mil|VY4=0mil",
    "|RECORD=Component|ID=7|SOURCEDESIGNATOR=J1|SOURCECOMMENT=Connector",
    "|RECORD=Text|COMPONENT=7|LAYER=MECHANICAL7|X=25mil|Y=25mil|HEIGHT=10mil|TEXT=.Designator",
    "|RECORD=Text|COMPONENT=7|LAYER=MECHANICAL7|X=25mil|Y=50mil|HEIGHT=10mil|TEXT=.Comment",
  ].join("\r\n")

  const svg = serializeAltiumPcbToSvg(parseAltiumPcbDoc(source))

  expect(svg).toContain(">J1</text>")
  expect(svg).toContain(">Connector</text>")
  expect(svg).not.toContain(".Designator")
  expect(svg).not.toContain(".Comment")
})
