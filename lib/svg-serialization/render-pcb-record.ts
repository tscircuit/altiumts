import type { AltiumRecord } from "../records/altium-record"
import {
  decodeAltiumWideString,
  getPcbMeasurement,
  getPcbRegionContours,
  getPcbVertexPoints,
  parsePcbMeasurement,
} from "./altium-values"
import { getPcbLayerColor } from "./pcb-layer"
import type { AltiumPcbSvgOptions, SvgPoint, SvgViewport } from "./svg-types"
import { escapeXml, formatSvgNumber, pointsToSvg } from "./svg-utils"

export function renderPcbRecord(
  record: AltiumRecord,
  viewport: SvgViewport,
  options: AltiumPcbSvgOptions,
): string | undefined {
  const kind = record.recordKind
  const layer = record.getCaseInsensitive("LAYER")
  const color = getPcbLayerColor(layer)
  const metadata = `data-record="${escapeXml(kind ?? "Unknown")}"${layer ? ` data-layer="${escapeXml(layer)}"` : ""}`

  if (kind === "Track") {
    const x1 = viewport.toX(getPcbMeasurement(record, "X1"))
    const y1 = viewport.toY(getPcbMeasurement(record, "Y1"))
    const x2 = viewport.toX(getPcbMeasurement(record, "X2"))
    const y2 = viewport.toY(getPcbMeasurement(record, "Y2"))
    const width = Math.max(getPcbMeasurement(record, "WIDTH", 4), 0.5)
    return `<line ${metadata} x1="${formatSvgNumber(x1)}" y1="${formatSvgNumber(y1)}" x2="${formatSvgNumber(x2)}" y2="${formatSvgNumber(y2)}" stroke="${color}" stroke-width="${formatSvgNumber(width)}"/>`
  }

  if (kind === "Arc") {
    const center = {
      x: getPcbMeasurement(record, "LOCATION.X"),
      y: getPcbMeasurement(record, "LOCATION.Y"),
    }
    const radius = getPcbMeasurement(record, "RADIUS")
    const startAngle = Number(record.getCaseInsensitive("STARTANGLE") ?? 0)
    const endAngle = Number(record.getCaseInsensitive("ENDANGLE") ?? 360)
    const points = approximateArc(center, radius, startAngle, endAngle)
    const width = Math.max(getPcbMeasurement(record, "WIDTH", 4), 0.5)
    return `<polyline ${metadata} points="${pointsToSvg(points, viewport)}" fill="none" stroke="${color}" stroke-width="${formatSvgNumber(width)}"/>`
  }

  if (kind === "Pad") {
    return renderPad(record, viewport, options, metadata, color)
  }

  if (kind === "Via") {
    return renderVia(record, viewport, options, metadata)
  }

  if (kind === "Region") {
    const contours = getPcbRegionContours(record)
    if (contours.length === 0) return undefined
    const path = contours
      .map((contour) => pointsToClosedPath(contour, viewport))
      .join(" ")
    return `<path ${metadata} d="${path}" fill="${color}" fill-opacity="0.32" fill-rule="evenodd" stroke="${color}" stroke-width="1.5"/>`
  }

  if (kind === "Polygon") {
    const points = getPcbVertexPoints(record)
    if (points.length < 3) return undefined
    return `<polygon ${metadata} points="${pointsToSvg(points, viewport)}" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="1.5"/>`
  }

  if (kind === "Fill") {
    const x1 = viewport.toX(getPcbMeasurement(record, "X1"))
    const y1 = viewport.toY(getPcbMeasurement(record, "Y1"))
    const x2 = viewport.toX(getPcbMeasurement(record, "X2"))
    const y2 = viewport.toY(getPcbMeasurement(record, "Y2"))
    return `<rect ${metadata} x="${formatSvgNumber(Math.min(x1, x2))}" y="${formatSvgNumber(Math.min(y1, y2))}" width="${formatSvgNumber(Math.abs(x2 - x1))}" height="${formatSvgNumber(Math.abs(y2 - y1))}" fill="${color}" fill-opacity="0.6"/>`
  }

  if (kind === "Text" && options.showText !== false) {
    const text =
      decodeAltiumWideString(record.getDecoded("WIDESTRING")) ||
      record.getDecoded("TEXT") ||
      ""
    const normalizedText = text.replace(/[ \t]+$/gm, "")
    if (!normalizedText) return undefined
    const x = viewport.toX(getPcbMeasurement(record, "X"))
    const y = viewport.toY(getPcbMeasurement(record, "Y"))
    const height = Math.max(getPcbMeasurement(record, "HEIGHT", 30), 3)
    const rotation = Number(record.getCaseInsensitive("ROTATION") ?? 0)
    const mirror = record.getBoolean("MIRROR") ? -1 : 1
    const fontName = record.getDecoded("FONTNAME") || "Arial"
    const fontWeight = record.getBoolean("BOLD") ? "bold" : "normal"
    const fontStyle = record.getBoolean("ITALIC") ? "italic" : "normal"
    const lines = normalizedText.split("\n")
    const textContent =
      lines.length === 1
        ? escapeXml(normalizedText)
        : lines
            .map(
              (line, index) =>
                `<tspan x="0" dy="${index === 0 ? "0" : formatSvgNumber(height * 1.2)}">${escapeXml(line)}</tspan>`,
            )
            .join("")
    return `<text ${metadata} x="0" y="0" fill="${color}" font-family="${escapeXml(fontName)}, sans-serif" font-size="${formatSvgNumber(height)}" font-weight="${fontWeight}" font-style="${fontStyle}" dominant-baseline="central" transform="translate(${formatSvgNumber(x)} ${formatSvgNumber(y)}) rotate(${formatSvgNumber(-rotation)}) scale(${mirror} 1)">${textContent}</text>`
  }

  if (kind === "Component" && options.showComponentOrigins) {
    const x = viewport.toX(getPcbMeasurement(record, "X"))
    const y = viewport.toY(getPcbMeasurement(record, "Y"))
    return `<path ${metadata} d="M ${formatSvgNumber(x - 8)} ${formatSvgNumber(y)} H ${formatSvgNumber(x + 8)} M ${formatSvgNumber(x)} ${formatSvgNumber(y - 8)} V ${formatSvgNumber(y + 8)}" fill="none" stroke="#f472b6" stroke-width="2"/>`
  }

  return undefined
}

