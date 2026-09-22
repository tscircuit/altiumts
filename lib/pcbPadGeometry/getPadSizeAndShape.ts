import type { AltiumPadRecord } from "../records/altium-pad-record"
import { getPcbRecordMeasurementMils } from "../records/pcb-record-helpers"
import { getFirstPadField } from "./getFirstPadField"
import { normalizeLayerName } from "./normalizeLayerName"
import type { AltiumPcbPadSizeAndShape } from "./types"

export function getPadSizeAndShape({
  layerOrdinal,
  padMode,
  record,
  useRequestedLayerGeometry,
}: {
  layerOrdinal: number
  padMode: number
  record: AltiumPadRecord
  useRequestedLayerGeometry: boolean
}): AltiumPcbPadSizeAndShape {
  const isMultilayer = normalizeLayerName(record.layer) === "MULTILAYER"

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
        getFirstPadField({
          record,
          fieldNames: ["SHAPE", "TOPSHAPE"],
        })?.toUpperCase() ?? "ROUND",
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
        getFirstPadField({
          record,
          fieldNames: ["BOTTOMSHAPE", "BOTSHAPE", "SHAPE", "TOPSHAPE"],
        })?.toUpperCase() ?? "ROUND",
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
        getFirstPadField({
          record,
          fieldNames: [`LAYER${layerOrdinal}SHAPE`, "MIDSHAPE", "SHAPE"],
        })?.toUpperCase() ?? "ROUND",
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
      getFirstPadField({
        record,
        fieldNames: ["MIDSHAPE", "SHAPE", "TOPSHAPE"],
      })?.toUpperCase() ?? "ROUND",
    widthMils,
  }
}
