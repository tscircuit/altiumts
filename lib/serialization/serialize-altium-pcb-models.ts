import { zlibSync } from "fflate"
import { AltiumBinaryWriter } from "../binary/altium-binary-io"
import { AltiumSerializationError } from "../errors/altium-error"
import {
  type AltiumCompoundFile,
  addAltiumCompoundStream,
} from "./altium-binary-container"
import {
  getAltiumRecordFields,
  toAltiumBinaryRecordBytes,
} from "./altium-binary-record-encoding"

export type AltiumEmbeddedModelInput = {
  bytes: Uint8Array
  modelIndex: number
}

export function writeAltiumModelRecords(recordSources: string[]): Uint8Array {
  const writer = new AltiumBinaryWriter()
  for (const recordSource of recordSources) {
    const fields = getAltiumRecordFields(recordSource)
    const propertySource = [...fields.entries()]
      .filter(([fieldName]) => fieldName !== "RECORD")
      .map(([fieldName, fieldText]) => `|${fieldName}=${fieldText}`)
      .join("")
    writer.uint32LengthPrefixedBytes(
      toAltiumBinaryRecordBytes(propertySource).subarray(1),
    )
  }
  return writer.toUint8Array()
}

export function addAltiumEmbeddedModelStreams({
  compoundFile,
  embeddedModels,
  modelRecordCount,
}: {
  compoundFile: AltiumCompoundFile
  embeddedModels: readonly AltiumEmbeddedModelInput[]
  modelRecordCount: number
}): void {
  const seenModelIndexes = new Set<number>()
  for (const embeddedModel of embeddedModels) {
    if (
      !Number.isSafeInteger(embeddedModel.modelIndex) ||
      embeddedModel.modelIndex < 0 ||
      embeddedModel.modelIndex >= modelRecordCount
    ) {
      throw new AltiumSerializationError(
        `Embedded model index ${embeddedModel.modelIndex} is outside the model record range`,
      )
    }
    if (seenModelIndexes.has(embeddedModel.modelIndex)) {
      throw new AltiumSerializationError(
        `Embedded model index ${embeddedModel.modelIndex} is duplicated`,
      )
    }
    seenModelIndexes.add(embeddedModel.modelIndex)
    addAltiumCompoundStream({
      compoundFile,
      content: zlibSync(embeddedModel.bytes),
      path: `/Models/${embeddedModel.modelIndex}`,
    })
  }
}