function pointsToClosedPath(points: SvgPoint[], viewport: SvgViewport): string {
  return points
    .map((point, index) => {
      const command = index === 0 ? "M" : "L"
      return `${command} ${formatSvgNumber(viewport.toX(point.x))} ${formatSvgNumber(viewport.toY(point.y))}`
    })
    .concat("Z")
    .join(" ")
}

function renderPad(
  record: AltiumRecord,
  viewport: SvgViewport,
  options: AltiumPcbSvgOptions,
  metadata: string,
  color: string,
): string {
  const x = viewport.toX(getPcbMeasurement(record, "X"))
  const y = viewport.toY(getPcbMeasurement(record, "Y"))
  const width =
    parsePcbMeasurement(record.getCaseInsensitive("XSIZE")) ??
    parsePcbMeasurement(record.getCaseInsensitive("TOPXSIZE")) ??
    20
  const height =
    parsePcbMeasurement(record.getCaseInsensitive("YSIZE")) ??
    parsePcbMeasurement(record.getCaseInsensitive("TOPYSIZE")) ??
    width
  const rotation = Number(record.getCaseInsensitive("ROTATION") ?? 0)
  const shape = record.getCaseInsensitive("SHAPE")?.toUpperCase() ?? "ROUND"
  const transform =
    rotation === 0
      ? ""
      : ` transform="rotate(${formatSvgNumber(-rotation)} ${formatSvgNumber(x)} ${formatSvgNumber(y)})"`
  let body: string
  if (shape === "ROUND" || shape === "CIRCLE") {
    if (Math.abs(width - height) < 0.0001) {
      body = `<circle cx="${formatSvgNumber(x)}" cy="${formatSvgNumber(y)}" r="${formatSvgNumber(width / 2)}" fill="${color}" stroke="#111827" stroke-width="1"${transform}/>`
    } else {
      const radius = Math.min(width, height) / 2
      body = `<rect x="${formatSvgNumber(x - width / 2)}" y="${formatSvgNumber(y - height / 2)}" width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}" rx="${formatSvgNumber(radius)}" ry="${formatSvgNumber(radius)}" fill="${color}" stroke="#111827" stroke-width="1"${transform}/>`
    }
  } else {
    body = `<rect x="${formatSvgNumber(x - width / 2)}" y="${formatSvgNumber(y - height / 2)}" width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}" rx="${formatSvgNumber(shape.includes("ROUND") ? Math.min(width, height) * 0.18 : 0)}" fill="${color}" stroke="#111827" stroke-width="1"${transform}/>`
  }
  const holeSize = getPcbMeasurement(record, "HOLESIZE")
  const hole =
    options.showHoles !== false && holeSize > 0
      ? `<circle cx="${formatSvgNumber(x)}" cy="${formatSvgNumber(y)}" r="${formatSvgNumber(holeSize / 2)}" fill="#111827"/>`
      : ""
  return `<g ${metadata}>${body}${hole}</g>`
}

function renderVia(
  record: AltiumRecord,
  viewport: SvgViewport,
  options: AltiumPcbSvgOptions,
  metadata: string,
): string {
  const x = viewport.toX(getPcbMeasurement(record, "X"))
  const y = viewport.toY(getPcbMeasurement(record, "Y"))
  const diameter =
    parsePcbMeasurement(record.getCaseInsensitive("DIAMETER")) ??
    parsePcbMeasurement(record.getCaseInsensitive("TOPLAYERSIZE")) ??
    20
  const holeSize = getPcbMeasurement(record, "HOLESIZE", diameter * 0.45)
  const hole =
    options.showHoles !== false
      ? `<circle cx="${formatSvgNumber(x)}" cy="${formatSvgNumber(y)}" r="${formatSvgNumber(holeSize / 2)}" fill="#111827"/>`
      : ""
  return `<g ${metadata}><circle cx="${formatSvgNumber(x)}" cy="${formatSvgNumber(y)}" r="${formatSvgNumber(diameter / 2)}" fill="#22c55e" stroke="#d1fae5" stroke-width="1.5"/>${hole}</g>`
}

function approximateArc(
  center: SvgPoint,
  radius: number,
  startAngle: number,
  endAngle: number,
): SvgPoint[] {
  const sweep = endAngle - startAngle || 360
  const segments = Math.max(8, Math.ceil(Math.abs(sweep) / 7.5))
  const points: SvgPoint[] = []

  for (let index = 0; index <= segments; index++) {
    const angle = startAngle + (sweep * index) / segments
    const radians = (angle * Math.PI) / 180
    points.push({
      x: center.x + Math.cos(radians) * radius,
      y: center.y + Math.sin(radians) * radius,
    })
  }

  return points
}
