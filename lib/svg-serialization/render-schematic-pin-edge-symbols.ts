import type { SvgPoint } from "./svg-types"
import { formatSvgNumber } from "./svg-utils"

const CLOCK_SYMBOL_DEPTH_SVG_UNITS = 5
const CLOCK_SYMBOL_HALF_WIDTH_SVG_UNITS = 3
const INVERSION_SYMBOL_RADIUS_SVG_UNITS = 2.5

interface RenderSchematicPinEdgeSymbolsOptions {
  bodyPosition: SvgPoint
  color: string
  hasClockSymbol: boolean
  hasInversionSymbol: boolean
  screenDirection: SvgPoint
}

interface RenderedSchematicPinEdgeSymbols {
  lineStartPosition: SvgPoint
  svg: string
}

export function renderSchematicPinEdgeSymbols({
  bodyPosition,
  color,
  hasClockSymbol,
  hasInversionSymbol,
  screenDirection,
}: RenderSchematicPinEdgeSymbolsOptions): RenderedSchematicPinEdgeSymbols {
  const renderedSymbols: string[] = []
  let lineStartPosition = bodyPosition

  if (hasInversionSymbol) {
    const inversionCircleCenter = {
      x: bodyPosition.x + screenDirection.x * INVERSION_SYMBOL_RADIUS_SVG_UNITS,
      y: bodyPosition.y + screenDirection.y * INVERSION_SYMBOL_RADIUS_SVG_UNITS,
    }
    lineStartPosition = {
      x:
        bodyPosition.x +
        screenDirection.x * INVERSION_SYMBOL_RADIUS_SVG_UNITS * 2,
      y:
        bodyPosition.y +
        screenDirection.y * INVERSION_SYMBOL_RADIUS_SVG_UNITS * 2,
    }
    renderedSymbols.push(
      `<circle class="altium-schematic-pin-inversion-symbol" cx="${formatSvgNumber(inversionCircleCenter.x)}" cy="${formatSvgNumber(inversionCircleCenter.y)}" r="${formatSvgNumber(INVERSION_SYMBOL_RADIUS_SVG_UNITS)}" fill="#fff" stroke="${color}" stroke-width="1"/>`,
    )
  }

  if (hasClockSymbol) {
    const clockSymbolTip = {
      x: bodyPosition.x - screenDirection.x * CLOCK_SYMBOL_DEPTH_SVG_UNITS,
      y: bodyPosition.y - screenDirection.y * CLOCK_SYMBOL_DEPTH_SVG_UNITS,
    }
    const perpendicularDirection = {
      x: -screenDirection.y,
      y: screenDirection.x,
    }
    const clockSymbolBaseStart = {
      x:
        bodyPosition.x +
        perpendicularDirection.x * CLOCK_SYMBOL_HALF_WIDTH_SVG_UNITS,
      y:
        bodyPosition.y +
        perpendicularDirection.y * CLOCK_SYMBOL_HALF_WIDTH_SVG_UNITS,
    }
    const clockSymbolBaseEnd = {
      x:
        bodyPosition.x -
        perpendicularDirection.x * CLOCK_SYMBOL_HALF_WIDTH_SVG_UNITS,
      y:
        bodyPosition.y -
        perpendicularDirection.y * CLOCK_SYMBOL_HALF_WIDTH_SVG_UNITS,
    }
    const points = [clockSymbolTip, clockSymbolBaseStart, clockSymbolBaseEnd]
      .map((point) => `${formatSvgNumber(point.x)},${formatSvgNumber(point.y)}`)
      .join(" ")
    renderedSymbols.push(
      `<polygon class="altium-schematic-pin-clock-symbol" points="${points}" fill="#fff" stroke="${color}" stroke-width="1"/>`,
    )
  }

  return {
    lineStartPosition,
    svg: renderedSymbols.join(""),
  }
}
