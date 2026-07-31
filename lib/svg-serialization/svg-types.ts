export interface SvgPoint {
  x: number
  y: number
}

export interface SvgBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface AltiumSvgRenderOptions {
  backgroundColor?: string
  height?: number
  margin?: number
  showComponentOrigins?: boolean
  showHidden?: boolean
  showHoles?: boolean
  showText?: boolean
  title?: string
  width?: number
}

/**
 * A crop rectangle expressed in Altium board coordinates. `x` and `y` locate
 * the lower-left corner; all values use the document's normalized board unit.
 */
export interface AltiumPcbViewBox {
  height: number
  width: number
  x: number
  y: number
}

export interface AltiumPcbSvgOptions extends AltiumSvgRenderOptions {
  layers?: string[]
  showBoardOutline?: boolean
  viewBox?: AltiumPcbViewBox
}

export interface AltiumSheetSvgOptions extends AltiumSvgRenderOptions {
  showBorder?: boolean
}

export interface SvgViewport {
  bounds: SvgBounds
  height: number
  margin: number
  outputHeight: number
  outputWidth: number
  toX(x: number): number
  toY(y: number): number
  width: number
}
