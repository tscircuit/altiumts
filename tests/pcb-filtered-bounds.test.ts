import { expect, test } from "bun:test"
import { parseAltiumPcbDoc, serializeAltiumPcbToSvg } from "../lib"

test.each([false, true])(
  "fits selected layers without off-board fabrication text (fitToContent=%s)",
  (fitToContent) => {
    const copperSource = [
      "|RECORD=Board",
      "|RECORD=Track|LAYER=TOP|X1=100mil|Y1=100mil|X2=500mil|Y2=200mil|WIDTH=10mil",
    ].join("\n")
    const source = [
      copperSource,
      "|RECORD=Text|LAYER=MECHANICAL1|X=10000mil|Y=10000mil|HEIGHT=60mil|TEXT=Fabrication notes",
    ].join("\n")
    const document = parseAltiumPcbDoc(source)
    const copperOnly = parseAltiumPcbDoc(copperSource)
    const options = { layers: ["TOP"], fitToContent }
    const overview = serializeAltiumPcbToSvg(document, options)

    expect(overview).toBe(serializeAltiumPcbToSvg(copperOnly, options))
    expect(serializeAltiumPcbToSvg(document)).toContain("Fabrication notes")
    expect(
      serializeAltiumPcbToSvg(document, { layers: ["MECHANICAL1"] }),
    ).toContain("Fabrication notes")
    expect(
      serializeAltiumPcbToSvg(document, {
        ...options,
        viewBox: { x: 0, y: 0, width: 600, height: 300 },
      }),
    ).toContain('viewBox="0 0 600 300"')
    expect(document.getString()).toBe(source)
  },
)

const referenceSelections = [{ componentIndices: [0] }, { netIndices: [0] }]

test.each(referenceSelections)(
  "fits only selected component/net records: %j",
  (selection) => {
    const selectedSource = [
      "|RECORD=Board",
      "|RECORD=Component|ID=0|NAMEON=TRUE",
      "|RECORD=Component|ID=1|NAMEON=TRUE",
      "|RECORD=Net|ID=0|NAME=Selected",
      "|RECORD=Net|ID=1|NAME=Excluded",
      "|RECORD=Track|LAYER=TOP|COMPONENT=0|NET=0|X1=100mil|Y1=100mil|X2=500mil|Y2=200mil|WIDTH=10mil",
    ].join("\n")
    const source = `${selectedSource}\n|RECORD=Track|LAYER=TOP|COMPONENT=1|NET=1|X1=10000mil|Y1=10000mil|X2=10500mil|Y2=10200mil|WIDTH=10mil`
    const document = parseAltiumPcbDoc(source)
    for (const fitToContent of [false, true]) {
      const options = { ...selection, fitToContent }
      expect(serializeAltiumPcbToSvg(document, options)).toBe(
        serializeAltiumPcbToSvg(parseAltiumPcbDoc(selectedSource), options),
      )
    }
    expect(document.getString()).toBe(source)
  },
)

test("hidden component labels and disabled text do not expand the viewport", () => {
  const visibleSource = [
    "|RECORD=Board",
    "|RECORD=Component|ID=0|NAMEON=FALSE|COMMENTON=FALSE",
    "|RECORD=Track|LAYER=TOP|X1=100mil|Y1=100mil|X2=500mil|Y2=200mil|WIDTH=10mil",
  ].join("\n")
  const source = [
    visibleSource,
    "|RECORD=Text|LAYER=TOPOVERLAY|COMPONENT=0|DESIGNATOR=TRUE|X=10000mil|Y=10000mil|HEIGHT=60mil|TEXT=Hidden designator",
    "|RECORD=Text|LAYER=TOPOVERLAY|COMPONENT=0|COMMENT=TRUE|X=20000mil|Y=20000mil|HEIGHT=60mil|TEXT=Hidden comment",
  ].join("\n")
  const document = parseAltiumPcbDoc(source)
  const visibleOnly = parseAltiumPcbDoc(visibleSource)
  for (const fitToContent of [false, true]) {
    const visibleSvg = serializeAltiumPcbToSvg(visibleOnly, { fitToContent })
    expect(serializeAltiumPcbToSvg(document, { fitToContent })).toBe(visibleSvg)
    const withHidden = serializeAltiumPcbToSvg(document, {
      fitToContent,
      showHidden: true,
    })
    expect(withHidden).toContain("Hidden designator")
    expect(withHidden).toContain("Hidden comment")
    expect(withHidden.match(/viewBox="[^"]+"/u)?.[0]).not.toBe(
      visibleSvg.match(/viewBox="[^"]+"/u)?.[0],
    )
    const textDisabled = { fitToContent, showHidden: true, showText: false }
    expect(serializeAltiumPcbToSvg(document, textDisabled)).toBe(
      serializeAltiumPcbToSvg(visibleOnly, textDisabled),
    )
  }
  expect(document.getString()).toBe(source)
})
