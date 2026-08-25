import { AltiumPcbDoc } from "../altium-pcb-doc"
import { AltiumSchDoc } from "../altium-sch-doc"
import type { AltiumLine } from "../base/altium-line"
import { AltiumRecord } from "../records/altium-record"
import {
  AltiumSchImageRecord,
  type AltiumSchSheetRecord,
} from "../records/altium-schematic-records"
import { resolveSchematicParameterReference } from "../schematic-parameter-reference"
import {
  altiumColorToCss,
  getSchematicCoordinate,
  getSchematicIndexedPoints,
} from "./altium-values"
import { serializeAltiumPcbToSvg } from "./serialize-altium-pcb-to-svg"
import { serializeWindowsEnhancedMetafileToDataUrl } from "./serialize-windows-enhanced-metafile-to-svg"
import type {
  AltiumSheetSvgOptions,
  SvgBounds,
  SvgPoint,
  SvgViewport,
} from "./svg-types"
import {
  createSvgDocument,
  createSvgViewport,
  escapeXml,
  formatSvgNumber,
  pointsToSvg,
} from "./svg-utils"

interface SchematicRenderContext {
  document?: AltiumSchDoc
  records: AltiumRecord[]
  sheetRecord?: AltiumSchSheetRecord
}

interface SchematicPinRenderContext {
  color: string
  metadata: string
  options: AltiumSheetSvgOptions
  sheetRecord: AltiumSchSheetRecord | undefined
  viewport: SvgViewport
}

interface SchematicSheetChromeGeometry {
  innerHeight: number
  innerLeft: number
  innerTop: number
  innerWidth: number
  margin: number
  paperHeight: number
  paperLeft: number
  paperTop: number
  paperWidth: number
}

interface SchematicSheetChromeRenderInput {
  sheetHeight: number
  sheetRecord: AltiumSchSheetRecord | undefined
  sheetWidth: number
  viewport: SvgViewport
}

const SCHEMATIC_COMPONENT_OUTLINE_COLOR = "#840000"
const SCHEMATIC_COMPONENT_FILL_COLOR = "#ffffc2"
const STANDARD_TITLE_BLOCK_WIDTH = 460
const STANDARD_TITLE_BLOCK_HEIGHT = 100
const STANDARD_TITLE_BLOCK_SIZE_COLUMN_WIDTH = 65
const STANDARD_TITLE_BLOCK_LEFT_DETAILS_WIDTH = 263
const STANDARD_TITLE_BLOCK_NUMBER_COLUMN_RIGHT = 329
const STANDARD_TITLE_BLOCK_FIRST_ROW_RATIO = 0.375
const STANDARD_TITLE_BLOCK_SECOND_ROW_RATIO = 0.75
const STANDARD_TITLE_BLOCK_THIRD_ROW_RATIO = 0.875

export function serializeAltiumSheetToSvg(
  source: AltiumPcbDoc | AltiumSchDoc | AltiumLine[],
  options: AltiumSheetSvgOptions = {},
): string {
  if (source instanceof AltiumPcbDoc) {
    return serializeAltiumPcbToSvg(source, {
      ...options,
      backgroundColor: options.backgroundColor ?? "#f8fafc",
      title: options.title ?? "Altium PCB sheet",
    })
  }

  const lines = source instanceof AltiumSchDoc ? source.lines : source
  const records = lines.filter(
    (line): line is AltiumRecord => line instanceof AltiumRecord,
  )
  const sheetRecord = records.find(
    (record): record is AltiumSchSheetRecord => record.recordKind === "31",
  )
  const sheetWidth = Math.max(
    Number(sheetRecord?.getCaseInsensitive("CUSTOMX") ?? 1000),
    1,
  )
  const sheetHeight = Math.max(
    Number(sheetRecord?.getCaseInsensitive("CUSTOMY") ?? 800),
    1,
  )
  const paperBounds: SvgBounds = {
    minX: 0,
    minY: 0,
    maxX: sheetWidth,
    maxY: sheetHeight,
  }
  // Altium can retain intentionally off-sheet annotations and helper objects.
  // The paper rectangle, rather than all record geometry, defines the view.
  const viewport = createSvgViewport(paperBounds, options)
  const content: string[] = []
  const context: SchematicRenderContext = {
    document: source instanceof AltiumSchDoc ? source : undefined,
    records: records.filter((record) => record.recordKind !== undefined),
    sheetRecord,
  }

  const paperLeft = viewport.toX(0)
  const paperTop = viewport.toY(sheetHeight)
  const paperWidth = sheetWidth
  const paperHeight = sheetHeight
  content.push(
    `<defs><clipPath id="altium-sheet-paper"><rect x="${formatSvgNumber(paperLeft)}" y="${formatSvgNumber(paperTop)}" width="${formatSvgNumber(paperWidth)}" height="${formatSvgNumber(paperHeight)}"/></clipPath></defs>`,
  )

  if (options.showBorder !== false) {
    content.push(
      ...renderSchematicSheetChrome({
        sheetHeight,
        sheetRecord,
        sheetWidth,
        viewport,
      }),
    )
  }

  content.push(
    '<g data-sheet-content="true" clip-path="url(#altium-sheet-paper)">',
  )
  for (const record of records) {
    if (!shouldRenderSchematicRecord(record, context)) continue
    const rendered = renderSchematicRecord(record, viewport, options, context)
    if (rendered) content.push(rendered)
  }
  content.push("</g>")

  return createSvgDocument({
    backgroundColor: options.backgroundColor ?? "#e2e8f0",
    className: "altium-sheet",
    content,
    title: options.title ?? "Altium schematic sheet",
    viewport,
  })
}

