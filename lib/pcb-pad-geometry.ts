import type { AltiumPadRecord } from "./records/altium-pad-record"
import { getPcbRecordMeasurementMils } from "./records/pcb-record-helpers"

export interface AltiumPcbPadGeometry {
  cornerRadiusMils: number
  heightMils: number
  holeOffsetXMils: number
  holeOffsetYMils: number
  holeRotationDegrees: number
  holeShape: string
  holeSizeMils: number
  layerOrdinal: number
  plated: boolean
  rotationDegrees: number
  shape: string
  slotLengthMils: number
  widthMils: number
  xMils: number
  yMils: number
}

export interface GetAltiumPcbPadGeometryOptions {
  record: AltiumPadRecord
  requestedLayers?: readonly string[]
  /**
   * Selects the requested layer's pad-stack fields even for a surface pad.
   * Altium's SVG renderer keeps this disabled for backwards-compatible views.
   */
  useRequestedLayerGeometry?: boolean
}

/**
 * Resolves the effective geometry for one layer of an Altium pad stack.
 * Measurements remain in Altium's native mil coordinate space.
 */
export function getAltiumPcbPadGeometry({
  record,
  requestedLayers,
  useRequestedLayerGeometry = false,
}: GetAltiumPcbPadGeometryOptions): AltiumPcbPadGeometry {
  const layerOrdinal = getRequestedPadLayerOrdinal(record, requestedLayers)
  const padMode = record.padMode ?? 0
  const sizeAndShape = getPadSizeAndShape({
    layerOrdinal,
    padMode,
    record,
    useRequestedLayerGeometry,
  })
  const alternateShape = record
    .getCaseInsensitive(`LAYER${layerOrdinal}ALTSHAPE`)
    ?.toUpperCase()
  const cornerRadiusPercent = Number(
    record.getCaseInsensitive(`LAYER${layerOrdinal}CORNERRADIUS`) ?? 0,
  )
  const cornerRadiusMils =
    alternateShape === "ROUNDRECT" && Number.isFinite(cornerRadiusPercent)
      ? (Math.min(sizeAndShape.widthMils, sizeAndShape.heightMils) *
          cornerRadiusPercent) /
        200
      : 0
  const holeType = record.getNumber("HOLETYPE")
  const holeShape =
    record.getCaseInsensitive("HOLESHAPE")?.toUpperCase() ??
    (holeType === 1 ? "SQUARE" : holeType === 2 ? "SLOT" : "ROUND")
  const holeSizeMils = record.holeSizeMils ?? 0
  const slotLengthMils =
    getPcbRecordMeasurementMils(record, "SLOTLENGTH") ??
    (holeShape === "SLOT" ? record.holeWidthMils : undefined) ??
    holeSizeMils

  return {
    cornerRadiusMils,
    heightMils: sizeAndShape.heightMils,
    holeOffsetXMils:
      getPcbRecordMeasurementMils(
        record,
        `LAYER${layerOrdinal}HOLEXOFFSET`,
        `PADXOFFSET${layerOrdinal}`,
      ) ?? 0,
    holeOffsetYMils:
      getPcbRecordMeasurementMils(
        record,
        `LAYER${layerOrdinal}HOLEYOFFSET`,
        `PADYOFFSET${layerOrdinal}`,
      ) ?? 0,
    holeRotationDegrees: Number(
      record.getCaseInsensitive("SLOTROTATION") ??
        record.getCaseInsensitive("HOLEROTATION") ??
        0,
    ),
    holeShape,
    holeSizeMils,
    layerOrdinal,
    plated: record.plated !== false,
    rotationDegrees: Number(record.getCaseInsensitive("ROTATION") ?? 0),
    shape: alternateShape === "ROUNDRECT" ? alternateShape : sizeAndShape.shape,
    slotLengthMils,
    widthMils: sizeAndShape.widthMils,
    xMils: record.position?.x ?? 0,
    yMils: record.position?.y ?? 0,
  }
}

