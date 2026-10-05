import { decodeAltiumWideString } from "../decode-altium-wide-string"
import type { AltiumRecord } from "../records/altium-record"
import { getPcbMeasurement } from "./altium-values"
import { getPcbTextPositioning } from "./pcb-text-positioning"
import { getArialTextWidth } from "./pcb-text-width"
import type { SvgViewport } from "./svg-types"
import { escapeXml, formatSvgNumber } from "./svg-utils"

export function renderPcbText({
  record,
  recordIndex,
  text,
  metadata,
  color,
  viewport,
}: {
  record: AltiumRecord
  recordIndex: number
  text?: string
  metadata: string
  color: string
  viewport: SvgViewport
}): string | undefined {
  const recordText =
    text ??
    (decodeAltiumWideString(record.getDecoded("WIDESTRING")) ||
      record.getDecoded("TEXT") ||
      "")
  const normalizedText = trimPcbTextLineEnds(recordText)
  if (!normalizedText) return undefined
  const x = viewport.toX(getPcbMeasurement(record, "X"))
  const y = viewport.toY(getPcbMeasurement(record, "Y"))
  const height = Math.max(getPcbMeasurement(record, "HEIGHT", 30), 3)
  const rotation = Number(record.getCaseInsensitive("ROTATION") ?? 0)
  const mirror = record.getBoolean("MIRROR") ? -1 : 1
  const fontName = record.getDecoded("FONTNAME") || "Arial"
  const fontWeight = record.getBoolean("BOLD") ? "bold" : "normal"
  const fontStyle = record.getBoolean("ITALIC") ? "italic" : "normal"
  const positioning = getPcbTextPositioning(record.getNumber("JUSTIFICATION"))
  const lines = normalizedText.split("\n")
  let textContent = escapeXml(normalizedText)
  if (lines.length > 1) {
    textContent = lines
      .map((line, index) => {
        const dy = index === 0 ? "0" : formatSvgNumber(height * 1.2)
        return `<tspan x="0" dy="${dy}">${escapeXml(line)}</tspan>`
      })
      .join("")
  }
  const renderText = (fill: string, attributes = "") =>
    `<text ${attributes} x="0" y="0" fill="${fill}" font-family="${escapeXml(fontName)}, sans-serif" font-size="${formatSvgNumber(height)}" font-weight="${fontWeight}" font-style="${fontStyle}" text-anchor="${positioning.anchor}" dominant-baseline="${positioning.baseline}">${textContent}</text>`
  const transform = `translate(${formatSvgNumber(x)} ${formatSvgNumber(y)}) rotate(${formatSvgNumber(-rotation)}) scale(${mirror} 1)`
  if (record.getBoolean("INVERTED")) {
    const margin = Math.max(getPcbMeasurement(record, "MARGINBORDERWIDTH"), 0)
    // Use character advances for Arial instead of treating every letter as wide.
    // Keep the existing estimate for fonts and characters without known metrics.
    const textWidth = Math.max(
      ...lines.map((line) => {
        if (
          fontName.trim().toLowerCase() !== "arial" ||
          /[^\x20-\x7e]/.test(line)
        ) {
          return line.length * height * 0.8
        }
        return getArialTextWidth(
          line,
          height,
          record.getBoolean("BOLD") === true,
        )
      }),
    )
    const textHeight = height * (1 + (lines.length - 1) * 1.2)
    const horizontalOffset = { start: 0, middle: 0.5, end: 1 }[
      positioning.anchor
    ]
    const verticalOffset = {
      "text-before-edge": 0,
      central: 0.5,
      "text-after-edge": 1,
    }[positioning.baseline]
    let left = -textWidth * horizontalOffset - margin
    let top = -height * verticalOffset - margin
    let width = textWidth + 2 * margin
    let boxHeight = textHeight + 2 * margin
    if (record.getBoolean("INVERTEDRECT")) {
      width = getPcbMeasurement(record, "TEXTBOXWIDTH", width)
      boxHeight = getPcbMeasurement(record, "TEXTBOXHEIGHT", boxHeight)
      // Explicit dimensions describe the complete rectangle, including margins.
      left = -width * horizontalOffset
      top = -boxHeight * verticalOffset
    }
    const rectangle = `x="${formatSvgNumber(left)}" y="${formatSvgNumber(top)}" width="${formatSvgNumber(width)}" height="${formatSvgNumber(boxHeight)}"`
    const maskId = `pcb-knockout-${recordIndex}`
    const maskedText = renderText("black")
    return `<g ${metadata} data-knockout="true" transform="${transform}"><defs><mask id="${maskId}" maskUnits="userSpaceOnUse" ${rectangle} style="mask-type:luminance"><rect ${rectangle} fill="white"/>${maskedText}</mask></defs><rect ${rectangle} fill="${color}" mask="url(#${maskId})"/></g>`
  }
  return renderText(color, `${metadata} transform="${transform}"`)
}

function trimPcbTextLineEnds(text: string): string {
  // Match the previous /[ \t]+$/gm behavior exactly. trimEnd() would also
  // remove other Unicode whitespace that can be meaningful in PCB text.
  return text
    .split("\n")
    .map((line) => {
      let end = line.length
      while (end > 0 && (line[end - 1] === " " || line[end - 1] === "\t")) {
        end--
      }
      return line.slice(0, end)
    })
    .join("\n")
}