function renderSchematicRecord(
  record: AltiumRecord,
  viewport: SvgViewport,
  options: AltiumSheetSvgOptions,
  context: SchematicRenderContext,
): string | undefined {
  const kind = record.recordKind
  const color = altiumColorToCss(record.getCaseInsensitive("COLOR"), "#1f2937")
  const metadata = `data-record="${escapeXml(kind ?? "Unknown")}"`
  const lineWidth = Math.max(
    Number(record.getCaseInsensitive("LINEWIDTH") ?? 1),
    0.7,
  )

  if (kind === "6" || kind === "27" || kind === "7") {
    const points = getSchematicIndexedPoints(record)
    if (points.length < 2) return undefined
    const polygon = kind === "7"
    const tag = polygon ? "polygon" : "polyline"
    const fill = polygon
      ? altiumColorToCss(record.getCaseInsensitive("AREACOLOR"), "none")
      : "none"
    return `<${tag} ${metadata} points="${pointsToSvg(points, viewport)}" fill="${fill}" stroke="${color}" stroke-width="${formatSvgNumber(lineWidth)}"/>`
  }

  if (kind === "13") {
    const location = getSchematicLocationIfPresent(record)
    const corner = getSchematicCornerIfPresent(record)
    if (!location || !corner) return undefined
    return `<line ${metadata} x1="${formatSvgNumber(viewport.toX(location.x))}" y1="${formatSvgNumber(viewport.toY(location.y))}" x2="${formatSvgNumber(viewport.toX(corner.x))}" y2="${formatSvgNumber(viewport.toY(corner.y))}" stroke="${color}" stroke-width="${formatSvgNumber(lineWidth)}"/>`
  }

  if (kind === "10" || kind === "14") {
    return renderSchematicRectangle(record, viewport, metadata, color)
  }

  if (kind === "15") {
    return renderSchematicSheetSymbol(record, viewport, metadata)
  }

  if (kind === "16") {
    return renderSchematicSheetEntry(record, viewport, metadata, context)
  }

  if (kind === "8") {
    const center = getSchematicLocation(record)
    const radiusX = getSchematicCoordinate(record, "RADIUS", 1)
    const radiusY = getSchematicCoordinate(record, "SECONDARYRADIUS", radiusX)
    return `<ellipse ${metadata} cx="${formatSvgNumber(viewport.toX(center.x))}" cy="${formatSvgNumber(viewport.toY(center.y))}" rx="${formatSvgNumber(radiusX)}" ry="${formatSvgNumber(radiusY)}" fill="${record.getBoolean("ISSOLID") ? altiumColorToCss(record.getCaseInsensitive("AREACOLOR"), "none") : "none"}" stroke="${color}" stroke-width="${formatSvgNumber(lineWidth)}"/>`
  }

  if (kind === "11" || kind === "12") {
    const center = getSchematicLocation(record)
    const radius = getSchematicCoordinate(record, "RADIUS", 1)
    const startAngle = Number(record.getCaseInsensitive("STARTANGLE") ?? 0)
    const endAngle = Number(record.getCaseInsensitive("ENDANGLE") ?? 360)
    const points = approximateSchematicArc(center, radius, startAngle, endAngle)
    return `<polyline ${metadata} points="${pointsToSvg(points, viewport)}" fill="none" stroke="${color}" stroke-width="${formatSvgNumber(lineWidth)}"/>`
  }

  if (kind === "2") {
    return renderSchematicPin(record, {
      color,
      metadata,
      options,
      sheetRecord: context.sheetRecord,
      viewport,
    })
  }

  if (kind === "29") {
    const location = getSchematicLocation(record)
    const radius = Math.max(
      Number(record.getCaseInsensitive("SIZE") ?? 1) * 1.8,
      1.5,
    )
    return `<circle ${metadata} cx="${formatSvgNumber(viewport.toX(location.x))}" cy="${formatSvgNumber(viewport.toY(location.y))}" r="${formatSvgNumber(radius)}" fill="${color}"/>`
  }

  if (kind === "22") {
    const location = getSchematicLocation(record)
    const x = viewport.toX(location.x)
    const y = viewport.toY(location.y)
    const radius = 4
    return `<path ${metadata} d="M ${formatSvgNumber(x - radius)} ${formatSvgNumber(y - radius)} L ${formatSvgNumber(x + radius)} ${formatSvgNumber(y + radius)} M ${formatSvgNumber(x + radius)} ${formatSvgNumber(y - radius)} L ${formatSvgNumber(x - radius)} ${formatSvgNumber(y + radius)}" fill="none" stroke="${color}" stroke-width="1"/>`
  }

  if (kind === "17") {
    return renderSchematicPowerPort(
      record,
      viewport,
      metadata,
      color,
      context.sheetRecord,
    )
  }

  if (kind === "18") {
    const location = getSchematicLocation(record)
    const x = viewport.toX(location.x)
    const y = viewport.toY(location.y)
    const width = Math.max(Number(record.getCaseInsensitive("WIDTH") ?? 16), 10)
    const height = Math.max(
      Number(record.getCaseInsensitive("HEIGHT") ?? 10),
      4,
    )
    const halfHeight = height / 2
    const pointDepth = Math.min(width * 0.22, height)
    const ioType = Number(record.getCaseInsensitive("IOTYPE") ?? 0)
    const name = record.getDecoded("NAME") ?? ""
    const font = getSchematicFont(record, context.sheetRecord, 8)
    const fillColor = altiumColorToCss(
      record.getCaseInsensitive("AREACOLOR"),
      "#fff",
    )
    const textColor = altiumColorToCss(
      record.getCaseInsensitive("TEXTCOLOR"),
      color,
    )
    const path =
      ioType === 1
        ? `M ${formatSvgNumber(x)} ${formatSvgNumber(y)} L ${formatSvgNumber(x + pointDepth)} ${formatSvgNumber(y - halfHeight)} H ${formatSvgNumber(x + width)} V ${formatSvgNumber(y + halfHeight)} H ${formatSvgNumber(x + pointDepth)} Z`
        : ioType === 2
          ? `M ${formatSvgNumber(x)} ${formatSvgNumber(y - halfHeight)} H ${formatSvgNumber(x + width - pointDepth)} L ${formatSvgNumber(x + width)} ${formatSvgNumber(y)} L ${formatSvgNumber(x + width - pointDepth)} ${formatSvgNumber(y + halfHeight)} H ${formatSvgNumber(x)} Z`
          : `M ${formatSvgNumber(x)} ${formatSvgNumber(y - halfHeight)} H ${formatSvgNumber(x + width)} V ${formatSvgNumber(y + halfHeight)} H ${formatSvgNumber(x)} Z`
    return `<g ${metadata}><path d="${path}" fill="${fillColor}" stroke="${color}" stroke-width="1"/><text x="${formatSvgNumber(x + width / 2)}" y="${formatSvgNumber(y)}" text-anchor="middle" dominant-baseline="central" fill="${textColor}" ${font.attributes}>${escapeXml(name)}</text></g>`
  }

  if (
    kind === "4" ||
    kind === "25" ||
    kind === "32" ||
    kind === "33" ||
    kind === "34" ||
    kind === "41"
  ) {
    if (record.getBoolean("ISHIDDEN") && !options.showHidden) return undefined
    if (options.showText === false) return undefined
    const location = getSchematicLocation(record)
    const x = viewport.toX(location.x)
    const y = viewport.toY(location.y)
    const sourceText =
      record.getDecoded("TEXT") ??
      record.getDecoded("NAME") ??
      record.getDecoded("DESIGNATOR") ??
      ""
    const text =
      context.document && !hasSchematicComponentAncestor(record, context)
        ? (resolveSchematicParameterReference(context.document, sourceText) ??
          sourceText)
        : sourceText
    if (!text) return undefined
    const font = getSchematicFont(record, context.sheetRecord, 9)
    const positioning = getSchematicTextPositioning(record)
    return `<text ${metadata} x="0" y="0" fill="${color}" ${font.attributes} text-anchor="${positioning.anchor}" dominant-baseline="${positioning.baseline}" transform="translate(${formatSvgNumber(x)} ${formatSvgNumber(y)}) rotate(${formatSvgNumber(positioning.rotation)})">${escapeXml(text)}</text>`
  }

  if (kind === "28") {
    return renderSchematicTextFrame(
      record,
      viewport,
      metadata,
      context.sheetRecord,
    )
  }

  if (kind === "30") {
    const rectangle = getSchematicRectangle(record)
    if (!rectangle) return undefined
    const left = viewport.toX(rectangle.minX)
    const top = viewport.toY(rectangle.maxY)
    const width = rectangle.maxX - rectangle.minX
    const height = rectangle.maxY - rectangle.minY
    if (record instanceof AltiumSchImageRecord) {
      const embeddedImage = context.document?.getEmbeddedImageForRecord(record)
      if (embeddedImage) {
        const metafile = embeddedImage.getEnhancedMetafileBytes()
        let dataUrl: string | undefined
        if (metafile) {
          dataUrl = serializeWindowsEnhancedMetafileToDataUrl(metafile)
        }
        if (dataUrl === undefined) {
          dataUrl = embeddedImage.getDataUrl()
        }

        let preserveAspectRatio = "xMidYMid meet"
        if (record.getBoolean("KEEPASPECT") === false) {
          preserveAspectRatio = "none"
        }
        return `<image ${metadata} x="${formatSvgNumber(left)}" y="${formatSvgNumber(top)}" width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}" xlink:href="${dataUrl}" preserveAspectRatio="${preserveAspectRatio}"/>`
      }
    }
    return `<g ${metadata}><rect x="${formatSvgNumber(left)}" y="${formatSvgNumber(top)}" width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}" fill="#f1f5f9" stroke="#64748b"/><path d="M ${formatSvgNumber(left)} ${formatSvgNumber(top)} l ${formatSvgNumber(width)} ${formatSvgNumber(height)} M ${formatSvgNumber(left + width)} ${formatSvgNumber(top)} l ${formatSvgNumber(-width)} ${formatSvgNumber(height)}" stroke="#94a3b8"/></g>`
  }

  if (kind === "209") {
    const rectangle = getSchematicRectangle(record)
    if (!rectangle) return undefined
    const left = viewport.toX(rectangle.minX)
    const top = viewport.toY(rectangle.maxY)
    const width = rectangle.maxX - rectangle.minX
    const height = rectangle.maxY - rectangle.minY
    const text = (record.getDecoded("TEXT") ?? "").slice(0, 140)
    return `<g ${metadata}><rect x="${formatSvgNumber(left)}" y="${formatSvgNumber(top)}" width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}" fill="${altiumColorToCss(record.getCaseInsensitive("AREACOLOR"), "#fff7ed")}" stroke="${color}"/><text x="${formatSvgNumber(left + 6)}" y="${formatSvgNumber(top + 14)}" fill="${color}" font-family="Arial, sans-serif" font-size="9">${escapeXml(text)}</text></g>`
  }

  return undefined
}

