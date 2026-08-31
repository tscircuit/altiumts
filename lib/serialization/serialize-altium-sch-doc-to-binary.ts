import {
  type AltiumSchematicPngStorageInput,
  encodeAltiumSchematicImageStorage,
} from "../altium-embedded-schematic-image"
import type { AltiumSchDoc } from "../altium-sch-doc"
import {
  addAltiumCompoundStream,
  concatAltiumBinaryBytes,
  createAltiumCompoundFile,
  uint32AltiumBytes,
  writeAltiumCompoundFile,
} from "./altium-binary-container"
import {
  getAsciiAltiumSource,
  toAltiumBinaryRecordBytes,
} from "./altium-binary-record-encoding"

export interface SerializeAltiumSchDocToBinaryOptions {
  embeddedPngImages?: readonly AltiumSchematicPngStorageInput[]
}

/** Encodes an ASCII schematic into Altium's native OLE/CFB SchDoc container. */
export function serializeAltiumSchDocToBinary(
  document: string | AltiumSchDoc,
  options: SerializeAltiumSchDocToBinaryOptions = {},
): Uint8Array {
  const asciiDocument = getAsciiAltiumSource(document)
  const recordSources = asciiDocument
    .split(/\r?\n|\r/u)
    .filter(Boolean)
    .filter((recordSource) => !recordSource.startsWith("|HEADER="))
  const binaryHeader =
    "Protel for Windows - Schematic Capture Binary File Version 5.0"
  const fileHeaderBlocks = [
    toLengthPrefixedTextBlock(
      toAltiumBinaryRecordBytes(
        `|HEADER=${binaryHeader}|WEIGHT=${recordSources.length}|MINORVERSION=0|UNIQUEID=ALTIUMTS`,
      ),
    ),
    ...recordSources.map((recordSource) => {
      return toLengthPrefixedTextBlock(toAltiumBinaryRecordBytes(recordSource))
    }),
  ]

  const compoundFile = createAltiumCompoundFile()
  addAltiumCompoundStream({
    compoundFile,
    content: concatAltiumBinaryBytes(fileHeaderBlocks),
    path: "/FileHeader",
  })
  addAltiumCompoundStream({
    compoundFile,
    content: encodeAltiumSchematicImageStorage({
      images: options.embeddedPngImages ?? [],
    }),
    path: "/Storage",
  })
  addAltiumCompoundStream({
    compoundFile,
    content: toLengthPrefixedTextBlock(
      toAltiumBinaryRecordBytes(`|HEADER=${binaryHeader}`),
    ),
    path: "/Additional",
  })
  return writeAltiumCompoundFile(compoundFile)
}

function toLengthPrefixedTextBlock(recordBytes: Uint8Array): Uint8Array {
  return concatAltiumBinaryBytes([
    uint32AltiumBytes(recordBytes.byteLength),
    recordBytes,
  ])
}
