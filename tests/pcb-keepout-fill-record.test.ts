import { expect, test } from "bun:test"
import { parseAltiumPcbDoc } from "../lib"
import { getPcbDocumentBounds } from "../lib/svg-serialization/pcb-geometry"
import { getPcbLayerColor } from "../lib/svg-serialization/pcb-layer"
import { renderPcbRecord } from "../lib/svg-serialization/render-pcb-record"
import { createSvgViewport } from "../lib/svg-serialization/svg-utils"

test("renders a standalone keepout fill with its referenced pattern definition", () => {
  const document = parseAltiumPcbDoc(
    [
      "|RECORD=Board|VX0=0mil|VY0=0mil|VX1=100mil|VY1=0mil|VX2=100mil|VY2=100mil|VX3=0mil|VY3=100mil",
      "|RECORD=Fill|LAYER=TOP|KEEPOUT=TRUE|X1=0mil|Y1=0mil|X2=100mil|Y2=50mil",
      "|RECORD=Fill|LAYER=TOP|KEEPOUT=FALSE|X1=0mil|Y1=50mil|X2=100mil|Y2=100mil",
    ].join("\n"),
  )
  const viewport = createSvgViewport(getPcbDocumentBounds(document))
  const fills = document.records.filter(
    (record) => record.recordKind === "Fill",
  )
  expect(fills).toHaveLength(2)
  for (const record of fills) {
    const svg = renderPcbRecord({
      record,
      shouldFillPolygon: false,
      svgOptions: {},
      viewport,
    })
    if (!svg) throw new Error("Fill did not render")
    if (record.getBoolean("KEEPOUT")) {
      expect(svg.match(/<pattern /g)).toHaveLength(1)
      const patternId = svg.match(/<pattern id="([^"]+)"/)?.[1]
      expect(patternId).toBeDefined()
      expect(svg).toContain(`fill="url(#${patternId})"`)
      expect(svg).toContain(`stroke="${getPcbLayerColor("KEEPOUT")}"`)
    } else {
      expect(svg).not.toContain("<defs>")
      expect(svg).not.toContain('fill="url(')
      expect(svg).toContain(`fill="${getPcbLayerColor("TOP")}"`)
    }
  }
})
