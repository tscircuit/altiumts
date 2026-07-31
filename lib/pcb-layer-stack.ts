import {
  type AltiumMeasurement,
  parseAltiumMeasurement,
  parseAltiumMeasurementToMils,
} from "./measurement/altium-measurement"
import type { AltiumBoardRecord } from "./records/altium-board-record"

export interface AltiumPcbLayerStackEntry {
  copperThickness?: AltiumMeasurement
  dielectricConstant?: number
  dielectricHeight?: AltiumMeasurement
  dielectricMaterial?: string
  dielectricType?: string
  id?: string
  index: number
  isFlex?: boolean
  layerId?: string
  mechanicalEnabled?: boolean
  name?: string
  next?: string
  previous?: string
  source: "v8" | "v7" | "legacy"
  usedByPrimitives?: boolean
}

export interface AltiumPcbLayerSubStack {
  id?: string
  index: number
  isFlex?: boolean
  name?: string
  service?: boolean
  showBottomDielectric?: boolean
  showTopDielectric?: boolean
  source: "v9" | "v8"
  type?: number
  usedByPrimitives?: boolean
}

export interface AltiumPcbLayerPair {
  drillDrawing?: boolean
  drillGuide?: boolean
  highLayer?: string
  index: number
  lowLayer?: string
  subStackIds: string[]
}

export interface AltiumPcbTraceImpedanceConfiguration {
  calculatedImpedanceOhms?: number
  differentialPairGapMils?: number
  differentialPairMaximumGapMils?: number
  differentialPairMinimumGapMils?: number
  enabled?: boolean
  etchFactor?: number
  impedanceErrorPercent?: number
  index: number
  layerId?: string
  profileId?: string
  propagationSpeed?: number
  referenceBottomLayerId?: string
  referenceTopLayerId?: string
  subStackId?: string
  traceGapLocked?: boolean
  traceMaximumWidthMils?: number
  traceMinimumWidthMils?: number
  traceWidthLocked?: boolean
  traceWidthMils?: number
}

export interface AltiumPcbImpedanceProfile {
  displayName?: string
  id?: string
  index: number
  isDifferentialPair?: boolean
  name?: string
  targetImpedanceOhms?: number
  traceConfigurations: AltiumPcbTraceImpedanceConfiguration[]
}

export interface AltiumPcbLayerStack {
  entries: AltiumPcbLayerStackEntry[]
  id?: string
  impedanceProfiles: AltiumPcbImpedanceProfile[]
  isFlex?: boolean
  layerPairs: AltiumPcbLayerPair[]
  name?: string
  style?: string
  subStacks: AltiumPcbLayerSubStack[]
  traceImpedanceConfigurations: AltiumPcbTraceImpedanceConfiguration[]
}

export function getPcbLayerStack(
  board: AltiumBoardRecord,
): AltiumPcbLayerStack {
  const fields = new Map(
    board.fields.map(
      (field) => [field.key.toUpperCase(), field.value] as const,
    ),
  )
  const entries = [
    ...readIndexedLayers(fields, "LAYER_V8_", "v8"),
    ...readIndexedLayers(fields, "LAYERV7_", "v7"),
  ]
  if (entries.length === 0) {
    entries.push(...readIndexedLayers(fields, "LAYER", "legacy"))
  }
  const masterPrefix = fields.has("V9_MASTERSTACK_ID")
    ? "V9_MASTERSTACK_"
    : "LAYERMASTERSTACK_V8"
  const traceImpedanceConfigurations = readTraceImpedanceConfigurations(fields)
  return {
    entries: entries.sort((left, right) => left.index - right.index),
    id: getField(fields, `${masterPrefix}ID`),
    impedanceProfiles: readImpedanceProfiles(
      fields,
      traceImpedanceConfigurations,
    ),
    isFlex: parseBoolean(getField(fields, `${masterPrefix}ISFLEX`)),
    layerPairs: readLayerPairs(fields),
    name: getField(fields, `${masterPrefix}NAME`),
    style:
      getField(fields, `${masterPrefix}STYLE`) ??
      getField(fields, "LAYERSTACKSTYLE"),
    subStacks: readLayerSubStacks(fields),
    traceImpedanceConfigurations,
  }
}

