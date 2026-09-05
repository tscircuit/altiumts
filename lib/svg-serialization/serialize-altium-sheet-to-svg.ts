import { AltiumPcbDoc } from "../altium-pcb-doc"
import { AltiumSchDoc } from "../altium-sch-doc"
import type { AltiumLine } from "../base/altium-line"
import { AltiumRecord } from "../records/altium-record"
import {
  AltiumSchImageRecord,
  type AltiumSchSheetRecord,
} from "../records/altium-schematic-records"
import { resolveSchematicParameterReferenceWithContext } from "../schematic-parameter-reference"
import {
  altiumColorToCss,
  getSchematicCoordinate,
  getSchematicIndexedPoints,
} from "./altium-values"
import { approximateAltiumArc } from "./approximate-altium-arc"
import { getSchematicFont } from "./get-schematic-font"
import {
  getSchematicConnectionSegments,
  getSchematicPortDirection,
} from "./get-schematic-port-direction"
import { getSchematicSheetSize } from "./get-schematic-sheet-size"
import { renderAltiumNegatedText } from "./render-altium-negated-text"
import { renderSchematicPinEdgeSymbols } from "./render-schematic-pin-edge-symbols"
import {
  renderSchematicSheetEntry,
  renderSchematicSheetSymbol,
} from "./render-schematic-sheet-symbol"
import type { SchematicRenderContext } from "./schematic-render-context"
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

interface SchematicPinRenderContext {
  color: string
  metadata: string
  options: AltiumSheetSvgOptions
  sheetRecord: AltiumSchSheetRecord | undefined
  viewport: SvgViewport
}
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
  const [sheetWidth, sheetHeight] = getSchematicSheetSize(sheetRecord)
  const paperBounds: SvgBounds = {
    minX: 0,
    minY: 0,
    maxX: sheetWidth,
    maxY: sheetHeight,
  }
  // Altium can retain intentionally off-sheet annotations and helper objects.
  // The paper rectangle defines the default view; callers can explicitly
  // request a different region when inspecting those records.
  const renderBounds = options.viewBox
    ? schematicViewBoxToBounds(options.viewBox)
    : paperBounds
  const viewport = createSvgViewport(renderBounds, {
    ...options,
    margin: options.margin ?? (options.viewBox ? 0 : undefined),
  })
  const content: string[] = []
  const context: SchematicRenderContext = {
    document: source instanceof AltiumSchDoc ? source : undefined,
    records: records.filter((record) => record.recordKind !== undefined),
    sheetRecord,
  }

  const clipLeft = viewport.toX(renderBounds.minX)
  const clipTop = viewport.toY(renderBounds.maxY)
  const clipWidth = renderBounds.maxX - renderBounds.minX
  const clipHeight = renderBounds.maxY - renderBounds.minY
  content.push(
    `<defs><clipPath id="altium-sheet-paper"><rect x="${formatSvgNumber(clipLeft)}" y="${formatSvgNumber(clipTop)}" width="${formatSvgNumber(clipWidth)}" height="${formatSvgNumber(clipHeight)}"/></clipPath></defs>`,
  )

  if (options.showBorder !== false) {
    content.push(
      renderSchematicSheetBorder(
        sheetRecord,
        viewport,
        sheetWidth,
        sheetHeight,
      ),
    )
  }

  content.push(
    '<g data-sheet-content="true" clip-path="url(#altium-sheet-paper)">',
  )
  const recordsForPainting = getSchematicRecordsInPaintOrder(records, context)
  context.portConnectionSegments = getSchematicConnectionSegments(
    recordsForPainting.filter(
      (record) =>
        (record.recordKind === "2" ||
          record.recordKind === "26" ||
          record.recordKind === "27") &&
        shouldRenderSchematicRecord(record, context),
    ),
  )
  for (const record of recordsForPainting) {
    if (!shouldRenderSchematicRecord(record, context)) continue
    const rendered = renderSchematicRecord(record, viewport, options, context)
    if (rendered) content.push(rendered)
  }
  content.push("</g>")

  return createSvgDocument({
    backgroundColor:
      options.backgroundColor ??
      altiumColorToCss(sheetRecord?.getCaseInsensitive("AREACOLOR"), "#000000"),
    className: "altium-sheet",
    content,
    title: options.title ?? "Altium schematic sheet",
    viewport,
  })
}

