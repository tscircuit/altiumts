import type { AltiumPcbDocument } from "../altium-pcb-document"
import { decodeAltiumWideString } from "../decode-altium-wide-string"
import { getPcbRegionSemanticKind } from "../pcb-contours"
import {
  getPcbRecordComponent,
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
  const componentDesignatorTextLookup = createComponentTextLookup(
    document,
    "DESIGNATOR",
  )
  const componentCommentTextLookup = createComponentTextLookup(
    document,
    "COMMENT",
  )
  const polygonIndexesWithRegionRecords = new Set(
    document.records.flatMap((record) => {
      if (
        record.recordKind !== "Region" ||
        getPcbRegionSemanticKind(record) !== "COPPER"
      ) {
        return []
      }
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
          isVisibleComponentText(document, record),
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
      text: resolveComponentText(
        document,
        record,
        componentDesignatorTextLookup,
        componentCommentTextLookup,
      ),
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

function resolveComponentText(
  document: AltiumPcbDocument,
  record: AltiumRecord,
  componentDesignatorTextLookup: ReadonlyMap<number, string>,
  componentCommentTextLookup: ReadonlyMap<number, string>,
): string | undefined {
  if (record.recordKind !== "Text") return undefined
  const text = getPcbText(record)
  const specialString = text.toLowerCase()
  if (specialString !== ".designator" && specialString !== ".comment") {
    return undefined
  }
  const componentIndex = record.getNumber("COMPONENT")
  const component = getPcbRecordComponent(document, record)
  // Resolve SVG text from placed records or raw board fields. The component
  // accessor retains SOURCECOMMENT compatibility for API callers.
  const value =
    specialString === ".designator"
      ? ((componentIndex === undefined
          ? undefined
          : componentDesignatorTextLookup.get(componentIndex)) ??
        component?.getDecoded("SOURCEDESIGNATOR") ??
        component?.getDecoded("DESIGNATOR"))
      : ((componentIndex === undefined
          ? undefined
          : componentCommentTextLookup.get(componentIndex)) ??
        component?.getDecoded("COMMENT"))
  return value ?? ""
}

function createComponentTextLookup(
  document: AltiumPcbDocument,
  kind: "COMMENT" | "DESIGNATOR",
): ReadonlyMap<number, string> {
  const lookup = new Map<number, string>()

  for (const record of document.records) {
    if (record.recordKind !== "Text" || record.getBoolean(kind) !== true) {
      continue
    }
    const componentIndex = record.getNumber("COMPONENT")
    const text = getPcbText(record)
    if (
      componentIndex !== undefined &&
      getPcbRecordComponent(document, record) &&
      !lookup.has(componentIndex)
    ) {
      lookup.set(componentIndex, text)
    }
  }

  return lookup
}

function getPcbText(record: AltiumRecord): string {
  return (
    decodeAltiumWideString(record.getDecoded("WIDESTRING")) ||
    record.getDecoded("TEXT") ||
    ""
  )
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

function isVisibleComponentText(
  document: AltiumPcbDocument,
  record: AltiumRecord,
): boolean {
  if (record.recordKind !== "Text") return true
  const componentIndex = record.getNumber("COMPONENT")
  if (componentIndex === undefined || componentIndex === 0xffff) return true

  const component = getPcbRecordComponent(document, record)
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