function getPadSizeAndShape({
  layerOrdinal,
  padMode,
  record,
  useRequestedLayerGeometry,
}: {
  layerOrdinal: number
  padMode: number
  record: AltiumPadRecord
  useRequestedLayerGeometry: boolean
}): { heightMils: number; shape: string; widthMils: number } {
  const recordLayer = normalizeLayerName(record.layer)
  const isMultilayer = recordLayer === "MULTILAYER"

  if (
    (!useRequestedLayerGeometry && (!isMultilayer || padMode === 0)) ||
    layerOrdinal === 0
  ) {
    return {
      heightMils:
        getPcbRecordMeasurementMils(record, "YSIZE", "TOPYSIZE") ??
        getPcbRecordMeasurementMils(record, "XSIZE", "TOPXSIZE") ??
        20,
      shape:
        firstField(record, ["SHAPE", "TOPSHAPE"])?.toUpperCase() ?? "ROUND",
      widthMils: getPcbRecordMeasurementMils(record, "XSIZE", "TOPXSIZE") ?? 20,
    }
  }

  if (layerOrdinal === 31) {
    const widthMils =
      getPcbRecordMeasurementMils(
        record,
        "BOTTOMXSIZE",
        "BOTXSIZE",
        "XSIZE",
        "TOPXSIZE",
      ) ?? 20
    return {
      heightMils:
        getPcbRecordMeasurementMils(
          record,
          "BOTTOMYSIZE",
          "BOTYSIZE",
          "YSIZE",
          "TOPYSIZE",
        ) ?? widthMils,
      shape:
        firstField(record, [
          "BOTTOMSHAPE",
          "BOTSHAPE",
          "SHAPE",
          "TOPSHAPE",
        ])?.toUpperCase() ?? "ROUND",
      widthMils,
    }
  }

  if (padMode === 2 && layerOrdinal >= 2) {
    const widthMils =
      getPcbRecordMeasurementMils(
        record,
        `LAYER${layerOrdinal}XSIZE`,
        "MIDXSIZE",
        "XSIZE",
      ) ?? 20
    return {
      heightMils:
        getPcbRecordMeasurementMils(
          record,
          `LAYER${layerOrdinal}YSIZE`,
          "MIDYSIZE",
          "YSIZE",
        ) ?? widthMils,
      shape:
        firstField(record, [
          `LAYER${layerOrdinal}SHAPE`,
          "MIDSHAPE",
          "SHAPE",
        ])?.toUpperCase() ?? "ROUND",
      widthMils,
    }
  }

  const widthMils =
    getPcbRecordMeasurementMils(record, "MIDXSIZE", "XSIZE", "TOPXSIZE") ?? 20
  return {
    heightMils:
      getPcbRecordMeasurementMils(record, "MIDYSIZE", "YSIZE", "TOPYSIZE") ??
      widthMils,
    shape:
      firstField(record, ["MIDSHAPE", "SHAPE", "TOPSHAPE"])?.toUpperCase() ??
      "ROUND",
    widthMils,
  }
}

function getRequestedPadLayerOrdinal(
  record: AltiumPadRecord,
  requestedLayers: readonly string[] | undefined,
): number {
  const requestedLayer =
    requestedLayers?.length === 1
      ? normalizeLayerName(requestedLayers[0])
      : normalizeLayerName(record.layer)
  if (requestedLayer === "BOTTOM" || requestedLayer === "BOTTOMSOLDER") {
    return 31
  }
  if (requestedLayer === "TOP" || requestedLayer === "TOPSOLDER") return 0

  const innerLayerMatch = /^(?:MIDLAYER|MID|INTERNALPLANE)(\d+)$/u.exec(
    requestedLayer,
  )
  if (!innerLayerMatch?.[1]) return 0
  return Math.min(Math.max(Number(innerLayerMatch[1]), 1), 30)
}

function firstField(
  record: AltiumPadRecord,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const fieldContent = record.getCaseInsensitive(key)
    if (fieldContent !== undefined) return fieldContent
  }
  return undefined
}

function normalizeLayerName(layer: string | undefined): string {
  return (layer ?? "").replace(/[\s_.-]+/gu, "").toUpperCase()
}
