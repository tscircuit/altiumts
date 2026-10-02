import { AltiumDimensionRecord } from "../records/altium-dimension-record"
import type { AltiumRecord } from "../records/altium-record"
import type { SvgPoint } from "./svg-types"

export interface PcbDimensionGeometry {
  arrowSize: number
  openArrows: boolean
  arrowLineWidth: number
  arrowLength: number
  arrowsOutside: boolean
  extensionLines: { start: SvgPoint; end: SvgPoint }[]
  extensionLineWidth: number
  textAngle: number
  textCorners: SvgPoint[]
  textGap: number
  textMirror: boolean
  textAtSavedOrigin: boolean
  dimensionEnd: SvgPoint
  dimensionStart: SvgPoint
  label: string
  lineWidth: number
  referenceEnd: SvgPoint
  referenceStart: SvgPoint
  textHeight: number
  textPosition: SvgPoint
}

export function getPcbDimensionGeometry(
  record: AltiumRecord,
): PcbDimensionGeometry | undefined {
  if (!(record instanceof AltiumDimensionRecord)) return undefined
  const dimension = record
  const referenceStart = dimension.start
  const referenceEnd = dimension.end
  if (!referenceStart || !referenceEnd) return undefined

  const deltaX = referenceEnd.x - referenceStart.x
  const deltaY = referenceEnd.y - referenceStart.y
  const referenceDistance = Math.hypot(deltaX, deltaY)
  if (referenceDistance === 0) return undefined

  // Linear dimensions measure along their saved angle, not the chord between
  // references (PMP22712's bottom corners have different Y coordinates).
  const angle =
    dimension.dimensionKind === "1" ? dimension.getNumber("ANGLE") : undefined
  const radians =
    angle === undefined ? Math.atan2(deltaY, deltaX) : (angle * Math.PI) / 180
  const direction = { x: Math.cos(radians), y: Math.sin(radians) }
  const measuredDistanceMils = Math.abs(
    deltaX * direction.x + deltaY * direction.y,
  )
  if (measuredDistanceMils < 1e-6) return undefined
  const lineAnchor = dimension.dimensionLineAnchor ?? referenceStart
  const projectToLine = (point: SvgPoint): SvgPoint => {
    const distance =
      (point.x - lineAnchor.x) * direction.x +
      (point.y - lineAnchor.y) * direction.y
    return {
      x: lineAnchor.x + distance * direction.x,
      y: lineAnchor.y + distance * direction.y,
    }
  }
  const dimensionStart = projectToLine(referenceStart)
  const dimensionEnd = projectToLine(referenceEnd)
  const textPosition = dimension.textPoints[0] ?? {
    x: (dimensionStart.x + dimensionEnd.x) / 2,
    y: (dimensionStart.y + dimensionEnd.y) / 2,
  }

  const label = getDimensionLabel({ dimension, measuredDistanceMils })
  const textHeight = dimension.textHeightMils ?? 50
  const textGap = getMeasurementMils({
    fallbackMils: 10,
    fieldName: "TEXTGAP",
    record,
  })

  const extensionGap = getMeasurementMils({
    fallbackMils: 0,
    fieldName: "EXTENSIONPICKGAP",
    record,
  })
  const extensionOffset = getMeasurementMils({
    fallbackMils: 0,
    fieldName: "EXTENSIONOFFSET",
    record,
  })
  const extensionLines = [
    [referenceStart, dimensionStart],
    [referenceEnd, dimensionEnd],
  ].flatMap(([start, end]) => {
    if (!start || !end) return []
    const distance = Math.hypot(end.x - start.x, end.y - start.y)
    if (distance <= extensionGap) return []
    const x = (end.x - start.x) / distance
    const y = (end.y - start.y) / distance
    return [
      {
        start: { x: start.x + x * extensionGap, y: start.y + y * extensionGap },
        end: { x: end.x + x * extensionOffset, y: end.y + y * extensionOffset },
      },
    ]
  })
  const textAngle =
    dimension.getNumber("TEXT1ANGLE") ?? (radians * 180) / Math.PI
  const textAtSavedOrigin =
    dimension.getAltiumMeasurement("TEXT1X") !== undefined &&
    dimension.getAltiumMeasurement("TEXT1Y") !== undefined

  const textMirror = dimension.getBoolean("TEXT1MIRROR") === true
  const textWidth = label.length * textHeight * 0.6
  const textRadians = (textAngle * Math.PI) / 180
  const textCorners = [
    [
      textAtSavedOrigin ? 0 : -textWidth / 2,
      textAtSavedOrigin ? 0 : -textHeight / 2,
    ],
    [
      textAtSavedOrigin ? textWidth : textWidth / 2,
      textAtSavedOrigin ? 0 : -textHeight / 2,
    ],
    [
      textAtSavedOrigin ? textWidth : textWidth / 2,
      textAtSavedOrigin ? textHeight : textHeight / 2,
    ],
    [
      textAtSavedOrigin ? 0 : -textWidth / 2,
      textAtSavedOrigin ? textHeight : textHeight / 2,
    ],
  ].map(([x = 0, y = 0]) => {
    const mirroredX = textMirror ? -x : x
    return {
      x:
        textPosition.x +
        mirroredX * Math.cos(textRadians) -
        y * Math.sin(textRadians),
      y:
        textPosition.y +
        mirroredX * Math.sin(textRadians) +
        y * Math.cos(textRadians),
    }
  })

  return {
    openArrows: dimension.dimensionKind === "1",
    arrowLineWidth: getMeasurementMils({
      fallbackMils: dimension.lineWidthMils ?? 8,
      fieldName: "ARROWLINEWIDTH",
      record,
    }),
    textCorners,
    textGap,
    arrowLength: getMeasurementMils({
      fallbackMils: 100,
      fieldName: "ARROWLENGTH",
      record,
    }),
    arrowsOutside:
      dimension.getDecoded("ARROWPOSITION")?.toLowerCase() === "outside",
    extensionLines,
    extensionLineWidth: getMeasurementMils({
      fallbackMils: dimension.lineWidthMils ?? 8,
      fieldName: "EXTENSIONLINEWIDTH",
      record,
    }),
    textAngle,
    textMirror,
    textAtSavedOrigin,
    arrowSize: getMeasurementMils({
      fallbackMils: 40,
      fieldName: "ARROWSIZE",
      record,
    }),
    dimensionEnd,
    dimensionStart,
    label,
    lineWidth: dimension.lineWidthMils ?? 8,
    referenceEnd,
    referenceStart,
    textHeight,
    textPosition,
  }
}

