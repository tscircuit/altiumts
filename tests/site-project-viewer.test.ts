import { expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { unzipSync, zipSync } from "fflate"
import { createBugReportUrl } from "../site/src/bug-report"
import {
  createProjectExportPlan,
  prepareProjectExport,
  splitProjectExportPlan,
} from "../site/src/project-export"
import {
  expandBrowserProjectFiles,
  parseBrowserProjectFiles,
  renderProjectDocument,
} from "../site/src/parse-project"
import type { BrowserProjectFile } from "../site/src/project-viewer-types"
import type {
  ProjectDocumentManifest,
  ProjectViewerManifest,
  ProjectWorkerRequest,
} from "../site/src/project-viewer-types"
import { ProjectRenderCoordinator } from "../site/src/render-coordinator"

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

test("plans SVG exports for every manifest view in order", () => {
  const manifest = createViewerManifest([
    createDocument("schematic-0", "Schematics/Power.SchDoc", ["sheet"]),
    createDocument("pcb-1", "Boards/Controller.PcbDoc", [
      "overview",
      "board",
      "layer:TOP",
      "layer:BOTTOM",
    ]),
  ])

  const plan = createProjectExportPlan(manifest)
  expect(plan.archiveName).toBe("demo-project-rendered-views.zip")
  expect(plan.items).toEqual([
    {
      documentId: "schematic-0",
      svgPath: "svg/schematics--power--sheet.svg",
      viewId: "sheet",
    },
    {
      documentId: "pcb-1",
      svgPath: "svg/boards--controller--overview.svg",
      viewId: "overview",
    },
    {
      documentId: "pcb-1",
      svgPath: "svg/boards--controller--board.svg",
      viewId: "board",
    },
    {
      documentId: "pcb-1",
      svgPath: "svg/boards--controller--layer-top.svg",
      viewId: "layer:TOP",
    },
    {
      documentId: "pcb-1",
      svgPath: "svg/boards--controller--layer-bottom.svg",
      viewId: "layer:BOTTOM",
    },
  ])
})

test("splits large exports into deterministic bounded archives", () => {
  const plan = createProjectExportPlan(
    createViewerManifest([
      createDocument(
        "pcb-0",
        "Boards/Main.PcbDoc",
        Array.from({ length: 12 }, (_, index) => `view-${index + 1}`),
      ),
    ]),
  )

  const archives = splitProjectExportPlan(plan)
  expect(archives.map(({ archiveName }) => archiveName)).toEqual([
    "demo-project-rendered-views-part-01-of-03.zip",
    "demo-project-rendered-views-part-02-of-03.zip",
    "demo-project-rendered-views-part-03-of-03.zip",
  ])
  expect(archives.map(({ items }) => items.length)).toEqual([5, 5, 2])
  expect(archives.flatMap(({ items }) => items)).toEqual(plan.items)
  expect(
    splitProjectExportPlan({ ...plan, items: plan.items.slice(0, 5) }),
  ).toEqual([{ ...plan, items: plan.items.slice(0, 5) }])
})

test("creates traversal-safe, reserved-safe, collision-safe export names", () => {
  const manifest = createViewerManifest([
    createDocument("a", "../CON.SchDoc", ["sheet"]),
    createDocument("b", "Dir/Main.SchDoc", ["sheet"]),
    createDocument("c", "dir/main.schdoc", ["SHEET"]),
    createDocument("d", "Other/Main.SchDoc", ["sheet"]),
    createDocument("e", "<>:/?.SchDoc", ["../"]),
  ])

  const plan = createProjectExportPlan(manifest)
  const svgPaths = plan.items.map(({ svgPath }) => svgPath)
  expect(svgPaths).toEqual([
    "svg/unnamed--con-file--sheet.svg",
    "svg/dir--main--sheet.svg",
    "svg/dir--main--sheet-2.svg",
    "svg/other--main--sheet.svg",
    "svg/unnamed--unnamed--view.svg",
  ])
  expect(new Set(svgPaths.map((path) => path.toLowerCase())).size).toBe(
    svgPaths.length,
  )
  expect(svgPaths.every((path) => !path.includes("../"))).toBeTrue()
})

test("does not produce an archive after a render failure", async () => {
  const plan = createProjectExportPlan(
    createViewerManifest([
      createDocument("schematic-0", "Demo/Main.SchDoc", ["sheet", "second"]),
    ]),
  )
  let renderCount = 0

  await expect(
    prepareProjectExport(plan, {
      renderSvg: async () => {
        renderCount += 1
        if (renderCount === 2) throw new Error("Render failed")
        return '<svg width="1" height="1"></svg>'
      },
    }),
  ).rejects.toThrow("Render failed")
  expect(renderCount).toBe(2)
})

test("builds one archive containing only SVG views", async () => {
  const plan = createProjectExportPlan(
    createViewerManifest([
      createDocument("schematic-0", "Demo/Main.SchDoc", ["sheet"]),
      createDocument("pcb-1", "Demo/Main.PcbDoc", ["board"]),
    ]),
  )
  const archive = await prepareProjectExport(plan, {
    renderSvg: async (documentId, viewId) =>
      `<svg><title>${documentId}:${viewId}</title></svg>`,
  })
  const files = unzipSync(new Uint8Array(await archive.arrayBuffer()))

  expect(Object.keys(files).sort()).toEqual(
    ["svg/demo--main--board.svg", "svg/demo--main--sheet.svg"].sort(),
  )
  expect(new TextDecoder().decode(files["svg/demo--main--sheet.svg"])).toBe(
    "<svg><title>schematic-0:sheet</title></svg>",
  )
})

test("correlates background render responses independently of active order", async () => {
  const requests: ProjectWorkerRequest[] = []
  let nextRequestId = 10
  const coordinator = new ProjectRenderCoordinator(
    () => nextRequestId++,
    (request) => requests.push(request),
  )
  const active = coordinator.request("document-a", "sheet")
  const background = coordinator.request("document-b", "layer:TOP")

  const backgroundRequest = requests[1]
  const activeRequest = requests[0]
  if (
    !backgroundRequest ||
    backgroundRequest.type !== "render" ||
    !activeRequest ||
    activeRequest.type !== "render"
  ) {
    throw new Error("Expected two render requests")
  }
  expect(
    coordinator.handleResponse({
      documentId: backgroundRequest.documentId,
      requestId: backgroundRequest.requestId,
      svg: "<svg>background</svg>",
      type: "rendered",
      viewId: backgroundRequest.viewId,
    }),
  ).toBeTrue()
  expect(
    coordinator.handleResponse({
      documentId: activeRequest.documentId,
      requestId: activeRequest.requestId,
      svg: "<svg>active</svg>",
      type: "rendered",
      viewId: activeRequest.viewId,
    }),
  ).toBeTrue()

  expect(await background).toBe("<svg>background</svg>")
  expect(await active).toBe("<svg>active</svg>")
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

function createDocument(
  id: string,
  path: string,
  viewIds: string[],
): ProjectDocumentManifest {
  return {
    componentCount: 0,
    container: "fixture",
    format: "fixture",
    id,
    kind: path.toLowerCase().endsWith(".pcbdoc") ? "pcb" : "schematic",
    name: path.split("/").at(-1) ?? path,
    path,
    recordCount: 0,
    views: viewIds.map((viewId) => ({ id: viewId, label: viewId })),
  }
}

function createViewerManifest(
  documents: ProjectDocumentManifest[],
): ProjectViewerManifest {
  return {
    documents,
    failures: [],
    ignoredFileCount: 0,
    name: "Demo Project",
    projects: [],
    sourceFileCount: documents.length,
  }
}
