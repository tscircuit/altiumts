import type { AltiumPcbDocument } from "../altium-pcb-document"
import { getPcbRegionSemanticKind } from "../pcb-contours"
import {
  getPcbRecordComponentIndex,
  getPcbRecordNetIndex,
} from "../pcb-reference-resolution"
import type { AltiumRecord } from "../records/altium-record"
import {
  getPcbBoardOutline,
  getPcbDocumentBounds,
  getPcbRecordBounds,
} from "./pcb-geometry"
import {
  PCB_BOARD_FILL_COLOR,
  PCB_BOARD_OUTLINE_COLOR,
  recordAppliesToLayers,
} from "./pcb-layer"
import { renderPcbRecord } from "./render-pcb-record"
import type {
  AltiumPcbSvgOptions,
  AltiumPcbViewBox,
  SvgBounds,
} from "./svg-types"
import {
  boundsIntersect,
  createSvgDocument,
  createSvgViewport,
  pointsToClosedPath,
  pointsToSvg,
} from "./svg-utils"

const RECORD_PAINT_ORDER: Record<string, number> = {
  ComponentBody: 5,
  Polygon: 10,
  Region: 20,
  Fill: 30,
  Track: 40,
  Arc: 45,
  Pad: 50,
  Via: 60,
  Text: 70,
  Component: 80,
}

export function serializeAltiumPcbToSvg(
  document: AltiumPcbDocument,
  options: AltiumPcbSvgOptions = {},
): string {
  const bounds = options.viewBox
    ? pcbViewBoxToBounds(options.viewBox)
    : getPcbDocumentBounds(document)
  const viewport = createSvgViewport(bounds, {
    ...options,
    margin: options.margin ?? (options.viewBox ? 0 : undefined),
  })
  const content: string[] = []
  const outline = getPcbBoardOutline(document)
  const boardCutouts =
    options.showBoardCutouts === false ? [] : document.boardGeometry.cutouts
  const componentLookup = createComponentLookup(document)

  if (outline.length >= 3 && options.showBoardOutline !== false) {
    if (boardCutouts.length === 0) {
      content.push(
        `<polygon data-record="BoardOutline" points="${pointsToSvg(outline, viewport)}" fill="${PCB_BOARD_FILL_COLOR}" stroke="${PCB_BOARD_OUTLINE_COLOR}" stroke-width="3"/>`,
      )
    } else {
      const path = [
        pointsToClosedPath(outline, viewport),
        ...boardCutouts.flatMap(({ holes, outline: cutout }) =>
          [cutout, ...holes].map((contour) =>
            pointsToClosedPath(contour.points, viewport),
          ),
        ),
      ].join(" ")
      content.push(
        `<path data-record="BoardOutline" data-board-cutouts="${boardCutouts.length}" d="${path}" fill="${PCB_BOARD_FILL_COLOR}" fill-rule="evenodd" stroke="${PCB_BOARD_OUTLINE_COLOR}" stroke-width="3"/>`,
      )
    }
  }

  const records = document.records
    .filter((record) => recordAppliesToLayers(record, options.layers))
    .filter((record) => recordAppliesToReferences(document, record, options))
    .filter(
      (record) =>
        options.showHidden === true ||
        isVisibleComponentText(record, componentLookup),
    )
    .filter((record) => {
      if (!options.viewBox) return true
      const recordBounds = getPcbRecordBounds(record, options.layers)
      return !recordBounds || boundsIntersect(recordBounds, bounds)
    })
    .toSorted(
      (left, right) => getRecordPaintOrder(left) - getRecordPaintOrder(right),
    )

  for (const record of records) {
    const rendered = renderPcbRecord(record, viewport, {
      showHoles: true,
      showText: true,
      ...options,
    })
    if (rendered) content.push(rendered)
  }

  const layerTitle = options.layers?.length
    ? ` — ${options.layers.join(", ")}`
    : ""
  return createSvgDocument({
    backgroundColor: options.backgroundColor ?? "#071a16",
    className: "altium-pcb",
    content,
    title: options.title ?? `Altium PCB${layerTitle}`,
    viewport,
  })
}

function getRecordPaintOrder(record: AltiumRecord): number {
  if (
    record.recordKind === "Region" &&
    getPcbRegionSemanticKind(record) === "POLYGON_CUTOUT"
  ) {
    return 25
  }
  return RECORD_PAINT_ORDER[record.recordKind ?? ""] ?? 100
}

function recordAppliesToReferences(
  document: AltiumPcbDocument,
  record: AltiumRecord,
  options: AltiumPcbSvgOptions,
): boolean {
  if (options.componentIndices?.length) {
    const componentIndex = getPcbRecordComponentIndex(document, record)
    if (
      componentIndex === undefined ||
      !options.componentIndices.includes(componentIndex)
    ) {
      return false
    }
  }

  if (options.netIndices?.length) {
    const netIndex = getPcbRecordNetIndex(document, record)
    if (netIndex === undefined || !options.netIndices.includes(netIndex)) {
      return false
    }
  }

  return true
}

function createComponentLookup(
  document: AltiumPcbDocument,
): ReadonlyMap<number, AltiumRecord> {
  const lookup = new Map<number, AltiumRecord>()
  const components = document.getRecordsByKind("Component")

  for (const [index, component] of components.entries()) {
    lookup.set(index, component)
    const id = component.getNumber("ID")
    if (id !== undefined) lookup.set(id, component)
  }
  return lookup
}

function isVisibleComponentText(
  record: AltiumRecord,
  componentLookup: ReadonlyMap<number, AltiumRecord>,
): boolean {
  if (record.recordKind !== "Text") return true
  const componentIndex = record.getNumber("COMPONENT")
  if (componentIndex === undefined || componentIndex === 0xffff) return true

  const component = componentLookup.get(componentIndex)
  if (!component) return true
  if (
    record.getBoolean("DESIGNATOR") === true &&
    component.getBoolean("NAMEON") === false
  ) {
    return false
  }
  if (
    record.getBoolean("COMMENT") === true &&
    component.getBoolean("COMMENTON") === false
  ) {
    return false
  }
  return true
}

function pcbViewBoxToBounds(viewBox: AltiumPcbViewBox): SvgBounds {
  if (
    !Number.isFinite(viewBox.x) ||
    !Number.isFinite(viewBox.y) ||
    !Number.isFinite(viewBox.width) ||
    !Number.isFinite(viewBox.height) ||
    viewBox.width <= 0 ||
    viewBox.height <= 0
  ) {
    throw new RangeError(
      "PCB SVG viewBox must have finite x/y values and positive finite width/height values",
    )
  }

  return {
    minX: viewBox.x,
    minY: viewBox.y,
    maxX: viewBox.x + viewBox.width,
    maxY: viewBox.y + viewBox.height,
  }
}
