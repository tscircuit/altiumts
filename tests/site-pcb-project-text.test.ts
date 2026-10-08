import { expect, test } from "bun:test"
import {
  parseBrowserProjectFiles,
  renderProjectDocument,
} from "../site/src/parse-project"
import { readReferenceBytes } from "./svg/read-reference"

test("uses the matching uploaded project for complete and single-layer PCB annotations", async () => {
  const pcb = await readReferenceBytes("ti-pmp22712.PcbDoc")
  const project = await readReferenceBytes("ti-pmp22712.PrjPcb")
  const state = parseBrowserProjectFiles([
    {
      path: "Other/Other.PrjPcb",
      bytes: new TextEncoder().encode(
        "[Document1]\nDocumentPath=PMP22712_PCB.PcbDoc\n[Parameter1]\nName=PRJ_Number\nValue=Wrong project\n",
      ).buffer,
    },
    { path: "TI/PMP22712.PrjPcb", bytes: Uint8Array.from(project).buffer },
    { path: "TI/PMP22712_PCB.PcbDoc", bytes: Uint8Array.from(pcb).buffer },
    { path: "Loose/Standalone.PcbDoc", bytes: Uint8Array.from(pcb).buffer },
  ])
  const linked = state.manifest.documents.find(({ path }) =>
    path.startsWith("TI/"),
  )
  const loose = state.manifest.documents.find(({ path }) =>
    path.startsWith("Loose/"),
  )
  if (!linked || !loose) throw new Error("Expected both PCB documents")
  for (const viewId of ["board", "layer:TOPOVERLAY"]) {
    const svg = renderProjectDocument({ documentId: linked.id, state, viewId })
    expect(svg).toContain(">PMP22712E2</text>")
    expect(svg).not.toContain(".PRJ_Number")
    expect(svg).not.toContain("Wrong project")
  }
  const svg = renderProjectDocument({
    documentId: loose.id,
    state,
    viewId: "board",
  })
  expect(svg).toContain("&apos;.PRJ_Number&apos;.PCB_Rev")
  expect(svg).not.toContain(">PMP22712E2</text>")
}, 30_000)
