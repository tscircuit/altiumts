import { expect, test } from "bun:test"
import {
  parseAltiumBinaryPcbDoc,
  parseAltiumPcbDoc,
  parseAltiumPrjPcb,
  serializeAltiumPcbToSvg,
} from "../lib"
import { getProjectParameters } from "../lib/project-parameters"
import { resolvePcbSpecialStrings } from "../lib/svg-serialization/pcb-special-strings"
import {
  parseBrowserProjectFiles,
  renderProjectDocument,
} from "../site/src/parse-project"
import { readReference, readReferenceBytes } from "./svg/read-reference"

test("resolves the PMP22712 title through its uploaded project's document reference", async () => {
  const bytes = await readReferenceBytes("ti-pmp22712.PcbDoc")
  const projectSource = await readReference("ti-pmp22712.PrjPcb")
  const project = parseAltiumPrjPcb(projectSource)
  const board = parseAltiumBinaryPcbDoc(bytes)
  const title = board.texts.find(
    (record) => record.getNumber("WIDESTRINGINDEX") === 3,
  )!
  const isolated = parseAltiumPcbDoc(`|RECORD=Board\n${title.getString()}`)
  expect(serializeAltiumPcbToSvg(isolated, { project })).toContain(
    ">PMP22712E2</text>",
  )
  expect(serializeAltiumPcbToSvg(isolated)).toContain(".PRJ_Number")
  expect(board.getBytes()).toEqual(bytes)
  expect(project.getString()).toBe(projectSource)

  const state = parseBrowserProjectFiles([
    { path: "upload/PMP22712_PCB.PcbDoc", bytes: bytes.slice().buffer },
    {
      path: "upload/PMP22712.PrjPcb",
      bytes: new TextEncoder().encode(projectSource).buffer,
    },
    // A same-named board in another directory must not inherit the project.
    {
      path: "unrelated/PMP22712_PCB.PcbDoc",
      bytes: new TextEncoder().encode(
        "|RECORD=Board\n|RECORD=Text|LAYER=TOPOVERLAY|TEXT=.PRJ_Number|X=0|Y=0|HEIGHT=30",
      ).buffer,
    },
  ])
  const entry = state.manifest.documents.find(
    ({ path }) => path === "upload/PMP22712_PCB.PcbDoc",
  )!
  for (const viewId of ["board", "layer:TOPOVERLAY"]) {
    const svg = renderProjectDocument({ state, documentId: entry.id, viewId })
    expect(svg).toContain(">PMP22712E2</text>")
  }
  const other = state.manifest.documents.find(({ path }) =>
    path.startsWith("unrelated/"),
  )!
  expect(
    renderProjectDocument({ state, documentId: other.id, viewId: "board" }),
  ).toContain(">.PRJ_Number</text>")
}, 30_000)

test("resolves only complete parameter expressions and refreshes edited project values", () => {
  const project = parseAltiumPrjPcb(
    "[Parameter1]\nName=PRJ_Number\nValue=PMP22712\n[Parameters]\nParameter1=PCB_Rev=E2\nParameter2=Empty=*\n[Parameter2_1]\nName=PCB_Rev\nValue=variant-only\n",
  )
  const parameters = getProjectParameters(project)
  expect(resolvePcbSpecialStrings("'.prj_number'.PCB_REV", parameters)).toBe(
    "PMP22712E2",
  )
  expect(
    resolvePcbSpecialStrings(".PRJ_Number' Rev '.PCB_Rev", parameters),
  ).toBe("PMP22712 Rev E2")
  for (const text of [
    "'.PRJ_Number'.Missing",
    ".Empty",
    "board.example",
    "'literal'",
    "'.PRJ_Number",
    ".PRJ_Number + script()",
  ]) {
    expect(resolvePcbSpecialStrings(text, parameters)).toBeUndefined()
  }
  project.set("Parameter1", "Value", "<new&board>")
  const board = parseAltiumPcbDoc(
    "|RECORD=Board\n|RECORD=Text|TEXT=.PRJ_Number|HEIGHT=30",
  )
  expect(serializeAltiumPcbToSvg(board, { project })).toContain(
    "&lt;new&amp;board&gt;",
  )
  expect(board.getRecordsByKind("Text")[0]?.getDecoded("TEXT")).toBe(
    ".PRJ_Number",
  )
})

test("prefers an exact dotted parameter name over adjacent bare references", () => {
  const project = parseAltiumPrjPcb(
    "[Parameters]\nParameter1=PCB=BOARD\nParameter2=Rev=E2\nParameter3=PCB.Rev=B\n",
  )
  const source =
    "|RECORD=Board\n|RECORD=Text|TEXT=.PCB.Rev|HEIGHT=30\n|RECORD=Text|TEXT='.PCB.Rev'|HEIGHT=30\n|RECORD=Text|TEXT=.pCb.rEv|HEIGHT=30"
  const board = parseAltiumPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(board, { project })
  expect(svg.match(/>B<\/text>/gu)).toHaveLength(3)
  expect(svg).not.toContain("BOARDE2")
  expect(board.getString()).toBe(source)

  const parameters = new Map(getProjectParameters(project))
  parameters.set("pcb.rev", "*")
  expect(resolvePcbSpecialStrings(".PCB.Rev", parameters)).toBeUndefined()
  parameters.set("pcb.rev", "")
  expect(resolvePcbSpecialStrings(".PCB.Rev", parameters)).toBe("")
  parameters.delete("pcb.rev")
  expect(resolvePcbSpecialStrings(".PCB.Rev", parameters)).toBe("BOARDE2")
})
