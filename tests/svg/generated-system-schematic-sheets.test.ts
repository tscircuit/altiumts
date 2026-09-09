import { expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import {
  parseAltiumPrjPcb,
  parseAltiumSchDoc,
  serializeAltiumSheetToSvg,
  validateAltiumDocument,
} from "../../lib"
import { parseBrowserProjectFiles } from "../../site/src/parse-project"

interface SheetSpec {
  componentCount: number
  filename: string
  recordCount: number
  sheetSymbolCount: number
  snapshotName: string
  title: string
}

const fixtureDir = resolve(
  import.meta.dir,
  "..",
  "fixtures",
  "generated-system",
)

const sheets: SheetSpec[] = [
  {
    componentCount: 0,
    filename: "GeneratedSystem.SchDoc",
    recordCount: 22,
    sheetSymbolCount: 7,
    snapshotName: "sheet-top",
    title: "GeneratedSystem top sheet",
  },
  {
    componentCount: 12,
    filename: "GeneratedSystem-01.SchDoc",
    recordCount: 223,
    sheetSymbolCount: 0,
    snapshotName: "sheet-01",
    title: "GeneratedSystem-01 TCAN1042 CAN Interface",
  },
  {
    componentCount: 17,
    filename: "GeneratedSystem-02.SchDoc",
    recordCount: 331,
    sheetSymbolCount: 0,
    snapshotName: "sheet-02",
    title: "GeneratedSystem-02 TIDA-00356 Lamp Driver",
  },
  {
    componentCount: 4,
    filename: "GeneratedSystem-03.SchDoc",
    recordCount: 75,
    sheetSymbolCount: 0,
    snapshotName: "sheet-03",
    title: "GeneratedSystem-03 TIDA-01539 Ambient Light Sensors",
  },
  {
    componentCount: 10,
    filename: "GeneratedSystem-04.SchDoc",
    recordCount: 166,
    sheetSymbolCount: 0,
    snapshotName: "sheet-04",
    title: "GeneratedSystem-04 MSPM0G3507 Microcontroller",
  },
  {
    componentCount: 14,
    filename: "GeneratedSystem-05.SchDoc",
    recordCount: 282,
    sheetSymbolCount: 0,
    snapshotName: "sheet-05",
    title: "GeneratedSystem-05 TIDA-01539 Electrochromic Mirror Driver",
  },
  {
    componentCount: 13,
    filename: "GeneratedSystem-06.SchDoc",
    recordCount: 235,
    sheetSymbolCount: 0,
    snapshotName: "sheet-06",
    title: "GeneratedSystem-06 LM74202 and TPS7E81-Q1 Power Supply",
  },
  {
    componentCount: 3,
    filename: "GeneratedSystem-07.SchDoc",
    recordCount: 39,
    sheetSymbolCount: 0,
    snapshotName: "sheet-07",
    title: "GeneratedSystem-07 LM50HV-Q1 Temperature Sensor",
  },
]

for (const sheet of sheets) {
  test(`renders GeneratedSystem schematic sheet ${sheet.filename}`, async () => {
    const source = new Uint8Array(
      await readFile(resolve(fixtureDir, sheet.filename)),
    )
    const document = parseAltiumSchDoc(source)
    const validation = validateAltiumDocument(document, {
      profile: "strict",
    })
    const svg = serializeAltiumSheetToSvg(document, {
      title: sheet.title,
    })

    expect(document.records.length).toBe(sheet.recordCount)
    expect(document.components.length).toBe(sheet.componentCount)
    expect(
      document.records.filter((record) => record.recordKind === "15").length,
    ).toBe(sheet.sheetSymbolCount)

    expect(document.getBytes()).toEqual(source)
    expect(validation.valid).toBe(true)
    expect(validation.summary).toEqual({
      errors: 0,
      fatals: 0,
      warnings: 0,
    })

    expect(svg).toContain('class="altium-sheet"')
    expect(svg).toContain('data-record="SheetBorder"')
    expect(svg).toContain('clip-path="url(#altium-sheet-paper)"')

    await expect(svg).toMatchSvgSnapshot(import.meta.path, sheet.snapshotName)
  })
}

test("parses the GeneratedSystem project manifest referencing all documents", async () => {
  const projectText = await readFile(
    resolve(fixtureDir, "GeneratedSystem.PrjPcb"),
    "utf-8",
  )
  const project = parseAltiumPrjPcb(projectText)
  expect(project.documents).toHaveLength(9)
  expect(project.documents[0]?.path).toBe("GeneratedSystem.PcbDoc")
  expect(project.documents[0]?.kind).toBe("pcb-document")

  for (let index = 0; index < sheets.length; index += 1) {
    expect(project.documents[index + 1]?.path).toBe(sheets[index]?.filename)
    expect(project.documents[index + 1]?.kind).toBe("schematic-document")
  }
})

test("opens the GeneratedSystem ZIP archive and indexes the PCB and all schematic sheets", async () => {
  const zipBytes = await readFile(resolve(fixtureDir, "generated-system.zip"))
  const arrayBuffer = zipBytes.buffer.slice(
    zipBytes.byteOffset,
    zipBytes.byteOffset + zipBytes.byteLength,
  )
  const state = parseBrowserProjectFiles([
    {
      bytes: arrayBuffer,
      path: "GeneratedSystem.altium-project.zip",
    },
  ])

  expect(state.manifest.name).toBe("GeneratedSystem")
  expect(state.manifest.failures).toEqual([])
  expect(state.manifest.documents).toHaveLength(9)

  const pcbDoc = state.manifest.documents.find((doc) => doc.kind === "pcb")
  expect(pcbDoc).toBeDefined()
  expect(pcbDoc?.name).toBe("GeneratedSystem.PcbDoc")

  const schematicDocs = state.manifest.documents.filter(
    (doc) => doc.kind === "schematic",
  )
  expect(schematicDocs).toHaveLength(8)
  expect(schematicDocs.map((doc) => doc.name)).toEqual(
    sheets.map((sheet) => sheet.filename),
  )
})
