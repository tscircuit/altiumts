import { decodeAltiumWideString } from "../decode-altium-wide-string"
import type { AltiumRecord } from "../records/altium-record"
import { getPcbMeasurement } from "./altium-values"
import { getPcbTextPositioning } from "./pcb-text-positioning"

export function getPcbTextLayout(record: AltiumRecord, text?: string) {
  const normalizedText = trimPcbTextLineEnds(
    text ??
      (decodeAltiumWideString(record.getDecoded("WIDESTRING")) ||
        record.getDecoded("TEXT") ||
        ""),
  )
  const height = Math.max(getPcbMeasurement(record, "HEIGHT", 30), 3)
  const fontName = record.getDecoded("FONTNAME") || "Arial"
  const positioning = getPcbTextPositioning(record.getNumber("JUSTIFICATION"))
  const lines = normalizedText.split("\n")
  const layout = { normalizedText, height, fontName, positioning, lines }
  if (!record.getBoolean("INVERTED")) return { ...layout, knockout: undefined }
  const margin = Math.max(getPcbMeasurement(record, "MARGINBORDERWIDTH"), 0)
  const textWidth = Math.max(...lines.map((line) => line.length)) * height * 0.8
  const textHeight = height * (1 + (lines.length - 1) * 1.2)
  const horizontalOffset = { start: 0, middle: 0.5, end: 1 }[positioning.anchor]
  const verticalOffset = {
    "text-before-edge": 0,
    central: 0.5,
    "text-after-edge": 1,
  }[positioning.baseline]
  let left = -textWidth * horizontalOffset - margin
  let top = -textHeight * verticalOffset - margin
  let width = textWidth + 2 * margin
  let boxHeight = textHeight + 2 * margin
  if (record.getBoolean("INVERTEDRECT")) {
    width = getPcbMeasurement(record, "TEXTBOXWIDTH", width)
    boxHeight = getPcbMeasurement(record, "TEXTBOXHEIGHT", boxHeight)
    // Explicit dimensions include margins and align as a complete rectangle.
    left = -width * horizontalOffset
    top = -boxHeight * verticalOffset
  }
  return {
    ...layout,
    knockout: {
      left,
      top,
      width,
      height: boxHeight,
      textY: -(textHeight - height) * verticalOffset,
    },
  }
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
