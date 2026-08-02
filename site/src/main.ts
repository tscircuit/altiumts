import "./styles.css"

import { createBugReportUrl } from "./bug-report"
import { downloadGitHubProjectFiles } from "./github-project"
import type {
  BrowserProjectFile,
  ProjectDocumentManifest,
  ProjectViewerManifest,
  ProjectWorkerRequest,
  ProjectWorkerResponse,
} from "./project-viewer-types"

type ScreenName = "error" | "loading" | "viewer" | "welcome"

interface PendingRequest {
  documentId?: string
  type: "parse" | "render"
  viewId?: string
}

interface DroppedFileEntry {
  file(
    callback: (file: File) => void,
    error?: (error: DOMException) => void,
  ): void
  fullPath: string
  isDirectory: false
  isFile: true
  name: string
}

interface DroppedDirectoryEntry {
  createReader(): {
    readEntries(
      callback: (entries: DroppedEntry[]) => void,
      error?: (error: DOMException) => void,
    ): void
  }
  fullPath: string
  isDirectory: true
  isFile: false
  name: string
}

type DroppedEntry = DroppedDirectoryEntry | DroppedFileEntry

const welcomeScreen = getElement<HTMLElement>("welcome-screen")
const loadingScreen = getElement<HTMLElement>("loading-screen")
const errorScreen = getElement<HTMLElement>("error-screen")
const viewerScreen = getElement<HTMLElement>("viewer-screen")
const loadingTitle = getElement<HTMLElement>("loading-title")
const loadingMessage = getElement<HTMLElement>("loading-message")
const fatalErrorMessage = getElement<HTMLElement>("fatal-error-message")
const fatalReportLink = getElement<HTMLAnchorElement>("fatal-report-link")
const folderInput = getElement<HTMLInputElement>("folder-input")
const fileInput = getElement<HTMLInputElement>("file-input")
const chooseFolderButton = getElement<HTMLButtonElement>("choose-folder-button")
const chooseFilesButton = getElement<HTMLButtonElement>("choose-files-button")
const githubUrlForm = getElement<HTMLFormElement>("github-url-form")
const githubUrlInput = getElement<HTMLInputElement>("github-url-input")
const githubUrlButton = getElement<HTMLButtonElement>("github-url-button")
const errorRetryButton = getElement<HTMLButtonElement>("error-retry-button")
const openAnotherButton = getElement<HTMLButtonElement>("open-another-button")
const dropZone = getElement<HTMLElement>("drop-zone")
const documentNavigation = getElement<HTMLElement>("document-navigation")
const projectTitle = getElement<HTMLElement>("project-title")
const projectSubtitle = getElement<HTMLElement>("project-subtitle")
const projectWarning = getElement<HTMLElement>("project-warning")
const warningTitle = getElement<HTMLElement>("warning-title")
const warningSummary = getElement<HTMLElement>("warning-summary")
const warningReportLink = getElement<HTMLAnchorElement>("warning-report-link")
const documentTitle = getElement<HTMLElement>("document-title")
const documentKindIcon = getElement<HTMLElement>("document-kind-icon")
const documentFormatBadge = getElement<HTMLElement>("document-format-badge")
const documentMetadata = getElement<HTMLElement>("document-metadata")
const viewSelector = getElement<HTMLSelectElement>("view-selector")
const canvasViewport = getElement<HTMLElement>("canvas-viewport")
const svgStage = getElement<HTMLElement>("svg-stage")
const svgImage = getElement<HTMLImageElement>("svg-image")
const renderLoader = getElement<HTMLElement>("render-loader")
const fitButton = getElement<HTMLButtonElement>("fit-button")
const zoomInButton = getElement<HTMLButtonElement>("zoom-in-button")
const zoomOutButton = getElement<HTMLButtonElement>("zoom-out-button")
const downloadSvgButton = getElement<HTMLButtonElement>("download-svg-button")
const viewStatus = getElement<HTMLElement>("view-status")
const zoomStatus = getElement<HTMLElement>("zoom-status")

