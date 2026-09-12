import { expect, test } from "bun:test"
import {
  type AltiumPcbDocument,
  parseAltiumFile,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { readReferenceBytes } from "./read-reference"

const existingPcbSnapshotDocuments = [
  {
    filename: "c17-main.PcbDoc",
    topPads: 189,
    totalVias: 0,
    topTentedVias: 0,
    topVias: 0,
    renderedPads: 189,
    renderedVias: 0,
  },
  {
    filename: "elk-pi.PcbDoc",
    topPads: 980,
    totalVias: 499,
    topTentedVias: 496,
    topVias: 3,
    renderedPads: 980,
    renderedVias: 3,
  },
  {
    filename: "novena-edp-adapter-dvt1.PcbDoc",
    topPads: 298,
    totalVias: 214,
    topTentedVias: 212,
    topVias: 2,
    renderedPads: 297,
    renderedVias: 2,
  },
  {
    filename: "stm32-st-link-v2.PcbDoc",
    topPads: 75,
    totalVias: 65,
    topTentedVias: 65,
    topVias: 0,
    renderedPads: 75,
    renderedVias: 0,
  },
] as const

for (const {
  filename,
  topPads,
  totalVias,
  topTentedVias,
  topVias,
  renderedPads,
  renderedVias,
} of existingPcbSnapshotDocuments) {
  test(`renders top-solder openings in ${filename}`, async () => {
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
    const allVias = document.records.filter(
      (record) => record.recordKind === "Via",
    )
    const tentedVias = allVias.filter(
      (record) => record.getBoolean("TENTEDTOP") === true,
    )
    const vias = allVias.filter(
      (record) => record.getBoolean("TENTEDTOP") !== true,
    )
    const svg = serializeAltiumPcbLayerToSvg(document, "TOPSOLDER", {
      title: `${filename} — Top Solder Mask`,
    })

    expect(pads).toHaveLength(topPads)
    expect(allVias).toHaveLength(totalVias)
    expect(tentedVias).toHaveLength(topTentedVias)
    expect(vias).toHaveLength(topVias)
    expect(
      svg.match(/data-record="Pad" data-layer="TOPSOLDER"/g) ?? [],
    ).toHaveLength(renderedPads)
    expect(
      svg.match(/data-record="Via" data-layer="TOPSOLDER"/g) ?? [],
    ).toHaveLength(renderedVias)
    expect(svg).not.toContain("data-hole-shape")
    await expect(svg).toMatchSvgSnapshot(
      import.meta.path,
      filename.replace(/\.PcbDoc$/i, ""),
    )
  }, 30_000)
}
