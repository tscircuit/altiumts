import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
  serializeAltiumPcbToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("resolves PCB component designator and comment special strings", () => {
  const source = [
    "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=100mil|VY1=0mil|VX2=100mil|VY2=100mil|VX3=0mil|VY3=100mil|VX4=0mil|VY4=0mil",
    "|RECORD=Component|ID=7|SOURCEDESIGNATOR=J1|SOURCEDESCRIPTION=Connector description",
    "|RECORD=Text|COMPONENT=7|LAYER=TOPOVERLAY|X=25mil|Y=90mil|HEIGHT=10mil|TEXT=J1_A|DESIGNATOR=TRUE",
    "|RECORD=Text|COMPONENT=7|LAYER=TOPOVERLAY|X=25mil|Y=75mil|HEIGHT=10mil|TEXT=Connector|COMMENT=TRUE",
    "|RECORD=Text|COMPONENT=7|LAYER=MECHANICAL7|X=25mil|Y=25mil|HEIGHT=10mil|TEXT=.Designator",
    "|RECORD=Text|COMPONENT=7|LAYER=MECHANICAL7|X=25mil|Y=50mil|HEIGHT=10mil|TEXT=.Comment",
    "|RECORD=Component|ID=8|SOURCEDESCRIPTION=Not a component comment",
    "|RECORD=Text|COMPONENT=8|LAYER=MECHANICAL7|X=75mil|Y=50mil|HEIGHT=10mil|TEXT=.Comment",
  ].join("\r\n")

  const svg = serializeAltiumPcbToSvg(parseAltiumPcbDoc(source))

  expect(svg.match(/>J1_A<\/text>/g)).toHaveLength(2)
  expect(svg.match(/>Connector<\/text>/g)).toHaveLength(2)
  expect(svg).not.toContain("Connector description")
  expect(svg).not.toContain("Not a component comment")
  expect(svg).not.toContain(".Designator")
  expect(svg).not.toContain(".Comment")
})

test("resolves PCB comment special strings from real Altium data", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const capacitor = document.components.find(
    (component) => component.designator === "C6",
  )
  const svg = serializeAltiumPcbToSvg(document, {
    layers: ["MECHANICAL6"],
  })

  expect(capacitor?.getDecoded("COMMENT")).toBeUndefined()
  expect(capacitor?.comment).toBeUndefined()
  expect(capacitor?.getDecoded("SOURCEDESCRIPTION")).toBe("Cap Ceramic 10%")
  expect(svg).toContain(">CL21B105KAFNNNE</text>")
  expect(svg).toContain(">R3_I3</text>")
  expect(svg.toLowerCase()).not.toContain(">.comment</text>")
}, 20_000)
