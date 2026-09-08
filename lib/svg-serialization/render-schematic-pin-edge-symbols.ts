import type { SvgPoint } from "./svg-types"
import { formatSvgNumber } from "./svg-utils"

const CLOCK_SYMBOL_DEPTH_SVG_UNITS = 4
const CLOCK_SYMBOL_HALF_WIDTH_SVG_UNITS = 2
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
  outerSymbolEdgePosition: SvgPoint
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
  let outerSymbolEdgePosition = bodyPosition

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
    outerSymbolEdgePosition = lineStartPosition
    renderedSymbols.push(
      `<circle class="altium-schematic-pin-inversion-symbol" cx="${formatSvgNumber(inversionCircleCenter.x)}" cy="${formatSvgNumber(inversionCircleCenter.y)}" r="${formatSvgNumber(INVERSION_SYMBOL_RADIUS_SVG_UNITS)}" fill="#fff" stroke="${color}" stroke-width="1"/>`,
    )
  }

  if (hasClockSymbol) {
    const clockSymbolBaseCenter = {
      x: bodyPosition.x,
      y: bodyPosition.y,
    }
    const perpendicularDirection = {
      x: -screenDirection.y,
      y: screenDirection.x,
    }
    const clockSymbolBaseStart = {
      x:
        clockSymbolBaseCenter.x +
        perpendicularDirection.x * CLOCK_SYMBOL_HALF_WIDTH_SVG_UNITS,
      y:
        clockSymbolBaseCenter.y +
        perpendicularDirection.y * CLOCK_SYMBOL_HALF_WIDTH_SVG_UNITS,
    }
    const clockSymbolBaseEnd = {
      x:
        clockSymbolBaseCenter.x -
        perpendicularDirection.x * CLOCK_SYMBOL_HALF_WIDTH_SVG_UNITS,
      y:
        clockSymbolBaseCenter.y -
        perpendicularDirection.y * CLOCK_SYMBOL_HALF_WIDTH_SVG_UNITS,
    }
    const points = [
      {
        x: bodyPosition.x - screenDirection.x * CLOCK_SYMBOL_DEPTH_SVG_UNITS,
        y: bodyPosition.y - screenDirection.y * CLOCK_SYMBOL_DEPTH_SVG_UNITS,
      },
      clockSymbolBaseStart,
      clockSymbolBaseEnd,
    ]
      .map((point) => `${formatSvgNumber(point.x)},${formatSvgNumber(point.y)}`)
      .join(" ")
    renderedSymbols.push(
      `<polygon class="altium-schematic-pin-clock-symbol" points="${points}" fill="none" stroke="${color}" stroke-width="0.25"/>`,
    )
  }

  return {
    lineStartPosition,
    outerSymbolEdgePosition,
    svg: renderedSymbols.join(""),
  }
}
