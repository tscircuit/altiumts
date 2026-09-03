import type { AltiumRecord } from "../records/altium-record"
import { getSchematicCoordinate } from "./altium-values"
import { getSchematicFont } from "./get-schematic-font"
import { renderAltiumNegatedText } from "./render-altium-negated-text"
import type { SchematicRenderContext } from "./schematic-render-context"
import type { SvgPoint, SvgViewport } from "./svg-types"
import { formatSvgNumber } from "./svg-utils"

type SchematicSheetEntrySide = 0 | 1 | 2 | 3

type RenderSchematicSheetSymbolInput = {
  metadata: string
  record: AltiumRecord
  viewport: SvgViewport
}

type RenderSchematicSheetEntryInput = RenderSchematicSheetSymbolInput & {
  context: SchematicRenderContext
}

type GetSchematicSheetEntryPointInput = {
  distanceFromTopAltiumUnits: number
  sheetHeightAltiumUnits: number
  sheetLocationAltiumUnits: SvgPoint
  sheetWidthAltiumUnits: number
  side: SchematicSheetEntrySide
}

type GetSchematicSheetEntryPolygonInput = {
  entrySvgPoint: SvgPoint
  side: SchematicSheetEntrySide
}

type GetSchematicSheetEntryTextPositionInput = {
  entrySvgPoint: SvgPoint
  side: SchematicSheetEntrySide
}

type GetSchematicRecordParentInput = {
  context: SchematicRenderContext
  record: AltiumRecord
}

const SCHEMATIC_COMPONENT_OUTLINE_COLOR = "#840000"
const SCHEMATIC_COMPONENT_FILL_COLOR = "#ffffc2"
const ALTIUM_SHEET_ENTRY_DISTANCE_UNIT = 10
const ENTRY_TRIANGLE_HALF_WIDTH_SVG_UNITS = 4
const ENTRY_TRIANGLE_DEPTH_SVG_UNITS = 7
const ENTRY_TEXT_OFFSET_SVG_UNITS = 9

export function renderSchematicSheetSymbol({
  metadata,
  record,
  viewport,
}: RenderSchematicSheetSymbolInput): string {
  const location = getSchematicLocation(record)
  const widthAltiumUnits = Math.max(
    getSchematicCoordinate(record, "XSIZE", 1),
    1,
  )
  const heightAltiumUnits = Math.max(
    getSchematicCoordinate(record, "YSIZE", 1),
    1,
  )
  const left = viewport.toX(location.x)
  const top = viewport.toY(location.y)
  return `<rect ${metadata} x="${formatSvgNumber(left)}" y="${formatSvgNumber(top)}" width="${formatSvgNumber(widthAltiumUnits)}" height="${formatSvgNumber(heightAltiumUnits)}" fill="${SCHEMATIC_COMPONENT_FILL_COLOR}" stroke="${SCHEMATIC_COMPONENT_OUTLINE_COLOR}" stroke-width="1"/>`
}

export function renderSchematicSheetEntry({
  context,
  metadata,
  record,
  viewport,
}: RenderSchematicSheetEntryInput): string | undefined {
  const sheetSymbol = getSchematicRecordParent({ context, record })
  if (sheetSymbol?.recordKind !== "15") return undefined

  const sheetLocation = getSchematicLocation(sheetSymbol)
  const sheetWidthAltiumUnits = Math.max(
    getSchematicCoordinate(sheetSymbol, "XSIZE", 1),
    1,
  )
  const sheetHeightAltiumUnits = Math.max(
    getSchematicCoordinate(sheetSymbol, "YSIZE", 1),
    1,
  )
  const side = getSchematicSheetEntrySide(record)
  const distanceFromTopAltiumUnits =
    Math.max(record.getNumber("DISTANCEFROMTOP") ?? 0, 0) *
    ALTIUM_SHEET_ENTRY_DISTANCE_UNIT
  const entryPoint = getSchematicSheetEntryPoint({
    distanceFromTopAltiumUnits,
    sheetHeightAltiumUnits,
    sheetLocationAltiumUnits: sheetLocation,
    sheetWidthAltiumUnits,
    side,
  })
  const entrySvgPoint = {
    x: viewport.toX(entryPoint.x),
    y: viewport.toY(entryPoint.y),
  }
  const entryPolygonPoints = getSchematicSheetEntryPolygon({
    entrySvgPoint,
    side,
  })
  const name = record.getDecoded("NAME") ?? ""
  const font = getSchematicFont({
    fallbackSize: 8,
    fontIdFieldName: "TEXTFONTID",
    record,
    sheetRecord: context.sheetRecord,
  })
  const textPosition = getSchematicSheetEntryTextPosition({
    entrySvgPoint,
    side,
  })
  const isHorizontal = side === 0 || side === 1
  const textAnchor = side === 0 ? "start" : side === 1 ? "end" : "middle"
  const baseline = isHorizontal
    ? "central"
    : side === 2
      ? "hanging"
      : "text-after-edge"

  return `<g ${metadata}><polygon points="${entryPolygonPoints}" fill="${SCHEMATIC_COMPONENT_FILL_COLOR}" stroke="${SCHEMATIC_COMPONENT_OUTLINE_COLOR}" stroke-width="1"/>${name ? `<text x="${formatSvgNumber(textPosition.x)}" y="${formatSvgNumber(textPosition.y)}" text-anchor="${textAnchor}" dominant-baseline="${baseline}" fill="${SCHEMATIC_COMPONENT_OUTLINE_COLOR}" ${font.attributes}>${renderAltiumNegatedText(name)}</text>` : ""}</g>`
}