const parserWorker = new Worker(
  new URL("./parser-worker.ts", import.meta.url),
  {
    type: "module",
  },
)
const pendingRequests = new Map<number, PendingRequest>()
const svgCache = new Map<string, string>()
let nextRequestId = 1
let manifest: ProjectViewerManifest | undefined
let currentDocument: ProjectDocumentManifest | undefined
let currentViewId: string | undefined
let currentSvg: string | undefined
let currentImageUrl: string | undefined
let selectedFileNames: string[] = []
let zoom: number | undefined
let panStart:
  | { left: number; pointerId: number; top: number; x: number; y: number }
  | undefined

chooseFolderButton.addEventListener("click", () => folderInput.click())
chooseFilesButton.addEventListener("click", () => fileInput.click())
githubUrlForm.addEventListener("submit", (event) => {
  event.preventDefault()
  void openGitHubUrl(githubUrlInput.value)
})
errorRetryButton.addEventListener("click", resetViewer)
openAnotherButton.addEventListener("click", resetViewer)
folderInput.addEventListener(
  "change",
  () => void openSelectedFiles(folderInput.files),
)
fileInput.addEventListener(
  "change",
  () => void openSelectedFiles(fileInput.files),
)
dropZone.addEventListener("click", (event) => {
  if ((event.target as HTMLElement).closest("button, input, form")) return
  fileInput.click()
})
for (const eventName of ["dragenter", "dragover"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault()
    dropZone.classList.add("is-dragging")
  })
}
for (const eventName of ["dragleave", "drop"]) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault()
    dropZone.classList.remove("is-dragging")
  })
}
dropZone.addEventListener("drop", (event) => {
  void openDroppedItems(event.dataTransfer)
})
viewSelector.addEventListener("change", () => {
  if (!currentDocument) return
  void selectView(currentDocument.id, viewSelector.value)
})
fitButton.addEventListener("click", setFitZoom)
zoomInButton.addEventListener("click", () => setNumericZoom((zoom ?? 1) * 1.25))
zoomOutButton.addEventListener("click", () =>
  setNumericZoom((zoom ?? 1) / 1.25),
)
downloadSvgButton.addEventListener("click", downloadCurrentSvg)
canvasViewport.addEventListener("pointerdown", beginPan)
canvasViewport.addEventListener("pointermove", updatePan)
canvasViewport.addEventListener("pointerup", endPan)
canvasViewport.addEventListener("pointercancel", endPan)
window.addEventListener("keydown", (event) => {
  if (viewerScreen.hidden || isFormControl(event.target)) return
  if (event.key === "+" || event.key === "=") {
    event.preventDefault()
    setNumericZoom((zoom ?? 1) * 1.25)
  } else if (event.key === "-") {
    event.preventDefault()
    setNumericZoom((zoom ?? 1) / 1.25)
  } else if (event.key === "0") {
    event.preventDefault()
    setFitZoom()
  }
})

parserWorker.addEventListener(
  "message",
  ({ data }: MessageEvent<ProjectWorkerResponse>) => {
    const pending = pendingRequests.get(data.requestId)
    if (!pending) return
    if (data.type === "progress") {
      loadingMessage.textContent = data.message
      return
    }
    pendingRequests.delete(data.requestId)
    if (data.type === "error") {
      showFatalError(data.message, data.errorName)
      return
    }
    if (data.type === "parsed") {
      manifest = data.manifest
      renderProjectShell(data.manifest)
      const firstDocument = data.manifest.documents[0]
      if (firstDocument) void selectDocument(firstDocument.id)
      return
    }
    if (
      pending.type !== "render" ||
      data.documentId !== currentDocument?.id ||
      data.viewId !== currentViewId
    ) {
      return
    }
    const cacheKey = getSvgCacheKey(data.documentId, data.viewId)
    svgCache.set(cacheKey, data.svg)
    displaySvg(data.svg)
  },
)

parserWorker.addEventListener("error", (event) => {
  showFatalError(
    event.message || "The local parser stopped unexpectedly.",
    "WorkerError",
  )
})

async function openSelectedFiles(fileList: FileList | null): Promise<void> {
  if (!fileList || fileList.length === 0) return
  await openFiles(
    [...fileList].map((file) => ({
      file,
      path: file.webkitRelativePath || file.name,
    })),
  )
}

