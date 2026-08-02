import { unzipSync } from "fflate"
import {
  AltiumBinaryPcbDoc,
  AltiumPcbDoc,
  type AltiumPcbDocument,
  AltiumPrjPcb,
  AltiumSchDoc,
  parseAltiumFile,
  resolveAltiumProjectPath,
  serializeAltiumPcbLayerToSvg,
  serializeAltiumPcbToSvg,
  serializeAltiumSheetToSvg,
} from "../../lib"
import type {
  AltiumProjectManifest,
  BrowserProjectFile,
  ProjectDocumentManifest,
  ProjectFileFailure,
  ProjectViewerManifest,
} from "./project-viewer-types"

const MAX_EXPANDED_FILE_COUNT = 2_000
const MAX_EXPANDED_BYTES = 768 * 1024 * 1024
const MAX_ARCHIVE_NESTING_DEPTH = 4
const LARGE_PCB_RECORD_COUNT = 100_000
const SUPPORTED_FILE_PATTERN =
  /\.(?:dsnwrk|outjob|pcbdoc|pcblib|prjpcb|schdoc|schlib)$/iu
const VIEWABLE_FILE_PATTERN = /\.(?:pcbdoc|prjpcb|schdoc)$/iu
const ZIP_FILE_PATTERN = /\.zip$/iu

interface ParsedViewableDocument {
  document: AltiumPcbDocument | AltiumSchDoc
  manifest: ProjectDocumentManifest
}

interface ParsedProjectDocument {
  document: AltiumPrjPcb
  path: string
}

export interface ParsedProjectState {
  documents: Map<string, ParsedViewableDocument>
  manifest: ProjectViewerManifest
}

export function parseBrowserProjectFiles(
  uploadedFiles: BrowserProjectFile[],
): ParsedProjectState {
  const expandedFiles = expandBrowserProjectFiles(uploadedFiles)
  const documents = new Map<string, ParsedViewableDocument>()
  const failures: ProjectFileFailure[] = []
  const projectDocuments: ParsedProjectDocument[] = []
  const candidates = expandedFiles.filter(({ path }) =>
    VIEWABLE_FILE_PATTERN.test(path),
  )

  for (const [index, file] of candidates.entries()) {
    try {
      const parsed = parseAltiumFile(new Uint8Array(file.bytes))
      const parsedDocument = parsed.document
      if (parsedDocument instanceof AltiumPrjPcb) {
        projectDocuments.push({ document: parsedDocument, path: file.path })
        continue
      }
      if (parsedDocument instanceof AltiumSchDoc) {
        const id = `schematic-${index}`
        documents.set(id, {
          document: parsedDocument,
          manifest: {
            componentCount: parsedDocument.components.length,
            container: parsed.detection.container,
            format: parsedDocument.sourceFormat,
            id,
            kind: "schematic",
            name: getBaseName(file.path),
            path: file.path,
            recordCount: parsedDocument.records.length,
            views: [{ id: "sheet", label: "Schematic sheet" }],
          },
        })
        continue
      }
      if (
        parsedDocument instanceof AltiumPcbDoc ||
        parsedDocument instanceof AltiumBinaryPcbDoc
      ) {
        const id = `pcb-${index}`
        const layerNames = getDocumentLayerNames(parsedDocument)
        const recordCount = parsedDocument.records.length
        const overviewLayers = getPcbOverviewLayers(layerNames)
        const isLargeBoard = recordCount >= LARGE_PCB_RECORD_COUNT
        documents.set(id, {
          document: parsedDocument,
          manifest: {
            componentCount: parsedDocument.getRecordsByKind("Component").length,
            container: parsed.detection.container,
            format:
              parsedDocument instanceof AltiumBinaryPcbDoc ? "binary" : "ascii",
            id,
            kind: "pcb",
            name: getBaseName(file.path),
            path: file.path,
            recordCount,
            views: [
              ...(isLargeBoard && overviewLayers.length > 0
                ? [
                    {
                      id: "overview",
                      label: "Board overview",
                      layers: overviewLayers,
                    },
                  ]
                : []),
              {
                id: "board",
                label: isLargeBoard
                  ? "Complete board (all layers, slower)"
                  : "Complete board",
              },
              ...layerNames.map((layer) => ({
                id: `layer:${layer}`,
                label: formatLayerName(layer),
                layer,
              })),
            ],
          },
        })
      }
    } catch (error) {
      failures.push(createFailure(file.path, error))
    }
  }

  const projects = createProjectManifests(projectDocuments, documents)
  const orderedDocuments = orderDocumentManifests(projects, documents)
  if (orderedDocuments.length === 0) {
    const reason =
      failures[0]?.message ??
      "No supported schematic or PCB documents were found in the selected files."
    throw new Error(reason)
  }

  return {
    documents,
    manifest: {
      documents: orderedDocuments,
      failures,
      ignoredFileCount: expandedFiles.length - candidates.length,
      name: getProjectDisplayName(projects, orderedDocuments, expandedFiles),
      projects,
      sourceFileCount: expandedFiles.length,
    },
  }
}

