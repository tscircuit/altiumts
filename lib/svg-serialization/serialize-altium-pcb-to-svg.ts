import type { AltiumPcbDocument } from "../altium-pcb-document"
import {
  getPcbRecordComponentIndex,
  getPcbRecordNetIndex,
  getPcbRecordPolygonIndex,
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
import { sortPcbRecordsForPainting } from "./sort-pcb-records-for-painting"
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
  const polygonIndexesWithRegionRecords = new Set(
    document.records.flatMap((record) => {
      if (record.recordKind !== "Region") return []
      const polygonIndex = getPcbRecordPolygonIndex(document, record)
      return polygonIndex === undefined ? [] : [polygonIndex]
    }),
  )

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

  const records = sortPcbRecordsForPainting({
    currentLayer: options.currentLayer,
    document,
    layerDrawingOrder: options.layerDrawingOrder,
    records: document.records
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
      }),
  })

  for (const record of records) {
    const polygonIndex =
      record.recordKind === "Polygon"
        ? getPcbRecordPolygonIndex(document, record)
        : undefined
    const shouldFillPolygon =
      record.recordKind === "Polygon" &&
      record.getBoolean("SHELVED") !== true &&
      (polygonIndex === undefined ||
        !polygonIndexesWithRegionRecords.has(polygonIndex))
    const rendered = renderPcbRecord({
      record,
      shouldFillPolygon,
      svgOptions: {
        showHoles: true,
        showText: true,
        ...options,
      },
      viewport,
    })
    if (rendered) content.push(rendered)
  }

  if (
    outline.length >= 3 &&
    options.showBoardOutline !== false &&
    boardCutouts.length > 0
  ) {
    const cutoutPath = boardCutouts
      .flatMap(({ holes, outline: cutout }) => [cutout, ...holes])
      .map((contour) => pointsToClosedPath(contour.points, viewport))
      .join(" ")
    content.push(
      `<path data-record="BoardCutoutOutline" data-board-cutouts="${boardCutouts.length}" d="${cutoutPath}" fill="none" stroke="${PCB_BOARD_OUTLINE_COLOR}" stroke-width="3"/>`,
    )
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
