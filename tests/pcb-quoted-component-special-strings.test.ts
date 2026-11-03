import { expect, test } from "bun:test"
import {
  parseAltiumPcbDoc,
  parseAltiumPrjPcb,
  serializeAltiumPcbToSvg,
} from "../lib"
import { escapeXml } from "../lib/svg-serialization/svg-utils"

test("resolves quoted component special strings without changing literal text", () => {
  const designatorStrings = [".Designator", "'.Designator'", "'.dEsIgNaToR'"]
  const commentStrings = [".Comment", "'.Comment'", "'.cOmMeNt'"]
  const embeddedStrings = [
    { text: "prefix '.Designator'", resolvedText: "prefix J1_A" },
    { text: "'.Designator' suffix", resolvedText: "J1_A suffix" },
    { text: "Owner's '.Designator'", resolvedText: "Owner's J1_A" },
    { text: "'.Designator''s part", resolvedText: "J1_A's part" },
    {
      text: "Part '.dEsIgNaToR': '.cOmMeNt'.",
      resolvedText: "Part J1_A: Placed comment.",
    },
    { text: "'.Designator''.Comment'", resolvedText: "J1_APlaced comment" },
    {
      text: "'.Unknown' / '.Designator'",
      resolvedText: "'.Unknown' / J1_A",
    },
    {
      text: "'.Unknown''.Designator'",
      resolvedText: "'.Unknown'J1_A",
    },
    {
      text: "'.Unknown'.Designator' / '.Comment'",
      resolvedText: "'.Unknown'.Designator' / Placed comment",
    },
    {
      text: "'.Designator' / '.Comment",
      resolvedText: "J1_A / '.Comment",
    },
  ]
  const literalStrings = [
    "'literal'",
    "'.Unknown'",
    "'.Unknown'.Designator'",
    "'.Unknown'.Comment'",
    "'.Unknown.Path'.Designator'",
    "'.deſignator'.Comment'",
    "'.deſignator'",
    ".deſignator",
    "'.Designator",
    ".Designator'",
    ".Designator suffix",
    "'literal .Designator'",
    "'literal '.Designator",
  ]
  const source = [
    "|RECORD=Board",
    "|RECORD=Component|ID=7|SOURCEDESIGNATOR=J1|COMMENT=Source comment",
    "|RECORD=Text|COMPONENT=7|LAYER=TOPOVERLAY|TEXT=J1_A|DESIGNATOR=TRUE",
    "|RECORD=Text|COMPONENT=7|LAYER=TOPOVERLAY|TEXT=Placed comment|COMMENT=TRUE",
    ...[...designatorStrings, ...commentStrings, ...literalStrings].map(
      (text) =>
        `|RECORD=Text|COMPONENT=7|LAYER=MECHANICAL2|HEIGHT=30mil|TEXT=${text}`,
    ),
    ...embeddedStrings.map(
      ({ text }) =>
        `|RECORD=Text|COMPONENT=7|LAYER=MECHANICAL2|HEIGHT=30mil|TEXT=${text}`,
    ),
    "|RECORD=Component|ID=8|SOURCEDESIGNATOR=C2|COMMENT=Capacitor",
    "|RECORD=Text|COMPONENT=8|LAYER=MECHANICAL2|TEXT='.Designator'",
    "|RECORD=Text|COMPONENT=8|LAYER=MECHANICAL2|TEXT='.Comment'",
    "|RECORD=Text|COMPONENT=8|LAYER=MECHANICAL2|TEXT=Part '.Designator': '.Comment'",
    "|RECORD=Text|COMPONENT=99|LAYER=MECHANICAL3|TEXT='.Designator'",
    "|RECORD=Text|LAYER=MECHANICAL3|TEXT='.Comment'",
    "|RECORD=Text|COMPONENT=99|LAYER=MECHANICAL3|TEXT=Missing '.Designator'",
    "|RECORD=Text|LAYER=MECHANICAL3|TEXT=Missing '.Comment'",
    "|RECORD=Component|ID=9|SOURCEDESIGNATOR='.Comment'|COMMENT='.Build'",
    "|RECORD=Text|COMPONENT=9|LAYER=MECHANICAL4|TEXT=Part '.Designator': '.Comment'",
    "|RECORD=Component|ID=10|SOURCEDESIGNATOR=.Build",
    "|RECORD=Text|COMPONENT=10|LAYER=MECHANICAL4|TEXT='.Designator'",
    "|RECORD=Text|LAYER=MECHANICAL4|TEXT=.Build",
    "|RECORD=Text|LAYER=MECHANICAL4|TEXT='.Build'",
    "|RECORD=Text|LAYER=MECHANICAL4|TEXT=.Build' Rev '.Revision",
    "|RECORD=Text|LAYER=MECHANICAL4|TEXT=.Literal",
    "|RECORD=Text|COMPONENT=7|LAYER=MECHANICAL4|TEXT='.Designator' '.Build'",
  ].join("\r\n")
  const document = parseAltiumPcbDoc(source)
  const svg = serializeAltiumPcbToSvg(document, {
    layers: ["MECHANICAL2"],
  })

  expect(svg.match(/>J1_A<\/text>/g)).toHaveLength(designatorStrings.length)
  expect(svg.match(/>Placed comment<\/text>/g)).toHaveLength(
    commentStrings.length,
  )
  expect(svg).toContain(">C2</text>")
  expect(svg).toContain(">Capacitor</text>")
  expect(svg).toContain(">Part C2: Capacitor</text>")
  expect(svg).not.toContain(">J1</text>")
  expect(svg).not.toContain("Source comment")
  for (const text of literalStrings) {
    expect(svg).toContain(`>${escapeXml(text)}</text>`)
  }
  for (const { resolvedText } of embeddedStrings) {
    expect(svg).toContain(`>${escapeXml(resolvedText)}</text>`)
  }
  const orphanSvg = serializeAltiumPcbToSvg(document, {
    layers: ["MECHANICAL3"],
  })
  expect(orphanSvg.match(/<text\b/g)).toHaveLength(2)
  expect(orphanSvg).toContain(`>${escapeXml("Missing '.Designator'")}</text>`)
  expect(orphanSvg).toContain(`>${escapeXml("Missing '.Comment'")}</text>`)
  const projectSource =
    "[Parameters]\nParameter1=Build=Production\nParameter2=Revision=E2\nParameter3=Literal='.Designator'\n"
  const project = parseAltiumPrjPcb(projectSource)
  const projectSvg = serializeAltiumPcbToSvg(document, {
    layers: ["MECHANICAL4"],
    project,
  })
  expect(projectSvg).toContain(
    `>${escapeXml("Part '.Comment': '.Build'")}</text>`,
  )
  expect(projectSvg).toContain(">.Build</text>")
  expect(projectSvg.match(/>Production<\/text>/g)).toHaveLength(2)
  expect(projectSvg).toContain(">Production Rev E2</text>")
  expect(projectSvg).toContain(`>${escapeXml("'.Designator'")}</text>`)
  expect(projectSvg).toContain(`>${escapeXml("J1_A '.Build'")}</text>`)
  expect(project.getString()).toBe(projectSource)
  expect(document.getString()).toBe(source)
})
