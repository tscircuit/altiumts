import type { AltiumRecord } from "../records/altium-record"
import { getPcbMeasurement, parsePcbMeasurement } from "./altium-values"
import { normalizeLayerName } from "./pcb-layer"

export interface PcbPadGeometry {
  cornerRadius: number
  height: number
  holeOffsetX: number
  holeOffsetY: number
  holeRotation: number
  holeShape: string
  holeSize: number
  layerOrdinal: number
  plated: boolean
  rotation: number
  shape: string
  slotLength: number
  width: number
  x: number
  y: number
}

export function getPcbPadGeometry(
  record: AltiumRecord,
  requestedLayers?: string[],
  expansion = 0,
): PcbPadGeometry {
  const layerOrdinal = getRequestedPadLayerOrdinal(record, requestedLayers)
  const padMode = record.getNumber("PADMODE") ?? 0
  const sizeAndShape = getPadSizeAndShape(record, layerOrdinal, padMode)
  const alternateShape = record
    .getCaseInsensitive(`LAYER${layerOrdinal}ALTSHAPE`)
    ?.toUpperCase()
  const cornerRadiusValue = Number(
    record.getCaseInsensitive(`LAYER${layerOrdinal}CORNERRADIUS`) ?? 0,
  )
  const baseCornerRadius =
    alternateShape === "ROUNDRECT" && Number.isFinite(cornerRadiusValue)
      ? (Math.min(sizeAndShape.width, sizeAndShape.height) *
          cornerRadiusValue) /
        200
      : 0
  const holeType = record.getNumber("HOLETYPE")
  const holeShape =
    record.getCaseInsensitive("HOLESHAPE")?.toUpperCase() ??
    (holeType === 1 ? "SQUARE" : holeType === 2 ? "SLOT" : "ROUND")
  const holeSize = getPcbMeasurement(record, "HOLESIZE")
  const slotLength =
    parsePcbMeasurement(record.getCaseInsensitive("SLOTLENGTH")) ??
    (holeShape === "SLOT"
      ? parsePcbMeasurement(record.getCaseInsensitive("HOLEWIDTH"))
      : undefined) ??
    holeSize

  return {
    cornerRadius: Math.max(baseCornerRadius + expansion, 0),
    height: Math.max(sizeAndShape.height + expansion * 2, 0),
    holeOffsetX: getPcbMeasurement(
      record,
      `LAYER${layerOrdinal}HOLEXOFFSET`,
      getPcbMeasurement(record, `PADXOFFSET${layerOrdinal}`),
    ),
    holeOffsetY: getPcbMeasurement(
      record,
      `LAYER${layerOrdinal}HOLEYOFFSET`,
      getPcbMeasurement(record, `PADYOFFSET${layerOrdinal}`),
    ),
    holeRotation: Number(
      record.getCaseInsensitive("SLOTROTATION") ??
        record.getCaseInsensitive("HOLEROTATION") ??
        0,
    ),
    holeShape,
    holeSize,
    layerOrdinal,
    plated: record.getBoolean("PLATED") !== false,
    rotation: Number(record.getCaseInsensitive("ROTATION") ?? 0),
    shape: alternateShape === "ROUNDRECT" ? alternateShape : sizeAndShape.shape,
    slotLength,
    width: Math.max(sizeAndShape.width + expansion * 2, 0),
    x: getPcbMeasurement(record, "X"),
    y: getPcbMeasurement(record, "Y"),
  }
}

function getPadSizeAndShape(
  record: AltiumRecord,
  layerOrdinal: number,
  padMode: number,
): { height: number; shape: string; width: number } {
  const recordLayer = normalizeLayerName(
    record.getCaseInsensitive("LAYER") ?? "",
  )
  const isMultilayer = recordLayer === "MULTILAYER"

  if (!isMultilayer || padMode === 0 || layerOrdinal === 0) {
    return {
      height:
        firstMeasurement(record, ["YSIZE", "TOPYSIZE"]) ??
        firstMeasurement(record, ["XSIZE", "TOPXSIZE"]) ??
        20,
      shape:
        firstValue(record, ["SHAPE", "TOPSHAPE"])?.toUpperCase() ?? "ROUND",
      width: firstMeasurement(record, ["XSIZE", "TOPXSIZE"]) ?? 20,
    }
  }

  if (layerOrdinal === 31) {
    const width =
      firstMeasurement(record, [
        "BOTTOMXSIZE",
        "BOTXSIZE",
        "XSIZE",
        "TOPXSIZE",
      ]) ?? 20
    return {
      height:
        firstMeasurement(record, [
          "BOTTOMYSIZE",
          "BOTYSIZE",
          "YSIZE",
          "TOPYSIZE",
        ]) ?? width,
      shape:
        firstValue(record, [
          "BOTTOMSHAPE",
          "BOTSHAPE",
          "SHAPE",
          "TOPSHAPE",
        ])?.toUpperCase() ?? "ROUND",
      width,
    }
  }

  if (padMode === 2 && layerOrdinal >= 2) {
    const width =
      firstMeasurement(record, [
        `LAYER${layerOrdinal}XSIZE`,
        "MIDXSIZE",
        "XSIZE",
      ]) ?? 20
    return {
      height:
        firstMeasurement(record, [
          `LAYER${layerOrdinal}YSIZE`,
          "MIDYSIZE",
          "YSIZE",
        ]) ?? width,
      shape:
        firstValue(record, [
          `LAYER${layerOrdinal}SHAPE`,
          "MIDSHAPE",
          "SHAPE",
        ])?.toUpperCase() ?? "ROUND",
      width,
    }
  }

  const width =
    firstMeasurement(record, ["MIDXSIZE", "XSIZE", "TOPXSIZE"]) ?? 20
  return {
    height:
      firstMeasurement(record, ["MIDYSIZE", "YSIZE", "TOPYSIZE"]) ?? width,
    shape:
      firstValue(record, ["MIDSHAPE", "SHAPE", "TOPSHAPE"])?.toUpperCase() ??
      "ROUND",
    width,
  }
}

function getRequestedPadLayerOrdinal(
  record: AltiumRecord,
  requestedLayers: string[] | undefined,
): number {
  const requestedLayer =
    requestedLayers?.length === 1
      ? normalizeLayerName(requestedLayers[0] ?? "")
      : normalizeLayerName(record.getCaseInsensitive("LAYER") ?? "")
  if (requestedLayer === "BOTTOM" || requestedLayer === "BOTTOMSOLDER") {
    return 31
  }
  if (requestedLayer === "TOP" || requestedLayer === "TOPSOLDER") return 0

  const innerMatch = /^(?:MIDLAYER|MID|INTERNALPLANE)(\d+)$/u.exec(
    requestedLayer,
  )
  if (!innerMatch?.[1]) return 0
  return Math.min(Math.max(Number(innerMatch[1]), 1), 30)
}

function firstMeasurement(
  record: AltiumRecord,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const value = parsePcbMeasurement(record.getCaseInsensitive(key))
    if (value !== undefined) return value
  }
  return undefined
}

function firstValue(record: AltiumRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record.getCaseInsensitive(key)
    if (value !== undefined) return value
  }
  return undefined
}
