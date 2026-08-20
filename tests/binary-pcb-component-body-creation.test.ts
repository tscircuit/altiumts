import { expect, test } from "bun:test"
import {
  AltiumComponentBodyRecord,
  getPcbContour,
  parseAltiumBinaryPcbDoc,
  serializeAltiumPcbDocToBinary,
} from "../lib"
import {
  binaryComponentBodyBoardSource,
  embeddedStepModelBytes,
} from "./fixtures/binary-pcb-component-body"

test("creates native component bodies with embedded STEP models", async () => {
  const document = parseAltiumBinaryPcbDoc(
    serializeAltiumPcbDocToBinary(binaryComponentBodyBoardSource, {
      embeddedModels: [{ bytes: embeddedStepModelBytes, modelIndex: 0 }],
    }),
  )
  const componentBody = document.componentBodies[0]

  expect(document.getStreamSummary("ShapeBasedComponentBodies6")).toMatchObject(
    {
      declaredRecordCount: 1,
      decodedPrimitiveRecordCount: 1,
    },
  )
  expect(componentBody).toBeInstanceOf(AltiumComponentBodyRecord)
  if (!(componentBody instanceof AltiumComponentBodyRecord)) {
    throw new Error("Expected a typed Altium component body record")
  }
  expect(componentBody).toMatchObject({
    componentIndex: 0,
    modelEmbedded: true,
    modelId: "{TEST-MODEL}",
    modelRotation3d: { x: 0, y: 0, z: 45 },
    overallHeightMils: 100,
  })
  expect(getPcbContour(componentBody).vertices).toHaveLength(5)
  expect(document.models).toHaveLength(1)
  expect(document.models[0]).toMatchObject({
    embedded: true,
    id: "{TEST-MODEL}",
    name: "test-body.step",
  })
  const embeddedModel = document.getEmbeddedModelForComponentBody(componentBody)
  expect(embeddedModel).toBeDefined()
  expect(await embeddedModel?.getDecompressedBytes()).toEqual(
    embeddedStepModelBytes,
  )
})
