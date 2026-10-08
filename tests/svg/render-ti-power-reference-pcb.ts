import {
  parseAltiumBinaryPcbDoc,
  parseAltiumPrjPcb,
  serializeAltiumPcbToSvg,
} from "../../lib"
import { readReference, readReferenceBytes } from "./read-reference"

export async function renderTiPowerReferencePcb({
  filename,
  title,
  projectFilename,
}: {
  filename: string
  title: string
  projectFilename: string
}): Promise<string> {
  const project = parseAltiumPrjPcb(await readReference(projectFilename))
  const source = await readReferenceBytes(filename)
  const document = parseAltiumBinaryPcbDoc(source)
  const bounds = document.boardGeometry.outline.bounds
  if (!bounds) throw new Error(`${filename} does not contain a board outline`)

  // Keep off-board fabrication drawings from shrinking the PCB snapshot.
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  const padding = Math.max(width, height) * 0.05
  return serializeAltiumPcbToSvg(document, {
    title,
    project,
    width: 800,
    height: 600,
    viewBox: {
      x: bounds.minX - padding,
      y: bounds.minY - padding,
      width: width + 2 * padding,
      height: height + 2 * padding,
    },
  })
}