function getSchematicRecordParent({
  context,
  record,
}: GetSchematicRecordParentInput): AltiumRecord | undefined {
  if (context.document) return context.document.getParent(record)
  const ownerIndex = record.getNumber("OWNERINDEX")
  return ownerIndex === undefined || ownerIndex < 0
    ? undefined
    : context.records[ownerIndex]
}

function getSchematicSheetEntrySide(
  record: AltiumRecord,
): SchematicSheetEntrySide {
  const side = Math.round(record.getNumber("SIDE") ?? 0)
  return side === 1 || side === 2 || side === 3 ? side : 0
}

function getSchematicSheetEntryPoint({
  distanceFromTopAltiumUnits,
  sheetHeightAltiumUnits,
  sheetLocationAltiumUnits,
  sheetWidthAltiumUnits,
  side,
}: GetSchematicSheetEntryPointInput): SvgPoint {
  if (side === 1) {
    return {
      x: sheetLocationAltiumUnits.x + sheetWidthAltiumUnits,
      y: sheetLocationAltiumUnits.y - distanceFromTopAltiumUnits,
    }
  }
  if (side === 2) {
    return {
      x: sheetLocationAltiumUnits.x + distanceFromTopAltiumUnits,
      y: sheetLocationAltiumUnits.y,
    }
  }
  if (side === 3) {
    return {
      x: sheetLocationAltiumUnits.x + distanceFromTopAltiumUnits,
      y: sheetLocationAltiumUnits.y - sheetHeightAltiumUnits,
    }
  }
  return {
    x: sheetLocationAltiumUnits.x,
    y: sheetLocationAltiumUnits.y - distanceFromTopAltiumUnits,
  }
}

function getSchematicSheetEntryPolygon({
  entrySvgPoint,
  side,
}: GetSchematicSheetEntryPolygonInput): string {
  const { x, y } = entrySvgPoint
  if (side === 1) {
    return `${formatSvgNumber(x)},${formatSvgNumber(y - ENTRY_TRIANGLE_HALF_WIDTH_SVG_UNITS)} ${formatSvgNumber(x - ENTRY_TRIANGLE_DEPTH_SVG_UNITS)},${formatSvgNumber(y)} ${formatSvgNumber(x)},${formatSvgNumber(y + ENTRY_TRIANGLE_HALF_WIDTH_SVG_UNITS)}`
  }
  if (side === 2) {
    return `${formatSvgNumber(x - ENTRY_TRIANGLE_HALF_WIDTH_SVG_UNITS)},${formatSvgNumber(y)} ${formatSvgNumber(x)},${formatSvgNumber(y + ENTRY_TRIANGLE_DEPTH_SVG_UNITS)} ${formatSvgNumber(x + ENTRY_TRIANGLE_HALF_WIDTH_SVG_UNITS)},${formatSvgNumber(y)}`
  }
  if (side === 3) {
    return `${formatSvgNumber(x - ENTRY_TRIANGLE_HALF_WIDTH_SVG_UNITS)},${formatSvgNumber(y)} ${formatSvgNumber(x)},${formatSvgNumber(y - ENTRY_TRIANGLE_DEPTH_SVG_UNITS)} ${formatSvgNumber(x + ENTRY_TRIANGLE_HALF_WIDTH_SVG_UNITS)},${formatSvgNumber(y)}`
  }
  return `${formatSvgNumber(x)},${formatSvgNumber(y - ENTRY_TRIANGLE_HALF_WIDTH_SVG_UNITS)} ${formatSvgNumber(x + ENTRY_TRIANGLE_DEPTH_SVG_UNITS)},${formatSvgNumber(y)} ${formatSvgNumber(x)},${formatSvgNumber(y + ENTRY_TRIANGLE_HALF_WIDTH_SVG_UNITS)}`
}

function getSchematicSheetEntryTextPosition({
  entrySvgPoint,
  side,
}: GetSchematicSheetEntryTextPositionInput): SvgPoint {
  const { x, y } = entrySvgPoint
  if (side === 0) return { x: x + ENTRY_TEXT_OFFSET_SVG_UNITS, y }
  if (side === 1) return { x: x - ENTRY_TEXT_OFFSET_SVG_UNITS, y }
  if (side === 2) return { x, y: y + ENTRY_TEXT_OFFSET_SVG_UNITS }
  return { x, y: y - ENTRY_TEXT_OFFSET_SVG_UNITS }
}

function getSchematicLocation(record: AltiumRecord): SvgPoint {
  return {
    x: getSchematicCoordinate(record, "LOCATION.X"),
    y: getSchematicCoordinate(record, "LOCATION.Y"),
  }
}
