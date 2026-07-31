import { expect, test } from "bun:test"
import {
  type AltiumBinaryPcbDoc,
  type AltiumRuleRecord,
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
  validateAltiumDocument,
} from "../lib"
import { readReferenceBytes } from "./svg/read-reference"

function getRule(
  document: AltiumBinaryPcbDoc,
  ruleKind: string,
  name?: string,
): AltiumRuleRecord {
  const rule = document.rules.find(
    (candidate) =>
      candidate.ruleKind === ruleKind &&
      (name === undefined || candidate.name === name),
  )
  if (!rule) {
    throw new Error(
      `Expected ${ruleKind}${name === undefined ? "" : ` rule ${name}`}`,
    )
  }
  return rule
}

test("models Novena board grids, layer-stack relationships, and PCB rules", async () => {
  const source = await readReferenceBytes("novena-edp-adapter-dvt1.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const board = document.board
  if (!board) throw new Error("Expected the Novena Board6 record")

  expect(board.grid).toEqual({
    dotGrid: false,
    electricalGridEnabled: true,
    electricalGridRangeMils: 4,
    largeVisibleGridMultiplier: 5,
    largeVisibleGridSize: 0,
    snapEnabled: true,
    snapSizeMils: 10,
    visibleGridMultiplier: 1,
    visibleGridSize: 0,
  })

  const stack = board.layerStack
  expect(stack).toMatchObject({
    id: "{374D7D1C-2837-490E-8661-D0E4934A13AC}",
    isFlex: false,
    name: "Master layer stack",
  })
  expect(stack.subStacks).toEqual([
    {
      id: "{5C0C3223-D866-4955-BCD2-EB2E768135EA}",
      index: 0,
      isFlex: false,
      name: "Board Layer Stack",
      service: false,
      showBottomDielectric: false,
      showTopDielectric: false,
      source: "v8",
      type: 1,
      usedByPrimitives: false,
    },
  ])
  expect(stack.layerPairs).toEqual([
    {
      drillDrawing: false,
      drillGuide: false,
      highLayer: "BOTTOM",
      index: 0,
      lowLayer: "TOP",
      subStackIds: ["{5C0C3223-D866-4955-BCD2-EB2E768135EA}"],
    },
  ])

  const clearance = getRule(document, "Clearance", "Clearance_poly")
  expect(clearance.category).toBe("clearance")
  expect(clearance.clearanceMils).toBe(8)
  expect(clearance.widthConstraint).toBeUndefined()

  const width = getRule(document, "Width", "Width")
  expect(width.category).toBe("routing-width")
  expect(width.widthConstraint).toEqual({
    maximumMils: 200,
    minimumMils: 4,
    preferredMils: 8,
  })
  expect(width.impedanceConstraint).toEqual({
    maximum: 50,
    minimum: 50,
    preferred: 50,
  })
  expect(
    width.layerConstraints.find(({ layer }) => layer === "MID-LAYER1"),
  ).toEqual({
    layer: "MID-LAYER1",
    maximumMils: 7.874,
    minimumMils: 7.874,
    preferredMils: 7.874,
  })

  const vias = getRule(document, "RoutingVias")
  expect(vias.viaDiameterConstraint).toEqual({
    maximumMils: 30,
    minimumMils: 18,
    preferredMils: 20,
  })
  expect(vias.viaHoleConstraint).toEqual({
    maximumMils: 15,
    minimumMils: 8,
    preferredMils: 10,
  })
  expect(vias.viaStyle).toBe("Through Hole")

  const routingLayers = getRule(document, "RoutingLayers").routingLayers
  expect(routingLayers.find(({ layer }) => layer === "TOP")?.enabled).toBeTrue()
  expect(
    routingLayers.find(({ layer }) => layer === "BOTTOM")?.enabled,
  ).toBeTrue()

  const differentialPairs = getRule(document, "DiffPairsRouting")
  expect(differentialPairs.differentialPairGap).toEqual({
    maximumMils: 10,
    minimumMils: 5,
    preferredMils: 5,
  })
  expect(differentialPairs.maximumUncoupledLengthMils).toBe(500)
  expect(
    differentialPairs.layerConstraints.find(({ layer }) => layer === "TOP"),
  ).toEqual({
    layer: "TOP",
    maximumMils: 4.0157,
    minimumMils: 4.0157,
    preferredMils: 4.0157,
  })
  expect(
    differentialPairs.layerConstraints.find(
      ({ layer }) => layer === "MID-LAYER1",
    ),
  ).toEqual({
    gap: { minimumMils: 10, preferredMils: 10 },
    layer: "MID-LAYER1",
    maximumMils: 15,
    minimumMils: 15,
    preferredMils: 15,
  })

  expect(getRule(document, "PlaneConnect").thermalRelief).toEqual({
    airGapMils: 10,
    angle: undefined,
    conductorWidthMils: 10,
    connectionStyle: "Direct",
    expansionMils: 20,
    spokeCount: 4,
  })
  expect(getRule(document, "PolygonConnect").thermalRelief).toEqual({
    airGapMils: 6,
    angle: "90 Angle",
    conductorWidthMils: 20,
    connectionStyle: "Relief",
    expansionMils: undefined,
    spokeCount: 4,
  })
  expect(getRule(document, "SolderMaskExpansion").maskExpansionMils).toBe(
    2.7559,
  )
  expect(getRule(document, "PasteMaskExpansion").maskExpansionMils).toBe(0)
  expect(
    getRule(document, "MinimumSolderMaskSliver").minimumSolderMaskSliverMils,
  ).toBe(10)
  expect(getRule(document, "HoleSize").holeSizeConstraint).toEqual({
    maximumMils: 175,
    minimumMils: 1,
    preferredMils: undefined,
  })
  expect(getRule(document, "Height").heightConstraint).toEqual({
    maximumMils: 1000,
    minimumMils: 0,
    preferredMils: 500,
  })
  expect(getRule(document, "AssemblyTestpoint").testPointSettings).toEqual({
    allowBottom: true,
    allowTop: true,
    gridMils: 1,
    holeSize: {
      maximumMils: 40,
      minimumMils: 0,
      preferredMils: 32,
    },
    padSize: {
      maximumMils: 100,
      minimumMils: 40,
      preferredMils: 60,
    },
    underComponent: true,
    useGrid: true,
  })

  expect(document.getBytes()).toEqual(source)
})

test("prefers Elk Pi V9 sub-stacks and models matched-length rules", async () => {
  const source = await readReferenceBytes("elk-pi.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(source)
  const board = document.board
  if (!board) throw new Error("Expected the Elk Pi Board6 record")

  expect(board.grid).toMatchObject({
    dotGrid: true,
    electricalGridRangeMils: 8,
    snapEnabled: true,
    snapSizeMils: 10,
  })

  const stack = board.layerStack
  expect(stack.subStacks).toHaveLength(7)
  expect(stack.subStacks.every(({ source }) => source === "v9")).toBeTrue()
  expect(new Set(stack.subStacks.map(({ id }) => id)).size).toBe(7)
  const knownSubStackIds = new Set(stack.subStacks.map(({ id }) => id))
  expect(
    stack.layerPairs.every(({ subStackIds }) =>
      subStackIds.every((id) => knownSubStackIds.has(id)),
    ),
  ).toBeTrue()
  expect(stack.layerPairs[0]).toMatchObject({
    highLayer: "BOTTOM",
    lowLayer: "TOP",
  })
  expect(stack.impedanceProfiles).toHaveLength(1)
  expect(stack.traceImpedanceConfigurations).toHaveLength(28)
  expect(stack.impedanceProfiles[0]).toMatchObject({
    displayName: "S50",
    id: "{ECBF05F0-C5DE-4B3A-BBF2-E0E80519FAB6}",
    index: 0,
    isDifferentialPair: false,
    name: "",
    targetImpedanceOhms: 50,
  })
  expect(stack.impedanceProfiles[0]?.traceConfigurations).toHaveLength(28)
  expect(stack.traceImpedanceConfigurations[0]).toEqual({
    calculatedImpedanceOhms: 50.009755,
    differentialPairGapMils: 5,
    differentialPairMaximumGapMils: 5,
    differentialPairMinimumGapMils: 5,
    enabled: true,
    etchFactor: 0,
    impedanceErrorPercent: 0.019511,
    index: 0,
    layerId: "16777217",
    profileId: "{ECBF05F0-C5DE-4B3A-BBF2-E0E80519FAB6}",
    propagationSpeed: 0.152814,
    referenceBottomLayerId: "16777218",
    referenceTopLayerId: "16973824",
    subStackId: "{228598A4-536F-4195-9A26-FA1530EEC867}",
    traceGapLocked: false,
    traceMaximumWidthMils: 11.492,
    traceMinimumWidthMils: 11.492,
    traceWidthLocked: false,
    traceWidthMils: 11.492,
  })
  expect(
    stack.traceImpedanceConfigurations.every(({ subStackId }) =>
      knownSubStackIds.has(subStackId),
    ),
  ).toBeTrue()

  expect(getRule(document, "MatchedLengths").matchedLengthToleranceMils).toBe(
    1000,
  )
  expect(getRule(document, "Width", "Single50").impedanceConstraint).toEqual({
    maximum: 50,
    minimum: 50,
    preferred: 50,
  })
  expect(getRule(document, "RoutingVias").viaDiameterConstraint).toEqual({
    maximumMils: 50,
    minimumMils: 27.5591,
    preferredMils: 27.5591,
  })
  expect(
    getRule(document, "PolygonConnect", "PolygonConnect_pad").thermalRelief,
  ).toEqual({
    airGapMils: 10,
    angle: "90 Angle",
    conductorWidthMils: 15,
    connectionStyle: "Relief",
    expansionMils: undefined,
    spokeCount: 4,
  })

  expect(document.getBytes()).toEqual(source)
})

test("validates advanced PCB constraint and layer-stack relationships", () => {
  const document = parseAltiumPcbDoc(
    [
      [
        "|RECORD=Board",
        "|LAYERMASTERSTACK_V8ID={MASTER}",
        "|LAYERSUBSTACK_V8_0ID={STACK}",
        "|LAYERPAIR0LOW=TOP",
        "|LAYERPAIR0HIGH=BOTTOM",
        "|LAYERPAIR0SUBSTACK_0={MISSING}",
        "|V9_TRACEIMPEDANCE0_PROFILE_ID={MISSING_PROFILE}",
        "|V9_TRACEIMPEDANCE0_SUBSTACK_ID={MISSING_STACK}",
      ].join(""),
      "|RECORD=Rule|NAME=Invalid width|RULEKIND=Width|MINLIMIT=20mil|PREFEREDWIDTH=10mil|MAXLIMIT=5mil|MINIMP=60|FAVIMP=50|MAXIMP=40",
    ].join("\n"),
  )

  const result = validateAltiumDocument(document, { profile: "strict" })
  expect(result.valid).toBeFalse()
  expect(result.issues.map(({ code }) => code)).toEqual([
    "PCB_LAYER_PAIR_SUBSTACK_MISSING",
    "PCB_IMPEDANCE_SUBSTACK_MISSING",
    "PCB_IMPEDANCE_PROFILE_MISSING",
    "PCB_RULE_RANGE_INVERTED",
    "PCB_RULE_PREFERRED_OUT_OF_RANGE",
    "PCB_RULE_RANGE_INVERTED",
    "PCB_RULE_PREFERRED_OUT_OF_RANGE",
  ])
})
