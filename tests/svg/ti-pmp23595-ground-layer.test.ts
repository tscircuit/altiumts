import { expect, test } from "bun:test"
import {
  parseBrowserProjectFiles,
  renderProjectDocument,
} from "../../site/src/parse-project"
import { readReferenceBytes } from "./read-reference"

test("renders PMP23595 GND 1 by its physical MID3 identity", async () => {
  const bytes = await readReferenceBytes("ti-pmp23595.PcbDoc")
  const state = parseBrowserProjectFiles([
    { path: "ti-pmp23595.PcbDoc", bytes: Uint8Array.from(bytes).buffer },
  ])
  const pcb = state.manifest.documents[0]
  const view = pcb?.views.find(({ label }) => label === "GND 1")
  if (!pcb || !view) throw new Error("Expected the GND 1 layer view")
  expect(view.layer).toBe("MID3")
  const svg = renderProjectDocument(state, pcb.id, view.id)
  expect(svg).toContain('data-record="Polygon" data-layer="MID3"')
  expect(svg).toContain('data-record="Region" data-layer="MID-LAYER3"')
  expect(svg).not.toContain('data-layer="MID-LAYER1"')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
}, 30_000)