function readImpedanceProfiles(
  fields: ReadonlyMap<string, string>,
  traceConfigurations: AltiumPcbTraceImpedanceConfiguration[],
): AltiumPcbImpedanceProfile[] {
  return [...collectIndexes(fields, /^V9_IMPEDANCEPROFILE(\d+)_ID$/u)]
    .sort((left, right) => left - right)
    .map((index) => {
      const base = `V9_IMPEDANCEPROFILE${index}_`
      const id = getField(fields, `${base}ID`)
      return {
        displayName: getField(fields, `${base}DISPLAY_NAME`),
        id,
        index,
        isDifferentialPair: parseBoolean(getField(fields, `${base}ISDIFFPAIR`)),
        name: getField(fields, `${base}NAME`),
        targetImpedanceOhms: parseNumber(getField(fields, `${base}IMPEDANCE`)),
        traceConfigurations: traceConfigurations.filter(
          ({ profileId }) =>
            id !== undefined && profileId?.toUpperCase() === id.toUpperCase(),
        ),
      }
    })
}

function readTraceImpedanceConfigurations(
  fields: ReadonlyMap<string, string>,
): AltiumPcbTraceImpedanceConfiguration[] {
  return [...collectIndexes(fields, /^V9_TRACEIMPEDANCE(\d+)_PROFILE_ID$/u)]
    .sort((left, right) => left - right)
    .map((index) => {
      const base = `V9_TRACEIMPEDANCE${index}_`
      const value = (suffix: string): string | undefined =>
        getField(fields, `${base}${suffix}`)
      const measurement = (suffix: string): number | undefined =>
        parseAltiumMeasurementToMils(value(suffix))
      return {
        calculatedImpedanceOhms: parseNumber(value("CALC_IMPEDANCE")),
        differentialPairGapMils: measurement("DIFF_PAIR_GAP"),
        differentialPairMaximumGapMils: measurement("DIFF_PAIR_MAXGAP"),
        differentialPairMinimumGapMils: measurement("DIFF_PAIR_MINGAP"),
        enabled: parseBoolean(value("ENABLED")),
        etchFactor: parseNumber(value("ETCH_FACTOR")),
        impedanceErrorPercent: parseNumber(value("IMPEDANCE_ERR")),
        index,
        layerId: value("LAYER_V7ID"),
        profileId: value("PROFILE_ID"),
        propagationSpeed: parseNumber(value("PROPAGATION_SPEED")),
        referenceBottomLayerId: value("REF_BOT_V7ID"),
        referenceTopLayerId: value("REF_TOP_V7ID"),
        subStackId: value("SUBSTACK_ID"),
        traceGapLocked: parseBoolean(value("TRACEGAP_LOCKED")),
        traceMaximumWidthMils: measurement("TRACE_MAXWIDTH"),
        traceMinimumWidthMils: measurement("TRACE_MINWIDTH"),
        traceWidthLocked: parseBoolean(value("TRACEWIDTH_LOCKED")),
        traceWidthMils: measurement("TRACE_WIDTH"),
      }
    })
}

function readLayerSubStacks(
  fields: ReadonlyMap<string, string>,
): AltiumPcbLayerSubStack[] {
  const v9Indexes = collectIndexes(fields, /^V9_SUBSTACK(\d+)_ID$/u)
  const source = v9Indexes.size > 0 ? "v9" : "v8"
  const indexes =
    source === "v9"
      ? v9Indexes
      : collectIndexes(fields, /^LAYERSUBSTACK_V8_(\d+)ID$/u)
  return [...indexes]
    .sort((left, right) => left - right)
    .map((index) => {
      const base =
        source === "v9" ? `V9_SUBSTACK${index}_` : `LAYERSUBSTACK_V8_${index}`
      const value = (suffix: string): string | undefined =>
        getField(fields, `${base}${suffix}`)
      return {
        id: value("ID"),
        index,
        isFlex: parseBoolean(value("ISFLEX")),
        name: value("NAME"),
        service: parseBoolean(value("SERVICE")),
        showBottomDielectric: parseBoolean(value("SHOWBOTTOMDIELECTRIC")),
        showTopDielectric: parseBoolean(value("SHOWTOPDIELECTRIC")),
        source,
        type: parseNumber(value("TYPE")),
        usedByPrimitives: parseBoolean(value("USEDBYPRIMS")),
      }
    })
}

