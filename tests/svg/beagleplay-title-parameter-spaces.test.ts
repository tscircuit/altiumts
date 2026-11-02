import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"

test("renders the BeaglePlay power-tree title block", async () => {
  const document = parseAltiumSchDoc(
    await Bun.file(
      new URL("../fixtures/beagleplay-power-tree.SchDoc", import.meta.url),
    ).bytes(),
  )
  const svg = serializeAltiumSheetToSvg(document, {
    viewBox: { x: 1200, y: 0, width: 453, height: 200 },
  })

  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
