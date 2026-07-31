import type {
  AltiumSvgRenderOptions,
  SvgBounds,
  SvgPoint,
  SvgViewport,
} from "./svg-types"

export function createSvgViewport(
  bounds: SvgBounds,
  options: AltiumSvgRenderOptions = {},
): SvgViewport {
  const contentWidth = Math.max(bounds.maxX - bounds.minX, 1)
  const contentHeight = Math.max(bounds.maxY - bounds.minY, 1)
  const defaultMargin = Math.max(contentWidth, contentHeight) * 0.035
  const margin = options.margin ?? defaultMargin
  const width = contentWidth + margin * 2
  const height = contentHeight + margin * 2
  const outputWidth = options.width ?? 1000
  const outputHeight =
    options.height ?? Math.max(180, Math.round((outputWidth * height) / width))

  return {
    bounds,
    height,
    margin,
    outputHeight,
    outputWidth,
    toX: (x: number) => x - bounds.minX + margin,
    toY: (y: number) => bounds.maxY - y + margin,
    width,
  }
}

export function createSvgDocument(init: {
  backgroundColor: string
  className: string
  content: string[]
  title: string
  viewport: SvgViewport
}): string {
  const { viewport } = init
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${formatSvgNumber(viewport.outputWidth)}" height="${formatSvgNumber(viewport.outputHeight)}" viewBox="0 0 ${formatSvgNumber(viewport.width)} ${formatSvgNumber(viewport.height)}" role="img" aria-label="${escapeXml(init.title)}" class="${escapeXml(init.className)}" data-renderer="altiumts">`,
    `  <title>${escapeXml(init.title)}</title>`,
    `  <rect width="100%" height="100%" fill="${escapeXml(init.backgroundColor)}"/>`,
    '  <g stroke-linecap="round" stroke-linejoin="round">',
    ...init.content.map((line) => `    ${line}`),
    "  </g>",
    "</svg>",
  ].join("\n")
}

export function formatSvgNumber(value: number): string {
  if (!Number.isFinite(value)) return "0"
  const rounded = Math.round(value * 10_000) / 10_000
  return Object.is(rounded, -0) ? "0" : String(rounded)
}

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

export function pointsToSvg(points: SvgPoint[], viewport: SvgViewport): string {
  return points
    .map(
      (point) =>
        `${formatSvgNumber(viewport.toX(point.x))},${formatSvgNumber(viewport.toY(point.y))}`,
    )
    .join(" ")
}

export function boundsFromPoints(points: SvgPoint[]): SvgBounds | undefined {
  if (points.length === 0) return undefined

  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  }
}

export function mergeBounds(
  left: SvgBounds | undefined,
  right: SvgBounds | undefined,
): SvgBounds | undefined {
  if (!left) return right
  if (!right) return left

  return {
    minX: Math.min(left.minX, right.minX),
    minY: Math.min(left.minY, right.minY),
    maxX: Math.max(left.maxX, right.maxX),
    maxY: Math.max(left.maxY, right.maxY),
  }
}

export function expandBounds(bounds: SvgBounds, amount: number): SvgBounds {
  return {
    minX: bounds.minX - amount,
    minY: bounds.minY - amount,
    maxX: bounds.maxX + amount,
    maxY: bounds.maxY + amount,
  }
}

export function boundsIntersect(left: SvgBounds, right: SvgBounds): boolean {
  return !(
    left.maxX < right.minX ||
    left.minX > right.maxX ||
    left.maxY < right.minY ||
    left.minY > right.maxY
  )
}
