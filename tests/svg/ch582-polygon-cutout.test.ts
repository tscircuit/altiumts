import { expect, test } from "bun:test"
import {
  getAltiumBounds,
  getPcbContour,
  parseAltiumPcbDoc,
  serializeAltiumPcbToSvg,
} from "../../lib"
import { readReference } from "./read-reference"

test("renders the full CH582 board", async () => {
  const document = parseAltiumPcbDoc(await readReference("ch582.PcbDoc"))
  const bounds = getAltiumBounds(
    document.polygons.flatMap((polygon) => getPcbContour(polygon).points),
  )
  if (!bounds) throw new Error("CH582 copper polygons have no bounds")

  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)
  const viewBoxSide = span * 1.1
  const svg = serializeAltiumPcbToSvg(document, {
    title: "CH582 full PCB",
    width: 800,
    height: 800,
    showBoardOutline: false,
    viewBox: {
      x: (bounds.minX + bounds.maxX - viewBoxSide) / 2,
      y: (bounds.minY + bounds.maxY - viewBoxSide) / 2,
      width: viewBoxSide,
      height: viewBoxSide,
    },
  })

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
