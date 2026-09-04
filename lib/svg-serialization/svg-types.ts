import type { AltiumPrjPcb } from "../altium-prj-pcb"

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
  componentIndices?: number[]
  /**
   * Active PCB layer. Altium draws this at its Current Layer priority; static
   * SVG rendering defaults to Top Layer.
   */
  currentLayer?: string
  /**
   * Layer names from front to back. This replaces Altium's default grouped
   * drawing order; the first layer renders on top.
   */
  layerDrawingOrder?: string[]
  layers?: string[]
  netIndices?: number[]
  showBoardCutouts?: boolean
  showBoardOutline?: boolean
  viewBox?: AltiumPcbViewBox
}

/**
 * A crop rectangle expressed in Altium schematic coordinates. `x` and `y`
 * locate the lower-left corner; all values use schematic document units.
 */
export interface AltiumSchematicViewBox {
  height: number
  width: number
  x: number
  y: number
}

export interface AltiumSheetSvgOptions extends AltiumSvgRenderOptions {
  /** Current schematic filename, including its extension. */
  documentName?: string
  /** Parsed project that supplies user-defined project parameters. */
  project?: AltiumPrjPcb
  /** Current project filename, including its extension. */
  projectName?: string
  showBorder?: boolean
  /** Show Altium electrical direction markers on schematic pins. Defaults to true. */
  showPinDirections?: boolean
  /**
   * Region to render and clip. Defaults to the declared schematic paper,
   * which intentionally hides off-sheet records.
   */
  viewBox?: AltiumSchematicViewBox
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