export function renderProjectDocument(
  state: ParsedProjectState,
  documentId: string,
  viewId: string,
): string {
  const entry = state.documents.get(documentId)
  if (!entry) throw new Error(`Document ${documentId} is no longer available`)
  const view = entry.manifest.views.find((candidate) => candidate.id === viewId)
  if (!view)
    throw new Error(`View ${viewId} is not available for this document`)
  const title = `${entry.manifest.name} — ${view.label}`
  if (entry.document instanceof AltiumSchDoc) {
    return serializeAltiumSheetToSvg(entry.document, {
      height: 1000,
      title,
      width: 1600,
    })
  }
  if (view.layers?.length) {
    return serializeAltiumPcbToSvg(entry.document, {
      height: 1000,
      layers: view.layers,
      title,
      width: 1600,
    })
  }
  if (view.layer) {
    return serializeAltiumPcbLayerToSvg(entry.document, view.layer, {
      height: 1000,
      title,
      width: 1600,
    })
  }
  return serializeAltiumPcbToSvg(entry.document, {
    height: 1000,
    title,
    width: 1600,
  })
}

export function expandBrowserProjectFiles(
  uploadedFiles: BrowserProjectFile[],
): BrowserProjectFile[] {
  const expanded: BrowserProjectFile[] = []
  const deduplicated = new Map<string, BrowserProjectFile>()
  const supportedFilesByNameAndSize = new Map<string, BrowserProjectFile[]>()
  let discoveredFileCount = 0
  let totalBytes = 0

  const accountForArchiveEntry = (byteLength: number): void => {
    discoveredFileCount += 1
    totalBytes += byteLength
    if (discoveredFileCount > MAX_EXPANDED_FILE_COUNT) {
      throw new Error(
        `The project contains more than ${MAX_EXPANDED_FILE_COUNT} files and cannot be opened safely in this browser tab.`,
      )
    }
    if (totalBytes > MAX_EXPANDED_BYTES) {
      throw new Error(
        `The expanded project is larger than ${Math.round(MAX_EXPANDED_BYTES / 1024 / 1024)} MB and cannot be opened safely in this browser tab.`,
      )
    }
  }

  const addExpandedFile = (file: BrowserProjectFile): void => {
    const path = normalizeProjectPath(file.path)
    const normalizedFile = { ...file, path }
    const key = path.toUpperCase()
    if (deduplicated.has(key)) return
    if (SUPPORTED_FILE_PATTERN.test(path)) {
      const contentKey = `${getBaseName(path).toUpperCase()}:${file.bytes.byteLength}`
      const possibleDuplicates =
        supportedFilesByNameAndSize.get(contentKey) ?? []
      if (
        possibleDuplicates.some((candidate) =>
          arrayBuffersEqual(candidate.bytes, file.bytes),
        )
      ) {
        return
      }
      possibleDuplicates.push(normalizedFile)
      supportedFilesByNameAndSize.set(contentKey, possibleDuplicates)
    }
    deduplicated.set(key, normalizedFile)
    expanded.push(normalizedFile)
  }

  const expandFile = (
    file: BrowserProjectFile,
    nestingDepth: number,
    accountForFile: boolean,
  ): void => {
    const path = normalizeProjectPath(file.path)
    if (!ZIP_FILE_PATTERN.test(path)) {
      if (accountForFile) accountForArchiveEntry(file.bytes.byteLength)
      addExpandedFile({ ...file, path })
      return
    }
    if (nestingDepth > MAX_ARCHIVE_NESTING_DEPTH) {
      throw new Error(
        `${getBaseName(path)} is nested more than ${MAX_ARCHIVE_NESTING_DEPTH} ZIP levels deep and cannot be opened safely.`,
      )
    }

    const archiveRoot = path.replace(ZIP_FILE_PATTERN, "")
    const archiveEntries: Array<{
      entryPath: string
      extract: boolean
      name: string
    }> = []
    let entries: Record<string, Uint8Array>
    try {
      entries = unzipSync(new Uint8Array(file.bytes), {
        filter: (entry) => {
          if (entry.name.endsWith("/") || isDiscardedArchivePath(entry.name)) {
            return false
          }
          const entryPath = normalizeProjectPath(`${archiveRoot}/${entry.name}`)
          accountForArchiveEntry(entry.originalSize)
          const shouldExtract =
            ZIP_FILE_PATTERN.test(entry.name) ||
            SUPPORTED_FILE_PATTERN.test(entry.name)
          archiveEntries.push({
            entryPath,
            extract: shouldExtract,
            name: entry.name,
          })
          return shouldExtract
        },
      })
    } catch (error) {
      throw new Error(
        `Could not read ${getBaseName(path)} as a ZIP archive: ${getErrorMessage(error)}`,
      )
    }

    for (const archiveEntry of archiveEntries) {
      if (!archiveEntry.extract) {
        addExpandedFile({
          bytes: new ArrayBuffer(0),
          path: archiveEntry.entryPath,
        })
        continue
      }
      const bytes = entries[archiveEntry.name]
      if (!bytes) continue
      expandFile(
        {
          bytes: toArrayBuffer(bytes),
          path: archiveEntry.entryPath,
        },
        nestingDepth + 1,
        false,
      )
    }
  }

  for (const file of uploadedFiles) {
    expandFile(file, 0, !ZIP_FILE_PATTERN.test(file.path))
  }
  return expanded
}

