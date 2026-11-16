import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbLayerToSvg,
} from "../../lib"
import { readReferenceBytes } from "../svg/read-reference"

const boards = [
  {
    filename: "elk-pi.PcbDoc",
    renderedPads: 980,
    renderedVias: 3,
    snapshotName: "elk-pi",
    sourceVias: 499,
    topTentedVias: 496,
    title: "Elk Pi Top Solder Mask",
  },
  {
    filename: "stm32-st-link-v2.PcbDoc",
    renderedPads: 75,
    renderedVias: 0,
    snapshotName: "stm32-st-link-v2",
    sourceVias: 65,
    topTentedVias: 65,
    title: "STM32 ST-Link V2.1 Top Solder Mask",
  },
] as const

for (const board of boards) {
  test(`renders the top solder mask for ${board.filename}`, async () => {
    const source = await readReferenceBytes(board.filename)
    const document = parseAltiumBinaryPcbDoc(source)
    const svg = serializeAltiumPcbLayerToSvg(document, "TOPSOLDER", {
      title: board.title,
    })

    const sourceVias = document.records.filter(
      (record) => record.recordKind === "Via",
    )
    const topTentedVias = sourceVias.filter(
      (record) =>
        (record.getBoolean("TENTEDTOP") ?? record.getBoolean("TENTINGTOP")) ===
        true,
    )

    expect(sourceVias).toHaveLength(board.sourceVias)
    expect(topTentedVias).toHaveLength(board.topTentedVias)
    expect(
      svg.match(/data-record="Pad" data-layer="TOPSOLDER"/g) ?? [],
    ).toHaveLength(board.renderedPads)
    expect(
      svg.match(/data-record="Via" data-layer="TOPSOLDER"/g) ?? [],
    ).toHaveLength(board.renderedVias)
    expect(svg).not.toContain("data-hole-shape")
    expect(svg).not.toContain("data-overlay")

    await expect(svg).toMatchSvgSnapshot(import.meta.path, board.snapshotName)
  }, 30_000)
}
