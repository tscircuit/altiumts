import { expect, test } from "bun:test"
import {
  AltiumBinaryPcbDoc,
  detectAltiumFile,
  parseAltiumFile,
  validateAltiumDocument,
} from "../lib"
import { TI_POWER_REFERENCE_PCB_FILENAMES } from "../scripts/references/ti-power-references"
import { readReferenceBytes } from "./svg/read-reference"

const references = [
  {
    filename: TI_POWER_REFERENCE_PCB_FILENAMES.pmp22650,
    counts: {
      records: 35746,
      components: 633,
      nets: 410,
      tracks: 20024,
      pads: 2503,
      vias: 1993,
      regions: 698,
    },
    bounds: { minX: 691.9998, minY: 1533.9999, maxX: 12003, maxY: 6766.9998 },
    vertices: 5,
  },
  {
    filename: TI_POWER_REFERENCE_PCB_FILENAMES.pmp22712,
    counts: {
      records: 2132,
      components: 30,
      nets: 23,
      tracks: 1210,
      pads: 81,
      vias: 8,
      regions: 38,
    },
    bounds: {
      minX: 691.9997,
      minY: 1484.7869,
      maxX: 2001.0552,
      maxY: 2557.6223,
    },
    vertices: 5,
  },
  {
    filename: TI_POWER_REFERENCE_PCB_FILENAMES.pmp22773,
    counts: {
      records: 2595,
      components: 34,
      nets: 28,
      tracks: 1548,
      pads: 106,
      vias: 30,
      regions: 37,
    },
    bounds: { minX: 692, minY: 1534, maxX: 1947, maxY: 2862.7402 },
    vertices: 5,
  },
  {
    filename: TI_POWER_REFERENCE_PCB_FILENAMES.pmp23595,
    counts: {
      records: 9486,
      components: 236,
      nets: 76,
      tracks: 4680,
      pads: 570,
      vias: 735,
      regions: 178,
    },
    bounds: { minX: 792, minY: 1438, maxX: 5592, maxY: 4538 },
    vertices: 5,
  },
  {
    filename: TI_POWER_REFERENCE_PCB_FILENAMES.pmp23653Main,
    counts: {
      records: 4303,
      components: 89,
      nets: 44,
      tracks: 2055,
      pads: 290,
      vias: 82,
      regions: 101,
    },
    bounds: { minX: 692, minY: 1534, maxX: 3054.2047, maxY: 2321.4016 },
    vertices: 9,
  },
  {
    filename: TI_POWER_REFERENCE_PCB_FILENAMES.pmp23653PlanarTransformer,
    counts: {
      records: 1722,
      components: 6,
      nets: 2,
      tracks: 925,
      pads: 18,
      vias: 29,
      regions: 75,
    },
    bounds: {
      minX: 690.0165,
      minY: 1516.2685,
      maxX: 1886.8969,
      maxY: 2339.1331,
    },
    vertices: 20,
  },
]

for (const { filename, counts, bounds, vertices } of references) {
  test(`parses and losslessly round-trips ${filename}`, async () => {
    const source = await readReferenceBytes(filename)
    expect(detectAltiumFile(source)).toMatchObject({
      confidence: 1,
      container: "cfb",
      documentKind: "pcb-document",
      encoding: "binary",
    })
    const { document } = parseAltiumFile(source)
    expect(document).toBeInstanceOf(AltiumBinaryPcbDoc)
    if (!(document instanceof AltiumBinaryPcbDoc)) {
      throw new Error(`Expected ${filename} to contain a binary PCB document`)
    }

    expect(document.records).toHaveLength(counts.records)
    expect(document.components).toHaveLength(counts.components)
    expect(document.nets).toHaveLength(counts.nets)
    expect(document.tracks).toHaveLength(counts.tracks)
    expect(document.pads).toHaveLength(counts.pads)
    expect(document.vias).toHaveLength(counts.vias)
    expect(document.regions).toHaveLength(counts.regions)
    expect(document.boardGeometry.outline.bounds).toEqual(bounds)
    expect(document.boardGeometry.outline.vertices).toHaveLength(vertices)
    expect(document.boardGeometry.outline.isExplicitlyClosed).toBe(true)

    const validation = validateAltiumDocument(document, { profile: "strict" })
    if (filename === TI_POWER_REFERENCE_PCB_FILENAMES.pmp22650) {
      // The original PMP22650 file contains two negative-sized pads. Preserve
      // these source diagnostics instead of silently accepting new errors.
      expect(validation.summary).toEqual({ errors: 2, fatals: 0, warnings: 0 })
      expect(validation.issues).toMatchObject([
        {
          code: "PCB_PAD_SIZE_INVALID",
          severity: "error",
          location: { recordIndex: 26, streamPath: "/Pads6/Data" },
        },
        {
          code: "PCB_PAD_SIZE_INVALID",
          severity: "error",
          location: { recordIndex: 27, streamPath: "/Pads6/Data" },
        },
      ])
      expect(validation.valid).toBe(false)
    } else {
      expect(validation).toEqual({
        issues: [],
        profile: "strict",
        summary: { errors: 0, fatals: 0, warnings: 0 },
        valid: true,
      })
    }
    expect(document.getBytes()).toEqual(source)
  }, 45_000)
}
