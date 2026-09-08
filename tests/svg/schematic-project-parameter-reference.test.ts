import { expect, test } from "bun:test"
import {
  parseAltiumPrjPcb,
  parseAltiumSchDoc,
  resolveSchematicParameterReferenceWithContext,
  serializeAltiumSheetToSvg,
} from "../../lib"

test("renders schematic project and document-name references", async () => {
  const project = parseAltiumPrjPcb(
    [
      "[Parameter1]",
      "Name=ProjectRevision",
      "Value=v3.3",
      "[Parameter2]",
      "Name=ProjectDrawnBy",
      "Value=Bruno Almeida",
    ].join("\n"),
  )
  const document = parseAltiumSchDoc(
    [
      "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
      "|RECORD=31|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Arial|CUSTOMX=320|CUSTOMY=170",
      "|RECORD=4|LOCATION.X=20|LOCATION.Y=140|FONTID=1|TEXT==DocumentName",
      "|RECORD=4|LOCATION.X=20|LOCATION.Y=110|FONTID=1|TEXT==ProjectName",
      "|RECORD=4|LOCATION.X=20|LOCATION.Y=80|FONTID=1|TEXT==ProjectRevision",
      "|RECORD=4|LOCATION.X=20|LOCATION.Y=50|FONTID=1|TEXT==ProjectDrawnBy",
      "|RECORD=4|LOCATION.X=160|LOCATION.Y=140|FONTID=1|TEXT==CurrentDate",
      "|RECORD=4|LOCATION.X=160|LOCATION.Y=110|FONTID=1|TEXT==CurrentTime",
      "|RECORD=4|LOCATION.X=20|LOCATION.Y=20|FONTID=1|TEXT==UnavailableParameter",
    ].join("\n"),
  )
  const parameterContext = {
    currentDate: "2026-09-08",
    currentTime: "14:30",
    document,
    documentName: "systems_pcb.SchDoc",
    project,
    projectName: "systems_pcb.PrjPCB",
  }
  const svg = serializeAltiumSheetToSvg(document, {
    currentDate: parameterContext.currentDate,
    currentTime: parameterContext.currentTime,
    documentName: parameterContext.documentName,
    project,
    projectName: parameterContext.projectName,
    title: "Schematic project parameter references",
  })

  expect(
    resolveSchematicParameterReferenceWithContext({
      ...parameterContext,
      reference: "=ProjectRevision",
    }),
  ).toBe("v3.3")
  expect(svg).toContain(">systems_pcb.SchDoc</text>")
  expect(svg).toContain(">systems_pcb.PrjPCB</text>")
  expect(svg).toContain(">v3.3</text>")
  expect(svg).toContain(">Bruno Almeida</text>")
  expect(svg).toContain(">2026-09-08</text>")
  expect(svg).toContain(">14:30</text>")
  expect(svg).toContain(">=UnavailableParameter</text>")
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
