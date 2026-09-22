import { getPcbRecordMeasurementMils } from "../records/pcb-record-helpers"
import { getPadSizeAndShape } from "./getPadSizeAndShape"
import { getRequestedPadLayerOrdinal } from "./getRequestedPadLayerOrdinal"
import type {
  AltiumPcbPadGeometry,
  GetAltiumPcbPadGeometryOptions,
} from "./types"

/** Resolves one pad-stack layer in Altium's native mil coordinate space. */
export function getAltiumPcbPadGeometry({
  record,
  requestedLayers,
  useRequestedLayerGeometry = false,
}: GetAltiumPcbPadGeometryOptions): AltiumPcbPadGeometry {
  const layerOrdinal = getRequestedPadLayerOrdinal({ record, requestedLayers })
  const sizeAndShape = getPadSizeAndShape({
    layerOrdinal,
    padMode: record.padMode ?? 0,
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
    holeCcwRotationDegrees: Number(
      record.getCaseInsensitive("SLOTROTATION") ??
        record.getCaseInsensitive("HOLEROTATION") ??
        0,
    ),
    holeShape,
    holeSizeMils,
    layerOrdinal,
    plated: record.plated !== false,
    ccwRotationDegrees: Number(record.getCaseInsensitive("ROTATION") ?? 0),
    shape: alternateShape === "ROUNDRECT" ? alternateShape : sizeAndShape.shape,
    slotLengthMils,
    widthMils: sizeAndShape.widthMils,
    xMils: record.position?.x ?? 0,
    yMils: record.position?.y ?? 0,
  }
}
