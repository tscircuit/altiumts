import { Unzlib, zlibSync } from "fflate"
import type { AltiumCompoundStream } from "./compound-file/altium-compound-file"
import {
  AltiumCorruptContainerError,
  AltiumSerializationError,
} from "./errors/altium-error"
import type { AltiumSchImageRecord } from "./records/altium-schematic-records"
import {
  concatAltiumBinaryBytes,
  uint32AltiumBytes,
} from "./serialization/altium-binary-container"
import { toAltiumBinaryRecordBytes } from "./serialization/altium-binary-record-encoding"

export interface DecodeAltiumSchematicImageOptions {
  maximumBitmapSize?: number
  maximumMetafileSize?: number
  maximumNativeImageSize?: number
  maximumOutputSize?: number
}

export interface AltiumSchematicImagePayload {
  bitmapBytes: Uint8Array
  enhancedMetafileBytes?: Uint8Array
  nativePngBytes?: Uint8Array
}

export interface AltiumSchematicImageStorageEntry {
  compressedBytes: Uint8Array
  name: string
}

export interface AltiumSchematicPngStorageInput {
  name: string
  pngBytes: Uint8Array
}

export class AltiumEmbeddedSchematicImage {
  readonly index: number
  readonly name: string
  readonly record: AltiumSchImageRecord
  readonly storage: AltiumCompoundStream
  private readonly compressedBytes: Uint8Array
  private decodedPayload?: AltiumSchematicImagePayload

  constructor(init: {
    compressedBytes: Uint8Array
    index: number
    name: string
    record: AltiumSchImageRecord
    storage: AltiumCompoundStream
  }) {
    this.compressedBytes = init.compressedBytes
    this.index = init.index
    this.name = init.name
    this.record = init.record
    this.storage = init.storage
  }

  get compressedSize(): number {
    return this.compressedBytes.byteLength
  }

  getCompressedBytes(): Uint8Array {
    return this.compressedBytes.slice()
  }

  getBitmapBytes(options: DecodeAltiumSchematicImageOptions = {}): Uint8Array {
    return this.getPayload(options).bitmapBytes.slice()
  }

  getEnhancedMetafileBytes(
    options: DecodeAltiumSchematicImageOptions = {},
  ): Uint8Array | undefined {
    return this.getPayload(options).enhancedMetafileBytes?.slice()
  }

  getNativePngBytes(
    options: DecodeAltiumSchematicImageOptions = {},
  ): Uint8Array | undefined {
    return this.getPayload(options).nativePngBytes?.slice()
  }

  getDataUrl(options: DecodeAltiumSchematicImageOptions = {}): string {
    return `data:image/png;base64,${encodeBase64(this.getPngBytes(options))}`
  }

  getPngBytes(options: DecodeAltiumSchematicImageOptions = {}): Uint8Array {
    const payload = this.getPayload(options)
    return (
      payload.nativePngBytes?.slice() ??
      encodeWindowsBitmapAsPng(payload.bitmapBytes)
    )
  }

  private getPayload(
    options: DecodeAltiumSchematicImageOptions,
  ): AltiumSchematicImagePayload {
    if (Object.keys(options).length > 0) {
      return decodeAltiumSchematicImagePayload(this.compressedBytes, options)
    }
    this.decodedPayload ??= decodeAltiumSchematicImagePayload(
      this.compressedBytes,
    )
    return this.decodedPayload
  }
}

export function parseAltiumEmbeddedSchematicImages(
  storage: AltiumCompoundStream | undefined,
  records: AltiumSchImageRecord[],
): AltiumEmbeddedSchematicImage[] {
  if (!storage || records.length === 0) return []
  const entries = parseSchematicImageStorage(storage.content)
  const unusedEntries = new Set(entries)

  return records.flatMap((record, index) => {
    const normalizedFileName = normalizeImageName(record.fileName)
    const entry = entries.find(
      (candidate) =>
        unusedEntries.has(candidate) &&
        normalizeImageName(candidate.name) === normalizedFileName,
    )
    if (!entry) return []
    unusedEntries.delete(entry)
    return [
      new AltiumEmbeddedSchematicImage({
        compressedBytes: entry.compressedBytes,
        index,
        name: entry.name,
        record,
        storage,
      }),
    ]
  })
}

