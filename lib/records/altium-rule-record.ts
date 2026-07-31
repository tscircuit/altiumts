import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import {
  getFirstDecoded,
  getPcbRecordMeasurementMils,
} from "./pcb-record-helpers"

export type AltiumRuleCategory =
  | "clearance"
  | "differential-pair"
  | "length"
  | "manufacturing"
  | "mask"
  | "plane-connect"
  | "polygon-connect"
  | "routing-layer"
  | "routing-width"
  | "unknown"
  | "via-style"

export interface AltiumRuleMeasurementRange {
  maximumMils?: number
  minimumMils?: number
  preferredMils?: number
}

export interface AltiumRuleNumericRange {
  maximum?: number
  minimum?: number
  preferred?: number
}

export interface AltiumRuleLayerConstraint extends AltiumRuleMeasurementRange {
  gap?: AltiumRuleMeasurementRange
  layer: string
}

export interface AltiumRoutingLayerSetting {
  enabled?: boolean
  layer: string
  mode?: string
}

export interface AltiumThermalReliefSettings {
  airGapMils?: number
  angle?: string
  conductorWidthMils?: number
  connectionStyle?: string
  expansionMils?: number
  spokeCount?: number
}

export interface AltiumTestPointSettings {
  allowBottom?: boolean
  allowTop?: boolean
  gridMils?: number
  holeSize?: AltiumRuleMeasurementRange
  padSize?: AltiumRuleMeasurementRange
  underComponent?: boolean
  useGrid?: boolean
}

