import { expect, test } from "bun:test"
import { serializeAltiumSheetToSvg } from "../../lib"
import { document, fonts, pin } from "../fixtures/native-schematic-rendering"

test("rendering preserves original malformed fields and native serialization", () => {
  const doc = document(
    [pin, "|RECORD=25|LOCATION.X=258.8|TEXT=VDD|ISHIDDEN=T"],
    fonts,
  )
  const before = doc.getString()
  serializeAltiumSheetToSvg(doc)
  expect(doc.getString()).toBe(before)
  expect(doc.netLabels[0]?.getCaseInsensitive("LOCATION.X")).toBe("258.8")
  expect(doc.netLabels[0]?.getBoolean("ISHIDDEN")).toBe(true)
})
