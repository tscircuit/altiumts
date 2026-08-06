import { Zip, ZipDeflate } from "fflate"
import type { ProjectViewerManifest } from "./project-viewer-types"

export interface ProjectExportPlanItem {
  documentId: string
  svgPath: string
  viewId: string
}

export interface ProjectExportPlan {
  archiveName: string
  items: ProjectExportPlanItem[]
}

export interface ProjectExportProgress {
  current: number
  phase: "preparing" | "compressing"
  total: number
}

export const PROJECT_EXPORT_VIEWS_PER_ARCHIVE = 5

interface PrepareProjectExportOptions {
  onProgress?: (progress: ProjectExportProgress) => void
  renderSvg: (documentId: string, viewId: string) => Promise<string>
  signal?: AbortSignal
}

const WINDOWS_RESERVED_NAME =
  /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu

export function createProjectExportPlan(
  manifest: ProjectViewerManifest,
): ProjectExportPlan {
  const usedNames = new Set<string>()
  const items: ProjectExportPlanItem[] = []

  for (const document of manifest.documents) {
    const documentName = stripExtension(document.path)
      .replaceAll("\\", "/")
      .split("/")
      .map((part) => sanitizeExportComponent(part, "unnamed"))
      .join("--")

    for (const view of document.views) {
      const viewName = sanitizeExportComponent(view.id, "view")
      const initialName = `${documentName || "document"}--${viewName}`
      let name = initialName
      let suffix = 2
      while (usedNames.has(name.toLocaleLowerCase("en-US"))) {
        name = `${initialName}-${suffix}`
        suffix += 1
      }
      usedNames.add(name.toLocaleLowerCase("en-US"))
      items.push({
        documentId: document.id,
        svgPath: `svg/${name}.svg`,
        viewId: view.id,
      })
    }
  }

  return {
    archiveName: `${sanitizeExportComponent(manifest.name, "project")}-rendered-views.zip`,
    items,
  }
}

export function sanitizeExportComponent(
  value: string,
  fallback = "untitled",
): string {
  let sanitized = value
    .normalize("NFKD")
    .replace(/\p{Mark}+/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")

  if (!sanitized || sanitized === "." || sanitized === "..") {
    sanitized = fallback
  }
  if (WINDOWS_RESERVED_NAME.test(sanitized)) sanitized += "-file"
  return sanitized
}

export function splitProjectExportPlan(
  plan: ProjectExportPlan,
  viewsPerArchive = PROJECT_EXPORT_VIEWS_PER_ARCHIVE,
): ProjectExportPlan[] {
  if (viewsPerArchive < 1)
    throw new Error("Archive size must be at least one view")
  const batchCount = Math.ceil(plan.items.length / viewsPerArchive)
  if (batchCount <= 1) return [plan]
  const archiveBase = plan.archiveName.replace(/\.zip$/u, "")

  return Array.from({ length: batchCount }, (_, index) => ({
    archiveName: `${archiveBase}-part-${String(index + 1).padStart(2, "0")}-of-${String(batchCount).padStart(2, "0")}.zip`,
    items: plan.items.slice(
      index * viewsPerArchive,
      (index + 1) * viewsPerArchive,
    ),
  }))
}

export async function prepareProjectExport(
  plan: ProjectExportPlan,
  options: PrepareProjectExportOptions,
): Promise<Blob> {
  const encode = new TextEncoder()
  const chunks: ArrayBuffer[] = []
  let archiveBlob: Blob | undefined
  let archiveError: Error | undefined
  const archive = new Zip((error, chunk, final) => {
    if (error) {
      archiveError = toError(error)
      return
    }
    if (chunk.byteLength > 0) {
      chunks.push(
        chunk.buffer.slice(
          chunk.byteOffset,
          chunk.byteOffset + chunk.byteLength,
        ) as ArrayBuffer,
      )
    }
    if (final) archiveBlob = new Blob(chunks, { type: "application/zip" })
  })

  try {
    for (const [index, item] of plan.items.entries()) {
      throwIfAborted(options.signal)
      options.onProgress?.({
        current: index + 1,
        phase: "preparing",
        total: plan.items.length,
      })
      const svg = await options.renderSvg(item.documentId, item.viewId)
      throwIfAborted(options.signal)
      const entry = new ZipDeflate(item.svgPath, { level: 6 })
      archive.add(entry)
      entry.push(encode.encode(svg), true)
      if (archiveError) throw archiveError
    }

    options.onProgress?.({
      current: plan.items.length,
      phase: "compressing",
      total: plan.items.length,
    })
    archive.end()
    if (archiveError) throw archiveError
    if (!archiveBlob) throw new Error("Could not finalize the project archive")
    throwIfAborted(options.signal)
    return archiveBlob
  } catch (error) {
    archive.terminate()
    throw error
  }
}

function stripExtension(path: string): string {
  return path.replace(/\.[^./\\]+$/u, "")
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return
  const error = new Error("Project export was cancelled")
  error.name = "AbortError"
  throw error
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}