function schematicViewBoxToBounds(
  viewBox: NonNullable<AltiumSheetSvgOptions["viewBox"]>,
): SvgBounds {
  if (
    !Number.isFinite(viewBox.x) ||
    !Number.isFinite(viewBox.y) ||
    !Number.isFinite(viewBox.width) ||
    !Number.isFinite(viewBox.height) ||
    viewBox.width <= 0 ||
    viewBox.height <= 0
  ) {
    throw new TypeError(
      "Schematic SVG viewBox must have finite x/y values and positive finite width/height values",
    )
  }

  return {
    minX: viewBox.x,
    minY: viewBox.y,
    maxX: viewBox.x + viewBox.width,
    maxY: viewBox.y + viewBox.height,
  }
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

  if (kind === "5") {
    const points = getSchematicIndexedPoints(record)
    if (points.length < 4) return undefined
    const path = renderSchematicBezierPath(points, viewport)
    if (!path) return undefined
    return `<path ${metadata} d="${path}" fill="none" stroke="${color}" stroke-width="${formatSvgNumber(lineWidth)}"/>`
  }

  if (kind === "6" || kind === "26" || kind === "27" || kind === "7") {
    const points = getSchematicIndexedPoints(record)
    if (points.length < 2) return undefined
    const polygon = kind === "7"
    const tag = polygon ? "polygon" : "polyline"
    const fill =
      polygon && record.getBoolean("ISSOLID") === true
        ? altiumColorToCss(record.getCaseInsensitive("AREACOLOR"), "none")
        : "none"
    const strokeWidth = kind === "26" ? Math.max(lineWidth, 2) : lineWidth
    return `<${tag} ${metadata} points="${pointsToSvg(points, viewport)}" fill="${fill}" stroke="${color}" stroke-width="${formatSvgNumber(strokeWidth)}"/>`
  }

  if (kind === "13" || kind === "37") {
    const location = getSchematicLocationIfPresent(record)
    const corner = getSchematicCornerIfPresent(record)
    if (!location || !corner) return undefined
    return `<line ${metadata} x1="${formatSvgNumber(viewport.toX(location.x))}" y1="${formatSvgNumber(viewport.toY(location.y))}" x2="${formatSvgNumber(viewport.toX(corner.x))}" y2="${formatSvgNumber(viewport.toY(corner.y))}" stroke="${color}" stroke-width="${formatSvgNumber(lineWidth)}"/>`
  }

  if (kind === "10" || kind === "14") {
    return renderSchematicRectangle(record, viewport, metadata, color)
  }

  if (kind === "15") {
    return renderSchematicSheetSymbol({ metadata, record, viewport })
  }

  if (kind === "16") {
    return renderSchematicSheetEntry({ context, metadata, record, viewport })
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
    const startAngleDegrees = Number(
      record.getCaseInsensitive("STARTANGLE") ?? 0,
    )
    const endAngleDegrees = Number(record.getCaseInsensitive("ENDANGLE") ?? 360)
    const points = approximateAltiumArc({
      center,
      radius,
      startAngleDegrees,
      endAngleDegrees,
    })
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
    const width = Math.max(getSchematicCoordinate(record, "WIDTH", 16), 10)
    const height = Math.max(getSchematicCoordinate(record, "HEIGHT", 10), 4)
    const halfHeight = height / 2
    const pointDepth = Math.min(width * 0.22, height)
    const { pointAtStart, pointAtEnd, vertical } = getSchematicPortDirection({
      record,
      segments: context.portConnectionSegments ?? [],
      width,
    })
    const name = record.getDecoded("NAME") ?? ""
    const font = getSchematicFont({
      fallbackSize: 8,
      record,
      sheetRecord: context.sheetRecord,
    })
    const fillColor = altiumColorToCss(
      record.getCaseInsensitive("AREACOLOR"),
      "#fff",
    )
    const textColor = altiumColorToCss(
      record.getCaseInsensitive("TEXTCOLOR"),
      color,
    )
    const path =
      pointAtStart && pointAtEnd
        ? `M ${formatSvgNumber(x)} ${formatSvgNumber(y)} L ${formatSvgNumber(x + pointDepth)} ${formatSvgNumber(y - halfHeight)} H ${formatSvgNumber(x + width - pointDepth)} L ${formatSvgNumber(x + width)} ${formatSvgNumber(y)} L ${formatSvgNumber(x + width - pointDepth)} ${formatSvgNumber(y + halfHeight)} H ${formatSvgNumber(x + pointDepth)} Z`
        : pointAtStart
          ? `M ${formatSvgNumber(x)} ${formatSvgNumber(y)} L ${formatSvgNumber(x + pointDepth)} ${formatSvgNumber(y - halfHeight)} H ${formatSvgNumber(x + width)} V ${formatSvgNumber(y + halfHeight)} H ${formatSvgNumber(x + pointDepth)} Z`
          : pointAtEnd
            ? `M ${formatSvgNumber(x)} ${formatSvgNumber(y - halfHeight)} H ${formatSvgNumber(x + width - pointDepth)} L ${formatSvgNumber(x + width)} ${formatSvgNumber(y)} L ${formatSvgNumber(x + width - pointDepth)} ${formatSvgNumber(y + halfHeight)} H ${formatSvgNumber(x)} Z`
            : `M ${formatSvgNumber(x)} ${formatSvgNumber(y - halfHeight)} H ${formatSvgNumber(x + width)} V ${formatSvgNumber(y + halfHeight)} H ${formatSvgNumber(x)} Z`
    return `<g ${metadata}${vertical ? ` transform="rotate(-90 ${formatSvgNumber(x)} ${formatSvgNumber(y)})"` : ""}><path d="${path}" fill="${fillColor}" stroke="${color}" stroke-width="1"/><text x="${formatSvgNumber(x + width / 2)}" y="${formatSvgNumber(y)}" text-anchor="middle" dominant-baseline="central" fill="${textColor}" ${font.attributes}>${renderAltiumNegatedText(name)}</text></g>`
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
    const text = context.document
      ? (resolveSchematicParameterReferenceWithContext({
          document: context.document,
          documentName: options.documentName,
          project: options.project,
          projectName: options.projectName,
          record,
          reference: sourceText,
        }) ?? sourceText)
      : sourceText
    if (!text) return undefined
    const font = getSchematicFont({
      fallbackSize: 9,
      record,
      sheetRecord: context.sheetRecord,
    })
    const positioning = getSchematicTextPositioning(record)
    const renderedText =
      kind === "25" ? renderAltiumNegatedText(text) : escapeXml(text)
    return `<text ${metadata} x="0" y="0" fill="${color}" ${font.attributes} text-anchor="${positioning.anchor}" dominant-baseline="${positioning.baseline}" transform="translate(${formatSvgNumber(x)} ${formatSvgNumber(y)}) rotate(${formatSvgNumber(positioning.rotation)})">${renderedText}</text>`
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

function renderSchematicBezierPath(
  points: SvgPoint[],
  viewport: SvgViewport,
): string | undefined {
  const startPoint = points[0]
  if (!startPoint || points.length < 4) return undefined

  const commands = [
    `M ${formatSvgNumber(viewport.toX(startPoint.x))} ${formatSvgNumber(viewport.toY(startPoint.y))}`,
  ]
  for (let index = 1; index + 2 < points.length; index += 3) {
    const controlPoint1 = points[index]
    const controlPoint2 = points[index + 1]
    const endPoint = points[index + 2]
    if (!controlPoint1 || !controlPoint2 || !endPoint) break
    commands.push(
      `C ${formatSvgNumber(viewport.toX(controlPoint1.x))} ${formatSvgNumber(viewport.toY(controlPoint1.y))} ${formatSvgNumber(viewport.toX(controlPoint2.x))} ${formatSvgNumber(viewport.toY(controlPoint2.y))} ${formatSvgNumber(viewport.toX(endPoint.x))} ${formatSvgNumber(viewport.toY(endPoint.y))}`,
    )
  }

  return commands.length > 1 ? commands.join(" ") : undefined
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

function renderSchematicPinText(params: {
  anchor: "start" | "end"
  color: string
  dominantBaseline: "central" | "text-after-edge"
  fontAttributes: string
  clockwiseRotationDegrees: number
  svgPosition: SvgPoint
  text: string
  useAltiumNegation?: boolean
}): string {
  const {
    anchor,
    color,
    dominantBaseline,
    fontAttributes,
    clockwiseRotationDegrees,
    svgPosition,
    text,
    useAltiumNegation,
  } = params
  if (!text) return ""

  const renderedText = useAltiumNegation
    ? renderAltiumNegatedText(text)
    : escapeXml(text)
  return `<text x="0" y="0" fill="${color}" ${fontAttributes} text-anchor="${anchor}" dominant-baseline="${dominantBaseline}" transform="translate(${formatSvgNumber(svgPosition.x)} ${formatSvgNumber(svgPosition.y)}) rotate(${formatSvgNumber(clockwiseRotationDegrees)})">${renderedText}</text>`
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
  const pinEdgeSymbols = renderSchematicPinEdgeSymbols({
    bodyPosition: body,
    color,
    hasClockSymbol: record.getNumber("SYMBOL_INNEREDGE") === 3,
    hasInversionSymbol: record.getNumber("SYMBOL_OUTEREDGE") === 1,
    screenDirection,
  })
  const clockwiseRotationDegrees =
    orientation === 1 || orientation === 3 ? -90 : 0
  const directionMatchesText = orientation === 0 || orientation === 1
  const designatorAnchor = directionMatchesText ? "start" : "end"
  const nameAnchor = directionMatchesText ? "end" : "start"
  const designatorPosition = {
    x: pinEdgeSymbols.outerSymbolEdgePosition.x + screenDirection.x * 2,
    y: pinEdgeSymbols.outerSymbolEdgePosition.y + screenDirection.y * 2,
  }
  const namePosition = {
    x: body.x - screenDirection.x * 2,
    y: body.y - screenDirection.y * 2,
  }
  const font = getSchematicFont({
    fallbackSize: 6,
    record,
    sheetRecord,
  })
  const designatorSvg = showDesignator
    ? renderSchematicPinText({
        anchor: designatorAnchor,
        color,
        dominantBaseline: "text-after-edge",
        fontAttributes: font.attributes,
        clockwiseRotationDegrees,
        svgPosition: designatorPosition,
        text: designator,
      })
    : ""
  const nameSvg = showName
    ? renderSchematicPinText({
        anchor: nameAnchor,
        color,
        dominantBaseline: "central",
        fontAttributes: font.attributes,
        clockwiseRotationDegrees,
        svgPosition: namePosition,
        text: name,
        useAltiumNegation: true,
      })
    : ""

  return `<g ${metadata}><line x1="${formatSvgNumber(pinEdgeSymbols.lineStartPosition.x)}" y1="${formatSvgNumber(pinEdgeSymbols.lineStartPosition.y)}" x2="${formatSvgNumber(connection.x)}" y2="${formatSvgNumber(connection.y)}" stroke="${color}" stroke-width="1"/>${pinEdgeSymbols.svg}${designatorSvg}${nameSvg}</g>`
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

  const font = getSchematicFont({
    fallbackSize: 10,
    record,
    sheetRecord,
  })
  const label = point(labelDistance)
  const vertical = direction.y !== 0
  const textAnchor = vertical ? "middle" : direction.x > 0 ? "start" : "end"
  const baseline = vertical ? (direction.y > 0 ? "hanging" : "auto") : "central"
  return `<g ${metadata}>${symbol}<text x="${formatSvgNumber(label.x)}" y="${formatSvgNumber(label.y)}" text-anchor="${textAnchor}" dominant-baseline="${baseline}" fill="${color}" ${font.attributes}>${renderAltiumNegatedText(text)}</text></g>`
}

function renderSchematicSheetBorder(
  sheetRecord: AltiumSchSheetRecord | undefined,
  viewport: SvgViewport,
  sheetWidth: number,
  sheetHeight: number,
): string {
  const left = viewport.toX(0)
  const top = viewport.toY(sheetHeight)
  const margin = Math.max(
    Number(sheetRecord?.getCaseInsensitive("CUSTOMMARGINWIDTH") ?? 10),
    4,
  )
  const innerLeft = viewport.toX(margin)
  const innerTop = viewport.toY(sheetHeight - margin)
  const innerWidth = Math.max(sheetWidth - margin * 2, 1)
  const innerHeight = Math.max(sheetHeight - margin * 2, 1)
  const xZones = Math.max(
    Math.round(Number(sheetRecord?.getCaseInsensitive("CUSTOMXZONES") ?? 6)),
    1,
  )
  const yZones = Math.max(
    Math.round(Number(sheetRecord?.getCaseInsensitive("CUSTOMYZONES") ?? 4)),
    1,
  )
  const zoneMarks: string[] = []

  for (let index = 1; index < xZones; index++) {
    const x = innerLeft + (innerWidth * index) / xZones
    zoneMarks.push(
      `<path d="M ${formatSvgNumber(x)} ${formatSvgNumber(top)} V ${formatSvgNumber(innerTop)} M ${formatSvgNumber(x)} ${formatSvgNumber(innerTop + innerHeight)} V ${formatSvgNumber(top + sheetHeight)}"/>`,
    )
  }
  for (let index = 1; index < yZones; index++) {
    const y = innerTop + (innerHeight * index) / yZones
    zoneMarks.push(
      `<path d="M ${formatSvgNumber(left)} ${formatSvgNumber(y)} H ${formatSvgNumber(innerLeft)} M ${formatSvgNumber(innerLeft + innerWidth)} ${formatSvgNumber(y)} H ${formatSvgNumber(left + sheetWidth)}"/>`,
    )
  }

  return `<g data-record="SheetBorder" fill="#fffef8" stroke="#334155" stroke-width="1"><rect x="${formatSvgNumber(left)}" y="${formatSvgNumber(top)}" width="${formatSvgNumber(sheetWidth)}" height="${formatSvgNumber(sheetHeight)}"/><rect x="${formatSvgNumber(innerLeft)}" y="${formatSvgNumber(innerTop)}" width="${formatSvgNumber(innerWidth)}" height="${formatSvgNumber(innerHeight)}" fill="none"/>${zoneMarks.join("")}</g>`
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
  const font = getSchematicFont({
    fallbackSize: 9,
    record,
    sheetRecord,
  })
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
    const parent = getParentSchematicRecord(current, context)
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

function getSchematicRecordsInPaintOrder(
  records: AltiumRecord[],
  context: SchematicRenderContext,
): AltiumRecord[] {
  const recordsInPaintOrder = [...records]
  const componentRecordIndexes = new Map<AltiumRecord, number[]>()

  for (const [recordIndex, record] of records.entries()) {
    const component = getOwningSchematicComponent(record, context)
    if (!component) continue

    const indexes = componentRecordIndexes.get(component)
    if (indexes) indexes.push(recordIndex)
    else componentRecordIndexes.set(component, [recordIndex])
  }

  for (const indexes of componentRecordIndexes.values()) {
    const componentRecords = indexes
      .map((index) => records[index])
      .filter((record): record is AltiumRecord => record !== undefined)
    const firstPinIndex = componentRecords.findIndex(
      (record) => record.recordKind === "2",
    )
    if (firstPinIndex < 0) continue

    const lateOpaqueGraphics = componentRecords
      .slice(firstPinIndex + 1)
      .filter(isOpaqueSchematicGraphic)
    if (lateOpaqueGraphics.length === 0) continue

    const lateOpaqueGraphicSet = new Set(lateOpaqueGraphics)
    const reorderedComponentRecords = componentRecords.filter(
      (record) => !lateOpaqueGraphicSet.has(record),
    )
    const insertionIndex = reorderedComponentRecords.findIndex(
      (record) => record.recordKind === "2",
    )
    reorderedComponentRecords.splice(insertionIndex, 0, ...lateOpaqueGraphics)

    for (const [indexOffset, recordIndex] of indexes.entries()) {
      const record = reorderedComponentRecords[indexOffset]
      if (record) recordsInPaintOrder[recordIndex] = record
    }
  }

  return recordsInPaintOrder
}

function getOwningSchematicComponent(
  record: AltiumRecord,
  context: SchematicRenderContext,
): AltiumRecord | undefined {
  const visited = new Set<AltiumRecord>()
  let parent = getParentSchematicRecord(record, context)

  while (parent && !visited.has(parent)) {
    if (parent.recordKind === "1") return parent
    visited.add(parent)
    parent = getParentSchematicRecord(parent, context)
  }

  return undefined
}

function getParentSchematicRecord(
  record: AltiumRecord,
  context: SchematicRenderContext,
): AltiumRecord | undefined {
  if (context.document) return context.document.getParent(record)

  const ownerIndex = record.getNumber("OWNERINDEX")
  return ownerIndex === undefined || ownerIndex < 0
    ? undefined
    : context.records[ownerIndex]
}

function isOpaqueSchematicGraphic(record: AltiumRecord): boolean {
  if (record.recordKind === "7") {
    return (
      record.getBoolean("ISSOLID") === true &&
      record.getCaseInsensitive("AREACOLOR") !== undefined
    )
  }

  return (
    (record.recordKind === "8" ||
      record.recordKind === "10" ||
      record.recordKind === "14") &&
    record.getBoolean("ISSOLID") === true
  )
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
