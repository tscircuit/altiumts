export interface BrowserProjectFile {
  bytes: ArrayBuffer
  path: string
}

export interface ProjectDocumentView {
  id: string
  label: string
  layer?: string
  layers?: string[]
}

export interface ProjectDocumentManifest {
  componentCount: number
  container: string
  format: string
  id: string
  kind: "pcb" | "schematic"
  name: string
  path: string
  recordCount: number
  views: ProjectDocumentView[]
}

export interface ProjectFileFailure {
  errorName: string
  message: string
  path: string
}

export interface ProjectReferenceManifest {
  documentId?: string
  kind?: string
  path: string
  resolvedPath: string
  uniqueId?: string
}

export interface AltiumProjectManifest {
  documents: ProjectReferenceManifest[]
  name: string
  path: string
  variantNames: string[]
}

export interface ProjectViewerManifest {
  documents: ProjectDocumentManifest[]
  failures: ProjectFileFailure[]
  ignoredFileCount: number
  name: string
  projects: AltiumProjectManifest[]
  sourceFileCount: number
}

export type ProjectWorkerRequest =
  | {
      files: BrowserProjectFile[]
      requestId: number
      type: "parse"
    }
  | {
      documentId: string
      requestId: number
      type: "render"
      viewId: string
    }

export type ProjectWorkerResponse =
  | {
      message: string
      requestId: number
      type: "progress"
    }
  | {
      manifest: ProjectViewerManifest
      requestId: number
      type: "parsed"
    }
  | {
      documentId: string
      requestId: number
      svg: string
      type: "rendered"
      viewId: string
    }
  | {
      errorName: string
      message: string
      requestId: number
      type: "error"
    }
