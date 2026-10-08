import { readFile } from "node:fs/promises"

type AltiumReferenceView = {
  title: string
  converterLabel?: string
  image: string
  mimeType: "image/png" | "image/jpeg"
  width: number
  height: number
  viewBox: { x: number; y: number; width: number; height: number }
  canvasBounds?: { x: number; y: number; width: number; height: number }
}

function escapeXml(text: string): string {
  return text.replace(/[&<>"']/gu, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    }[char]!
  })
}

export async function renderAltiumReferenceComparison({
  reference,
  converterSvg,
}: {
  reference: string
  converterSvg: string
}): Promise<string> {
  const directory = new URL("../fixtures/altium-reference/", import.meta.url)
  const view: AltiumReferenceView = JSON.parse(
    await readFile(new URL(`${reference}.json`, directory), "utf8"),
  )
  const image = await readFile(new URL(view.image, directory))
  const openingTag = converterSvg.match(/^<svg\b[^>]*>/u)?.[0] ?? ""
  const panelWidth = Number(openingTag.match(/\bwidth="([\d.]+)"/u)?.[1])
  const panelHeight = Number(openingTag.match(/\bheight="([\d.]+)"/u)?.[1])
  if (!(panelWidth > 0 && panelHeight > 0)) {
    throw new Error("PCB comparison requires numeric SVG width and height")
  }
  const title = escapeXml(view.title)
  const converterLabel = escapeXml(
    view.converterLabel ?? "AltiumTS — current PCB test output",
  )
  const width = 2 * panelWidth + 56
  const height = panelHeight + 114
  const rightX = panelWidth + 40
  const { x, y, width: cropWidth, height: cropHeight } = view.viewBox
  const viewBox = `${x} ${y} ${cropWidth} ${cropHeight}`
  const clipId = `reference-${reference}`
  const canvas = view.canvasBounds
  const clip = canvas
    ? `<defs><clipPath id="${clipId}"><rect x="${canvas.x}" y="${canvas.y}" width="${canvas.width}" height="${canvas.height}"/></clipPath></defs>`
    : ""
  const clipAttribute = canvas ? ` clip-path="url(#${clipId})"` : ""

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-altium-reference="${reference}" role="img" aria-label="${title}: real Altium reference and current AltiumTS, side by side">
  <title>${title}: real Altium versus current AltiumTS</title>
  <rect width="${width}" height="${height}" fill="#171a20"/>
  <g fill="#f5f5f5" font-family="Arial, sans-serif" font-size="22">
    <text x="16" y="30">${title}</text>
  </g>
  <g fill="#c6cbd3" font-family="Arial, sans-serif" font-size="16">
    <text x="16" y="55">Real Altium viewer — original reference pixels</text>
    <text x="${rightX}" y="55">${converterLabel}</text>
  </g>
  <svg x="16" y="70" width="${panelWidth}" height="${panelHeight}" viewBox="${viewBox}">
    <title>Original Altium reference pixels</title>${
      canvas
        ? `
    <rect x="${x}" y="${y}" width="${cropWidth}" height="${cropHeight}" fill="#ccc"/>
    ${clip}`
        : ""
    }
    <image${clipAttribute} width="${view.width}" height="${view.height}" href="data:${view.mimeType};base64,${image.toString("base64")}"/>
  </svg>
  <g transform="translate(${rightX} 70)">${converterSvg}</g>
  <text x="16" y="${height - 15}" fill="#c6cbd3" font-family="Arial, sans-serif" font-size="16">Same PCB and crop. Current rendering differences are preserved.</text>
</svg>`
}
