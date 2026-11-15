import { expect, test } from "bun:test"
import { parseAltiumIni, parseAltiumOutJob, parseAltiumPrjPcb } from "../lib"

test.each(["\n", "\r\n", "\r"])(
  "appending a project setting preserves its document path with %j line endings",
  (newline) => {
    const source = `[Document1]${newline}DocumentPath=board.SchDoc`
    const project = parseAltiumPrjPcb(source)
    expect(project.getString()).toBe(source)
    project.set("Document1", "DocumentKind", "SCH")
    const serialized = project.getString()
    expect(serialized).toBe(`${source}${newline}DocumentKind=SCH${newline}`)
    const reparsed = parseAltiumPrjPcb(serialized)
    expect(reparsed.documents[0]?.path).toBe("board.SchDoc")
    expect(reparsed.get("Document1", "DocumentKind")).toBe("SCH")
  },
)

test("appending after a final comment keeps the new output setting outside the comment", () => {
  const source = "[Output1]\r\nOutputType=Gerber\r\n; keep this comment"
  const outputJob = parseAltiumOutJob(source)
  outputJob.set("Output1", "DataSource", "board.PcbDoc")
  expect(outputJob.getString()).toBe(`${source}\r\nDataSource=board.PcbDoc\r\n`)
  const reparsed = parseAltiumOutJob(outputJob.getString())
  expect(reparsed.outputs[0]?.dataSource).toBe("board.PcbDoc")
})

test("an unterminated section header is separated from its first setting", () => {
  const document = parseAltiumIni("[Design]")
  document.set("Design", "Name", "Motor")
  expect(document.getString()).toBe("[Design]\nName=Motor\n")
  expect(parseAltiumIni(document.getString()).get("Design", "Name")).toBe(
    "Motor",
  )
})

test("a headerless final setting is separated from a new setting", () => {
  const document = parseAltiumIni("Version=1.0")
  document.set("", "Name", "Motor")
  expect(document.getString()).toBe("Version=1.0\nName=Motor\n")
  const reparsed = parseAltiumIni(document.getString())
  expect(reparsed.get("", "Version")).toBe("1.0")
  expect(reparsed.get("", "Name")).toBe("Motor")
})

test("inserting in an earlier section preserves following sections and comments", () => {
  const source =
    "[Design]\r\nName=Motor\r\n; keep\r\n[Document1]\r\nDocumentPath=board.SchDoc"
  const project = parseAltiumPrjPcb(source)
  project.set("Design", "Revision", "B")
  expect(project.getString()).toBe(
    "[Design]\r\nName=Motor\r\n; keep\r\nRevision=B\r\n[Document1]\r\nDocumentPath=board.SchDoc",
  )
  expect(parseAltiumPrjPcb(project.getString()).documents[0]?.path).toBe(
    "board.SchDoc",
  )
})

test("existing final newlines are not duplicated", () => {
  const source = "[Design]\nName=Motor\n"
  const document = parseAltiumIni(source)
  document.set("Design", "Revision", "B")
  expect(document.getString()).toBe(`${source}Revision=B\n`)
})

test("updating an existing setting retains an unterminated final line", () => {
  const document = parseAltiumIni("[Design]\r\nName=Motor")
  document.set("Design", "Name", "Power")
  expect(document.getString()).toBe("[Design]\r\nName=Power")
})
