import type { AltiumPcbDoc } from "../altium-pcb-doc"
import { AltiumBinaryWriter } from "../binary/altium-binary-io"
import { AltiumSerializationError } from "../errors/altium-error"
import { parseAltiumPcbDoc } from "../parser/parse-altium-pcb-doc"
import {
  type AltiumCompoundFile,
  addAltiumBinarySection,
  addAltiumCompoundStream,
  createAltiumCompoundFile,
  writeAltiumCompoundFile,
} from "./altium-binary-container"
import {
  getAltiumRecordKind,
  getAsciiAltiumSource,
  toAltiumPascalString,
  writeBinaryTypeLengthPrefixedAltiumRecords,
  writeLengthPrefixedAltiumRecords,
} from "./altium-binary-record-encoding"
import {
  PCB_OBJECT_ID,
  serializeAltiumArcRecord,
  serializeAltiumFillRecord,
  serializeAltiumPadRecord,
  serializeAltiumTextRecord,
  serializeAltiumTrackRecord,
  serializeAltiumViaRecord,
  writeAltiumPrimitiveRecords,
  writeAltiumWideStrings,
} from "./serialize-altium-pcb-primitives"
import { serializeAltiumRegionRecord } from "./serialize-altium-pcb-region"
import {
  assertSupportedAltiumPcbPrimitive,
  type SupportedAltiumPcbPrimitiveKind,
} from "./validate-altium-pcb-binary-primitive"

type SupportedAltiumPcbRecordKind =
  | "Arc"
  | "Board"
  | "Component"
  | "Dimension"
  | "Net"
  | "Polygon"
  | SupportedAltiumPcbPrimitiveKind

type AltiumPcbRecordSources = Record<SupportedAltiumPcbRecordKind, string[]>

const EMPTY_PCB_SECTION_NAMES = [
  "Regions6",
  "ComponentBodies6",
  "Classes6",
  "DifferentialPairs6",
  "Connections6",
] as const

/**
 * Encodes the supported subset of an ASCII PCB document into Altium's native
 * OLE/CFB PcbDoc container. Unsupported records and primitive fields throw
 * rather than producing a lossy document.
 */
export function serializeAltiumPcbDocToBinary(
  document: string | AltiumPcbDoc,
): Uint8Array {
  const asciiDocument = getAsciiAltiumSource(document)
  const parsedDocument = parseAltiumPcbDoc(asciiDocument)
  if (parsedDocument.boardGeometry.outline.vertices.length < 3) {
    throw new AltiumSerializationError(
      "Cannot create a binary PcbDoc without a board outline",
    )
  }

  const recordSources = collectSupportedPcbRecordSources(asciiDocument)
  const compoundFile = createAltiumCompoundFile()
  addPcbFileHeaders(compoundFile)

  addAltiumBinarySection({
    compoundFile,
    content: writeLengthPrefixedAltiumRecords(recordSources.Board),
    name: "Board6",
    recordCount: recordSources.Board.length,
  })
  addAltiumBinarySection({
    compoundFile,
    content: writeLengthPrefixedAltiumRecords(recordSources.Net),
    name: "Nets6",
    recordCount: recordSources.Net.length,
  })
  addAltiumBinarySection({
    compoundFile,
    content: writeLengthPrefixedAltiumRecords(recordSources.Component),
    name: "Components6",
    recordCount: recordSources.Component.length,
  })
  addAltiumBinarySection({
    compoundFile,
    content: writeLengthPrefixedAltiumRecords(recordSources.Polygon),
    name: "Polygons6",
    recordCount: recordSources.Polygon.length,
  })
  addAltiumBinarySection({
    compoundFile,
    content: writeBinaryTypeLengthPrefixedAltiumRecords(
      recordSources.Dimension,
    ),
    name: "Dimensions6",
    recordCount: recordSources.Dimension.length,
  })
  addAltiumBinarySection({
    compoundFile,
    content: writeAltiumPrimitiveRecords(
      PCB_OBJECT_ID.pad,
      recordSources.Pad.map(serializeAltiumPadRecord),
    ),
    name: "Pads6",
    recordCount: recordSources.Pad.length,
  })
  addAltiumBinarySection({
    compoundFile,
    content: writeAltiumPrimitiveRecords(
      PCB_OBJECT_ID.via,
      recordSources.Via.map(serializeAltiumViaRecord),
    ),
    name: "Vias6",
    recordCount: recordSources.Via.length,
  })
  addAltiumBinarySection({
    compoundFile,
    content: writeAltiumPrimitiveRecords(
      PCB_OBJECT_ID.track,
      recordSources.Track.map(serializeAltiumTrackRecord),
    ),
    name: "Tracks6",
    recordCount: recordSources.Track.length,
  })
  addAltiumBinarySection({
    compoundFile,
    content: writeAltiumPrimitiveRecords(
      PCB_OBJECT_ID.arc,
      recordSources.Arc.map(serializeAltiumArcRecord),
    ),
    name: "Arcs6",
    recordCount: recordSources.Arc.length,
  })
  addAltiumBinarySection({
    compoundFile,
    content: writeAltiumPrimitiveRecords(
      PCB_OBJECT_ID.fill,
      recordSources.Fill.map(serializeAltiumFillRecord),
    ),
    name: "Fills6",
    recordCount: recordSources.Fill.length,
  })
  addAltiumBinarySection({
    compoundFile,
    content: writeAltiumPrimitiveRecords(
      PCB_OBJECT_ID.region,
      recordSources.Region.map(serializeAltiumRegionRecord),
    ),
    name: "ShapeBasedRegions6",
    recordCount: recordSources.Region.length,
  })
  addAltiumBinarySection({
    compoundFile,
    content: writeAltiumPrimitiveRecords(
      PCB_OBJECT_ID.text,
      recordSources.Text.map(serializeAltiumTextRecord),
    ),
    name: "Texts6",
    recordCount: recordSources.Text.length,
  })
  addAltiumBinarySection({
    compoundFile,
    content: writeAltiumWideStrings(recordSources.Text),
    name: "WideStrings6",
    recordCount: recordSources.Text.length,
  })

  for (const name of EMPTY_PCB_SECTION_NAMES) {
    addAltiumBinarySection({
      compoundFile,
      content: new Uint8Array(),
      name,
      recordCount: 0,
    })
  }

  return writeAltiumCompoundFile(compoundFile)
}