function createProjectManifests(
  projects: ParsedProjectDocument[],
  documents: Map<string, ParsedViewableDocument>,
): AltiumProjectManifest[] {
  const documentIdByPath = new Map(
    [...documents.values()].map(({ manifest }) => [
      normalizeProjectPath(manifest.path).toUpperCase(),
      manifest.id,
    ]),
  )
  return projects.map(({ document, path }) => {
    const baseDirectory = getDirectoryName(path)
    return {
      documents: document.documents.map((reference) => {
        const resolvedPath = normalizeProjectPath(
          resolveAltiumProjectPath(baseDirectory, reference.path),
        )
        return {
          documentId: documentIdByPath.get(resolvedPath.toUpperCase()),
          kind: reference.kind,
          path: reference.path,
          resolvedPath,
          uniqueId: reference.uniqueId,
        }
      }),
      name: stripExtension(getBaseName(path)),
      path,
      variantNames: document.variants.map(({ name }) => name),
    }
  })
}

function orderDocumentManifests(
  projects: AltiumProjectManifest[],
  documents: Map<string, ParsedViewableDocument>,
): ProjectDocumentManifest[] {
  const byId = new Map(
    [...documents.values()].map(({ manifest }) => [manifest.id, manifest]),
  )
  const ordered: ProjectDocumentManifest[] = []
  const seen = new Set<string>()
  for (const project of projects) {
    for (const reference of project.documents) {
      if (!reference.documentId || seen.has(reference.documentId)) continue
      const manifest = byId.get(reference.documentId)
      if (!manifest) continue
      ordered.push(manifest)
      seen.add(reference.documentId)
    }
  }
  for (const { manifest } of documents.values()) {
    if (seen.has(manifest.id)) continue
    ordered.push(manifest)
  }
  return ordered
}

function getProjectDisplayName(
  projects: AltiumProjectManifest[],
  documents: ProjectDocumentManifest[],
  files: BrowserProjectFile[],
): string {
  const projectName = projects[0]?.name
  if (projectName) return projectName
  const commonRoot = getCommonRoot(files.map(({ path }) => path))
  if (commonRoot) return commonRoot
  if (documents.length === 1)
    return stripExtension(documents[0]?.name ?? "Altium design")
  return "Altium design"
}

