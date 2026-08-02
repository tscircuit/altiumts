import { expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { zipSync } from "fflate"
import { createBugReportUrl } from "../site/src/bug-report"
import {
  expandBrowserProjectFiles,
  parseBrowserProjectFiles,
  renderProjectDocument,
} from "../site/src/parse-project"
import type { BrowserProjectFile } from "../site/src/project-viewer-types"

const referencesDirectory = resolve(import.meta.dir, "..", "references")

test("opens loose schematic and PCB files and renders their SVG views", async () => {
  const files = await Promise.all([
    readReferenceFile("sample-schematic-sheet.SchDoc", "Demo/sheet.SchDoc"),
    readReferenceFile("sample-board-design.PcbDoc", "Demo/board.PcbDoc"),
  ])

  const state = parseBrowserProjectFiles(files)
  expect(state.manifest.name).toBe("Demo")
  expect(state.manifest.failures).toEqual([])
  expect(state.manifest.documents.map(({ kind }) => kind)).toEqual([
    "schematic",
    "pcb",
  ])

  const schematic = state.manifest.documents[0]
  const pcb = state.manifest.documents[1]
  expect(schematic?.views).toEqual([{ id: "sheet", label: "Schematic sheet" }])
  expect(pcb?.views.some(({ id }) => id === "board")).toBeTrue()
  expect(pcb?.views.some(({ layer }) => layer === "TOP")).toBeTrue()

  if (!schematic || !pcb) {
    throw new Error("Expected both schematic and PCB documents")
  }

  const schematicSvg = renderProjectDocument(state, schematic.id, "sheet")
  const boardSvg = renderProjectDocument(state, pcb.id, "board")
  const topLayer = pcb.views.find(({ layer }) => layer === "TOP")
  if (!topLayer) throw new Error("Expected a top copper layer view")
  const topLayerSvg = renderProjectDocument(state, pcb.id, topLayer.id)

  expect(schematicSvg).toStartWith("<svg")
  expect(schematicSvg).toContain("Schematic sheet")
  expect(boardSvg).toStartWith("<svg")
  expect(boardSvg).toContain("Complete board")
  expect(topLayerSvg).toStartWith("<svg")
  expect(topLayerSvg).toContain("Top copper")
})

test("uses project references to order uploaded documents", async () => {
  const project = new TextEncoder().encode(
    [
      "[Design]",
      "ProjectName=Viewer fixture",
      "[Document1]",
      "DocumentPath=boards\\main.PcbDoc",
      "DocumentUniqueId=PCB-1",
      "[Document2]",
      "DocumentPath=schematics\\main.SchDoc",
      "DocumentUniqueId=SCH-1",
      "[Variant1]",
      "VariantName=Production",
      "",
    ].join("\r\n"),
  )
  const files = await Promise.all([
    readReferenceFile(
      "sample-schematic-sheet.SchDoc",
      "Viewer/schematics/main.SchDoc",
    ),
    readReferenceFile(
      "sample-board-design.PcbDoc",
      "Viewer/boards/main.PcbDoc",
    ),
  ])
  files.push({
    bytes: toArrayBuffer(project),
    path: "Viewer/Main.PrjPcb",
  })

  const { manifest } = parseBrowserProjectFiles(files)
  expect(manifest.name).toBe("Main")
  expect(manifest.projects).toHaveLength(1)
  expect(manifest.projects[0]?.variantNames).toEqual(["Production"])
  expect(
    manifest.projects[0]?.documents.every(({ documentId }) => documentId),
  ).toBeTrue()
  expect(manifest.documents.map(({ kind }) => kind)).toEqual([
    "pcb",
    "schematic",
  ])
})

test("expands a ZIP project entirely in memory", async () => {
  const schematicBytes = new Uint8Array(
    await readFile(
      resolve(referencesDirectory, "sample-schematic-sheet.SchDoc"),
    ),
  )
  const archive = zipSync({
    ".DS_Store": new TextEncoder().encode("ignored"),
    "Project/main.SchDoc": schematicBytes,
    "Project/readme.txt": new TextEncoder().encode("ignored"),
  })

  const uploaded: BrowserProjectFile[] = [
    { bytes: toArrayBuffer(archive), path: "viewer-fixture.zip" },
  ]
  const expanded = expandBrowserProjectFiles(uploaded)
  expect(expanded.map(({ path }) => path)).toEqual([
    "viewer-fixture/Project/main.SchDoc",
    "viewer-fixture/Project/readme.txt",
  ])

  const { manifest } = parseBrowserProjectFiles(uploaded)
  expect(manifest.documents).toHaveLength(1)
  expect(manifest.documents[0]?.kind).toBe("schematic")
  expect(manifest.ignoredFileCount).toBe(1)
})

test("opens vendor bundles containing nested project ZIPs", async () => {
  const schematicBytes = new Uint8Array(
    await readFile(
      resolve(referencesDirectory, "sample-schematic-sheet.SchDoc"),
    ),
  )
  const nestedProject = zipSync({
    "Project/main.SchDoc": schematicBytes,
  })
  const archive = zipSync({
    "Board/project.zip": nestedProject,
    "Documentation/manual.pdf": new TextEncoder().encode("not extracted"),
    "Schematic/project.zip": nestedProject,
  })

  const uploaded: BrowserProjectFile[] = [
    { bytes: toArrayBuffer(archive), path: "vendor-bundle.zip" },
  ]
  const expanded = expandBrowserProjectFiles(uploaded)
  expect(expanded.map(({ path }) => path)).toEqual([
    "vendor-bundle/Board/project/Project/main.SchDoc",
    "vendor-bundle/Documentation/manual.pdf",
  ])
  expect(expanded[1]?.bytes.byteLength).toBe(0)

  const { manifest } = parseBrowserProjectFiles(uploaded)
  expect(manifest.documents).toHaveLength(1)
  expect(manifest.documents[0]?.kind).toBe("schematic")
  expect(manifest.ignoredFileCount).toBe(1)
})

test("creates a prefilled bug report without including project contents", () => {
  const reportUrl = new URL(
    createBugReportUrl({
      failures: [
        {
          errorName: "ParseError",
          message: "Unsupported record",
          path: "Demo/main.PcbDoc",
        },
      ],
      fileNames: ["Demo/main.PcbDoc"],
      fatalMessage: "The project could not be opened.",
    }),
  )

  expect(reportUrl.origin + reportUrl.pathname).toBe(
    "https://github.com/tscircuit/altiumts/issues/new",
  )
  expect(reportUrl.searchParams.get("labels")).toBe("bug")
  expect(reportUrl.searchParams.get("body")).toContain("Demo/main.PcbDoc")
  expect(reportUrl.searchParams.get("body")).toContain(
    "does not upload project contents",
  )
})

async function readReferenceFile(
  referenceName: string,
  path: string,
): Promise<BrowserProjectFile> {
  const bytes = new Uint8Array(
    await readFile(resolve(referencesDirectory, referenceName)),
  )
  return { bytes: toArrayBuffer(bytes), path }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
}