export function parseSchematicImageStorage(
  bytes: Uint8Array,
): AltiumSchematicImageStorageEntry[] {
  if (bytes.byteLength < 4) {
    throw new AltiumCorruptContainerError(
      "Schematic image storage header is truncated",
    )
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const headerLength = view.getUint32(0, true)
  let offset = 4 + headerLength
  if (offset > bytes.byteLength) {
    throw new AltiumCorruptContainerError(
      "Schematic image storage header exceeds the stream",
    )
  }

  const entries: AltiumSchematicImageStorageEntry[] = []
  while (offset < bytes.byteLength) {
    if (offset + 4 > bytes.byteLength) {
      throw new AltiumCorruptContainerError(
        "Schematic image storage frame length is truncated",
      )
    }
    const frameLength = view.getUint32(offset, true) & 0x00ff_ffff
    const payloadOffset = offset + 4
    const frameEnd = payloadOffset + frameLength
    if (frameLength === 0 || frameEnd > bytes.byteLength) {
      throw new AltiumCorruptContainerError(
        `Invalid schematic image storage frame length ${frameLength}`,
      )
    }
    if (payloadOffset + 2 > frameEnd || bytes[payloadOffset] !== 0xd0) {
      throw new AltiumCorruptContainerError(
        "Schematic image storage entry header is invalid",
      )
    }

    const nameLength = bytes[payloadOffset + 1] ?? 0
    const nameOffset = payloadOffset + 2
    const sizeOffset = nameOffset + nameLength
    if (sizeOffset + 4 > frameEnd) {
      throw new AltiumCorruptContainerError(
        "Schematic image storage entry name is truncated",
      )
    }
    const compressedLength = view.getUint32(sizeOffset, true)
    const compressedOffset = sizeOffset + 4
    const compressedEnd = compressedOffset + compressedLength
    if (compressedEnd > frameEnd) {
      throw new AltiumCorruptContainerError(
        "Schematic image storage compressed payload is truncated",
      )
    }
    entries.push({
      compressedBytes: bytes.subarray(compressedOffset, compressedEnd),
      name: new TextDecoder("windows-1252").decode(
        bytes.subarray(nameOffset, sizeOffset),
      ),
    })
    offset = frameEnd
  }
  return entries
}

/** Encodes PNG images into the `/Storage` stream used by binary SchDoc files. */
export function encodeAltiumSchematicImageStorage({
  images,
}: {
  images: readonly AltiumSchematicPngStorageInput[]
}): Uint8Array {
  const header = toAltiumBinaryRecordBytes("|HEADER=Icon storage")
  return concatAltiumBinaryBytes([
    uint32AltiumBytes(header.byteLength),
    header,
    ...images.map(encodeAltiumSchematicImageStorageFrame),
  ])
}

function encodeAltiumSchematicImageStorageFrame(
  image: AltiumSchematicPngStorageInput,
): Uint8Array {
  const nameBytes = encodeSchematicImageName(image.name)
  const nativePngBytes = extractPng(image.pngBytes, 32 * 1024 * 1024)
  if (!nativePngBytes) {
    throw new AltiumSerializationError(
      `Embedded schematic image ${JSON.stringify(image.name)} is not a complete PNG`,
    )
  }

  const nativeClassName = new TextEncoder().encode("TdxPNGImage")
  const uncompressedPayload = concatAltiumBinaryBytes([
    createTransparentBitmapPreview(),
    Uint8Array.of(nativeClassName.byteLength),
    nativeClassName,
    nativePngBytes,
  ])
  const compressedPayload = zlibSync(uncompressedPayload, { level: 6 })
  const framePayload = concatAltiumBinaryBytes([
    Uint8Array.of(0xd0, nameBytes.byteLength),
    nameBytes,
    uint32AltiumBytes(compressedPayload.byteLength),
    compressedPayload,
  ])
  if (framePayload.byteLength > 0x00ff_ffff) {
    throw new AltiumSerializationError(
      `Embedded schematic image ${JSON.stringify(image.name)} exceeds the Altium storage frame limit`,
    )
  }
  return concatAltiumBinaryBytes([
    uint32AltiumBytes(framePayload.byteLength),
    framePayload,
  ])
}

function encodeSchematicImageName(name: string): Uint8Array {
  if (name.length === 0 || /[^\x20-\x7e]/u.test(name)) {
    throw new AltiumSerializationError(
      "Embedded schematic image names must contain printable ASCII characters",
    )
  }
  const nameBytes = new TextEncoder().encode(name)
  if (nameBytes.byteLength > 255) {
    throw new AltiumSerializationError(
      "Embedded schematic image names must be at most 255 bytes",
    )
  }
  return nameBytes
}

function createTransparentBitmapPreview(): Uint8Array {
  const bitmap = new Uint8Array(58)
  const view = new DataView(bitmap.buffer)
  bitmap[0] = 0x42
  bitmap[1] = 0x4d
  view.setUint32(2, bitmap.byteLength, true)
  view.setUint32(10, 54, true)
  view.setUint32(14, 40, true)
  view.setInt32(18, 1, true)
  view.setInt32(22, -1, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, 32, true)
  view.setUint32(34, 4, true)
  return bitmap
}

export function decodeAltiumSchematicBitmap(
  compressedBytes: Uint8Array,
  options: DecodeAltiumSchematicImageOptions = {},
): Uint8Array {
  return decodeAltiumSchematicImagePayload(compressedBytes, options).bitmapBytes
}

export function decodeAltiumSchematicImagePayload(
  compressedBytes: Uint8Array,
  options: DecodeAltiumSchematicImageOptions = {},
): AltiumSchematicImagePayload {
  const maximumBitmapSize = options.maximumBitmapSize ?? 32 * 1024 * 1024
  const maximumMetafileSize = options.maximumMetafileSize ?? 32 * 1024 * 1024
  const maximumNativeImageSize =
    options.maximumNativeImageSize ?? 32 * 1024 * 1024
  const maximumOutputSize = options.maximumOutputSize ?? 64 * 1024 * 1024
  for (const [name, value] of [
    ["maximumBitmapSize", maximumBitmapSize],
    ["maximumMetafileSize", maximumMetafileSize],
    ["maximumNativeImageSize", maximumNativeImageSize],
    ["maximumOutputSize", maximumOutputSize],
  ] as const) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new RangeError(`${name} must be a positive safe integer`)
    }
  }

  let outputLength = 0
  const inflatedChunks: Uint8Array[] = []

  try {
    const inflater = new Unzlib((chunk) => {
      outputLength += chunk.byteLength
      if (outputLength > maximumOutputSize) {
        throw new AltiumCorruptContainerError(
          `Schematic image expands beyond the ${maximumOutputSize}-byte limit`,
        )
      }
      inflatedChunks.push(chunk.slice())
    })
    const inputChunkSize = 64 * 1024
    for (let offset = 0; offset < compressedBytes.byteLength; ) {
      const end = Math.min(offset + inputChunkSize, compressedBytes.byteLength)
      inflater.push(
        compressedBytes.subarray(offset, end),
        end === compressedBytes.byteLength,
      )
      offset = end
    }
  } catch (error) {
    if (error instanceof AltiumCorruptContainerError) throw error
    throw new AltiumCorruptContainerError(
      `Schematic image zlib decompression failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  const inflated = concatenateBytes(inflatedChunks)
  if (inflated.byteLength < 6 || inflated[0] !== 0x42 || inflated[1] !== 0x4d) {
    throw new AltiumCorruptContainerError(
      "Embedded schematic image is not a Windows bitmap",
    )
  }
  const inflatedView = new DataView(
    inflated.buffer,
    inflated.byteOffset,
    inflated.byteLength,
  )
  const bitmapLength = inflatedView.getUint32(2, true)
  if (bitmapLength < 14 || bitmapLength > maximumBitmapSize) {
    throw new AltiumCorruptContainerError(
      `Embedded schematic bitmap declares invalid size ${bitmapLength}`,
    )
  }
  if (bitmapLength > inflated.byteLength) {
    throw new AltiumCorruptContainerError(
      "Embedded schematic bitmap payload is truncated",
    )
  }

  const nativePayload = extractNativeImage(
    inflated,
    bitmapLength,
    maximumMetafileSize,
    maximumNativeImageSize,
  )
  return {
    bitmapBytes: inflated.slice(0, bitmapLength),
    ...nativePayload,
  }
}

function extractNativeImage(
  payload: Uint8Array,
  bitmapLength: number,
  maximumMetafileSize: number,
  maximumNativeImageSize: number,
): Pick<
  AltiumSchematicImagePayload,
  "enhancedMetafileBytes" | "nativePngBytes"
> {
  if (bitmapLength >= payload.byteLength) return {}
  const classNameLength = payload[bitmapLength] ?? 0
  const classNameOffset = bitmapLength + 1
  const nativeImageOffset = classNameOffset + classNameLength
  if (nativeImageOffset > payload.byteLength) return {}
  const className = new TextDecoder("windows-1252").decode(
    payload.subarray(classNameOffset, nativeImageOffset),
  )
  if (className === "TdxPNGImage") {
    const pngBytes = extractPng(
      payload.subarray(nativeImageOffset),
      maximumNativeImageSize,
    )
    if (!pngBytes) return {}
    return { nativePngBytes: pngBytes }
  }
  if (
    className !== "TMetafile" ||
    nativeImageOffset + 88 > payload.byteLength
  ) {
    return {}
  }

  const view = new DataView(
    payload.buffer,
    payload.byteOffset + nativeImageOffset,
    payload.byteLength - nativeImageOffset,
  )
  const recordType = view.getUint32(0, true)
  const headerSize = view.getUint32(4, true)
  const signature = view.getUint32(40, true)
  const metafileLength = view.getUint32(48, true)
  if (
    recordType !== 1 ||
    ![88, 100, 108].includes(headerSize) ||
    signature !== 0x464d_4520 ||
    metafileLength < headerSize ||
    metafileLength % 4 !== 0 ||
    metafileLength > maximumMetafileSize ||
    nativeImageOffset + metafileLength > payload.byteLength
  ) {
    return {}
  }
  const metafileBytes = payload.slice(
    nativeImageOffset,
    nativeImageOffset + metafileLength,
  )
  if (!isCompleteEnhancedMetafile(metafileBytes, headerSize)) return {}
  return { enhancedMetafileBytes: metafileBytes }
}

function isCompleteEnhancedMetafile(
  bytes: Uint8Array,
  headerSize: number,
): boolean {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = headerSize
  while (offset + 8 <= bytes.byteLength) {
    const type = view.getUint32(offset, true)
    const size = view.getUint32(offset + 4, true)
    const end = offset + size
    if (size < 8 || size % 4 !== 0 || end <= offset || end > bytes.byteLength) {
      return false
    }
    if (type === 14) return size >= 20 && end === bytes.byteLength
    offset = end
  }
  return false
}

function extractPng(
  bytes: Uint8Array,
  maximumNativeImageSize: number,
): Uint8Array | undefined {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10]
  if (
    bytes.byteLength < 20 ||
    bytes.byteLength > maximumNativeImageSize ||
    !signature.every((byte, index) => bytes[index] === byte)
  ) {
    return undefined
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = signature.length
  let sawHeader = false
  while (offset + 12 <= bytes.byteLength) {
    const dataLength = view.getUint32(offset)
    const chunkEnd = offset + 12 + dataLength
    if (
      dataLength > maximumNativeImageSize ||
      chunkEnd > bytes.byteLength ||
      chunkEnd > maximumNativeImageSize
    ) {
      return undefined
    }
    const chunkType = new TextDecoder().decode(
      bytes.subarray(offset + 4, offset + 8),
    )
    if (!sawHeader) {
      if (chunkType !== "IHDR" || dataLength !== 13) return undefined
      sawHeader = true
    }
    if (chunkType === "IEND") {
      if (dataLength !== 0) return undefined
      return bytes.slice(0, chunkEnd)
    }
    offset = chunkEnd
  }
  return undefined
}

export function encodeWindowsBitmapAsPng(bitmap: Uint8Array): Uint8Array {
  if (bitmap.byteLength < 54 || bitmap[0] !== 0x42 || bitmap[1] !== 0x4d) {
    throw new AltiumCorruptContainerError(
      "Embedded schematic image is not a supported Windows bitmap",
    )
  }
  const view = new DataView(bitmap.buffer, bitmap.byteOffset, bitmap.byteLength)
  const pixelOffset = view.getUint32(10, true)
  const dibHeaderSize = view.getUint32(14, true)
  const width = view.getInt32(18, true)
  const signedHeight = view.getInt32(22, true)
  const planes = view.getUint16(26, true)
  const bitsPerPixel = view.getUint16(28, true)
  const compression = view.getUint32(30, true)
  const height = Math.abs(signedHeight)
  if (
    dibHeaderSize < 40 ||
    width <= 0 ||
    height <= 0 ||
    width > 16_384 ||
    height > 16_384 ||
    planes !== 1 ||
    (bitsPerPixel !== 24 && bitsPerPixel !== 32) ||
    compression !== 0
  ) {
    throw new AltiumCorruptContainerError(
      `Unsupported schematic bitmap (${width}x${signedHeight}, ${bitsPerPixel}-bit, compression ${compression})`,
    )
  }

  const bytesPerPixel = bitsPerPixel / 8
  const sourceRowLength = Math.ceil((width * bytesPerPixel) / 4) * 4
  const sourceLength = sourceRowLength * height
  if (
    !Number.isSafeInteger(sourceLength) ||
    pixelOffset < 14 + dibHeaderSize ||
    pixelOffset + sourceLength > bitmap.byteLength
  ) {
    throw new AltiumCorruptContainerError(
      "Embedded schematic bitmap pixel payload is truncated",
    )
  }

  const pngRowLength = 1 + width * 4
  const pixels = new Uint8Array(pngRowLength * height)
  const topDown = signedHeight < 0
  for (let y = 0; y < height; y++) {
    const sourceY = topDown ? y : height - y - 1
    const sourceRow = pixelOffset + sourceY * sourceRowLength
    const targetRow = y * pngRowLength
    pixels[targetRow] = 0
    for (let x = 0; x < width; x++) {
      const source = sourceRow + x * bytesPerPixel
      const target = targetRow + 1 + x * 4
      pixels[target] = bitmap[source + 2] ?? 0
      pixels[target + 1] = bitmap[source + 1] ?? 0
      pixels[target + 2] = bitmap[source] ?? 0
      pixels[target + 3] =
        bitsPerPixel === 32 ? (bitmap[source + 3] ?? 255) : 255
    }
  }

  const ihdr = new Uint8Array(13)
  const ihdrView = new DataView(ihdr.buffer)
  ihdrView.setUint32(0, width)
  ihdrView.setUint32(4, height)
  ihdr[8] = 8
  ihdr[9] = 6
  return concatenateBytes([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    createPngChunk("IHDR", ihdr),
    createPngChunk("IDAT", zlibSync(pixels, { level: 6 })),
    createPngChunk("IEND", new Uint8Array()),
  ])
}

function createPngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type)
  const chunk = new Uint8Array(12 + data.byteLength)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, data.byteLength)
  chunk.set(typeBytes, 4)
  chunk.set(data, 8)
  view.setUint32(
    8 + data.byteLength,
    crc32(chunk.subarray(4, 8 + data.byteLength)),
  )
  return chunk
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffff_ffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0)
    }
  }
  return (crc ^ 0xffff_ffff) >>> 0
}

function concatenateBytes(chunks: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    chunks.reduce((length, chunk) => length + chunk.byteLength, 0),
  )
  let offset = 0
  for (const chunk of chunks) {
    output.set(chunk, offset)
    offset += chunk.byteLength
  }
  return output
}

function normalizeImageName(name: string | undefined): string | undefined {
  return name?.replace(/\\/gu, "/").split("/").at(-1)?.toLowerCase()
}

function encodeBase64(bytes: Uint8Array): string {
  const chunks: string[] = []
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)),
    )
  }
  return btoa(chunks.join(""))
}
