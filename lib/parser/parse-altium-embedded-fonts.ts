import { AltiumEmbeddedFont } from "../altium-embedded-font"
import { AltiumBinaryReader } from "../binary/altium-binary-io"
import { AltiumCorruptContainerError } from "../errors/altium-error"

export function parseAltiumEmbeddedFonts(
  bytes: Uint8Array,
  {
    expectedCount,
    tolerateInvalidRecords = false,
  }: {
    expectedCount?: number
    tolerateInvalidRecords?: boolean
  } = {},
): AltiumEmbeddedFont[] {
  const reader = new AltiumBinaryReader(bytes)
  const fonts: AltiumEmbeddedFont[] = []
  let recordIndex = 0
  while (reader.remaining > 0) {
    if (recordIndex >= 256) {
      if (tolerateInvalidRecords) break
      throw new AltiumCorruptContainerError("Too many embedded fonts")
    }
    const byteOffset = reader.offset
    try {
      // Read the complete frame before decoding optional font names. A bad
      // name can be skipped only when the next record boundary is known.
      const nameBytes = reader.uint32LengthPrefixedBytes(4096)
      const familyBytes = reader.uint32LengthPrefixedBytes(4096)
      const styleBytes = reader.uint32LengthPrefixedBytes(4096)
      const bold = reader.uint8() !== 0
      const italic = reader.uint8() !== 0
      reader.skip(1) // Reserved byte; retained in the compound stream.
      const compressedBytes = reader.uint32LengthPrefixedBytes(16 * 1024 * 1024)
      try {
        fonts.push(
          new AltiumEmbeddedFont({
            name: decodeFontName(nameBytes),
            family: decodeFontName(familyBytes),
            style: decodeFontName(styleBytes),
            bold,
            italic,
            compressedBytes,
            sourceLocation: {
              streamPath: "/EmbeddedFonts6/Data",
              byteOffset,
              recordIndex,
            },
          }),
        )
      } catch (cause) {
        if (!tolerateInvalidRecords) throw cause
      }
      recordIndex++
    } catch (cause) {
      if (!tolerateInvalidRecords) throw cause
      // Truncated/invalid framing cannot be resynchronized safely. Keep the
      // valid prefix instead of discarding every optional font in the PCB.
      break
    }
  }
  if (
    !tolerateInvalidRecords &&
    expectedCount !== undefined &&
    recordIndex !== expectedCount
  ) {
    throw new AltiumCorruptContainerError(
      "Embedded font count does not match Header",
    )
  }
  return fonts
}

function decodeFontName(bytes: Uint8Array): string {
  if (bytes.length % 2 !== 0)
    throw new AltiumCorruptContainerError(
      "Odd UTF-16 embedded font name length",
    )
  return new TextDecoder("utf-16le", { fatal: true })
    .decode(bytes)
    .replace(/\0$/u, "")
}
