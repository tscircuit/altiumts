import { expect, test } from "bun:test"
import {
  parseBrowserProjectFiles,
  renderProjectDocument,
} from "../site/src/parse-project"
import { readReferenceBytes } from "./svg/read-reference"

test("matches the declared PMP22712 Altium layer panel", async () => {
  const source = await readReferenceBytes("ti-pmp22712.PcbDoc")
  const { manifest } = parseBrowserProjectFiles([
    {
      bytes: source.buffer.slice(
        source.byteOffset,
        source.byteOffset + source.byteLength,
      ) as ArrayBuffer,
      path: "PMP22712_PCB.PcbDoc",
    },
  ])
  const layerViews = manifest.documents[0]?.views.filter(({ layer }) => layer)

  expect(
    layerViews?.filter(({ group }) => group === "copper").map(getLayerSummary),
  ).toEqual([
    "TOP:Top Layer",
    "MID1:Signal Layer 1",
    "MID2:Signal Layer 2",
    "BOTTOM:Bottom Layer",
  ])
  expect(
    layerViews
      ?.filter(({ group }) => group === "mechanical")
      .map(getLayerSummary),
  ).toEqual([
    "MECHANICAL1:M1 Board Outline",
    "MECHANICAL2:M2 Board Dimensions",
    "MECHANICAL3:M3 3D STEP Top",
    "MECHANICAL4:M4 3D STEP Bottom",
    "MECHANICAL5:M5 Assembly Top",
    "MECHANICAL6:M6 Assembly Bottom",
    "MECHANICAL7:M7 LPKF Text Top",
    "MECHANICAL8:M8 LPKF Text Bottom",
    "MECHANICAL9:M9 Title Sheet",
    "MECHANICAL10:M10 Fab Notes",
    "MECHANICAL11:M11 Gerber Information",
    "MECHANICAL12:M12 Stackup",
    "MECHANICAL13:M13 Component Bodies Top",
    "MECHANICAL14:M14 Component Bodies Bottom",
    "MECHANICAL15:M15 Courtyards Top",
    "MECHANICAL16:M16 Courtyards Bottom",
    "MECHANICAL17:M17 Embedded Cavity",
    "MECHANICAL18:M18 Embedded Assembly",
    "MECHANICAL19:M19 Embedded Keepout",
  ])
  expect(
    layerViews?.filter(({ group }) => group === "other").map(getLayerSummary),
  ).toEqual([
    "MULTILAYER:Multi-Layer",
    "DRILLGUIDE:Drill Guide",
    "KEEPOUT:Keep-Out Layer",
    "DRILLDRAWING:Drill Drawing",
  ])
  expect(
    layerViews
      ?.filter(({ hasPrimitives }) => hasPrimitives === false)
      .map(({ layer }) => layer),
  ).toEqual([
    "MECHANICAL7",
    "MECHANICAL8",
    "MECHANICAL17",
    "MECHANICAL18",
    "MECHANICAL19",
  ])
}, 30_000)

function getLayerSummary({
  label,
  layer,
}: {
  label: string
  layer?: string
}): string {
  return `${layer}:${label}`
}

test("defaults PMP22712 to a clean overview while retaining mechanical views", async () => {
  const source = await readReferenceBytes("ti-pmp22712.PcbDoc")
  const state = parseBrowserProjectFiles([
    { path: "PMP22712_PCB.PcbDoc", bytes: Uint8Array.from(source).buffer },
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
  // Hidden dimensions include control coordinates far outside the physical board.
  const viewBox = overview
    .match(/viewBox="([^"]+)"/)![1]!
    .split(" ")
    .map(Number)
  expect(viewBox[2]).toBeLessThan(2000)
  expect(viewBox[3]).toBeLessThan(2000)
  expect(overview).toContain('data-layer="TOP"')
  expect(overview).toContain('data-layer="TOPOVERLAY"')
  expect(overview).not.toContain('data-layer="MECHANICAL')
  expect(overview).not.toContain('data-record="Dimension"')
  const dimensions = renderProjectDocument({
    documentId: pcb.id,
    state,
    viewId: "layer:MECHANICAL2",
  })
  expect(dimensions).toContain('data-record="Dimension"')
  const complete = renderProjectDocument({
    documentId: pcb.id,
    state,
    viewId: "board",
  })
  expect(complete).toContain('data-record="Dimension"')
})
