import type { AltiumPadRecord } from "../records/altium-pad-record"

export interface AltiumPcbPadGeometry {
  cornerRadiusMils: number
  heightMils: number
  holeOffsetXMils: number
  holeOffsetYMils: number
  holeCcwRotationDegrees: number
  holeShape: string
  holeSizeMils: number
  layerOrdinal: number
  plated: boolean
  ccwRotationDegrees: number
  shape: string
  slotLengthMils: number
  widthMils: number
  xMils: number
  yMils: number
}

export interface AltiumPcbPadSizeAndShape {
  heightMils: number
  shape: string
  widthMils: number
}

export interface GetAltiumPcbPadGeometryOptions {
  record: AltiumPadRecord
  requestedLayers?: readonly string[]
  /** Selects the requested layer's pad-stack fields for a surface pad. */
  useRequestedLayerGeometry?: boolean
}
