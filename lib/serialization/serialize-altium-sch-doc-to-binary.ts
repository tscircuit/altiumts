import type { AltiumSchDoc } from "../altium-sch-doc"
import { encodeAltiumText } from "../parser/decode-altium-text"
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

export type AltiumSchematicEmbeddedImageInput = {
  compressedBytes: Uint8Array
  name: string
}

export type SerializeAltiumSchDocToBinaryOptions = {
  embeddedImages?: readonly AltiumSchematicEmbeddedImageInput[]
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
    content: serializeSchematicImageStorage(options.embeddedImages ?? []),
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

function serializeSchematicImageStorage(
  embeddedImages: readonly AltiumSchematicEmbeddedImageInput[],
): Uint8Array {
  const header = toLengthPrefixedTextBlock(
    toAltiumBinaryRecordBytes("|HEADER=Icon storage"),
  )
  const entries = embeddedImages.map(({ compressedBytes, name }) => {
    const nameBytes = encodeAltiumText(name, "windows-1252")
    if (nameBytes.byteLength === 0 || nameBytes.byteLength > 255) {
      throw new RangeError(
        "Embedded schematic image names must be 1 to 255 Windows-1252 bytes",
      )
    }
    if (compressedBytes.byteLength === 0) {
      throw new RangeError(
        "Embedded schematic image compressed bytes must not be empty",
      )
    }
    const entry = concatAltiumBinaryBytes([
      Uint8Array.of(0xd0, nameBytes.byteLength),
      nameBytes,
      uint32AltiumBytes(compressedBytes.byteLength),
      compressedBytes,
    ])
    if (entry.byteLength > 0x00ff_ffff) {
      throw new RangeError(
        "Embedded schematic image storage entries must fit in 24 bits",
      )
    }
    return concatAltiumBinaryBytes([uint32AltiumBytes(entry.byteLength), entry])
  })
  return concatAltiumBinaryBytes([header, ...entries])
}

function toLengthPrefixedTextBlock(recordBytes: Uint8Array): Uint8Array {
  return concatAltiumBinaryBytes([
    uint32AltiumBytes(recordBytes.byteLength),
    recordBytes,
  ])
}
