import { expect, test } from "bun:test"
import { parseBrowserProjectFiles } from "../site/src/parse-project"
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
