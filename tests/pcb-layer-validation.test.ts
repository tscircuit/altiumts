import { expect, test } from "bun:test"
import {
  getAltiumPcbLayerAliasKey,
  isAltiumPcbCopperLayerName,
  isKnownAltiumPcbLayerName,
  normalizeAltiumPcbLayerName,
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
  validateAltiumDocument,
} from "../lib"
import { readReferenceBytes } from "./svg/read-reference"

test("normalizes verified PCB layer naming variants", () => {
  expect(normalizeAltiumPcbLayerName("Mid-Layer 14")).toBe("MIDLAYER14")
  expect(getAltiumPcbLayerAliasKey("MID-LAYER1")).toBe("MID1")
  expect(getAltiumPcbLayerAliasKey("MID1")).toBe("MID1")
  expect(getAltiumPcbLayerAliasKey("Plane 2")).toBe("INTERNALPLANE2")
  expect(getAltiumPcbLayerAliasKey("Internal Plane 2")).toBe("INTERNALPLANE2")
  for (const layer of [
    "TOP",
    "Top Layer",
    "MID1",
    "MID-LAYER30",
    "PLANE2",
    "Internal Plane 16",
    "Mechanical 32",
    "Keep-Out Layer",
    "DRC Error Markers",
  ]) {
    expect(isKnownAltiumPcbLayerName(layer)).toBeTrue()
  }
  expect(isKnownAltiumPcbLayerName("MID-LAYER31")).toBeFalse()
  expect(isKnownAltiumPcbLayerName("LAYER123")).toBeFalse()
  expect(isAltiumPcbCopperLayerName("MID-LAYER14")).toBeTrue()
  expect(isAltiumPcbCopperLayerName("MECHANICAL16")).toBeFalse()
})

test("allows zero-width artwork but rejects zero-width copper", () => {
  const document = parseAltiumPcbDoc(
    [
      "|RECORD=Board",
      "|RECORD=Track|LAYER=MECHANICAL16|X1=0mil|Y1=0mil|X2=10mil|Y2=0mil|WIDTH=0mil",
      "|RECORD=Track|LAYER=TOP|X1=0mil|Y1=10mil|X2=10mil|Y2=10mil|WIDTH=0mil",
      "|RECORD=Track|LAYER=FUTURELAYER|X1=0mil|Y1=20mil|X2=10mil|Y2=20mil|WIDTH=0mil",
    ].join("\n"),
  )
  const widthIssues = validateAltiumDocument(document, {
    profile: "strict",
  }).issues.filter(({ code }) => code === "PCB_TRACK_WIDTH_INVALID")
  expect(widthIssues).toHaveLength(2)
  expect(
    widthIssues.every(({ context }) => context?.recordKind === "Track"),
  ).toBeTrue()
})

test("validates primitive layer references against standard and stack names", () => {
  const document = parseAltiumPcbDoc(
    [
      "|RECORD=Board|LAYER_V8_0NAME=Signal Foo|LAYER_V8_0ID={LAYER}",
      "|RECORD=Track|LAYER=TOP|X1=0mil|Y1=0mil|X2=10mil|Y2=0mil|WIDTH=5mil",
      "|RECORD=Track|LAYER=Signal Foo|X1=0mil|Y1=5mil|X2=10mil|Y2=5mil|WIDTH=5mil",
      "|RECORD=Pad|LAYER=MULTILAYER|X=0mil|Y=0mil|XSIZE=20mil|YSIZE=20mil|FROMLAYER=TOP|TOLAYER=LAYER255",
      "|RECORD=Track|LAYER=Future Signal|X1=0mil|Y1=10mil|X2=10mil|Y2=10mil|WIDTH=5mil",
    ].join("\n"),
  )

  const basic = validateAltiumDocument(document)
  const strict = validateAltiumDocument(document, { profile: "strict" })
  expect(
    basic.issues.filter(({ code }) => code === "PCB_PRIMITIVE_LAYER_UNKNOWN"),
  ).toHaveLength(1)
  expect(basic.valid).toBeTrue()
  expect(
    strict.issues.filter(({ code }) => code === "PCB_PRIMITIVE_LAYER_UNKNOWN"),
  ).toMatchObject([
    {
      context: { fieldName: "LAYER", recordKind: "Track" },
      message: "Track references unknown layer Future Signal in LAYER",
      severity: "error",
    },
  ])
  expect(strict.valid).toBeFalse()
})

test("accepts all verified primitive layer variants in binary fixtures", async () => {
  for (const filename of ["novena-edp-adapter-dvt1.PcbDoc", "elk-pi.PcbDoc"]) {
    const document = parseAltiumBinaryPcbDoc(await readReferenceBytes(filename))
    const layerIssues = validateAltiumDocument(document, {
      profile: "strict",
    }).issues.filter(({ code }) => code === "PCB_PRIMITIVE_LAYER_UNKNOWN")
    expect(layerIssues, filename).toEqual([])
  }
}, 20_000)
