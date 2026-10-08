import { readFile } from "node:fs/promises"

const references = {
  pmp22712: {
    title: "PMP22712 E2",
    width: 986,
    height: 954,
    board: { x: 80, y: 214, width: 848, height: 695 },
  },
  pmp22773: {
    title: "PMP22773 E3",
    width: 1034,
    height: 1188,
    board: { x: 148, y: 260, width: 704, height: 746 },
  },
} as const

export async function renderAltiumReferenceComparison({
  reference,
  converterSvg,
}: {
  reference: keyof typeof references
  converterSvg: string
}): Promise<string> {
  const { title, width, height, board } = references[reference]
  const image = await readFile(
    new URL(`../fixtures/altium-reference/${reference}.png`, import.meta.url),
  )
  // Align the screenshot's board rectangle with the existing full-board
  // snapshot, which adds 5% padding around the PCB outline. Keep the image's
  // aspect ratio and pixels intact; screenshot bounds are approximate.
  const padding = Math.max(board.width, board.height) * 0.05
  const viewBox = [
    board.x - padding,
    board.y - padding,
    board.width + padding * 2,
    board.height + padding * 2,
  ].join(" ")

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1656" height="714" viewBox="0 0 1656 714" role="img" aria-label="${title}: real Altium reference and current AltiumTS, side by side">
  <title>${title}: real Altium versus current AltiumTS</title>
  <rect width="1656" height="714" fill="#171a20"/>
  <g fill="#f5f5f5" font-family="Arial, sans-serif" font-size="22">
    <text x="16" y="30">${title} — real Altium reference</text>
    <text x="840" y="30">${title} — current AltiumTS</text>
  </g>
  <g fill="#c6cbd3" font-family="Arial, sans-serif" font-size="16">
    <text x="16" y="55">Original uploaded screenshot, aligned to the board outline</text>
    <text x="840" y="55">Existing PCB snapshot output, with its default visible layers</text>
  </g>
  <svg x="16" y="70" width="800" height="600" viewBox="${viewBox}">
    <title>Original Altium reference pixels</title>
    <image width="${width}" height="${height}" href="data:image/png;base64,${image.toString("base64")}"/>
  </svg>
  <g transform="translate(840 70)">${converterSvg}</g>
  <text x="16" y="699" fill="#c6cbd3" font-family="Arial, sans-serif" font-size="16">Baseline comparison: text, colors, layer visibility and dimension differences remain visible. No rendering fixes applied.</text>
</svg>`
}
