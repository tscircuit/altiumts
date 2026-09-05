import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc } from "../lib"
import {
  addAltiumBinarySection,
  concatAltiumBinaryBytes,
  createAltiumCompoundFile,
  uint32AltiumBytes,
  writeAltiumCompoundFile,
} from "../lib/serialization/altium-binary-container"
import { writeLengthPrefixedAltiumRecords } from "../lib/serialization/altium-binary-record-encoding"

test("preserves opaque binary connection records", () => {
  const compoundFile = createAltiumCompoundFile()
  const opaqueConnection = new TextEncoder().encode("opaque connection bytes")
  const textConnection = writeLengthPrefixedAltiumRecords(["|NET=GND"])
  const connectionData = concatAltiumBinaryBytes([
    uint32AltiumBytes(opaqueConnection.byteLength),
    opaqueConnection,
    textConnection,
  ])

  addAltiumBinarySection({
    compoundFile,
    content: writeLengthPrefixedAltiumRecords(["|RECORD=Board"]),
    name: "Board6",
    recordCount: 1,
  })
  addAltiumBinarySection({
    compoundFile,
    content: connectionData,
    name: "Connections6",
    recordCount: 2,
  })

  const document = parseAltiumBinaryPcbDoc(
    writeAltiumCompoundFile(compoundFile),
  )

  const connections = document.getRecordsByKind("Connection")
  expect(connections).toHaveLength(1)
  expect(connections[0]?.get("NET")).toBe("GND")
  expect(connections[0]?.sourceLocation?.recordIndex).toBe(1)
  expect(document.getStreamSummary("Connections6")).toMatchObject({
    declaredRecordCount: 2,
    decodedPropertyRecordCount: 1,
  })
  expect(
    document.compoundFile.getStream("/Connections6/Data")?.content,
  ).toEqual(connectionData)
})