function renderSchematicSheetSymbol(
  record: AltiumRecord,
  viewport: SvgViewport,
  metadata: string,
): string {
  const location = getSchematicLocation(record)
  const width = Math.max(getSchematicCoordinate(record, "XSIZE", 1), 1)
  const height = Math.max(getSchematicCoordinate(record, "YSIZE", 1), 1)
  const left = viewport.toX(location.x)
  const top = viewport.toY(location.y)
  return `<rect ${metadata} x="${formatSvgNumber(left)}" y="${formatSvgNumber(top)}" width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}" fill="${SCHEMATIC_COMPONENT_FILL_COLOR}" stroke="${SCHEMATIC_COMPONENT_OUTLINE_COLOR}" stroke-width="1"/>`
}

function renderSchematicSheetEntry(
  record: AltiumRecord,
  viewport: SvgViewport,
  metadata: string,
  context: SchematicRenderContext,
): string | undefined {
  const sheetSymbol = getSchematicRecordParent(record, context)
  if (sheetSymbol?.recordKind !== "15") return undefined

  const sheetLocation = getSchematicLocation(sheetSymbol)
  const sheetWidth = Math.max(
    getSchematicCoordinate(sheetSymbol, "XSIZE", 1),
    1,
  )
  const sheetHeight = Math.max(
    getSchematicCoordinate(sheetSymbol, "YSIZE", 1),
    1,
  )
  const side = Math.round(record.getNumber("SIDE") ?? 0)
  const distance = Math.max(record.getNumber("DISTANCEFROMTOP") ?? 0, 0) * 10
  const entryPoint = getSchematicSheetEntryPoint({
    distance,
    sheetHeight,
    sheetLocation,
    sheetWidth,
    side,
  })
  const x = viewport.toX(entryPoint.x)
  const y = viewport.toY(entryPoint.y)
  const horizontal = side === 0 || side === 1
  const points = getSchematicSheetEntryPolygon({ side, x, y })
  const name = record.getDecoded("NAME") ?? ""
  const font = getSchematicFont(record, context.sheetRecord, 8)
  const textOffset = 9
  const textX = side === 0 ? x + textOffset : side === 1 ? x - textOffset : x
  const textY = side === 2 ? y + textOffset : side === 3 ? y - textOffset : y
  const textAnchor = side === 0 ? "start" : side === 1 ? "end" : "middle"
  const baseline = horizontal
    ? "central"
    : side === 2
      ? "hanging"
      : "text-after-edge"

  return `<g ${metadata}><polygon points="${points}" fill="${SCHEMATIC_COMPONENT_FILL_COLOR}" stroke="${SCHEMATIC_COMPONENT_OUTLINE_COLOR}" stroke-width="1"/>${name ? `<text x="${formatSvgNumber(textX)}" y="${formatSvgNumber(textY)}" text-anchor="${textAnchor}" dominant-baseline="${baseline}" fill="${SCHEMATIC_COMPONENT_OUTLINE_COLOR}" ${font.attributes}>${escapeXml(name)}</text>` : ""}</g>`
}

function getSchematicRecordParent(
  record: AltiumRecord,
  context: SchematicRenderContext,
): AltiumRecord | undefined {
  if (context.document) return context.document.getParent(record)
  const ownerIndex = record.getNumber("OWNERINDEX")
  return ownerIndex === undefined || ownerIndex < 0
    ? undefined
    : context.records[ownerIndex]
}