export class AltiumRuleRecord extends AltiumRecord {
  override readonly type: string = "rule-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get name(): string | undefined {
    return getFirstDecoded(this, "NAME")
  }

  get ruleKind(): string | undefined {
    return getFirstDecoded(this, "RULEKIND")
  }

  get priority(): number | undefined {
    return this.getNumber("PRIORITY") ?? this.getNumber("INDEXFORSAVE")
  }

  get enabled(): boolean | undefined {
    return this.getBoolean("ENABLED")
  }

  get scope1Expression(): string | undefined {
    return getFirstDecoded(this, "SCOPE1EXPRESSION")
  }

  get scope2Expression(): string | undefined {
    return getFirstDecoded(this, "SCOPE2EXPRESSION")
  }

  get comment(): string | undefined {
    return getFirstDecoded(this, "COMMENT")
  }

  get uniqueId(): string | undefined {
    return getFirstDecoded(this, "UNIQUEID")
  }

  get category(): AltiumRuleCategory {
    const kind = this.ruleKind?.toUpperCase()
    if (!kind) return "unknown"
    if (
      [
        "BOARDOUTLINECLEARANCE",
        "CLEARANCE",
        "COMPONENTCLEARANCE",
        "HOLETOHOLECLEARANCE",
        "PLANECLEARANCE",
      ].includes(kind)
    ) {
      return "clearance"
    }
    if (kind === "WIDTH") return "routing-width"
    if (kind === "ROUTINGVIAS") return "via-style"
    if (kind === "ROUTINGLAYERS") return "routing-layer"
    if (kind === "DIFFPAIRSROUTING") return "differential-pair"
    if (kind === "LENGTH" || kind === "MATCHEDLENGTHS") return "length"
    if (kind === "PLANECONNECT") return "plane-connect"
    if (kind === "POLYGONCONNECT") return "polygon-connect"
    if (kind === "SOLDERMASKEXPANSION" || kind === "PASTEMASKEXPANSION") {
      return "mask"
    }
    if (
      /(?:ASSEMBLY|FABRICATION|HEIGHT|HOLE|SILK|SLIVER|TESTPOINT)/u.test(kind)
    ) {
      return "manufacturing"
    }
    return "unknown"
  }

  get clearanceMils(): number | undefined {
    if (this.category !== "clearance") return undefined
    return getPcbRecordMeasurementMils(
      this,
      "GAP",
      "GENERICCLEARANCE",
      "CLEARANCE",
    )
  }

  get verticalClearanceMils(): number | undefined {
    if (this.category !== "clearance") return undefined
    return getPcbRecordMeasurementMils(this, "VERTICALGAP")
  }

  get widthConstraint(): AltiumRuleMeasurementRange | undefined {
    if (this.normalizedRuleKind !== "WIDTH") return undefined
    return getMeasurementRange(
      this,
      ["MINLIMIT"],
      ["PREFEREDWIDTH", "PREFERREDWIDTH"],
      ["MAXLIMIT"],
    )
  }

  get layerConstraints(): AltiumRuleLayerConstraint[] {
    if (
      !["DIFFPAIRSROUTING", "WIDTH"].includes(this.normalizedRuleKind ?? "")
    ) {
      return []
    }
    const constraints = new Map<string, AltiumRuleLayerConstraint>()
    for (const field of this.fields) {
      const match =
        /^(TOPLAYER|BOTTOMLAYER|MIDLAYER(\d+))_(MINWIDTH|PREFWIDTH|MAXWIDTH|MINGAP|PREFGAP|MAXGAP)$/u.exec(
          field.key.toUpperCase(),
        )
      if (!match?.[1] || !match[3]) continue
      const layer = normalizeConstraintLayer(match[1], match[2])
      const constraint = constraints.get(layer) ?? { layer }
      const value = getPcbRecordMeasurementMils(this, field.key)
      if (value === undefined) continue
      if (match[3].endsWith("GAP")) {
        constraint.gap ??= {}
        assignRangeValue(constraint.gap, match[3], value)
      } else {
        assignRangeValue(constraint, match[3], value)
      }
      constraints.set(layer, constraint)
    }
    return [...constraints.values()]
  }

  get viaDiameterConstraint(): AltiumRuleMeasurementRange | undefined {
    if (this.normalizedRuleKind !== "ROUTINGVIAS") return undefined
    return getMeasurementRange(
      this,
      ["MINWIDTH"],
      ["WIDTH", "PREFEREDWIDTH"],
      ["MAXWIDTH"],
    )
  }

  get viaHoleConstraint(): AltiumRuleMeasurementRange | undefined {
    if (this.normalizedRuleKind !== "ROUTINGVIAS") return undefined
    return getMeasurementRange(
      this,
      ["MINHOLEWIDTH"],
      ["HOLEWIDTH", "PREFEREDHOLEWIDTH"],
      ["MAXHOLEWIDTH"],
    )
  }

  get viaStyle(): string | undefined {
    if (this.normalizedRuleKind !== "ROUTINGVIAS") return undefined
    return getFirstDecoded(this, "VIASTYLE")
  }

  get routingLayers(): AltiumRoutingLayerSetting[] {
    if (this.normalizedRuleKind !== "ROUTINGLAYERS") return []
    const settings = new Map<string, AltiumRoutingLayerSetting>()
    for (const field of this.fields) {
      const match = /^(TOP LAYER|BOTTOM LAYER|MID LAYER (\d+))(_V5)?$/u.exec(
        field.key.toUpperCase(),
      )
      if (!match?.[1]) continue
      const layer = normalizeRoutingLayer(match[1], match[2])
      const setting = settings.get(layer) ?? { layer }
      if (match[3]) setting.enabled = parseRuleBoolean(field.value)
      else setting.mode = field.value
      settings.set(layer, setting)
    }
    return [...settings.values()]
  }

  get differentialPairGap(): AltiumRuleMeasurementRange | undefined {
    if (this.normalizedRuleKind !== "DIFFPAIRSROUTING") return undefined
    return getMeasurementRange(
      this,
      ["MINLIMIT"],
      ["MOSTFREQGAP", "PREFEREDGAP", "PREFERREDGAP"],
      ["MAXLIMIT"],
    )
  }

  get maximumUncoupledLengthMils(): number | undefined {
    if (this.normalizedRuleKind !== "DIFFPAIRSROUTING") return undefined
    return getPcbRecordMeasurementMils(this, "MAXUNCOUPLEDLENGTH")
  }

  get matchedLengthToleranceMils(): number | undefined {
    if (!["LENGTH", "MATCHEDLENGTHS"].includes(this.normalizedRuleKind ?? "")) {
      return undefined
    }
    return getPcbRecordMeasurementMils(this, "TOLERANCE")
  }

  get impedanceConstraint(): AltiumRuleNumericRange | undefined {
    if (this.normalizedRuleKind !== "WIDTH") return undefined
    const range = {
      maximum: this.getNumber("MAXIMP"),
      minimum: this.getNumber("MINIMP"),
      preferred: this.getNumber("FAVIMP"),
    }
    return hasDefinedValue(range) ? range : undefined
  }

  get thermalRelief(): AltiumThermalReliefSettings | undefined {
    if (
      !["PLANECONNECT", "POLYGONCONNECT"].includes(
        this.normalizedRuleKind ?? "",
      )
    ) {
      return undefined
    }
    const settings = {
      airGapMils: getPcbRecordMeasurementMils(
        this,
        "AIRGAPWIDTH",
        "RELIEFAIRGAP",
      ),
      angle: getFirstDecoded(this, "POLYGONRELIEFANGLE"),
      conductorWidthMils: getPcbRecordMeasurementMils(
        this,
        "RELIEFCONDUCTORWIDTH",
      ),
      connectionStyle: getFirstDecoded(
        this,
        "CONNECTSTYLE",
        "PLANECONNECTSTYLE",
      ),
      expansionMils: getPcbRecordMeasurementMils(this, "RELIEFEXPANSION"),
      spokeCount: this.getNumber("RELIEFENTRIES"),
    }
    return hasDefinedValue(settings) ? settings : undefined
  }

  get maskExpansionMils(): number | undefined {
    if (
      !["PASTEMASKEXPANSION", "SOLDERMASKEXPANSION"].includes(
        this.normalizedRuleKind ?? "",
      )
    ) {
      return undefined
    }
    return getPcbRecordMeasurementMils(this, "EXPANSION")
  }

  get heightConstraint(): AltiumRuleMeasurementRange | undefined {
    if (this.normalizedRuleKind !== "HEIGHT") return undefined
    return getMeasurementRange(
      this,
      ["MINHEIGHT"],
      ["PREFHEIGHT", "PREFEREDHEIGHT"],
      ["MAXHEIGHT"],
    )
  }

  get holeSizeConstraint(): AltiumRuleMeasurementRange | undefined {
    if (this.normalizedRuleKind !== "HOLESIZE") return undefined
    return getMeasurementRange(this, ["MINLIMIT"], [], ["MAXLIMIT"])
  }

  get minimumSolderMaskSliverMils(): number | undefined {
    if (this.normalizedRuleKind !== "MINIMUMSOLDERMASKSLIVER") return undefined
    return getPcbRecordMeasurementMils(this, "MINSOLDERMASKWIDTH")
  }

  get minimumSilkClearanceMils(): number | undefined {
    if (
      ![
        "SILKTOBOARDREGIONCLEARANCE",
        "SILKTOSILKCLEARANCE",
        "SILKTOSOLDERMASKCLEARANCE",
      ].includes(this.normalizedRuleKind ?? "")
    ) {
      return undefined
    }
    return getPcbRecordMeasurementMils(
      this,
      "MINSILKSCREENTOMASKGAP",
      "SILKTOSILKCLEARANCE",
    )
  }

  get testPointSettings(): AltiumTestPointSettings | undefined {
    if (!this.normalizedRuleKind?.includes("TESTPOINT")) return undefined
    const settings = {
      allowBottom: this.getBoolean("ALLOWSIDEBOTTOM"),
      allowTop: this.getBoolean("ALLOWSIDETOP"),
      gridMils: getPcbRecordMeasurementMils(this, "TESTPOINTGRID"),
      holeSize: getMeasurementRange(
        this,
        ["MINHOLESIZE"],
        ["PREFEREDHOLESIZE", "PREFERREDHOLESIZE"],
        ["MAXHOLESIZE"],
      ),
      padSize: getMeasurementRange(
        this,
        ["MINSIZE"],
        ["PREFEREDSIZE", "PREFERREDSIZE"],
        ["MAXSIZE"],
      ),
      underComponent: this.getBoolean("TESTPOINTUNDERCOMPONENT"),
      useGrid: this.getBoolean("USEGRID"),
    }
    return hasDefinedValue(settings) ? settings : undefined
  }

  private get normalizedRuleKind(): string | undefined {
    return this.ruleKind?.toUpperCase()
  }
}

