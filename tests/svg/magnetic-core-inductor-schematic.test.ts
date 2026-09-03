import { expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"

test("renders a complete schematic containing a magnetic-core inductor", async () => {
  const source = await readFile(
    resolve(import.meta.dir, "..", "fixtures", "magnetic-core-inductor.SchDoc"),
  )
  const document = parseAltiumSchDoc(source)
  const magneticCoreInductor = document.records.find(
    (record) =>
      record.recordKind === "1" &&
      record.getCaseInsensitive("COMPONENTDESCRIPTION") ===
        "Magnetic-Core Inductor",
  )

  expect(magneticCoreInductor).toBeDefined()

  const svg = serializeAltiumSheetToSvg(document, {
    title: "Magnetic-core inductor schematic reproduction",
  })

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
