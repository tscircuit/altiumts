import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbDocToBinary } from "../lib"
import { binaryCopperPrimitiveBoardSource } from "./fixtures/binary-pcb-copper-primitives"

test("creates native binary PCB design rules", () => {
  const ruleSource =
    "|RECORD=Rule|BINARYRECORDTYPE=2|RULEKIND=Width|NETSCOPE=0|LAYERKIND=0|ENABLED=TRUE|NAME=Minimum Trace Width|PRIORITY=1|SCOPE1EXPRESSION=All|SCOPE2EXPRESSION=All|MINLIMIT=6mil"
  const document = parseAltiumBinaryPcbDoc(
    serializeAltiumPcbDocToBinary(
      [binaryCopperPrimitiveBoardSource, ruleSource].join("\r\n"),
    ),
  )

  expect(document.getStreamSummary("Rules6")).toMatchObject({
    declaredRecordCount: 1,
    decodedPropertyRecordCount: 1,
  })
  expect(document.rules).toHaveLength(1)
  expect(document.rules[0]).toMatchObject({
    category: "routing-width",
    enabled: true,
    name: "Minimum Trace Width",
    ruleKind: "Width",
    scope1Expression: "All",
    widthConstraint: { minimumMils: 6 },
  })
})
