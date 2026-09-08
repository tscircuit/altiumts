import type { AltiumPcbDocument } from "../altium-pcb-document"
import { getPcbComponentByIndex } from "../pcb-reference-resolution"
import type { AltiumRecord } from "../records/altium-record"
import {
  getPcbMeasurement,
  getPcbVertexPoints,
  parsePcbMeasurement,
} from "./altium-values"
import { getPcbDimensionGeometry } from "./pcb-dimension-geometry"
import { normalizeLayerName, recordAppliesToLayers } from "./pcb-layer"
import { getPcbPadGeometry } from "./pcb-pad-geometry"
import type { SvgBounds, SvgPoint } from "./svg-types"
import { boundsFromPoints, expandBounds, mergeBounds } from "./svg-utils"

export function getPcbBoardOutline(document: AltiumPcbDocument): SvgPoint[] {
  return document.boardGeometry.outline.points
}

export function getPcbDocumentBounds(
  document: AltiumPcbDocument,
  requestedLayers?: string[],
): SvgBounds {
  const outlineBounds = boundsFromPoints(getPcbBoardOutline(document))
  if (outlineBounds) {
    return document.records.reduce(
      (bounds, record) =>
        record.recordKind === "Dimension" ||
        isBoardMountedOverlayTrack(
          document,
          record,
          outlineBounds,
          requestedLayers,
        )
          ? (mergeBounds(bounds, getPcbRecordBounds(record)) ?? bounds)
          : bounds,
      outlineBounds,
    )
  }

  let bounds: SvgBounds | undefined
  for (const record of document.records) {
    bounds = mergeBounds(bounds, getPcbRecordBounds(record))
  }

  return bounds ?? { minX: 0, minY: 0, maxX: 1000, maxY: 800 }
}

function isBoardMountedOverlayTrack(
  document: AltiumPcbDocument,
  record: AltiumRecord,
  boardBounds: SvgBounds,
  requestedLayers?: string[],
): boolean {
  if (record.recordKind !== "Track") return false
  const layer = normalizeLayerName(record.getDecoded("LAYER") ?? "")
  if (layer !== "TOPOVERLAY" && layer !== "BOTTOMOVERLAY") return false
  if (!recordAppliesToLayers(record, requestedLayers)) return false
  const componentIndex = record.getNumber("COMPONENT")
  if (componentIndex === undefined) return false
  const component = getPcbComponentByIndex(document, componentIndex)
  if (!component) return false
  const x = getPcbMeasurement(component, "X")
  const y = getPcbMeasurement(component, "Y")
  return (
    x >= boardBounds.minX &&
    x <= boardBounds.maxX &&
    y >= boardBounds.minY &&
    y <= boardBounds.maxY
  )
}

export function getPcbRecordBounds(
  record: AltiumRecord,
  requestedLayers?: string[],
): SvgBounds | undefined {
  const kind = record.recordKind

  if (kind === "Dimension") {
    const geometry = getPcbDimensionGeometry(record)
    if (!geometry) return undefined
    const dimensionDeltaX = geometry.dimensionEnd.x - geometry.dimensionStart.x
    const dimensionDeltaY = geometry.dimensionEnd.y - geometry.dimensionStart.y
    const dimensionLength = Math.hypot(dimensionDeltaX, dimensionDeltaY)
    const textDirection = {
      x: dimensionDeltaX / dimensionLength,
      y: dimensionDeltaY / dimensionLength,
    }
    const bounds = boundsFromPoints([
      geometry.referenceStart,
      geometry.referenceEnd,
      geometry.dimensionStart,
      geometry.dimensionEnd,
      geometry.textPosition,
      {
        x:
          geometry.textPosition.x -
          textDirection.x * geometry.estimatedTextHalfWidth,
        y:
          geometry.textPosition.y -
          textDirection.y * geometry.estimatedTextHalfWidth,
      },
      {
        x:
          geometry.textPosition.x +
          textDirection.x * geometry.estimatedTextHalfWidth,
        y:
          geometry.textPosition.y +
          textDirection.y * geometry.estimatedTextHalfWidth,
      },
    ])
    return bounds
      ? expandBounds(bounds, Math.max(geometry.arrowSize, geometry.textHeight))
      : undefined
  }

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
    const geometry = getPcbPadGeometry(record, requestedLayers)
    const rotation = (geometry.rotation * Math.PI) / 180
    const halfWidth = geometry.width / 2
    const halfHeight = geometry.height / 2
    const extentX =
      Math.abs(Math.cos(rotation)) * halfWidth +
      Math.abs(Math.sin(rotation)) * halfHeight
    const extentY =
      Math.abs(Math.sin(rotation)) * halfWidth +
      Math.abs(Math.cos(rotation)) * halfHeight
    return {
      minX: geometry.x - extentX,
      minY: geometry.y - extentY,
      maxX: geometry.x + extentX,
      maxY: geometry.y + extentY,
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

  if (
    kind === "ComponentBody" ||
    kind === "Region" ||
    kind === "Polygon" ||
    kind === "Board"
  ) {
    return boundsFromPoints(getPcbVertexPoints(record))
  }

  if (kind === "Text") {
    const x = getPcbMeasurement(record, "X")
    const y = getPcbMeasurement(record, "Y")
    const height = getPcbMeasurement(record, "HEIGHT", 30)
    return expandBounds({ minX: x, minY: y, maxX: x, maxY: y }, height)
  }

  if (kind === "Fill") {
    const x1 = getPcbMeasurement(record, "X1")
    const y1 = getPcbMeasurement(record, "Y1")
    const x2 = getPcbMeasurement(record, "X2")
    const y2 = getPcbMeasurement(record, "Y2")
    const centerX = (x1 + x2) / 2
    const centerY = (y1 + y2) / 2
    const halfWidth = Math.abs(x2 - x1) / 2
    const halfHeight = Math.abs(y2 - y1) / 2
    const rotation =
      (Number(record.getCaseInsensitive("ROTATION") ?? 0) * Math.PI) / 180
    const extentX =
      Math.abs(Math.cos(rotation)) * halfWidth +
      Math.abs(Math.sin(rotation)) * halfHeight
    const extentY =
      Math.abs(Math.sin(rotation)) * halfWidth +
      Math.abs(Math.cos(rotation)) * halfHeight
    return {
      minX: centerX - extentX,
      minY: centerY - extentY,
      maxX: centerX + extentX,
      maxY: centerY + extentY,
    }
  }

  return undefined
}