function getDimensionLabel({
  dimension,
  measuredDistanceMils,
}: {
  dimension: AltiumDimensionRecord
  measuredDistanceMils: number
}): string {
  const textFormat = dimension.getDecoded("TEXTFORMAT")?.trim()
  // Native linear dimensions use a sample value (10mil), not a literal label.
  const nativeValueAndUnit =
    dimension.dimensionKind === "1" && textFormat?.toLowerCase() === "10mil"
  if (textFormat?.toLowerCase() === "none") return ""
  if (textFormat && textFormat !== "<>" && !nativeValueAndUnit)
    return textFormat

  const precision = Math.min(Math.max(dimension.precision ?? 2, 0), 6)
  const normalizedUnit = dimension.unit?.toUpperCase() ?? "MILS"
  const { amount, unitLabel } = convertMilsForDimensionUnit({
    measuredDistanceMils,
    normalizedUnit,
  })
  const prefix = dimension.prefix ?? ""
  const suffix = dimension.suffix ?? (nativeValueAndUnit ? "" : ` ${unitLabel}`)
  return `${prefix}${amount.toFixed(precision)}${nativeValueAndUnit ? unitLabel : ""}${suffix}`
}

function convertMilsForDimensionUnit({
  measuredDistanceMils,
  normalizedUnit,
}: {
  measuredDistanceMils: number
  normalizedUnit: string
}): { amount: number; unitLabel: string } {
  if (normalizedUnit.includes("MILLIMETER")) {
    return { amount: measuredDistanceMils * 0.0254, unitLabel: "mm" }
  }
  if (normalizedUnit.includes("CENTIMETER")) {
    return { amount: measuredDistanceMils * 0.00254, unitLabel: "cm" }
  }
  if (normalizedUnit.includes("INCH")) {
    return { amount: measuredDistanceMils / 1000, unitLabel: "in" }
  }
  return { amount: measuredDistanceMils, unitLabel: "mil" }
}

function getMeasurementMils({
  fallbackMils,
  fieldName,
  record,
}: {
  fallbackMils: number
  fieldName: string
  record: AltiumRecord
}): number {
  return record.getAltiumMeasurement(fieldName)?.toMils() ?? fallbackMils
}
