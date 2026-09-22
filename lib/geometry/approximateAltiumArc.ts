import type { AltiumPoint } from "./altium-geometry"
import { getCcwSweepDegrees } from "./altium-geometry"

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
    const radians = (angleDegrees * Math.PI) / 180
    return {
      x: center.x + Math.cos(radians) * radius,
      y: center.y + Math.sin(radians) * radius,
    }
  })
}