async function openDroppedItems(
  dataTransfer: DataTransfer | null,
): Promise<void> {
  if (!dataTransfer) return
  const entries: DroppedEntry[] = [...dataTransfer.items].flatMap((item) => {
    const withEntry = item as unknown as {
      webkitGetAsEntry?: () => DroppedEntry | null
    }
    const entry = withEntry.webkitGetAsEntry?.()
    return entry ? [entry] : []
  })
  if (entries.length === 0) {
    await openSelectedFiles(dataTransfer.files)
    return
  }
  try {
    const files = (await Promise.all(entries.map(readDroppedEntry))).flat()
    await openFiles(files)
  } catch (error) {
    showFatalError(
      error instanceof Error ? error.message : String(error),
      "FileReadError",
    )
  }
}

async function openFiles(
  files: Array<{ file: File; path: string }>,
): Promise<void> {
  if (files.length === 0) return
  selectedFileNames = files.map(({ path }) => path)
  setScreen("loading")
  loadingTitle.textContent = `Opening ${files.length === 1 ? files[0]?.file.name : `${files.length} files`}…`
  loadingMessage.textContent =
    "Reading files from this device. Nothing is being uploaded."
  try {
    const browserFiles: BrowserProjectFile[] = await Promise.all(
      files.map(async ({ file, path }) => ({
        bytes: await file.arrayBuffer(),
        path,
      })),
    )
    parseProjectFiles(browserFiles)
  } catch (error) {
    showFatalError(
      error instanceof Error ? error.message : String(error),
      "FileReadError",
    )
  }
}

async function openGitHubUrl(value: string): Promise<void> {
  const githubUrl = value.trim()
  if (!githubUrl) return
  selectedFileNames = [githubUrl]
  githubUrlButton.disabled = true
  setScreen("loading")
  loadingTitle.textContent = "Opening the GitHub project…"
  loadingMessage.textContent =
    "Connecting directly to GitHub. The project will be parsed in this browser tab."
  try {
    const files = await downloadGitHubProjectFiles(githubUrl, {
      onProgress: (message) => {
        loadingMessage.textContent = message
      },
    })
    selectedFileNames = files.map(({ path }) => path)
    parseProjectFiles(files)
  } catch (error) {
    showFatalError(
      error instanceof Error ? error.message : String(error),
      "GitHubImportError",
      "Try a URL to the exact public project folder, or download the repository and choose its complete folder.",
    )
  } finally {
    githubUrlButton.disabled = false
  }
}

function parseProjectFiles(files: BrowserProjectFile[]): void {
  const requestId = nextRequestId++
  pendingRequests.clear()
  pendingRequests.set(requestId, { type: "parse" })
  const request: ProjectWorkerRequest = {
    files,
    requestId,
    type: "parse",
  }
  parserWorker.postMessage(
    request,
    files.map(({ bytes }) => bytes),
  )
}

function renderProjectShell(project: ProjectViewerManifest): void {
  projectTitle.textContent = project.name
  const schematicCount = project.documents.filter(
    ({ kind }) => kind === "schematic",
  ).length
  const pcbCount = project.documents.filter(({ kind }) => kind === "pcb").length
  projectSubtitle.textContent = [
    schematicCount
      ? `${schematicCount} ${schematicCount === 1 ? "sheet" : "sheets"}`
      : "",
    pcbCount ? `${pcbCount} ${pcbCount === 1 ? "board" : "boards"}` : "",
  ]
    .filter(Boolean)
    .join(" · ")
  documentNavigation.replaceChildren()
  appendNavigationGroup(
    "SCHEMATIC SHEETS",
    project.documents.filter(({ kind }) => kind === "schematic"),
  )
  appendNavigationGroup(
    "PCB DOCUMENTS",
    project.documents.filter(({ kind }) => kind === "pcb"),
  )
  if (project.failures.length > 0) {
    projectWarning.hidden = false
    warningTitle.textContent = `${project.failures.length} ${project.failures.length === 1 ? "file needs" : "files need"} support`
    warningSummary.textContent = project.failures
      .slice(0, 2)
      .map(({ path }) => getBaseName(path))
      .join(", ")
    warningReportLink.href = createBugReportUrl({
      failures: project.failures,
      fileNames: selectedFileNames,
    })
  } else {
    projectWarning.hidden = true
  }
  setScreen("viewer")
}