function readLayerPairs(
  fields: ReadonlyMap<string, string>,
): AltiumPcbLayerPair[] {
  const indexes = collectIndexes(fields, /^LAYERPAIR(\d+)LOW$/u)
  return [...indexes]
    .sort((left, right) => left - right)
    .map((index) => {
      const base = `LAYERPAIR${index}`
      const subStackPrefix = `${base}SUBSTACK_`
      const subStackIds = [...fields]
        .flatMap(([key, value]) => {
          if (!key.startsWith(subStackPrefix)) return []
          const suffix = key.slice(subStackPrefix.length)
          return /^\d+$/u.test(suffix) ? [{ index: Number(suffix), value }] : []
        })
        .sort((left, right) => left.index - right.index)
        .map(({ value }) => value)
      return {
        drillDrawing: parseBoolean(getField(fields, `${base}DRILLDRAWING`)),
        drillGuide: parseBoolean(getField(fields, `${base}DRILLGUIDE`)),
        highLayer: getField(fields, `${base}HIGH`),
        index,
        lowLayer: getField(fields, `${base}LOW`),
        subStackIds,
      }
    })
}

function collectIndexes(
  fields: ReadonlyMap<string, string>,
  pattern: RegExp,
): Set<number> {
  const indexes = new Set<number>()
  for (const key of fields.keys()) {
    const index = pattern.exec(key)?.[1]
    if (index !== undefined) indexes.add(Number(index))
  }
  return indexes
}

function readIndexedLayers(
  fields: ReadonlyMap<string, string>,
  prefix: string,
  source: AltiumPcbLayerStackEntry["source"],
): AltiumPcbLayerStackEntry[] {
  const indexes = new Set<number>()
  const expression =
    source === "legacy"
      ? /^LAYER(\d+)NAME$/u
      : new RegExp(
          `^${escapeRegExp(prefix)}(\\d+)(?:_|)(?:ID|NAME|LAYERID)$`,
          "u",
        )

  for (const key of fields.keys()) {
    const match = expression.exec(key)
    if (match?.[1]) indexes.add(Number(match[1]))
  }

  return [...indexes].map((index) => {
    const base = `${prefix}${index}`
    const value = (suffix: string): string | undefined =>
      getField(fields, `${base}${suffix}`)
    const entry: AltiumPcbLayerStackEntry = {
      index,
      source,
    }

    if (source === "v8") {
      entry.id = value("ID")
      entry.name = value("NAME")
      entry.layerId = value("LAYERID")
      entry.usedByPrimitives = parseBoolean(value("USEDBYPRIMS"))
      entry.mechanicalEnabled = parseBoolean(value("MECHENABLED"))
      entry.copperThickness = parseAltiumMeasurement(value("COPTHICK") ?? "")
      entry.dielectricType = value("DIELTYPE")
      entry.dielectricConstant = parseNumber(value("DIELCONST"))
      entry.dielectricHeight = parseAltiumMeasurement(value("DIELHEIGHT") ?? "")
      entry.dielectricMaterial = value("DIELMATERIAL")
      return entry
    }

    entry.layerId = value("LAYERID")
    entry.name = value("NAME")
    entry.previous = value("PREV")
    entry.next = value("NEXT")
    entry.mechanicalEnabled = parseBoolean(value("MECHENABLED"))
    entry.copperThickness = parseAltiumMeasurement(value("COPTHICK") ?? "")
    entry.dielectricType = value("DIELTYPE")
    entry.dielectricConstant = parseNumber(value("DIELCONST"))
    entry.dielectricHeight = parseAltiumMeasurement(value("DIELHEIGHT") ?? "")
    entry.dielectricMaterial = value("DIELMATERIAL")
    return entry
  })
}

function getField(
  fields: ReadonlyMap<string, string>,
  key: string,
): string | undefined {
  return fields.get(key.toUpperCase())
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined
  if (/^(?:T|TRUE|1)$/iu.test(value)) return true
  if (/^(?:F|FALSE|0)$/iu.test(value)) return false
  return undefined
}

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
}
