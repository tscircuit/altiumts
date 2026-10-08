import { Unzlib } from "fflate"
import { AltiumNode } from "./base/altium-node"
import { AltiumCorruptContainerError } from "./errors/altium-error"
import type { AltiumSourceLocation } from "./source-location"

/** A font already embedded by the PCB author in EmbeddedFonts6. */
export class AltiumEmbeddedFont extends AltiumNode {
  override readonly type = "embedded-font"
  readonly name: string
  readonly family: string
  readonly style: string
  readonly bold: boolean
  readonly italic: boolean
  private readonly compressedBytes: Uint8Array

  constructor(init: {
    name: string
    family: string
    style: string
    bold: boolean
    italic: boolean
    compressedBytes: Uint8Array
    sourceLocation?: AltiumSourceLocation
  }) {
    super(init)
    this.name = init.name
    this.family = init.family
    this.style = init.style
    this.bold = init.bold
    this.italic = init.italic
    this.compressedBytes = init.compressedBytes.slice()
  }

  getDecompressedBytes(
    maximumOutputSize = 16 * 1024 * 1024,
  ): Uint8Array<ArrayBuffer> {
    if (!Number.isSafeInteger(maximumOutputSize) || maximumOutputSize <= 0) {
      throw new RangeError("maximumOutputSize must be a positive integer")
    }
    if (this.compressedBytes.length === 0) {
      throw new AltiumCorruptContainerError("Empty embedded font data")
    }
    const chunks: Uint8Array[] = []
    let length = 0
    try {
      const inflater = new Unzlib((chunk) => {
        length += chunk.length
        if (length > maximumOutputSize) {
          throw new AltiumCorruptContainerError(
            "Embedded font exceeds output limit",
          )
        }
        chunks.push(chunk)
      })
      for (
        let offset = 0;
        offset < this.compressedBytes.length;
        offset += 4096
      ) {
        const end = Math.min(offset + 4096, this.compressedBytes.length)
        inflater.push(
          this.compressedBytes.subarray(offset, end),
          end === this.compressedBytes.length,
        )
      }
    } catch (cause) {
      throw new AltiumCorruptContainerError("Cannot decompress embedded font", {
        cause,
      })
    }
    const result = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    return result
  }

  override getChildren(): AltiumNode[] {
    return []
  }

  override getString(): string {
    return JSON.stringify({
      name: this.name,
      family: this.family,
      style: this.style,
      bold: this.bold,
      italic: this.italic,
    })
  }
}