function collectSupportedPcbRecordSources(
  asciiDocument: string,
): AltiumPcbRecordSources {
  const recordSources: AltiumPcbRecordSources = {
    Arc: [],
    Board: [],
    Component: [],
    Dimension: [],
    Fill: [],
    Net: [],
    Pad: [],
    Polygon: [],
    Region: [],
    Text: [],
    Track: [],
    Via: [],
  }
  for (const recordSource of asciiDocument.split(/\r?\n|\r/u).filter(Boolean)) {
    const recordKind = getAltiumRecordKind(recordSource)
    if (!isSupportedAltiumPcbRecordKind(recordKind)) {
      throw new AltiumSerializationError(
        `Unsupported PCB record kind for binary serialization: ${JSON.stringify(recordKind || "missing RECORD")}`,
      )
    }
    if (isSupportedAltiumPcbPrimitiveKind(recordKind)) {
      assertSupportedAltiumPcbPrimitive(recordSource, recordKind)
    }
    recordSources[recordKind].push(recordSource)
  }
  return recordSources
}

function isSupportedAltiumPcbRecordKind(
  recordKind: string,
): recordKind is SupportedAltiumPcbRecordKind {
  return [
    "Arc",
    "Board",
    "Component",
    "Dimension",
    "Fill",
    "Net",
    "Pad",
    "Polygon",
    "Region",
    "Text",
    "Track",
    "Via",
  ].includes(recordKind)
}

function isSupportedAltiumPcbPrimitiveKind(
  recordKind: SupportedAltiumPcbRecordKind,
): recordKind is SupportedAltiumPcbPrimitiveKind {
  return ["Arc", "Fill", "Pad", "Region", "Text", "Track", "Via"].includes(
    recordKind,
  )
}

function addPcbFileHeaders(compoundFile: AltiumCompoundFile): void {
  const legacyHeader = new AltiumBinaryWriter().uint32(
    "PCB 5.0 Binary File".length,
  )
  for (const character of "PCB 5.0 Bi") {
    legacyHeader.uint16(character.charCodeAt(0))
  }
  addAltiumCompoundStream({
    compoundFile,
    content: legacyHeader.toUint8Array(),
    path: "/FileHeader",
  })

  const version = "PCB 6.0 Binary File"
  const currentHeader = new AltiumBinaryWriter()
    .uint32(version.length)
    .writeBytes(toAltiumPascalString(version))
    .float64(5.01)
  addAltiumCompoundStream({
    compoundFile,
    content: currentHeader.toUint8Array(),
    path: "/FileHeaderSix",
  })
}
