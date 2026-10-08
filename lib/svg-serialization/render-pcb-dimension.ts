import type { AltiumRecord } from "../records/altium-record"
import { getPcbDimensionGeometry } from "./pcb-dimension-geometry"
import type { SvgPoint, SvgViewport } from "./svg-types"
import { escapeXml, formatSvgNumber } from "./svg-utils"

export function renderPcbDimension({
  color,
  metadata,
  record,
  viewport,
}: {
  color: string
  metadata: string
  record: AltiumRecord
  viewport: SvgViewport
}): string | undefined {
  const geometry = getPcbDimensionGeometry(record)
  if (!geometry) return undefined

  const dimensionStart = toViewportPoint({
    point: geometry.dimensionStart,
    viewport,
  })
  const dimensionEnd = toViewportPoint({
    point: geometry.dimensionEnd,
    viewport,
  })
  const textPosition = toViewportPoint({
    point: geometry.textPosition,
    viewport,
  })
  const measuredDeltaX = dimensionEnd.x - dimensionStart.x
  const measuredDeltaY = dimensionEnd.y - dimensionStart.y
  const measuredLength = Math.hypot(measuredDeltaX, measuredDeltaY)
  const directionX = measuredDeltaX / measuredLength
  const directionY = measuredDeltaY / measuredLength
  const perpendicularX = -directionY
  const perpendicularY = directionX
  const arrowHalfWidth =
    geometry.arrowSize * (geometry.openArrows ? Math.sin(Math.PI / 9) : 0.35)
  const arrowDepth =
    geometry.arrowSize * (geometry.openArrows ? Math.cos(Math.PI / 9) : 1)
  const arrowDirection = geometry.arrowsOutside ? -1 : 1
  const startArrowPoints: [SvgPoint, SvgPoint, SvgPoint] = [
    dimensionStart,
    {
      x:
        dimensionStart.x +
        directionX * arrowDepth * arrowDirection +
        perpendicularX * arrowHalfWidth,
      y:
        dimensionStart.y +
        directionY * arrowDepth * arrowDirection +
        perpendicularY * arrowHalfWidth,
    },
    {
      x:
        dimensionStart.x +
        directionX * arrowDepth * arrowDirection -
        perpendicularX * arrowHalfWidth,
      y:
        dimensionStart.y +
        directionY * arrowDepth * arrowDirection -
        perpendicularY * arrowHalfWidth,
    },
  ]
  const endArrowPoints: [SvgPoint, SvgPoint, SvgPoint] = [
    dimensionEnd,
    {
      x:
        dimensionEnd.x -
        directionX * arrowDepth * arrowDirection +
        perpendicularX * arrowHalfWidth,
      y:
        dimensionEnd.y -
        directionY * arrowDepth * arrowDirection +
        perpendicularY * arrowHalfWidth,
    },
    {
      x:
        dimensionEnd.x -
        directionX * arrowDepth * arrowDirection -
        perpendicularX * arrowHalfWidth,
      y:
        dimensionEnd.y -
        directionY * arrowDepth * arrowDirection -
        perpendicularY * arrowHalfWidth,
    },
  ]
  const dimensionAngleDegrees = -geometry.textAngle
  const readableTextAngleDegrees = geometry.textAtSavedOrigin
    ? dimensionAngleDegrees
    : dimensionAngleDegrees > 90 || dimensionAngleDegrees < -90
      ? dimensionAngleDegrees + 180
      : dimensionAngleDegrees
  const extensionPath = geometry.extensionLines
    .map(
      ({ start, end }) =>
        `M ${formatSvgPoint(toViewportPoint({ point: start, viewport }))} L ${formatSvgPoint(toViewportPoint({ point: end, viewport }))}`,
    )
    .join(" ")
  const dimensionLinePath = getDimensionLinePath({
    dimensionEnd,
    dimensionStart,
    directionX,
    directionY,
    geometry,
    measuredLength,
    perpendicularX,
    perpendicularY,
    textCorners: geometry.textCorners.map((point) =>
      toViewportPoint({ point, viewport }),
    ),
  })

  const arrows = [startArrowPoints, endArrowPoints].map(
    ([tip, first, second]) =>
      geometry.openArrows
        ? `<path d="M ${formatSvgPoint(first)} L ${formatSvgPoint(tip)} L ${formatSvgPoint(second)}" fill="none" stroke="${color}" stroke-width="${formatSvgNumber(geometry.arrowLineWidth)}"/>`
        : `<polygon points="${formatSvgPoints([tip, first, second])}" fill="${color}"/>`,
  )

  return [
    `<g ${metadata}>`,
    `<path d="${extensionPath}" fill="none" stroke="${color}" stroke-width="${formatSvgNumber(geometry.extensionLineWidth)}"/>`,
    `<path d="${dimensionLinePath}" fill="none" stroke="${color}" stroke-width="${formatSvgNumber(geometry.lineWidth)}"/>`,
    ...arrows,
    `<text x="0" y="0" fill="${color}" font-family="Arial, sans-serif" font-size="${formatSvgNumber(geometry.textHeight)}" text-anchor="${geometry.textAtSavedOrigin ? "start" : "middle"}" dominant-baseline="${geometry.textAtSavedOrigin ? "text-after-edge" : "central"}" transform="translate(${formatSvgNumber(textPosition.x)} ${formatSvgNumber(textPosition.y)}) rotate(${formatSvgNumber(readableTextAngleDegrees)}) scale(${geometry.textMirror ? -1 : 1} 1)">${escapeXml(geometry.label)}</text>`,
    "</g>",
  ].join("")
}

