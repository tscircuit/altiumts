import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../../lib"

function renderAlignmentBoard() {
  const records = [
    "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=1500mil|VY1=0mil|VX2=1500mil|VY2=900mil|VX3=0mil|VY3=900mil",
  ]
  const alignments = [
    "top_left",
    "center_left",
    "bottom_left",
    "top_center",
    "center",
    "bottom_center",
    "top_right",
    "center_right",
    "bottom_right",
  ]
  for (const [index, text] of alignments.entries()) {
    const column = Math.floor(index / 3)
    const row = index % 3
    const x = 250 + column * 500
    const y = 700 - row * 250
    records.push(
      `|RECORD=Text|LAYER=TOPOVERLAY|X=${x}mil|Y=${y}mil|HEIGHT=30mil|TEXT=${text}|JUSTIFICATION=${index + 1}|INVERTED=TRUE|MARGINBORDERWIDTH=10mil`,
    )
    records.push(
      `|RECORD=Track|LAYER=TOP|X1=${x - 20}mil|Y1=${y}mil|X2=${x + 20}mil|Y2=${y}mil|WIDTH=3mil`,
    )
    records.push(
      `|RECORD=Track|LAYER=TOP|X1=${x}mil|Y1=${y - 20}mil|X2=${x}mil|Y2=${y + 20}mil|WIDTH=3mil`,
    )
  }
  const svg = serializeAltiumPcbToSvg(parseAltiumPcbDoc(records.join("\n")), {
    layerDrawingOrder: ["TOP", "TOPOVERLAY"],
  })
  return { svg, alignments }
}

test("shows knockout text against anchors for all nine alignments", async () => {
  const { svg } = renderAlignmentBoard()
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})

test("renders knockout backgrounds at all nine anchors", () => {
  const { svg, alignments } = renderAlignmentBoard()
  expect(svg.match(/data-knockout="true"/g)).toHaveLength(9)
  for (const [index, text] of alignments.entries()) {
    const left = -(Math.floor(index / 3) * text.length * 30 * 0.8) / 2 - 10
    const top = -(index % 3) * 15
    expect(svg).toContain(`x="${left}" y="${top - 10}"`)
  }
})
