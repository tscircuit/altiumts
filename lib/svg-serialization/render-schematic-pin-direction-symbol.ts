import type { SvgPoint } from "./svg-types"
import { formatSvgNumber } from "./svg-utils"

const PIN_ELECTRICAL_TYPE = {
  input: 0,
  inputOutput: 1,
  output: 2,
} as const

const DIRECTION_SYMBOL_HALF_WIDTH_SVG_UNITS = 3

type SchematicPinDirection = "bidirectional" | "input" | "output"

const DIRECTION_SYMBOL_LENGTH_BY_PIN_DIRECTION: Record<
  SchematicPinDirection,
  number
> = {
  bidirectional: 9,
  input: 7,
  output: 7,
}

interface RenderSchematicPinDirectionSymbolOptions {
  color: string
  connectionPosition: SvgPoint
  electricalType: number | undefined
  screenDirection: SvgPoint
  symbolStartPosition: SvgPoint
}

function getSchematicPinDirection(
  electricalType: number | undefined,
): SchematicPinDirection | undefined {
  switch (electricalType ?? PIN_ELECTRICAL_TYPE.input) {
    case PIN_ELECTRICAL_TYPE.input:
      return "input"
    case PIN_ELECTRICAL_TYPE.inputOutput:
      return "bidirectional"
    case PIN_ELECTRICAL_TYPE.output:
      return "output"
    default:
      return undefined
  }
}

function offsetPoint(
  point: SvgPoint,
  direction: SvgPoint,
  distance: number,
): SvgPoint {
  return {
    x: point.x + direction.x * distance,
    y: point.y + direction.y * distance,
  }
}

function pointToSvg(point: SvgPoint): string {
  return `${formatSvgNumber(point.x)},${formatSvgNumber(point.y)}`
}

function renderPolygon(points: SvgPoint[], color: string): string {
  return `<polygon points="${points.map(pointToSvg).join(" ")}" fill="#fff" stroke="${color}" stroke-width="1"/>`
}

export function renderSchematicPinDirectionSymbol({
  color,
  connectionPosition,
  electricalType,
  screenDirection,
  symbolStartPosition,
}: RenderSchematicPinDirectionSymbolOptions): string {
  const pinDirection = getSchematicPinDirection(electricalType)
  if (!pinDirection) return ""

  const availableLength =
    (connectionPosition.x - symbolStartPosition.x) * screenDirection.x +
    (connectionPosition.y - symbolStartPosition.y) * screenDirection.y
  const symbolLength = Math.min(
    DIRECTION_SYMBOL_LENGTH_BY_PIN_DIRECTION[pinDirection],
    availableLength,
  )
  if (symbolLength <= 0) return ""

  const outerPoint = offsetPoint(
    symbolStartPosition,
    screenDirection,
    symbolLength,
  )
  const middlePoint = offsetPoint(
    symbolStartPosition,
    screenDirection,
    symbolLength / 2,
  )
  const perpendicularDirection = {
    x: -screenDirection.y,
    y: screenDirection.x,
  }
  const halfWidth = Math.min(
    DIRECTION_SYMBOL_HALF_WIDTH_SVG_UNITS,
    availableLength / 2,
  )
  const baseCenter = pinDirection === "input" ? outerPoint : symbolStartPosition
  const baseStart = offsetPoint(baseCenter, perpendicularDirection, halfWidth)
  const baseEnd = offsetPoint(baseCenter, perpendicularDirection, -halfWidth)

  const polygon =
    pinDirection === "bidirectional"
      ? renderPolygon(
          [
            symbolStartPosition,
            offsetPoint(middlePoint, perpendicularDirection, halfWidth),
            outerPoint,
            offsetPoint(middlePoint, perpendicularDirection, -halfWidth),
          ],
          color,
        )
      : renderPolygon(
          [
            pinDirection === "input" ? symbolStartPosition : outerPoint,
            baseStart,
            baseEnd,
          ],
          color,
        )

  return `<g class="altium-schematic-pin-direction-symbol" data-pin-direction="${pinDirection}">${polygon}</g>`
}