function getDocumentLayerNames(document: AltiumPcbDocument): string[] {
  const layerCounts = new Map<string, number>()
  for (const record of document.records) {
    const layer = record.getCaseInsensitive("LAYER")?.trim()
    if (!layer || layer.toUpperCase() === "UNKNOWN") continue
    layerCounts.set(layer, (layerCounts.get(layer) ?? 0) + 1)
  }
  return [...layerCounts.keys()]
    .sort(
      (left, right) =>
        getLayerPriority(left) - getLayerPriority(right) ||
        left.localeCompare(right, undefined, { numeric: true }),
    )
    .slice(0, 64)
}

function getPcbOverviewLayers(layerNames: string[]): string[] {
  const overviewLayerNames = new Set([
    "BOTTOM",
    "BOTTOMOVERLAY",
    "MULTILAYER",
    "TOP",
    "TOPOVERLAY",
  ])
  return layerNames.filter((layer) =>
    overviewLayerNames.has(layer.replace(/[\s_-]/gu, "").toUpperCase()),
  )
}

function getLayerPriority(layer: string): number {
  const normalized = layer.replace(/[\s_-]/gu, "").toUpperCase()
  if (normalized === "TOP") return 0
  if (normalized === "BOTTOM") return 1
  if (normalized.startsWith("MID")) return 2
  if (normalized === "TOPOVERLAY") return 3
  if (normalized === "BOTTOMOVERLAY") return 4
  if (normalized === "TOPSOLDER") return 5
  if (normalized === "BOTTOMSOLDER") return 6
  if (normalized === "TOPPASTE") return 7
  if (normalized === "BOTTOMPASTE") return 8
  if (normalized === "MULTILAYER") return 9
  if (normalized === "KEEPOUT") return 10
  if (normalized.startsWith("MECHANICAL")) return 30
  return 20
}

function formatLayerName(layer: string): string {
  const normalized = layer.replace(/[\s_-]/gu, "").toUpperCase()
  const knownNames: Record<string, string> = {
    BOTTOM: "Bottom copper",
    BOTTOMOVERLAY: "Bottom overlay",
    BOTTOMPASTE: "Bottom paste",
    BOTTOMSOLDER: "Bottom solder mask",
    KEEPOUT: "Keepout",
    MULTILAYER: "Multi-layer",
    TOP: "Top copper",
    TOPOVERLAY: "Top overlay",
    TOPPASTE: "Top paste",
    TOPSOLDER: "Top solder mask",
  }
  return knownNames[normalized] ?? layer.replace(/([a-z])([A-Z])/gu, "$1 $2")
}

function createFailure(path: string, error: unknown): ProjectFileFailure {
  return {
    errorName: error instanceof Error ? error.name : "Error",
    message: getErrorMessage(error),
    path,
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function normalizeProjectPath(path: string): string {
  const segments: string[] = []
  for (const segment of path.replaceAll("\\", "/").split("/")) {
    if (!segment || segment === ".") continue
    if (segment === "..") segments.pop()
    else segments.push(segment)
  }
  return segments.join("/")
}

function getDirectoryName(path: string): string {
  const normalized = normalizeProjectPath(path)
  const separator = normalized.lastIndexOf("/")
  return separator < 0 ? "." : normalized.slice(0, separator)
}

function getBaseName(path: string): string {
  return normalizeProjectPath(path).split("/").at(-1) ?? path
}

function stripExtension(path: string): string {
  return path.replace(/\.[^.]+$/u, "")
}

function getCommonRoot(paths: string[]): string | undefined {
  const roots = new Set(
    paths
      .map(normalizeProjectPath)
      .map((path) => path.split("/")[0])
      .filter((value): value is string => Boolean(value)),
  )
  return roots.size === 1 ? [...roots][0] : undefined
}

function isDiscardedArchivePath(path: string): boolean {
  const normalized = path.replaceAll("\\", "/")
  return (
    normalized.startsWith("__MACOSX/") ||
    normalized === ".DS_Store" ||
    normalized.endsWith("/.DS_Store")
  )
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
}

function arrayBuffersEqual(left: ArrayBuffer, right: ArrayBuffer): boolean {
  if (left.byteLength !== right.byteLength) return false
  const leftBytes = new Uint8Array(left)
  const rightBytes = new Uint8Array(right)
  for (let index = 0; index < leftBytes.length; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return false
  }
  return true
}
