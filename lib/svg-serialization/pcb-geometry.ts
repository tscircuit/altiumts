import type { AltiumPcbDocument } from "../altium-pcb-document"
import type { AltiumRecord } from "../records/altium-record"
import {
  getPcbMeasurement,
  getPcbVertexPoints,
  parsePcbMeasurement,
} from "./altium-values"
import type { SvgBounds, SvgPoint } from "./svg-types"
import { boundsFromPoints, expandBounds, mergeBounds } from "./svg-utils"

export function getPcbBoardOutline(document: AltiumPcbDocument): SvgPoint[] {
  for (const boardRecord of document.getRecordsByKind("Board")) {
    const points = getPcbVertexPoints(boardRecord)
    if (points.length >= 3) return points
  }
  return []
}

export function getPcbDocumentBounds(document: AltiumPcbDocument): SvgBounds {
  const outlineBounds = boundsFromPoints(getPcbBoardOutline(document))
  if (outlineBounds) return outlineBounds

  let bounds: SvgBounds | undefined
  for (const record of document.records) {
    bounds = mergeBounds(bounds, getPcbRecordBounds(record))
  }

  return bounds ?? { minX: 0, minY: 0, maxX: 1000, maxY: 800 }
}

export function getPcbRecordBounds(
  record: AltiumRecord,
): SvgBounds | undefined {
  const kind = record.recordKind

  if (kind === "Track") {
    const bounds = boundsFromPoints([
      {
        x: getPcbMeasurement(record, "X1"),
        y: getPcbMeasurement(record, "Y1"),
      },
      {
        x: getPcbMeasurement(record, "X2"),
        y: getPcbMeasurement(record, "Y2"),
      },
    ])
    const width = getPcbMeasurement(record, "WIDTH")
    return bounds && width > 0 ? expandBounds(bounds, width / 2) : bounds
  }

  if (kind === "Pad") {
    const x = getPcbMeasurement(record, "X")
    const y = getPcbMeasurement(record, "Y")
    const width =
      parsePcbMeasurement(record.getCaseInsensitive("XSIZE")) ??
      parsePcbMeasurement(record.getCaseInsensitive("TOPXSIZE")) ??
      20
    const height =
      parsePcbMeasurement(record.getCaseInsensitive("YSIZE")) ??
      parsePcbMeasurement(record.getCaseInsensitive("TOPYSIZE")) ??
      width
    const rotation =
      (Number(record.getCaseInsensitive("ROTATION") ?? 0) * Math.PI) / 180
    const halfWidth = width / 2
    const halfHeight = height / 2
    const extentX =
      Math.abs(Math.cos(rotation)) * halfWidth +
      Math.abs(Math.sin(rotation)) * halfHeight
    const extentY =
      Math.abs(Math.sin(rotation)) * halfWidth +
      Math.abs(Math.cos(rotation)) * halfHeight
    return {
      minX: x - extentX,
      minY: y - extentY,
      maxX: x + extentX,
      maxY: y + extentY,
    }
  }

  if (kind === "Via") {
    const x = getPcbMeasurement(record, "X")
    const y = getPcbMeasurement(record, "Y")
    const diameter =
      parsePcbMeasurement(record.getCaseInsensitive("DIAMETER")) ??
      parsePcbMeasurement(record.getCaseInsensitive("TOPLAYERSIZE")) ??
      20
    return {
      minX: x - diameter / 2,
      minY: y - diameter / 2,
      maxX: x + diameter / 2,
      maxY: y + diameter / 2,
    }
  }

  if (kind === "Arc") {
    const x = getPcbMeasurement(record, "LOCATION.X")
    const y = getPcbMeasurement(record, "LOCATION.Y")
    const radius = getPcbMeasurement(record, "RADIUS")
    const width = getPcbMeasurement(record, "WIDTH")
    const extent = radius + Math.max(width / 2, 0)
    return {
      minX: x - extent,
      minY: y - extent,
      maxX: x + extent,
      maxY: y + extent,
    }
  }

  if (kind === "Region" || kind === "Polygon" || kind === "Board") {
    return boundsFromPoints(getPcbVertexPoints(record))
  }

  if (kind === "Text") {
    const x = getPcbMeasurement(record, "X")
    const y = getPcbMeasurement(record, "Y")
    const height = getPcbMeasurement(record, "HEIGHT", 30)
    return expandBounds({ minX: x, minY: y, maxX: x, maxY: y }, height)
  }

  if (kind === "Fill") {
    return boundsFromPoints([
      {
        x: getPcbMeasurement(record, "X1"),
        y: getPcbMeasurement(record, "Y1"),
      },
      {
        x: getPcbMeasurement(record, "X2"),
        y: getPcbMeasurement(record, "Y2"),
      },
    ])
  }

  return undefined
}
