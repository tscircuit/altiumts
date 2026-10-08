import type { AltiumRecord } from "../records/altium-record"
import { getPcbMeasurement } from "./altium-values"
import { getPcbTextLayout } from "./pcb-text-layout"
import type { SvgViewport } from "./svg-types"
import { escapeXml, formatSvgNumber } from "./svg-utils"

export function renderPcbText({
  record,
  recordIndex,
  idPrefix,
  text,
  metadata,
  color,
  viewport,
}: {
  record: AltiumRecord
  recordIndex: number
  idPrefix: string
  text?: string
  metadata: string
  color: string
  viewport: SvgViewport
}): string | undefined {
  const { normalizedText, height, fontName, positioning, lines, knockout } =
    getPcbTextLayout(record, text)
  if (!normalizedText) return undefined
  const x = viewport.toX(getPcbMeasurement(record, "X"))
  const y = viewport.toY(getPcbMeasurement(record, "Y"))
  const rotation = Number(record.getCaseInsensitive("ROTATION") ?? 0)
  const mirror = record.getBoolean("MIRROR") ? -1 : 1
  const fontWeight = record.getBoolean("BOLD") ? "bold" : "normal"
  const fontStyle = record.getBoolean("ITALIC") ? "italic" : "normal"
  let textContent = escapeXml(normalizedText)
  if (lines.length > 1) {
    textContent = lines
      .map((line, index) => {
        const dy = index === 0 ? "0" : formatSvgNumber(height * 1.2)
        return `<tspan x="0" dy="${dy}">${escapeXml(line)}</tspan>`
      })
      .join("")
  }
  const renderText = (fill: string, attributes = "", textY = 0) =>
    `<text ${attributes} x="0" y="${formatSvgNumber(textY)}" fill="${fill}" font-family="${escapeXml(fontName)}, sans-serif" font-size="${formatSvgNumber(height)}" font-weight="${fontWeight}" font-style="${fontStyle}" text-anchor="${positioning.anchor}" dominant-baseline="${positioning.baseline}">${textContent}</text>`
  const transform = `translate(${formatSvgNumber(x)} ${formatSvgNumber(y)}) rotate(${formatSvgNumber(-rotation)}) scale(${mirror} 1)`
  if (knockout) {
    const { left, top, width, height: boxHeight } = knockout
    const rectangle = `x="${formatSvgNumber(left)}" y="${formatSvgNumber(top)}" width="${formatSvgNumber(width)}" height="${formatSvgNumber(boxHeight)}"`
    const maskId = `pcb-${idPrefix}-knockout-${recordIndex}`
    const maskedText = renderText("black", "", knockout.textY)
    return `<g ${metadata} data-knockout="true" transform="${transform}"><defs><mask id="${maskId}" maskUnits="userSpaceOnUse" ${rectangle} style="mask-type:luminance"><rect ${rectangle} fill="white"/>${maskedText}</mask></defs><rect ${rectangle} fill="${color}" mask="url(#${maskId})"/></g>`
  }
  return renderText(color, `${metadata} transform="${transform}"`)
}