function getSchematicSheetEntryPoint({
  distance,
  sheetHeight,
  sheetLocation,
  sheetWidth,
  side,
}: {
  distance: number
  sheetHeight: number
  sheetLocation: SvgPoint
  sheetWidth: number
  side: number
}): SvgPoint {
  if (side === 1) {
    return {
      x: sheetLocation.x + sheetWidth,
      y: sheetLocation.y - distance,
    }
  }
  if (side === 2) {
    return { x: sheetLocation.x + distance, y: sheetLocation.y }
  }
  if (side === 3) {
    return {
      x: sheetLocation.x + distance,
      y: sheetLocation.y - sheetHeight,
    }
  }
  return { x: sheetLocation.x, y: sheetLocation.y - distance }
}

function getSchematicSheetEntryPolygon({
  side,
  x,
  y,
}: {
  side: number
  x: number
  y: number
}): string {
  const halfWidth = 4
  const depth = 7
  if (side === 1) {
    return `${formatSvgNumber(x)},${formatSvgNumber(y - halfWidth)} ${formatSvgNumber(x - depth)},${formatSvgNumber(y)} ${formatSvgNumber(x)},${formatSvgNumber(y + halfWidth)}`
  }
  if (side === 2) {
    return `${formatSvgNumber(x - halfWidth)},${formatSvgNumber(y)} ${formatSvgNumber(x)},${formatSvgNumber(y + depth)} ${formatSvgNumber(x + halfWidth)},${formatSvgNumber(y)}`
  }
  if (side === 3) {
    return `${formatSvgNumber(x - halfWidth)},${formatSvgNumber(y)} ${formatSvgNumber(x)},${formatSvgNumber(y - depth)} ${formatSvgNumber(x + halfWidth)},${formatSvgNumber(y)}`
  }
  return `${formatSvgNumber(x)},${formatSvgNumber(y - halfWidth)} ${formatSvgNumber(x + depth)},${formatSvgNumber(y)} ${formatSvgNumber(x)},${formatSvgNumber(y + halfWidth)}`
}

function hasSchematicComponentAncestor(
  record: AltiumRecord,
  context: SchematicRenderContext,
): boolean {
  let current = context.document?.getParent(record)
  const visited = new Set<AltiumRecord>()

  while (current && !visited.has(current)) {
    if (current.recordKind === "1") return true
    visited.add(current)
    current = context.document?.getParent(current)
  }

  return false
}

function renderSchematicRectangle(
  record: AltiumRecord,
  viewport: SvgViewport,
  metadata: string,
  color: string,
): string | undefined {
  const rectangle = getSchematicRectangle(record)
  if (!rectangle) return undefined
  const left = viewport.toX(rectangle.minX)
  const top = viewport.toY(rectangle.maxY)
  const width = rectangle.maxX - rectangle.minX
  const height = rectangle.maxY - rectangle.minY
  const radius = Number(record.getCaseInsensitive("CORNERXRADIUS") ?? 0)
  const fill = record.getBoolean("ISSOLID")
    ? altiumColorToCss(record.getCaseInsensitive("AREACOLOR"), "#fff")
    : "none"
  return `<rect ${metadata} x="${formatSvgNumber(left)}" y="${formatSvgNumber(top)}" width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}" rx="${formatSvgNumber(radius)}" fill="${fill}" stroke="${color}" stroke-width="${formatSvgNumber(Math.max(Number(record.getCaseInsensitive("LINEWIDTH") ?? 1), 0.7))}"/>`
}

function renderSchematicPin(
  record: AltiumRecord,
  context: SchematicPinRenderContext,
): string {
  const { color, metadata, options, sheetRecord, viewport } = context
  const location = getSchematicLocation(record)
  const length = Math.max(
    Number(record.getCaseInsensitive("PINLENGTH") ?? 10),
    1,
  )
  const pinConglomerate = record.getNumber("PINCONGLOMERATE")
  const orientation =
    (pinConglomerate ?? Number(record.getCaseInsensitive("ORIENTATION") ?? 0)) &
    3
  const hidden =
    record.getBoolean("ISHIDDEN") ||
    (pinConglomerate !== undefined && (pinConglomerate & 0x04) !== 0)
  if (hidden && !options.showHidden) {
    return ""
  }
  const direction = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ][orientation] ?? { x: 1, y: 0 }
  const end = {
    x: location.x + direction.x * length,
    y: location.y + direction.y * length,
  }
  const name = record.getDecoded("NAME") ?? ""
  const designator = record.getDecoded("DESIGNATOR") ?? ""
  const showName =
    pinConglomerate === undefined || (pinConglomerate & 0x08) !== 0
  const showDesignator =
    pinConglomerate === undefined || (pinConglomerate & 0x10) !== 0
  const body = {
    x: viewport.toX(location.x),
    y: viewport.toY(location.y),
  }
  const connection = {
    x: viewport.toX(end.x),
    y: viewport.toY(end.y),
  }
  const screenDirection = {
    x: direction.x,
    y: -direction.y,
  }
  const rotation = orientation === 1 || orientation === 3 ? -90 : 0
  const directionMatchesText = orientation === 0 || orientation === 1
  const designatorAnchor = directionMatchesText ? "start" : "end"
  const nameAnchor = directionMatchesText ? "end" : "start"
  const designatorPosition = {
    x: body.x + screenDirection.x * 2,
    y: body.y + screenDirection.y * 2,
  }
  const namePosition = {
    x: body.x - screenDirection.x * 2,
    y: body.y - screenDirection.y * 2,
  }
  const font = getSchematicFont(record, sheetRecord, 6)
  const renderPinText = (
    text: string,
    position: SvgPoint,
    anchor: string,
  ): string =>
    text
      ? `<text x="0" y="0" fill="${color}" ${font.attributes} text-anchor="${anchor}" dominant-baseline="text-after-edge" transform="translate(${formatSvgNumber(position.x)} ${formatSvgNumber(position.y)}) rotate(${rotation})">${escapeXml(text)}</text>`
      : ""

  return `<g ${metadata}><line x1="${formatSvgNumber(body.x)}" y1="${formatSvgNumber(body.y)}" x2="${formatSvgNumber(connection.x)}" y2="${formatSvgNumber(connection.y)}" stroke="${color}" stroke-width="1"/>${showDesignator ? renderPinText(designator, designatorPosition, designatorAnchor) : ""}${showName ? renderPinText(name, namePosition, nameAnchor) : ""}</g>`
}

