import type {
  ProjectWorkerRequest,
  ProjectWorkerResponse,
} from "./project-viewer-types"

interface PendingRender {
  documentId: string
  reject: (error: Error) => void
  resolve: (svg: string) => void
  viewId: string
}

export class ProjectRenderCoordinator {
  private readonly pending = new Map<number, PendingRender>()

  constructor(
    private readonly getRequestId: () => number,
    private readonly postRequest: (request: ProjectWorkerRequest) => void,
  ) {}

  request(documentId: string, viewId: string): Promise<string> {
    const requestId = this.getRequestId()
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { documentId, reject, resolve, viewId })
      this.postRequest({ documentId, requestId, type: "render", viewId })
    })
  }

  handleResponse(response: ProjectWorkerResponse): boolean {
    if (response.type !== "rendered" && response.type !== "error") return false
    const pending = this.pending.get(response.requestId)
    if (!pending) return false
    this.pending.delete(response.requestId)

    if (response.type === "error") {
      const error = new Error(response.message)
      error.name = response.errorName
      pending.reject(error)
      return true
    }
    if (
      response.documentId !== pending.documentId ||
      response.viewId !== pending.viewId
    ) {
      pending.reject(
        new Error("The worker returned a mismatched rendered view"),
      )
      return true
    }
    pending.resolve(response.svg)
    return true
  }

  cancelAll(message = "Rendering was cancelled"): void {
    const error = new Error(message)
    error.name = "AbortError"
    for (const pending of this.pending.values()) pending.reject(error)
    this.pending.clear()
  }
}
