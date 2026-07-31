import type { AltiumPcbDocument } from "../altium-pcb-document"
import type { AltiumRecord } from "../records/altium-record"
import {
  getPcbBoardOutline,
  getPcbDocumentBounds,
  getPcbRecordBounds,
} from "./pcb-geometry"
import { recordAppliesToLayers } from "./pcb-layer"
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
  pointsToSvg,
} from "./svg-utils"

const RECORD_PAINT_ORDER: Record<string, number> = {
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
  const componentLookup = createComponentLookup(document)

  if (outline.length >= 3 && options.showBoardOutline !== false) {
    content.push(
      `<polygon data-record="BoardOutline" points="${pointsToSvg(outline, viewport)}" fill="#123d32" stroke="#6ee7b7" stroke-width="3"/>`,
    )
  }

  const records = document.records
    .filter((record) => recordAppliesToLayers(record, options.layers))
    .filter(
      (record) =>
        options.showHidden === true ||
        isVisibleComponentText(record, componentLookup),
    )
    .filter((record) => {
      if (!options.viewBox) return true
      const recordBounds = getPcbRecordBounds(record)
      return !recordBounds || boundsIntersect(recordBounds, bounds)
    })
    .toSorted(
      (left, right) =>
        (RECORD_PAINT_ORDER[left.recordKind ?? ""] ?? 100) -
        (RECORD_PAINT_ORDER[right.recordKind ?? ""] ?? 100),
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
