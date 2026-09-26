import { expect, test } from "bun:test"
import {
  parseBrowserProjectFiles,
  renderProjectDocument,
} from "../../site/src/parse-project"
import { readReferenceBytes } from "./read-reference"

test("renders PMP22650 Layer 2 by its physical MID5 identity", async () => {
  const bytes = await readReferenceBytes("ti-pmp22650-main.PcbDoc")
  const state = parseBrowserProjectFiles([
    { path: "ti-pmp22650-main.PcbDoc", bytes: Uint8Array.from(bytes).buffer },
  ])
  const pcb = state.manifest.documents[0]
  const view = pcb?.views.find(({ label }) => label === "Layer 2")
  if (!pcb || !view) throw new Error("Expected the Layer 2 view")
  expect(view.layer).toBe("MID5")
  const svg = renderProjectDocument(state, pcb.id, view.id)
  expect(svg).toContain('data-record="Polygon" data-layer="MID5"')
  expect(svg).toContain('data-record="Track" data-layer="MID-LAYER5"')
  expect(svg).not.toContain('data-layer="MID-LAYER1"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
}, 30_000)