export class AltiumDxpRuleRecord extends AltiumRuleRecord {
  override readonly type = "dxp-rule-record"
}

function getMeasurementRange(
  record: AltiumRecord,
  minimumKeys: string[],
  preferredKeys: string[],
  maximumKeys: string[],
): AltiumRuleMeasurementRange | undefined {
  const range = {
    maximumMils: getPcbRecordMeasurementMils(record, ...maximumKeys),
    minimumMils: getPcbRecordMeasurementMils(record, ...minimumKeys),
    preferredMils: getPcbRecordMeasurementMils(record, ...preferredKeys),
  }
  return hasDefinedValue(range) ? range : undefined
}

function assignRangeValue(
  range: AltiumRuleMeasurementRange,
  fieldKind: string,
  value: number,
): void {
  if (fieldKind.startsWith("MIN")) range.minimumMils = value
  else if (fieldKind.startsWith("MAX")) range.maximumMils = value
  else range.preferredMils = value
}

function normalizeConstraintLayer(raw: string, index?: string): string {
  if (raw === "TOPLAYER") return "TOP"
  if (raw === "BOTTOMLAYER") return "BOTTOM"
  return `MID-LAYER${index ?? ""}`
}

function normalizeRoutingLayer(raw: string, index?: string): string {
  if (raw === "TOP LAYER") return "TOP"
  if (raw === "BOTTOM LAYER") return "BOTTOM"
  return `MID-LAYER${index ?? ""}`
}

function parseRuleBoolean(value: string): boolean | undefined {
  if (/^(?:TRUE|T|1)$/iu.test(value)) return true
  if (/^(?:FALSE|F|0)$/iu.test(value)) return false
  return undefined
}

function hasDefinedValue(value: object): boolean {
  return Object.values(value).some((candidate) => candidate !== undefined)
}