function renderSchematicPowerPort(
  record: AltiumRecord,
  viewport: SvgViewport,
  metadata: string,
  color: string,
  sheetRecord: AltiumSchSheetRecord | undefined,
): string {
  const location = getSchematicLocation(record)
  const origin = {
    x: viewport.toX(location.x),
    y: viewport.toY(location.y),
  }
  const orientation =
    ((Math.round(record.getNumber("ORIENTATION") ?? 0) % 4) + 4) % 4
  const direction = [
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
  ][orientation] ?? { x: 1, y: 0 }
  const perpendicular = { x: -direction.y, y: direction.x }
  const point = (along: number, across = 0): SvgPoint => ({
    x: origin.x + direction.x * along + perpendicular.x * across,
    y: origin.y + direction.y * along + perpendicular.y * across,
  })
  const svgPoint = (value: SvgPoint): string =>
    `${formatSvgNumber(value.x)} ${formatSvgNumber(value.y)}`
  const style = Math.round(Number(record.getCaseInsensitive("STYLE") ?? 2))
  let symbol: string
  let labelDistance: number

  if (style === 2) {
    const stemEnd = point(8)
    symbol = `<path d="M ${svgPoint(origin)} L ${svgPoint(stemEnd)} M ${svgPoint(point(8, -5))} L ${svgPoint(point(8, 5))}" fill="none" stroke="${color}" stroke-width="1"/>`
    labelDistance = 12
  } else if (style === 5) {
    symbol = `<path d="M ${svgPoint(origin)} L ${svgPoint(point(4))} M ${svgPoint(point(4, -7))} L ${svgPoint(point(4, 7))} L ${svgPoint(point(12))} Z" fill="none" stroke="${color}" stroke-width="1"/>`
    labelDistance = 16
  } else if (style === 4) {
    symbol = `<path d="M ${svgPoint(origin)} L ${svgPoint(point(4))} M ${svgPoint(point(4, -7))} L ${svgPoint(point(4, 7))} M ${svgPoint(point(8, -4.5))} L ${svgPoint(point(8, 4.5))} M ${svgPoint(point(12, -2))} L ${svgPoint(point(12, 2))}" fill="none" stroke="${color}" stroke-width="1"/>`
    labelDistance = 16
  } else if (style === 6) {
    symbol = `<path d="M ${svgPoint(origin)} L ${svgPoint(point(4))} M ${svgPoint(point(4, -7))} L ${svgPoint(point(4, 7))} M ${svgPoint(point(4, -7))} L ${svgPoint(point(9, -9))} M ${svgPoint(point(4))} L ${svgPoint(point(9, -2))} M ${svgPoint(point(4, 7))} L ${svgPoint(point(9, 5))}" fill="none" stroke="${color}" stroke-width="1"/>`
    labelDistance = 14
  } else {
    symbol = `<path d="M ${svgPoint(origin)} L ${svgPoint(point(10, -5))} L ${svgPoint(point(10, 5))} Z" fill="${color}"/>`
    labelDistance = 14
  }

  const text = record.getDecoded("TEXT") ?? record.getDecoded("NAME") ?? ""
  const showNetName = record.getBoolean("SHOWNETNAME") !== false
  if (!text || !showNetName) return `<g ${metadata}>${symbol}</g>`

  const font = getSchematicFont(record, sheetRecord, 10)
  const label = point(labelDistance)
  const vertical = direction.y !== 0
  const textAnchor = vertical ? "middle" : direction.x > 0 ? "start" : "end"
  const baseline = vertical ? (direction.y > 0 ? "hanging" : "auto") : "central"
  return `<g ${metadata}>${symbol}<text x="${formatSvgNumber(label.x)}" y="${formatSvgNumber(label.y)}" text-anchor="${textAnchor}" dominant-baseline="${baseline}" fill="${color}" ${font.attributes}>${escapeXml(text)}</text></g>`
}

function getSchematicSheetChromeGeometry({
  sheetHeight,
  sheetRecord,
  sheetWidth,
  viewport,
}: SchematicSheetChromeRenderInput): SchematicSheetChromeGeometry {
  const requestedMargin = Number(
    sheetRecord?.getCaseInsensitive("CUSTOMMARGINWIDTH") ?? 10,
  )
  const margin = Number.isFinite(requestedMargin)
    ? Math.max(requestedMargin, 4)
    : 10
  return {
    innerHeight: Math.max(sheetHeight - margin * 2, 1),
    innerLeft: viewport.toX(margin),
    innerTop: viewport.toY(sheetHeight - margin),
    innerWidth: Math.max(sheetWidth - margin * 2, 1),
    margin,
    paperHeight: sheetHeight,
    paperLeft: viewport.toX(0),
    paperTop: viewport.toY(sheetHeight),
    paperWidth: sheetWidth,
  }
}

function getSchematicSheetChromeFont({
  fontSize,
  sheetRecord,
}: {
  fontSize: number
  sheetRecord: AltiumSchSheetRecord | undefined
}): string {
  const requestedSystemFontId = Number(
    sheetRecord?.getCaseInsensitive("SYSTEMFONT") ?? 1,
  )
  const systemFontId = Number.isFinite(requestedSystemFontId)
    ? Math.max(Math.round(requestedSystemFontId), 1)
    : 1
  const fontFamily =
    sheetRecord?.getDecoded(`FONTNAME${systemFontId}`) ?? "Times New Roman"
  return `font-family="${escapeXml(fontFamily)}" font-size="${formatSvgNumber(fontSize)}"`
}

function getSchematicSheetZoneCount({
  fallbackCount,
  fieldName,
  maximum,
  sheetRecord,
}: {
  fallbackCount: number
  fieldName: string
  maximum: number
  sheetRecord: AltiumSchSheetRecord | undefined
}): number {
  const requestedZoneCount = Number(
    sheetRecord?.getCaseInsensitive(fieldName) ?? fallbackCount,
  )
  if (!Number.isFinite(requestedZoneCount)) return fallbackCount
  return Math.min(Math.max(Math.round(requestedZoneCount), 1), maximum)
}

function renderSchematicSheetChrome({
  sheetHeight,
  sheetRecord,
  sheetWidth,
  viewport,
}: SchematicSheetChromeRenderInput): string[] {
  const chromeGeometry = getSchematicSheetChromeGeometry({
    sheetHeight,
    sheetRecord,
    sheetWidth,
    viewport,
  })
  const renderedChrome: string[] = []
  if (sheetRecord?.getBoolean("BORDERON") !== false) {
    renderedChrome.push(
      renderSchematicSheetBorder({ chromeGeometry, sheetRecord }),
    )
  }
  if (sheetRecord?.getBoolean("TITLEBLOCKON") === true) {
    renderedChrome.push(
      renderSchematicSheetTitleBlock({ chromeGeometry, sheetRecord }),
    )
  }
  return renderedChrome
}