function getDimensionLinePath({
  dimensionEnd,
  dimensionStart,
  directionX,
  directionY,
  geometry,
  measuredLength,
  perpendicularX,
  perpendicularY,
  textCorners,
}: {
  dimensionEnd: SvgPoint
  dimensionStart: SvgPoint
  directionX: number
  directionY: number
  geometry: NonNullable<ReturnType<typeof getPcbDimensionGeometry>>
  measuredLength: number
  perpendicularX: number
  perpendicularY: number
  textCorners: SvgPoint[]
}): string {
  if (geometry.arrowsOutside) {
    const startTail = {
      x: dimensionStart.x - directionX * geometry.arrowLength,
      y: dimensionStart.y - directionY * geometry.arrowLength,
    }
    const endTail = {
      x: dimensionEnd.x + directionX * geometry.arrowLength,
      y: dimensionEnd.y + directionY * geometry.arrowLength,
    }
    return `M ${formatSvgPoint(startTail)} L ${formatSvgPoint(dimensionStart)} M ${formatSvgPoint(dimensionEnd)} L ${formatSvgPoint(endTail)}`
  }
  if (!geometry.label)
    return `M ${formatSvgPoint(dimensionStart)} L ${formatSvgPoint(dimensionEnd)}`
  const along = textCorners.map(
    (point) =>
      (point.x - dimensionStart.x) * directionX +
      (point.y - dimensionStart.y) * directionY,
  )
  const across = textCorners.map(
    (point) =>
      (point.x - dimensionStart.x) * perpendicularX +
      (point.y - dimensionStart.y) * perpendicularY,
  )
  const textStart = Math.min(...along) - geometry.textGap
  const textEnd = Math.max(...along) + geometry.textGap
  if (
    Math.min(...across) > geometry.textGap ||
    Math.max(...across) < -geometry.textGap ||
    textEnd <= 0 ||
    textStart >= measuredLength
  ) {
    return `M ${formatSvgPoint(dimensionStart)} L ${formatSvgPoint(dimensionEnd)}`
  }
  const gapStart = Math.max(0, textStart)
  const gapEnd = Math.min(measuredLength, textEnd)
  const beforeGap = {
    x: dimensionStart.x + directionX * gapStart,
    y: dimensionStart.y + directionY * gapStart,
  }
  const afterGap = {
    x: dimensionStart.x + directionX * gapEnd,
    y: dimensionStart.y + directionY * gapEnd,
  }
  return [
    gapStart > 0
      ? `M ${formatSvgPoint(dimensionStart)} L ${formatSvgPoint(beforeGap)}`
      : "",
    gapEnd < measuredLength
      ? `M ${formatSvgPoint(afterGap)} L ${formatSvgPoint(dimensionEnd)}`
      : "",
  ]
    .filter(Boolean)
    .join(" ")
}

function toViewportPoint({
  point,
  viewport,
}: {
  point: SvgPoint
  viewport: SvgViewport
}): SvgPoint {
  return { x: viewport.toX(point.x), y: viewport.toY(point.y) }
}

function formatSvgPoint(point: SvgPoint): string {
  return `${formatSvgNumber(point.x)} ${formatSvgNumber(point.y)}`
}

function formatSvgPoints(points: SvgPoint[]): string {
  return points
    .map((point) => `${formatSvgNumber(point.x)},${formatSvgNumber(point.y)}`)
    .join(" ")
}
