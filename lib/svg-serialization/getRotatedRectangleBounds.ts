import {
  applyToPoints,
  compose,
  rotateDEG,
  translate,
} from "transformation-matrix"
import type { SvgBounds, SvgPoint } from "./svg-types"
import { boundsFromPoints } from "./svg-utils"

export function getRotatedRectangleBounds({
  center,
  width,
  height,
  ccwRotationDegrees,
}: {
  center: SvgPoint
  width: number
  height: number
  ccwRotationDegrees: number
}): SvgBounds {
  const halfWidth = width / 2
  const halfHeight = height / 2
  const localToPcbTransform = compose(
    translate(center.x, center.y),
    rotateDEG(ccwRotationDegrees),
  )
  const bounds = boundsFromPoints(
    applyToPoints(localToPcbTransform, [
      { x: -halfWidth, y: -halfHeight },
      { x: halfWidth, y: -halfHeight },
      { x: halfWidth, y: halfHeight },
      { x: -halfWidth, y: halfHeight },
    ]),
  )
  if (!bounds) throw new Error("Rotated rectangle must contain four points")
  return bounds
}