function renderSchematicSheetBorder({
  chromeGeometry,
  sheetRecord,
}: {
  chromeGeometry: SchematicSheetChromeGeometry
  sheetRecord: AltiumSchSheetRecord | undefined
}): string {
  const {
    innerHeight,
    innerLeft,
    innerTop,
    innerWidth,
    margin,
    paperHeight,
    paperLeft,
    paperTop,
    paperWidth,
  } = chromeGeometry
  const xZones = getSchematicSheetZoneCount({
    fallbackCount: 6,
    fieldName: "CUSTOMXZONES",
    maximum: 99,
    sheetRecord,
  })
  const yZones = getSchematicSheetZoneCount({
    fallbackCount: 4,
    fieldName: "CUSTOMYZONES",
    maximum: 26,
    sheetRecord,
  })
  const zoneMarks: string[] = []
  const zoneLabels: string[] = []
  const referenceZoneMarksVisible =
    sheetRecord?.getBoolean("REFERENCEZONESON") !== false
  const zoneFont = getSchematicSheetChromeFont({
    fontSize: Math.min(8, Math.max(margin * 0.6, 3)),
    sheetRecord,
  })

  if (referenceZoneMarksVisible) {
    for (let zoneIndex = 1; zoneIndex < xZones; zoneIndex++) {
      const x = innerLeft + (innerWidth * zoneIndex) / xZones
      zoneMarks.push(
        `<path d="M ${formatSvgNumber(x)} ${formatSvgNumber(paperTop)} V ${formatSvgNumber(innerTop)} M ${formatSvgNumber(x)} ${formatSvgNumber(innerTop + innerHeight)} V ${formatSvgNumber(paperTop + paperHeight)}"/>`,
      )
    }
    for (let zoneIndex = 0; zoneIndex < xZones; zoneIndex++) {
      const x = innerLeft + (innerWidth * (zoneIndex + 0.5)) / xZones
      zoneLabels.push(
        `<text x="${formatSvgNumber(x)}" y="${formatSvgNumber(paperTop + margin / 2)}" text-anchor="middle" dominant-baseline="central" ${zoneFont}>${zoneIndex + 1}</text>`,
        `<text x="${formatSvgNumber(x)}" y="${formatSvgNumber(innerTop + innerHeight + margin / 2)}" text-anchor="middle" dominant-baseline="central" ${zoneFont}>${zoneIndex + 1}</text>`,
      )
    }
    for (let zoneIndex = 1; zoneIndex < yZones; zoneIndex++) {
      const y = innerTop + (innerHeight * zoneIndex) / yZones
      zoneMarks.push(
        `<path d="M ${formatSvgNumber(paperLeft)} ${formatSvgNumber(y)} H ${formatSvgNumber(innerLeft)} M ${formatSvgNumber(innerLeft + innerWidth)} ${formatSvgNumber(y)} H ${formatSvgNumber(paperLeft + paperWidth)}"/>`,
      )
    }
    for (let zoneIndex = 0; zoneIndex < yZones; zoneIndex++) {
      const y = innerTop + (innerHeight * (zoneIndex + 0.5)) / yZones
      const zoneLetter = String.fromCharCode("A".charCodeAt(0) + zoneIndex)
      zoneLabels.push(
        `<text x="${formatSvgNumber(paperLeft + margin / 2)}" y="${formatSvgNumber(y)}" text-anchor="middle" dominant-baseline="central" ${zoneFont}>${zoneLetter}</text>`,
        `<text x="${formatSvgNumber(innerLeft + innerWidth + margin / 2)}" y="${formatSvgNumber(y)}" text-anchor="middle" dominant-baseline="central" ${zoneFont}>${zoneLetter}</text>`,
      )
    }
  }

  const renderedZoneLabels =
    zoneLabels.length > 0
      ? `<g fill="#334155" stroke="none">${zoneLabels.join("")}</g>`
      : ""
  return `<g data-record="SheetBorder" fill="#fffef8" stroke="#334155" stroke-width="1"><rect x="${formatSvgNumber(paperLeft)}" y="${formatSvgNumber(paperTop)}" width="${formatSvgNumber(paperWidth)}" height="${formatSvgNumber(paperHeight)}"/><rect x="${formatSvgNumber(innerLeft)}" y="${formatSvgNumber(innerTop)}" width="${formatSvgNumber(innerWidth)}" height="${formatSvgNumber(innerHeight)}" fill="none"/>${zoneMarks.join("")}${renderedZoneLabels}</g>`
}

function renderSchematicSheetChromeLabel({
  fontAttributes,
  text,
  x,
  y,
}: {
  fontAttributes: string
  text: string
  x: number
  y: number
}): string {
  return `<text x="${formatSvgNumber(x)}" y="${formatSvgNumber(y)}" dominant-baseline="hanging" ${fontAttributes}>${text}</text>`
}

