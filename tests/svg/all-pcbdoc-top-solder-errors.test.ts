import { expect, test } from "bun:test"
import {
  type AltiumPcbDocument,
  parseAltiumFile,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"

// Keep this repro scoped to reference boards that already have SVG snapshots.
const existingPcbSnapshotDocuments = [
  { filename: "c17-main.PcbDoc", topPads: 189, topVias: 0 },
  { filename: "elk-pi.PcbDoc", topPads: 980, topVias: 3 },
  {
    filename: "novena-edp-adapter-dvt1.PcbDoc",
    topPads: 298,
    topVias: 2,
  },
  { filename: "stm32-st-link-v2.PcbDoc", topPads: 75, topVias: 0 },
] as const

for (const { filename, topPads, topVias } of existingPcbSnapshotDocuments) {
  test(`reproduces missing top-solder openings in ${filename}`, async () => {
    const source = await readReferenceBytes(filename)
    const result = parseAltiumFile(source)

    expect(result.detection.documentKind).toBe("pcb-document")
    const document = result.document as AltiumPcbDocument
    const pads = document.records.filter(
      (record) =>
        record.recordKind === "Pad" &&
        ["MULTILAYER", "TOP"].includes(
          record.getCaseInsensitive("LAYER") ?? "",
        ),
    )
    const vias = document.records.filter(
      (record) =>
        record.recordKind === "Via" && record.getBoolean("TENTEDTOP") !== true,
    )
    const svg = serializeAltiumPcbLayerToSvg(document, "TOPSOLDER", {
      title: `${filename} — Top Solder Mask`,
    })

    expect(pads).toHaveLength(topPads)
    expect(vias).toHaveLength(topVias)
    expect(svg).not.toContain('data-record="Pad"')
    expect(svg).not.toContain('data-record="Via"')
    await expect(svg).toMatchSvgSnapshot(
      import.meta.path,
      filename.replace(/\.PcbDoc$/i, ""),
    )
  }, 30_000)
}
