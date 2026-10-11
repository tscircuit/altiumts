import { expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbToSvg } from "../../lib"
import { readReferenceBytes } from "./read-reference"

test("compares PMP22712 text with the supplied Altium reference", async () => {
  const bytes = await readReferenceBytes("ti-pmp22712.PcbDoc")
  const document = parseAltiumBinaryPcbDoc(bytes)
  const reference = await readFile(
    new URL("../fixtures/altium-reference/pmp22712.png", import.meta.url),
  )
  // Match the screenshot's board rectangle (80,214)-(928,909), then crop
  // its top 300 mils. Both panels retain the same board-relative scale.
  const converterSvg = serializeAltiumPcbToSvg(document, {
    title: "PMP22712 title and evaluation warning",
    width: 900,
    height: 206.2678,
    layers: ["TOPOVERLAY", "BOTTOMOVERLAY"],
    viewBox: {
      x: 691.9997,
      y: 2257.6223,
      width: 1309.0555,
      height: 300,
    },
  })
  const comparison = `<svg xmlns="http://www.w3.org/2000/svg" width="1856" height="290" viewBox="0 0 1856 290" role="img" aria-label="PMP22712: supplied Altium reference on the left, AltiumTS on the right">
  <rect width="1856" height="290" fill="#171a20"/>
  <g fill="#f5f5f5" font-family="Arial, sans-serif" font-size="22">
    <text x="16" y="31">Altium reference (uploaded screenshot)</text>
    <text x="940" y="31">AltiumTS (real PCB, same board crop)</text>
  </g>
  <svg x="16" y="48" width="900" height="206.2678" viewBox="80 214 848 194.3501">
    <title>Original uploaded Altium screenshot, board text crop</title>
    <image width="986" height="954" href="data:image/png;base64,${reference.toString("base64")}"/>
  </svg>
  <g transform="translate(940 48)">${converterSvg}</g>
  <text x="16" y="279" fill="#c6cbd3" font-family="Arial, sans-serif" font-size="14">Reference pixels are unchanged. Converter uses top/bottom overlay layers; colors and unresolved special strings remain visible.</text>
</svg>`
  expect(converterSvg).toContain(
    "For evaluation only; not FCC approved for resale.",
  )
  expect(converterSvg).toContain('data-record="BoardOutline"')
  expect(converterSvg).not.toMatch(/NaN|Infinity/u)
  expect(document.getBytes()).toEqual(bytes)
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
})