function renderSchematicSheetTitleBlock({
  chromeGeometry,
  sheetRecord,
}: {
  chromeGeometry: SchematicSheetChromeGeometry
  sheetRecord: AltiumSchSheetRecord | undefined
}): string {
  const { innerHeight, innerLeft, innerTop, innerWidth } = chromeGeometry
  const titleBlockWidth = Math.min(STANDARD_TITLE_BLOCK_WIDTH, innerWidth)
  const titleBlockHeight = Math.min(STANDARD_TITLE_BLOCK_HEIGHT, innerHeight)
  const titleBlockLeft = innerLeft + innerWidth - titleBlockWidth
  const titleBlockTop = innerTop + innerHeight - titleBlockHeight
  const firstRowBottom =
    titleBlockTop + titleBlockHeight * STANDARD_TITLE_BLOCK_FIRST_ROW_RATIO
  const secondRowBottom =
    titleBlockTop + titleBlockHeight * STANDARD_TITLE_BLOCK_SECOND_ROW_RATIO
  const thirdRowBottom =
    titleBlockTop + titleBlockHeight * STANDARD_TITLE_BLOCK_THIRD_ROW_RATIO
  const sizeColumnRight =
    titleBlockLeft +
    titleBlockWidth *
      (STANDARD_TITLE_BLOCK_SIZE_COLUMN_WIDTH / STANDARD_TITLE_BLOCK_WIDTH)
  const leftDetailsRight =
    titleBlockLeft +
    titleBlockWidth *
      (STANDARD_TITLE_BLOCK_LEFT_DETAILS_WIDTH / STANDARD_TITLE_BLOCK_WIDTH)
  const numberColumnRight =
    titleBlockLeft +
    titleBlockWidth *
      (STANDARD_TITLE_BLOCK_NUMBER_COLUMN_RIGHT / STANDARD_TITLE_BLOCK_WIDTH)
  const labelInset = Math.min(7, titleBlockWidth / 20)
  const fontAttributes = getSchematicSheetChromeFont({
    fontSize: 10,
    sheetRecord,
  })
  const titleBlockLabels = [
    renderSchematicSheetChromeLabel({
      fontAttributes,
      text: "Title",
      x: titleBlockLeft + labelInset,
      y: titleBlockTop + 2,
    }),
    renderSchematicSheetChromeLabel({
      fontAttributes,
      text: "Size",
      x: titleBlockLeft + labelInset,
      y: firstRowBottom + 2,
    }),
    renderSchematicSheetChromeLabel({
      fontAttributes,
      text: "Number",
      x: sizeColumnRight + labelInset,
      y: firstRowBottom + 2,
    }),
    renderSchematicSheetChromeLabel({
      fontAttributes,
      text: "Revision",
      x: numberColumnRight + labelInset,
      y: firstRowBottom + 2,
    }),
    renderSchematicSheetChromeLabel({
      fontAttributes,
      text: "Date:",
      x: titleBlockLeft + labelInset,
      y: secondRowBottom + 1,
    }),
    renderSchematicSheetChromeLabel({
      fontAttributes,
      text: "Sheet",
      x: leftDetailsRight + labelInset,
      y: secondRowBottom + 1,
    }),
    renderSchematicSheetChromeLabel({
      fontAttributes,
      text: "of",
      x: numberColumnRight + labelInset,
      y: secondRowBottom + 1,
    }),
    renderSchematicSheetChromeLabel({
      fontAttributes,
      text: "File:",
      x: titleBlockLeft + labelInset,
      y: thirdRowBottom + 1,
    }),
    renderSchematicSheetChromeLabel({
      fontAttributes,
      text: "Drawn By:",
      x: leftDetailsRight + labelInset,
      y: thirdRowBottom + 1,
    }),
  ].join("")

  return `<g data-record="SheetTitleBlock" fill="none" stroke="#334155" stroke-width="1"><rect x="${formatSvgNumber(titleBlockLeft)}" y="${formatSvgNumber(titleBlockTop)}" width="${formatSvgNumber(titleBlockWidth)}" height="${formatSvgNumber(titleBlockHeight)}"/><path d="M ${formatSvgNumber(titleBlockLeft)} ${formatSvgNumber(firstRowBottom)} H ${formatSvgNumber(titleBlockLeft + titleBlockWidth)} M ${formatSvgNumber(titleBlockLeft)} ${formatSvgNumber(secondRowBottom)} H ${formatSvgNumber(titleBlockLeft + titleBlockWidth)} M ${formatSvgNumber(titleBlockLeft)} ${formatSvgNumber(thirdRowBottom)} H ${formatSvgNumber(titleBlockLeft + titleBlockWidth)} M ${formatSvgNumber(sizeColumnRight)} ${formatSvgNumber(firstRowBottom)} V ${formatSvgNumber(secondRowBottom)} M ${formatSvgNumber(leftDetailsRight)} ${formatSvgNumber(secondRowBottom)} V ${formatSvgNumber(titleBlockTop + titleBlockHeight)} M ${formatSvgNumber(numberColumnRight)} ${formatSvgNumber(firstRowBottom)} V ${formatSvgNumber(secondRowBottom)}"/><g fill="#334155" stroke="none">${titleBlockLabels}</g></g>`
}

function renderSchematicTextFrame(
  record: AltiumRecord,
  viewport: SvgViewport,
  metadata: string,
  sheetRecord: AltiumSchSheetRecord | undefined,
): string | undefined {
  const rectangle = getSchematicRectangle(record)
  if (!rectangle) return undefined
  const text = decodeSchematicMultilineText(record.getDecoded("TEXT") ?? "")
  if (!text) return undefined

  const left = viewport.toX(rectangle.minX)
  const top = viewport.toY(rectangle.maxY)
  const width = rectangle.maxX - rectangle.minX
  const height = rectangle.maxY - rectangle.minY
  const font = getSchematicFont(record, sheetRecord, 9)
  const margin = Math.max(getSchematicCoordinate(record, "TEXTMARGIN", 0), 0)
  const availableWidth = Math.max(width - margin * 2, font.size)
  const availableHeight = Math.max(height - margin * 2, font.size)
  const lines =
    record.getBoolean("WORDWRAP") === false
      ? text.split("\n")
      : wrapSchematicText(text, availableWidth, font.size, font.family)
  const lineHeight = font.size
  const clip = record.getBoolean("CLIPTORECT") !== false
  const visibleLines = clip
    ? lines.slice(0, Math.max(Math.ceil(availableHeight / lineHeight), 1))
    : lines
  const alignment = Number(record.getCaseInsensitive("ALIGNMENT") ?? 1)
  const anchor = alignment === 2 ? "middle" : alignment === 3 ? "end" : "start"
  const x =
    anchor === "middle"
      ? left + width / 2
      : anchor === "end"
        ? left + width - margin
        : left + margin
  const color = altiumColorToCss(
    record.getCaseInsensitive("TEXTCOLOR") ??
      record.getCaseInsensitive("COLOR"),
    "#1f2937",
  )
  const uniqueId = (record.getDecoded("UNIQUEID") ?? `${left}-${top}`).replace(
    /[^a-z0-9_-]/giu,
    "-",
  )
  const clipId = `altium-text-frame-${uniqueId}`
  const tspans = visibleLines
    .map(
      (line, index) =>
        `<tspan x="${formatSvgNumber(x)}" dy="${formatSvgNumber(index === 0 ? 0 : lineHeight)}">${escapeXml(line)}</tspan>`,
    )
    .join("")
  const isSolid = record.getBoolean("ISSOLID") === true
  const showBorder = record.getBoolean("SHOWBORDER") === true
  const background =
    isSolid || showBorder
      ? `<rect x="${formatSvgNumber(left)}" y="${formatSvgNumber(top)}" width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}" fill="${isSolid ? altiumColorToCss(record.getCaseInsensitive("AREACOLOR"), "#fff") : "none"}" stroke="${showBorder ? altiumColorToCss(record.getCaseInsensitive("COLOR"), color) : "none"}"/>`
      : ""

  return `<g ${metadata}>${background}${clip ? `<defs><clipPath id="${clipId}"><rect x="${formatSvgNumber(left)}" y="${formatSvgNumber(top)}" width="${formatSvgNumber(width)}" height="${formatSvgNumber(height)}"/></clipPath></defs>` : ""}<text x="${formatSvgNumber(x)}" y="${formatSvgNumber(top + margin + font.size)}" fill="${color}" text-anchor="${anchor}" ${font.attributes}${clip ? ` clip-path="url(#${clipId})"` : ""}>${tspans}</text></g>`
}

function getSchematicFont(
  record: AltiumRecord,
  sheetRecord: AltiumSchSheetRecord | undefined,
  fallbackSize: number,
): { attributes: string; family: string; size: number } {
  const fontId = Math.max(
    Math.round(Number(record.getCaseInsensitive("FONTID") ?? 1)),
    1,
  )
  const size = Math.max(
    Number(sheetRecord?.getCaseInsensitive(`SIZE${fontId}`) ?? fallbackSize),
    1,
  )
  const family =
    sheetRecord?.getDecoded(`FONTNAME${fontId}`) ?? "Arial, sans-serif"
  const weight =
    sheetRecord?.getBoolean(`BOLD${fontId}`) === true ? "bold" : "normal"
  const style =
    sheetRecord?.getBoolean(`ITALIC${fontId}`) === true ? "italic" : "normal"
  const decoration =
    sheetRecord?.getBoolean(`UNDERLINE${fontId}`) === true
      ? "underline"
      : "none"
  return {
    attributes: `font-family="${escapeXml(family)}" font-size="${formatSvgNumber(size)}" font-style="${style}" font-weight="${weight}" text-decoration="${decoration}"`,
    family,
    size,
  }
}

