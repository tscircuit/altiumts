import { expect, test } from "bun:test"
import {
  parseAltiumPcbDoc,
  parseAltiumPrjPcb,
  serializeAltiumPcbToSvg,
} from "../lib"
import { getProjectParameters } from "../lib/project-parameters"
import { resolvePcbProjectText } from "../lib/svg-serialization/resolve-pcb-project-text"

test("resolves PCB project annotations while retaining the source expression", () => {
  const project = parseAltiumPrjPcb(
    "[Parameter1]\nName=PRJ_Number\nValue=PMP22712\n[Parameter2]\nName=PCB_Rev\nValue=E2\n",
  )
  const source =
    "|RECORD=Board\n|RECORD=Text|LAYER=TOPOVERLAY|HEIGHT=100mil|TEXT='.PRJ_Number'.PCB_Rev"
  const document = parseAltiumPcbDoc(source)
  expect(serializeAltiumPcbToSvg(document, { project })).toContain(
    ">PMP22712E2</text>",
  )
  expect(document.getString()).toBe(source)
  expect(serializeAltiumPcbToSvg(document)).toContain(
    "&apos;.PRJ_Number&apos;.PCB_Rev",
  )
  project.set("Parameter2", "Value", "E3")
  expect(serializeAltiumPcbToSvg(document, { project })).toContain(
    ">PMP22712E3</text>",
  )
})

test("preserves literal text, separators and unknown PCB parameter references", () => {
  const parameters = new Map([
    ["number", "PMP22712"],
    ["revision", "E2"],
    ["board name", "Power board"],
    ["empty", ""],
    ["unset", "*"],
  ])
  for (const [source, expected] of [
    [".NUMBER", "PMP22712"],
    ["File: '.Number' / Rev: '.Revision'", "File: PMP22712 / Rev: E2"],
    ["'.Board Name'", "Power board"],
    ["'.Number'.Revision", "PMP22712E2"],
    ["'.Number'.Missing", "PMP22712.Missing"],
    ["'.Missing' / '.Revision'", "'.Missing' / E2"],
    [".Empty", ""],
    [".Unset", ".Unset"],
    [".Missing", ".Missing"],
    [
      "Don't change example.com or '.Number",
      "Don't change example.com or '.Number",
    ],
  ]) {
    expect(resolvePcbProjectText(source!, parameters)).toBe(expected!)
  }
})

test("shares compact project parameters without reading variant overrides", () => {
  const project = parseAltiumPrjPcb(
    "[Parameters]\nParameter1=Number=PMP22712\n[Parameter2_1]\nName=Number\nValue=Wrong variant\n",
  )
  expect(resolvePcbProjectText(".Number", getProjectParameters(project))).toBe(
    "PMP22712",
  )
})
