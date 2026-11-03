import { expect, test } from "bun:test"
import { parseAltiumPrjPcb } from "../../lib"
import {
  parseBrowserProjectFiles,
  renderProjectDocument,
} from "../../site/src/parse-project"
import { readReference, readReferenceBytes } from "./read-reference"
import { renderAltiumReferenceComparison } from "./render-altium-reference-comparison"

test("opens PMP22712 in a clean overview and retains its mechanical views", async () => {
  const source = await readReferenceBytes("ti-pmp22712.PcbDoc")
  const projectSource = await readReference("ti-pmp22712.PrjPcb")
  const project = parseAltiumPrjPcb(projectSource)
  const pcbReference = project.documents.find((reference) =>
    reference.path.toLowerCase().endsWith(".pcbdoc"),
  )!
  const state = parseBrowserProjectFiles([
    { path: pcbReference.path, bytes: Uint8Array.from(source).buffer },
    {
      path: "Project.PrjPcb",
      bytes: new TextEncoder().encode(projectSource).buffer,
    },
  ])
  const pcb = state.manifest.documents[0]!
  expect(pcb.views[0]).toMatchObject({
    id: "overview",
    layers: ["TOP", "BOTTOM", "TOPOVERLAY", "BOTTOMOVERLAY", "MULTILAYER"],
  })
  const overview = renderProjectDocument({
    documentId: pcb.id,
    state,
    viewId: pcb.views[0]!.id,
  })
  // Hidden dimension control points must not shrink the physical board.
  const viewBox = overview
    .match(/viewBox="([^"]+)"/u)![1]!
    .split(" ")
    .map(Number)
  expect(viewBox[2]).toBeLessThan(2000)
  expect(viewBox[3]).toBeLessThan(2000)
  for (const layer of ["TOP", "BOTTOM", "TOPOVERLAY", "MULTILAYER"]) {
    expect(overview).toContain(`data-layer="${layer}"`)
  }
  expect(overview).toContain('data-record="BoardOutline"')
  expect(overview).toContain('data-record="Pad"')
  expect(overview).toContain('data-record="Via"')
  expect(overview).toContain(">PMP22712E2</text>")
  expect(overview).not.toContain('data-layer="MECHANICAL')
  expect(overview).not.toContain('data-record="Dimension"')
  expect(overview).not.toContain('data-record="ComponentBody"')
  for (const viewId of ["layer:MECHANICAL2", "board"]) {
    const dimensions = renderProjectDocument({
      documentId: pcb.id,
      state,
      viewId,
    })
    expect(dimensions).toContain('data-record="Dimension"')
    expect(dimensions).toContain('data-layer="MECHANICAL2"')
  }
  const comparison = await renderAltiumReferenceComparison({
    reference: "ti-pmp22712-overview",
    converterSvg: overview,
  })
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
}, 30_000)
