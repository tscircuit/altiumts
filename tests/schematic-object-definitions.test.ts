import { expect, test } from "bun:test"
import {
  AltiumSchObjectDefinitionRecord,
  parseAltiumSchDoc,
  serializeAltiumSchDocToBinary,
  serializeAltiumSheetToSvg,
} from "../lib"

test("round-trips native custom power graphics separately from electrical sheet records", () => {
  const id = "{A668A77B-9D4D-4B22-9AC8-3D328B8FB4F1}"
  const source = `|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0\n|RECORD=31|FONTIDCOUNT=1|FONTNAME1=Arial|SIZE1=4\n|RECORD=17|LOCATION.X=100|LOCATION.Y=100|STYLE=2|ORIENTATION=1|SHOWNETNAME=T|TEXT=VDD|FONTID=1|COLOR=136|ObjectDefinitionId=${id}`
  const definitions = [
    `|RECORD=129|ObjectDefinitionId=${id}|LibReference=HairlinePowerBar|PartCount=2|CurrentPartId=1|OwnerPartId=-1`,
    "|RECORD=13|OwnerIndex=0|OwnerPartId=-1|Location.X=0|Location.Y=0|Corner.X=10|Corner.Y=0|LineWidth=0|Color=136",
    "|RECORD=13|OwnerIndex=0|OwnerPartId=-1|Location.X=10|Location.Y=-5|Corner.X=10|Corner.Y=5|LineWidth=0|Color=136|UnknownField=retained|UnknownField=again",
  ]
  const bytes = serializeAltiumSchDocToBinary(source, {
    objectDefinitionRecords: definitions,
  })
  const document = parseAltiumSchDoc(bytes)
  expect(document.getBytes()).toEqual(bytes)
  expect(document.records).toHaveLength(2)
  expect(document.powerPorts[0]!.text).toBe("VDD")
  expect(document.objectDefinitionRecords[1]).toBeInstanceOf(
    AltiumSchObjectDefinitionRecord,
  )
  expect(document.objectDefinitionRecords[1]!.sourceLocation?.streamPath).toBe(
    "/ObjectDefinitions",
  )
  expect(document.getObjectDefinitionGraphics(id.toLowerCase())).toHaveLength(2)
  expect(document.getObjectDefinitionGraphics("absent")).toBeUndefined()
  expect(document.objectDefinitionRecords[3]!.getString()).toContain(
    "|UnknownField=retained|UnknownField=again",
  )
  expect(
    new TextDecoder().decode(
      document.compoundFile!.getStream("/FileHeader")!.content,
    ),
  ).toContain(`|ObjectDefinitionId=${id}`)
  const svg = serializeAltiumSheetToSvg(document)
  expect(svg.match(/vector-effect="non-scaling-stroke"/g)).toHaveLength(2)
  expect(svg).toContain("rotate(-90)")
  expect(svg).toContain(">VDD</text>")
  document.objectDefinitionRecords[2]!.set("Color", "255")
  expect(() => document.getBytes()).toThrow(
    "Modified binary schematic documents",
  )
})