function shouldRenderSchematicRecord(
  record: AltiumRecord,
  context: SchematicRenderContext,
): boolean {
  let ownerPartId = record.getNumber("OWNERPARTID")
  let ownerPartDisplayMode = record.getNumber("OWNERPARTDISPLAYMODE")
  let current: AltiumRecord | undefined = record
  const visited = new Set<AltiumRecord>()

  while (current && !visited.has(current)) {
    visited.add(current)
    const ownerIndex = current.getNumber("OWNERINDEX")
    const parent: AltiumRecord | undefined = context.document
      ? context.document.getParent(current)
      : ownerIndex === undefined || ownerIndex < 0
        ? undefined
        : context.records[ownerIndex]
    if (!parent) return true

    if (ownerPartId === undefined || ownerPartId <= 0) {
      ownerPartId = current.getNumber("OWNERPARTID")
    }
    if (ownerPartDisplayMode === undefined) {
      ownerPartDisplayMode = current.getNumber("OWNERPARTDISPLAYMODE")
    }

    if (parent.recordKind === "1") {
      const currentPartId = parent.getNumber("CURRENTPARTID") ?? 1
      const partMatches =
        ownerPartId === undefined ||
        ownerPartId <= 0 ||
        ownerPartId === currentPartId
      const displayModeMatches =
        ownerPartDisplayMode === undefined || ownerPartDisplayMode === 0
      return partMatches && displayModeMatches
    }

    current = parent
  }

  return true
}

function getSchematicTextPositioning(record: AltiumRecord): {
  anchor: "start" | "middle" | "end"
  baseline: "text-after-edge" | "central" | "text-before-edge"
  rotation: number
} {
  const justification = Math.min(
    Math.max(Math.round(record.getNumber("JUSTIFICATION") ?? 0), 0),
    8,
  )
  const orientation =
    ((Math.round(record.getNumber("ORIENTATION") ?? 0) % 4) + 4) % 4
  const column = justification % 3
  const row = Math.floor(justification / 3)
  let anchor: "start" | "middle" | "end" =
    column === 1 ? "middle" : column === 2 ? "end" : "start"

  // Altium keeps text upright for leftwards/downwards orientation and flips
  // horizontal justification instead of rotating the glyphs by 180 degrees.
  if (orientation === 2 || orientation === 3) {
    anchor = anchor === "start" ? "end" : anchor === "end" ? "start" : anchor
  }

  return {
    anchor,
    baseline:
      row === 1
        ? "central"
        : row === 2
          ? "text-before-edge"
          : "text-after-edge",
    rotation: orientation === 1 || orientation === 3 ? -90 : 0,
  }
}

function decodeSchematicMultilineText(text: string): string {
  return text.replaceAll("~1", "\n").replaceAll("\\n", "\n")
}

function wrapSchematicText(
  text: string,
  maximumWidth: number,
  fontSize: number,
  fontFamily: string,
): string[] {
  return text.split("\n").flatMap((paragraph) => {
    if (
      estimateSchematicTextWidth(paragraph, fontSize, fontFamily) <=
      maximumWidth
    ) {
      return [paragraph]
    }
    const words = paragraph.split(/\s+/u)
    const lines: string[] = []
    let line = ""
    for (const word of words) {
      if (!line) {
        line = word
      } else if (
        estimateSchematicTextWidth(`${line} ${word}`, fontSize, fontFamily) <=
        maximumWidth
      ) {
        line = `${line} ${word}`
      } else {
        lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
    return lines.length > 0 ? lines : [paragraph]
  })
}

function estimateSchematicTextWidth(
  text: string,
  fontSize: number,
  fontFamily: string,
): number {
  if (/courier|mono/iu.test(fontFamily)) return text.length * fontSize * 0.6
  if (!/times|cambria|serif/iu.test(fontFamily)) {
    return text.length * fontSize * 0.52
  }

  return [...text].reduce((width, character) => {
    const emWidth =
      character === " "
        ? 0.23
        : /[ilI1.,:;!'`|]/u.test(character)
          ? 0.2
          : /[mwMW@%]/u.test(character)
            ? 0.7
            : /[A-Z0-9]/u.test(character)
              ? 0.5
              : 0.4
    return width + emWidth * fontSize
  }, 0)
}

function getSchematicRectangle(record: AltiumRecord): SvgBounds | undefined {
  const location = getSchematicLocationIfPresent(record)
  const corner = getSchematicCornerIfPresent(record)
  if (!location || !corner) return undefined
  return {
    minX: Math.min(location.x, corner.x),
    minY: Math.min(location.y, corner.y),
    maxX: Math.max(location.x, corner.x),
    maxY: Math.max(location.y, corner.y),
  }
}

function getSchematicLocation(record: AltiumRecord): SvgPoint {
  return {
    x: getSchematicCoordinate(record, "LOCATION.X"),
    y: getSchematicCoordinate(record, "LOCATION.Y"),
  }
}

function getSchematicLocationIfPresent(
  record: AltiumRecord,
): SvgPoint | undefined {
  if (
    record.getCaseInsensitive("LOCATION.X") === undefined ||
    record.getCaseInsensitive("LOCATION.Y") === undefined
  ) {
    return undefined
  }
  return getSchematicLocation(record)
}

function getSchematicCornerIfPresent(
  record: AltiumRecord,
): SvgPoint | undefined {
  if (
    record.getCaseInsensitive("CORNER.X") === undefined ||
    record.getCaseInsensitive("CORNER.Y") === undefined
  ) {
    return undefined
  }
  return {
    x: getSchematicCoordinate(record, "CORNER.X"),
    y: getSchematicCoordinate(record, "CORNER.Y"),
  }
}

function approximateSchematicArc(
  center: SvgPoint,
  radius: number,
  startAngle: number,
  endAngle: number,
): SvgPoint[] {
  const sweep = endAngle - startAngle || 360
  const segments = Math.max(8, Math.ceil(Math.abs(sweep) / 7.5))
  return Array.from({ length: segments + 1 }, (_, index) => {
    const angle = startAngle + (sweep * index) / segments
    const radians = (angle * Math.PI) / 180
    return {
      x: center.x + Math.cos(radians) * radius,
      y: center.y + Math.sin(radians) * radius,
    }
  })
}
