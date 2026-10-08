import { expect, test } from "bun:test"
import { zipSync } from "fflate"
import { parseAltiumPrjPcb } from "../lib"
import {
  TI_POWER_REFERENCE_PCB_FILENAMES,
  TI_POWER_REFERENCE_PROJECT_FILENAMES,
} from "../scripts/references/ti-power-references"
import {
  parseBrowserProjectFiles,
  renderProjectDocument,
} from "../site/src/parse-project"
import type { BrowserProjectFile } from "../site/src/project-viewer-types"
import { readReference, readReferenceBytes } from "./svg/read-reference"

test("resolves each real PCB from its own project when six project ZIPs are opened together", async () => {
  const cases = [
    { key: "pmp22650", label: "PMP22650E2", viewId: "board" },
    { key: "pmp22712", label: "PMP22712E2", viewId: "board" },
    { key: "pmp22773", label: "PMP22773E3", viewId: "board" },
    { key: "pmp23595", label: "PMP23595A", viewId: "board" },
    { key: "pmp23653Main", label: "PMP23653B", viewId: "board" },
    // This PCB has no on-board project title; its drawing contains the name.
    {
      key: "pmp23653PlanarTransformer",
      label: "PMP23653-XFMR",
      viewId: "layer:MECHANICAL5",
    },
  ] as const
  const files: BrowserProjectFile[] = []
  for (const { key } of cases) {
    const source = await readReference(
      TI_POWER_REFERENCE_PROJECT_FILENAMES[key],
    )
    const project = parseAltiumPrjPcb(source)
    const pcbReference = project.documents.find((reference) =>
      reference.path.toLowerCase().endsWith(".pcbdoc"),
    )!
    expect(pcbReference).toBeDefined()
    expect(project.getString()).toBe(source)
    // Preserve the original document names and project bytes inside each ZIP.
    const archive = zipSync({
      [pcbReference.path]: await readReferenceBytes(
        TI_POWER_REFERENCE_PCB_FILENAMES[key],
      ),
      "Project.PrjPCB": new TextEncoder().encode(source),
    })
    files.push({ path: `${key}.zip`, bytes: new Uint8Array(archive).buffer })
  }
  // Same parameter names have different values in every project. Association
  // must use the declared document path regardless of input/project order.
  const state = parseBrowserProjectFiles(files.reverse())
  expect(state.manifest.projects).toHaveLength(cases.length)
  for (const { key, label, viewId } of cases) {
    const entry = state.manifest.documents.find(
      (document) =>
        document.kind === "pcb" && document.path.startsWith(`${key}/`),
    )!
    expect(entry).toBeDefined()
    const svg = renderProjectDocument({ state, documentId: entry.id, viewId })
    expect(svg).toContain(`>${label}</text>`)
    expect(svg).not.toContain(".PRJ_Number")
    expect(svg).not.toContain(".PCB_Rev")
  }
}, 60_000)