function appendNavigationGroup(
  title: string,
  documents: ProjectDocumentManifest[],
): void {
  if (documents.length === 0) return
  const group = document.createElement("section")
  group.className = "navigation-group"
  const heading = document.createElement("h3")
  heading.className = "navigation-group-title"
  heading.append(document.createTextNode(title))
  const count = document.createElement("span")
  count.textContent = String(documents.length)
  heading.append(count)
  group.append(heading)
  for (const item of documents) {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "document-nav-button"
    button.dataset.documentId = item.id
    button.addEventListener("click", () => void selectDocument(item.id))
    const kind = document.createElement("span")
    kind.className = "nav-kind"
    kind.textContent = item.kind === "pcb" ? "PCB" : "SCH"
    const copy = document.createElement("span")
    copy.className = "nav-copy"
    const name = document.createElement("strong")
    name.textContent = item.name
    const detail = document.createElement("span")
    detail.textContent = `${item.componentCount.toLocaleString()} components · ${item.format}`
    copy.append(name, detail)
    button.append(kind, copy)
    group.append(button)
  }
  documentNavigation.append(group)
}

async function selectDocument(documentId: string): Promise<void> {
  const selected = manifest?.documents.find(({ id }) => id === documentId)
  if (!selected) return
  currentDocument = selected
  for (const button of documentNavigation.querySelectorAll<HTMLButtonElement>(
    ".document-nav-button",
  )) {
    button.classList.toggle(
      "is-active",
      button.dataset.documentId === documentId,
    )
  }
  documentTitle.textContent = selected.name
  documentKindIcon.textContent = selected.kind === "pcb" ? "PCB" : "SCH"
  documentFormatBadge.textContent = selected.format
  documentMetadata.textContent = `${selected.recordCount.toLocaleString()} records · ${selected.componentCount.toLocaleString()} components · ${selected.container}`
  viewSelector.replaceChildren(
    ...selected.views.map((view) => {
      const option = document.createElement("option")
      option.value = view.id
      option.textContent = view.label
      return option
    }),
  )
  const firstViewId = selected.views[0]?.id
  if (firstViewId) await selectView(documentId, firstViewId)
}

async function selectView(documentId: string, viewId: string): Promise<void> {
  if (!currentDocument || currentDocument.id !== documentId) return
  currentViewId = viewId
  viewSelector.value = viewId
  const view = currentDocument.views.find(({ id }) => id === viewId)
  viewStatus.textContent = view?.label ?? "Rendering"
  const cached = svgCache.get(getSvgCacheKey(documentId, viewId))
  if (cached) {
    displaySvg(cached)
    return
  }
  renderLoader.hidden = false
  svgStage.classList.add("is-loading")
  const requestId = nextRequestId++
  pendingRequests.set(requestId, { documentId, type: "render", viewId })
  const request: ProjectWorkerRequest = {
    documentId,
    requestId,
    type: "render",
    viewId,
  }
  parserWorker.postMessage(request)
}

function displaySvg(svg: string): void {
  currentSvg = svg
  if (currentImageUrl) URL.revokeObjectURL(currentImageUrl)
  currentImageUrl = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  )
  svgImage.src = currentImageUrl
  svgImage.alt = `${currentDocument?.name ?? "Altium document"} — ${viewSelector.selectedOptions[0]?.textContent ?? "SVG view"}`
  renderLoader.hidden = true
  svgStage.classList.remove("is-loading")
  viewStatus.textContent = `${viewSelector.selectedOptions[0]?.textContent ?? "View"} · rendered locally`
  setFitZoom()
}

function setFitZoom(): void {
  zoom = undefined
  svgStage.classList.add("is-fit")
  svgImage.style.width = ""
  svgImage.style.maxWidth = ""
  svgImage.style.maxHeight = ""
  fitButton.classList.add("is-active")
  zoomStatus.textContent = "Fit to view"
  canvasViewport.scrollTo({ behavior: "smooth", left: 0, top: 0 })
}

