import { expect, test } from "bun:test"
import { isAltiumPcbCopperLayerName } from "../lib"
import { parseBrowserProjectFiles } from "../site/src/parse-project"
import { readReferenceBytes } from "./svg/read-reference"

test("deduplicates physical layer aliases in the TI AM62L viewer menu", async () => {
  const source = await readReferenceBytes("ti-tmds62levm-rev-b.PcbDoc")
  const { manifest } = parseBrowserProjectFiles([
    {
      bytes: source.buffer.slice(
        source.byteOffset,
        source.byteOffset + source.byteLength,
      ) as ArrayBuffer,
      path: "PROC181E1-1_BRD_11_3.pcbdoc",
    },
  ])
  const pcbDocument = manifest.documents[0]
  const copperLayers = pcbDocument?.views
    .map(({ layer }) => layer)
    .filter(
      (layer): layer is string =>
        layer !== undefined &&
        layer !== "MULTILAYER" &&
        isAltiumPcbCopperLayerName(layer),
    )

  expect(copperLayers).toEqual([
    "TOP",
    "MID1",
    "MID2",
    "MID3",
    "MID4",
    "BOTTOM",
  ])
  expect(
    pcbDocument?.views.some(({ layer }) => layer === "MECHANICAL1"),
  ).toBeTrue()
}, 60_000)
