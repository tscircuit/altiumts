import type { AltiumPoint } from "./altium-geometry"
import { getCcwSweepDegrees } from "./altium-geometry"
import {
  applyToPoint,
  compose,
  rotateDEG,
  translate,
} from "transformation-matrix"

export interface ApproximateAltiumArcOptions {
  center: AltiumPoint
  endAngleDegrees: number
  radius: number
  startAngleDegrees: number
}

/** Samples an Altium arc in its native counterclockwise direction. */
export function approximateAltiumArc({
  center,
  endAngleDegrees,
  radius,
  startAngleDegrees,
}: ApproximateAltiumArcOptions): AltiumPoint[] {
  const ccwSweepDegrees = getCcwSweepDegrees(startAngleDegrees, endAngleDegrees)
  const segments = Math.max(8, Math.ceil(ccwSweepDegrees / 7.5))

  return Array.from({ length: segments + 1 }, (_, index) => {
    const angleDegrees =
      startAngleDegrees + (ccwSweepDegrees * index) / segments
    const radialToAltiumTransform = compose(
      translate(center.x, center.y),
      rotateDEG(angleDegrees),
    )
    return applyToPoint(radialToAltiumTransform, { x: radius, y: 0 })
  })
}