function setNumericZoom(value: number): void {
  zoom = Math.min(4, Math.max(0.25, value))
  svgStage.classList.remove("is-fit")
  svgImage.style.width = `${1600 * zoom}px`
  svgImage.style.maxWidth = "none"
  svgImage.style.maxHeight = "none"
  fitButton.classList.remove("is-active")
  zoomStatus.textContent = `${Math.round(zoom * 100)}%`
}

function downloadCurrentSvg(): void {
  if (!currentSvg || !currentDocument) return
  const view = currentDocument.views.find(({ id }) => id === currentViewId)
  const suffix = view?.layer ? `-${slugify(view.layer)}` : ""
  const url = URL.createObjectURL(
    new Blob([currentSvg], { type: "image/svg+xml;charset=utf-8" }),
  )
  const link = document.createElement("a")
  link.href = url
  link.download = `${stripExtension(currentDocument.name)}${suffix}.svg`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

function beginPan(event: PointerEvent): void {
  if (event.button !== 0) return
  panStart = {
    left: canvasViewport.scrollLeft,
    pointerId: event.pointerId,
    top: canvasViewport.scrollTop,
    x: event.clientX,
    y: event.clientY,
  }
  canvasViewport.setPointerCapture(event.pointerId)
  canvasViewport.classList.add("is-panning")
}

function updatePan(event: PointerEvent): void {
  if (!panStart || panStart.pointerId !== event.pointerId) return
  canvasViewport.scrollLeft = panStart.left - (event.clientX - panStart.x)
  canvasViewport.scrollTop = panStart.top - (event.clientY - panStart.y)
}

function endPan(event: PointerEvent): void {
  if (!panStart || panStart.pointerId !== event.pointerId) return
  panStart = undefined
  canvasViewport.classList.remove("is-panning")
}

function resetViewer(): void {
  manifest = undefined
  currentDocument = undefined
  currentViewId = undefined
  currentSvg = undefined
  selectedFileNames = []
  svgCache.clear()
  pendingRequests.clear()
  folderInput.value = ""
  fileInput.value = ""
  githubUrlInput.value = ""
  if (currentImageUrl) URL.revokeObjectURL(currentImageUrl)
  currentImageUrl = undefined
  svgImage.removeAttribute("src")
  setScreen("welcome")
}

function showFatalError(
  message: string,
  errorName: string,
  recovery = "Try selecting the complete project.",
): void {
  renderLoader.hidden = true
  svgStage.classList.remove("is-loading")
  fatalErrorMessage.textContent = `${message} (${errorName}). ${recovery} If it still fails, please open a bug report so we can add support for this design.`
  fatalReportLink.href = createBugReportUrl({
    failures: [{ errorName, message, path: selectedFileNames[0] ?? "Project" }],
    fatalMessage: message,
    fileNames: selectedFileNames,
  })
  setScreen("error")
}

function setScreen(screen: ScreenName): void {
  welcomeScreen.hidden = screen !== "welcome"
  loadingScreen.hidden = screen !== "loading"
  errorScreen.hidden = screen !== "error"
  viewerScreen.hidden = screen !== "viewer"
}

async function readDroppedEntry(
  entry: DroppedEntry,
): Promise<Array<{ file: File; path: string }>> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      entry.file(resolve, reject),
    )
    return [{ file, path: entry.fullPath.replace(/^\//u, "") || file.name }]
  }
  const children: DroppedEntry[] = []
  const reader = entry.createReader()
  while (true) {
    const batch = await new Promise<DroppedEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    )
    if (batch.length === 0) break
    children.push(...batch)
  }
  return (await Promise.all(children.map(readDroppedEntry))).flat()
}

function getSvgCacheKey(documentId: string, viewId: string): string {
  return `${documentId}:${viewId}`
}

function getBaseName(path: string): string {
  return path.replaceAll("\\", "/").split("/").at(-1) ?? path
}

function stripExtension(path: string): string {
  return path.replace(/\.[^.]+$/u, "")
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
}

function isFormControl(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLButtonElement
  )
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing required element #${id}`)
  return element as T
}
