import type { SvgPoint } from "./svg-types"
import { formatSvgNumber } from "./svg-utils"

/** Electrical-type indicators, separate from a pin's explicit IEEE symbols. */
export function renderSchematicPinElectricalSymbol({
  bodyPosition,
  color,
  electricalType,
  screenDirection,
}: {
  bodyPosition: SvgPoint
  color: string
  electricalType: number
  screenDirection: SvgPoint
}): string {
  // Passive and power pins have no direction indicator. Other electrical
  // types have additional symbols which are not implemented here yet.
  if (![0, 1, 2].includes(electricalType)) return ""
  const point = (along: number, across = 0): string =>
    `${formatSvgNumber(bodyPosition.x + screenDirection.x * along - screenDirection.y * across)},${formatSvgNumber(bodyPosition.y + screenDirection.y * along + screenDirection.x * across)}`
  const points =
    electricalType === 0
      ? [point(0), point(6, 2), point(6, -2)]
      : electricalType === 2
        ? [point(6), point(0, 2), point(0, -2)]
        : [point(0), point(3, 2), point(6), point(3, -2)]
  return `<polygon class="altium-schematic-pin-electrical-symbol" data-electrical="${electricalType}" points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="0.25"/>`
}
