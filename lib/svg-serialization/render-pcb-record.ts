import { getPcbRegionSemanticKind } from "../pcb-contours"
import type { AltiumRecord } from "../records/altium-record"
import {
  decodeAltiumWideString,
  getPcbMeasurement,
  getPcbRegionContours,
  getPcbVertexPoints,
  parsePcbMeasurement,
} from "./altium-values"
import { getPcbLayerColor, PCB_BOARD_FILL_COLOR } from "./pcb-layer"
import { getPcbPadGeometry } from "./pcb-pad-geometry"
import type { AltiumPcbSvgOptions, SvgPoint, SvgViewport } from "./svg-types"
import {
  escapeXml,
  formatSvgNumber,
  pointsToClosedPath,
  pointsToSvg,
} from "./svg-utils"

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
    const regionKind = getPcbRegionSemanticKind(record)
    if (regionKind === "BOARD_CUTOUT" || regionKind === "LAYER_STACK_REGION") {
      return undefined
    }
    const path = contours
      .map((contour) => pointsToClosedPath(contour, viewport))
      .join(" ")
    if (regionKind === "POLYGON_CUTOUT") {
      return `<path ${metadata} data-region-kind="POLYGON_CUTOUT" d="${path}" fill="${PCB_BOARD_FILL_COLOR}" fill-rule="evenodd" stroke="${PCB_BOARD_FILL_COLOR}" stroke-width="1.5"/>`
    }
    return `<path ${metadata} d="${path}" fill="${color}" fill-opacity="0.32" fill-rule="evenodd" stroke="${color}" stroke-width="1.5"/>`
  }

  if (kind === "ComponentBody") {
    const contours = getPcbRegionContours(record)
    if (contours.length === 0) return undefined
    const path = contours
      .map((contour) => pointsToClosedPath(contour, viewport))
      .join(" ")
    const component = record.getCaseInsensitive("COMPONENT")
    const componentMetadata = component
      ? ` data-component="${escapeXml(component)}"`
      : ""
    return `<path ${metadata}${componentMetadata} d="${path}" fill="${color}" fill-opacity="0.08" fill-rule="evenodd" stroke="${color}" stroke-opacity="0.72" stroke-width="1.5"/>`
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
    const centerX = (x1 + x2) / 2
    const centerY = (y1 + y2) / 2
    const rotation = Number(record.getCaseInsensitive("ROTATION") ?? 0)
    const transform =
      rotation === 0
        ? ""
        : ` transform="rotate(${formatSvgNumber(-rotation)} ${formatSvgNumber(centerX)} ${formatSvgNumber(centerY)})"`
    return `<rect ${metadata} data-keepout="${record.getBoolean("KEEPOUT") === true}" x="${formatSvgNumber(Math.min(x1, x2))}" y="${formatSvgNumber(Math.min(y1, y2))}" width="${formatSvgNumber(Math.abs(x2 - x1))}" height="${formatSvgNumber(Math.abs(y2 - y1))}" fill="${color}" fill-opacity="0.6"${transform}/>`
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

function renderPad(
  record: AltiumRecord,
  viewport: SvgViewport,
  options: AltiumPcbSvgOptions,
  metadata: string,
  color: string,
): string {
  const geometry = getPcbPadGeometry(record, options.layers)
  const x = viewport.toX(geometry.x)
  const y = viewport.toY(geometry.y)
  const transform =
    geometry.rotation === 0
      ? ""
      : ` transform="rotate(${formatSvgNumber(-geometry.rotation)} ${formatSvgNumber(x)} ${formatSvgNumber(y)})"`
  let body: string
  if (geometry.shape === "ROUND" || geometry.shape === "CIRCLE") {
    if (Math.abs(geometry.width - geometry.height) < 0.0001) {
      body = `<circle cx="${formatSvgNumber(x)}" cy="${formatSvgNumber(y)}" r="${formatSvgNumber(geometry.width / 2)}" fill="${color}" stroke="#111827" stroke-width="1"/>`
    } else {
      const radius = Math.min(geometry.width, geometry.height) / 2
      body = renderRoundedRect(
        x,
        y,
        geometry.width,
        geometry.height,
        radius,
        color,
      )
    }
  } else if (
    geometry.shape === "ROUNDRECT" ||
    geometry.shape === "ROUNDEDRECTANGLE"
  ) {
    body = renderRoundedRect(
      x,
      y,
      geometry.width,
      geometry.height,
      geometry.cornerRadius || Math.min(geometry.width, geometry.height) * 0.18,
      color,
    )
  } else if (geometry.shape === "OCTAGONAL" || geometry.shape === "OCTAGON") {
    body = renderOctagonalPad(x, y, geometry.width, geometry.height, color)
  } else {
    body = `<rect x="${formatSvgNumber(x - geometry.width / 2)}" y="${formatSvgNumber(y - geometry.height / 2)}" width="${formatSvgNumber(geometry.width)}" height="${formatSvgNumber(geometry.height)}" fill="${color}" stroke="#111827" stroke-width="1"/>`
  }

  const hole =
    options.showHoles !== false && geometry.holeSize > 0
      ? renderPadHole(geometry, x, y)
      : ""
  const padName = record.getDecoded("NAME")
  const nameMetadata = padName ? ` data-pad-name="${escapeXml(padName)}"` : ""
  const padMode = record.getCaseInsensitive("PADSTACKMODE")
  const modeMetadata = padMode
    ? ` data-pad-stack-mode="${escapeXml(padMode)}"`
    : ""
  return `<g ${metadata}${nameMetadata} data-pad-shape="${escapeXml(geometry.shape)}" data-pad-stack-layer="${geometry.layerOrdinal}"${modeMetadata} data-plated="${geometry.plated}"${transform}>${body}${hole}</g>`
}

function renderRoundedRect(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string,
): string {
  return `<rect x="${formatSvgNumber(x - width / 2)}" y="${formatSvgNumber(y - height / 2)}" width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}" rx="${formatSvgNumber(radius)}" ry="${formatSvgNumber(radius)}" fill="${color}" stroke="#111827" stroke-width="1"/>`
}

function renderOctagonalPad(
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): string {
  const halfWidth = width / 2
  const halfHeight = height / 2
  const chamfer = Math.min(width, height) / 4
  const points = [
    `${formatSvgNumber(x - halfWidth + chamfer)},${formatSvgNumber(y - halfHeight)}`,
    `${formatSvgNumber(x + halfWidth - chamfer)},${formatSvgNumber(y - halfHeight)}`,
    `${formatSvgNumber(x + halfWidth)},${formatSvgNumber(y - halfHeight + chamfer)}`,
    `${formatSvgNumber(x + halfWidth)},${formatSvgNumber(y + halfHeight - chamfer)}`,
    `${formatSvgNumber(x + halfWidth - chamfer)},${formatSvgNumber(y + halfHeight)}`,
    `${formatSvgNumber(x - halfWidth + chamfer)},${formatSvgNumber(y + halfHeight)}`,
    `${formatSvgNumber(x - halfWidth)},${formatSvgNumber(y + halfHeight - chamfer)}`,
    `${formatSvgNumber(x - halfWidth)},${formatSvgNumber(y - halfHeight + chamfer)}`,
  ].join(" ")
  return `<polygon points="${points}" fill="${color}" stroke="#111827" stroke-width="1"/>`
}

function renderPadHole(
  geometry: ReturnType<typeof getPcbPadGeometry>,
  padX: number,
  padY: number,
): string {
  const x = padX + geometry.holeOffsetX
  const y = padY - geometry.holeOffsetY
  const stroke = geometry.plated ? "" : ' stroke="#f8fafc" stroke-width="1.5"'

  if (geometry.holeShape === "SLOT") {
    const length = Math.max(geometry.slotLength, geometry.holeSize)
    const transform =
      geometry.holeRotation === 0
        ? ""
        : ` transform="rotate(${formatSvgNumber(-geometry.holeRotation)} ${formatSvgNumber(x)} ${formatSvgNumber(y)})"`
    return `<rect data-hole-shape="SLOT" x="${formatSvgNumber(x - length / 2)}" y="${formatSvgNumber(y - geometry.holeSize / 2)}" width="${formatSvgNumber(length)}" height="${formatSvgNumber(geometry.holeSize)}" rx="${formatSvgNumber(geometry.holeSize / 2)}" ry="${formatSvgNumber(geometry.holeSize / 2)}" fill="#111827"${stroke}${transform}/>`
  }

  if (geometry.holeShape === "SQUARE") {
    return `<rect data-hole-shape="SQUARE" x="${formatSvgNumber(x - geometry.holeSize / 2)}" y="${formatSvgNumber(y - geometry.holeSize / 2)}" width="${formatSvgNumber(geometry.holeSize)}" height="${formatSvgNumber(geometry.holeSize)}" fill="#111827"${stroke}/>`
  }

  return `<circle data-hole-shape="ROUND" cx="${formatSvgNumber(x)}" cy="${formatSvgNumber(y)}" r="${formatSvgNumber(geometry.holeSize / 2)}" fill="#111827"${stroke}/>`
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
