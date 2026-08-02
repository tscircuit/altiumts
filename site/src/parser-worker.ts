/// <reference lib="webworker" />

import {
  type ParsedProjectState,
  parseBrowserProjectFiles,
  renderProjectDocument,
} from "./parse-project"
import type {
  ProjectWorkerRequest,
  ProjectWorkerResponse,
} from "./project-viewer-types"

const workerScope = self as DedicatedWorkerGlobalScope
let projectState: ParsedProjectState | undefined

workerScope.addEventListener(
  "message",
  ({ data }: MessageEvent<ProjectWorkerRequest>) => {
    try {
      if (data.type === "parse") {
        post({
          message: "Detecting Altium documents and project references…",
          requestId: data.requestId,
          type: "progress",
        })
        projectState = parseBrowserProjectFiles(data.files)
        post({
          manifest: projectState.manifest,
          requestId: data.requestId,
          type: "parsed",
        })
        return
      }
      if (!projectState) throw new Error("Open a project before rendering it")
      const svg = renderProjectDocument(
        projectState,
        data.documentId,
        data.viewId,
      )
      post({
        documentId: data.documentId,
        requestId: data.requestId,
        svg,
        type: "rendered",
        viewId: data.viewId,
      })
    } catch (error) {
      post({
        errorName: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
        requestId: data.requestId,
        type: "error",
      })
    }
  },
)

function post(message: ProjectWorkerResponse): void {
  workerScope.postMessage(message)
}
