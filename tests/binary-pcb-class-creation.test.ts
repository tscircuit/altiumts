import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbDocToBinary } from "../lib"
import { binaryCopperPrimitiveBoardSource } from "./fixtures/binary-pcb-copper-primitives"

test("creates native binary PCB component classes", () => {
  const classSource =
    "|RECORD=Class|KIND=1|NAME=Power Components|SUPERCLASS=FALSE|M0=U1|M1=U2|UNIQUEID=POWER_COMPONENTS"
  const document = parseAltiumBinaryPcbDoc(
    serializeAltiumPcbDocToBinary(
      [binaryCopperPrimitiveBoardSource, classSource].join("\r\n"),
    ),
  )

  expect(document.getStreamSummary("Classes6")).toMatchObject({
    declaredRecordCount: 1,
    decodedPropertyRecordCount: 1,
  })
  expect(document.classes).toHaveLength(1)
  expect(document.classes[0]).toMatchObject({
    classKind: "1",
    members: ["U1", "U2"],
    name: "Power Components",
    superClass: false,
  })
})
