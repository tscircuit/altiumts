import { expect, test } from "bun:test"
import { AltiumSerializationError, serializeAltiumPcbDocToBinary } from "../lib"
import { binaryDocumentPcbSource } from "./fixtures/binary-document-creation"

test("rejects PCB record kinds that binary serialization cannot preserve", () => {
  const sourceWithUnion = [
    binaryDocumentPcbSource,
    "|RECORD=Union|NAME=Unsupported Union",
  ].join("\r\n")

  expect(() => serializeAltiumPcbDocToBinary(sourceWithUnion)).toThrow(
    new AltiumSerializationError(
      'Unsupported PCB record kind for binary serialization: "Union"',
    ),
  )
})
