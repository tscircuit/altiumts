import { AltiumEmbeddedFont } from "../altium-embedded-font"
import { AltiumBinaryReader } from "../binary/altium-binary-io"
import { AltiumCorruptContainerError } from "../errors/altium-error"

export function parseAltiumEmbeddedFonts(
  bytes: Uint8Array,
  expectedCount?: number,
): AltiumEmbeddedFont[] {
  const reader = new AltiumBinaryReader(bytes)
  const fonts: AltiumEmbeddedFont[] = []
  while (reader.remaining > 0) {
    if (fonts.length >= 256)
      throw new AltiumCorruptContainerError("Too many embedded fonts")
    const byteOffset = reader.offset
    const name = readFontName(reader)
    const family = readFontName(reader)
    const style = readFontName(reader)
    const bold = reader.uint8() !== 0
    const italic = reader.uint8() !== 0
    reader.skip(1) // Reserved byte, observed as 1; retained in the compound stream.
    const compressedBytes = reader.uint32LengthPrefixedBytes(16 * 1024 * 1024)
    fonts.push(
      new AltiumEmbeddedFont({
        name,
        family,
        style,
        bold,
        italic,
        compressedBytes,
        sourceLocation: {
          streamPath: "/EmbeddedFonts6/Data",
          byteOffset,
          recordIndex: fonts.length,
        },
      }),
    )
  }
  if (expectedCount !== undefined && fonts.length !== expectedCount) {
    throw new AltiumCorruptContainerError(
      "Embedded font count does not match Header",
    )
  }
  return fonts
}

function readFontName(reader: AltiumBinaryReader): string {
  const bytes = reader.uint32LengthPrefixedBytes(4096)
  if (bytes.length % 2 !== 0)
    throw new AltiumCorruptContainerError(
      "Odd UTF-16 embedded font name length",
    )
  return new TextDecoder("utf-16le", { fatal: true })
    .decode(bytes)
    .replace(/\0$/u, "")
}
