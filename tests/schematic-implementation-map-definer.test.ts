import { describe, expect, test } from "bun:test"
import {
  AltiumField,
  AltiumSchDoc,
  AltiumSchImplementationMapDefinerRecord,
  AltiumSchImplementationMapRecord,
  AltiumSchImplementationRecord,
  AltiumSchMapDefinerRecord,
  parseAltiumFile,
  parseAltiumSchDoc,
} from "../lib"
import { readReferenceBytes } from "./svg/read-reference"

describe("AltiumSchImplementationMapDefinerRecord (Record 47)", () => {
  test("parses Record 47 from reference altium-dsp-fpga-power.SchDoc", async () => {
    const bytes = await readReferenceBytes("altium-dsp-fpga-power.SchDoc")
    const { document } = parseAltiumFile(bytes)
    expect(document).toBeInstanceOf(AltiumSchDoc)

    const doc = document as AltiumSchDoc
    const records47 = doc.getRecordsByKind("47")
    expect(records47).toHaveLength(1)

    const mapDefiner = records47[0]
    expect(mapDefiner).toBeInstanceOf(AltiumSchImplementationMapDefinerRecord)
    expect(mapDefiner).toBeInstanceOf(AltiumSchMapDefinerRecord)
    if (!(mapDefiner instanceof AltiumSchImplementationMapDefinerRecord)) {
      throw new Error("Expected AltiumSchImplementationMapDefinerRecord")
    }
    expect(mapDefiner.type).toBe("schematic-implementation-map-definer-record")

    expect(mapDefiner.designatorInterface).toBe("2")
    expect(mapDefiner.implementationCount).toBe(1)
    expect(mapDefiner.implementationDesignator).toBe("6")
    expect(mapDefiner.implementationDesignators).toEqual(["6"])
    expect(mapDefiner.getImplementationDesignator(0)).toBe("6")
    expect(mapDefiner.getImplementationDesignator(1)).toBeUndefined()
    expect(mapDefiner.ownerIndex).toBe(5868)

    // Verify ownership hierarchy: Record 47 is owned by Record 46 (ImplementationMap),
    // which is owned by Record 45 (Implementation).
    const parent = doc.getParent(mapDefiner)
    expect(parent).toBeInstanceOf(AltiumSchImplementationMapRecord)
    expect(parent?.recordKind).toBe("46")

    if (parent) {
      const grandparent = doc.getParent(parent)
      expect(grandparent).toBeInstanceOf(AltiumSchImplementationRecord)
      expect(grandparent?.recordKind).toBe("45")
      expect((grandparent as AltiumSchImplementationRecord).modelName).toBe(
        "DIP-6",
      )
    }
  })

  test("parses multi-pin implementation map definer record", () => {
    const source =
      "|HEADER=Schematic Capture\r\n" +
      "|RECORD=47|OWNERINDEX=12|DESINTF=CLK|DESIMPCOUNT=2|DESIMP0=A1|DESIMP1=A2\r\n"
    const doc = parseAltiumSchDoc(source)

    expect(doc.records).toHaveLength(1)
    const record = doc.records[0] as AltiumSchImplementationMapDefinerRecord

    expect(record).toBeInstanceOf(AltiumSchImplementationMapDefinerRecord)
    expect(record.designatorInterface).toBe("CLK")
    expect(record.implementationCount).toBe(2)
    expect(record.implementationDesignator).toBe("A1")
    expect(record.implementationDesignators).toEqual(["A1", "A2"])
    expect(record.getImplementationDesignator(0)).toBe("A1")
    expect(record.getImplementationDesignator(1)).toBe("A2")
    expect(record.getImplementationDesignator(2)).toBeUndefined()
    expect(record.ownerIndex).toBe(12)
    expect(doc.getString()).toBe(source)
  })

  test("handles empty or default fields gracefully", () => {
    const record = new AltiumSchImplementationMapDefinerRecord({
      items: [new AltiumField({ key: "RECORD", value: "47" })],
    })

    expect(record.type).toBe("schematic-implementation-map-definer-record")
    expect(record.designatorInterface).toBeUndefined()
    expect(record.implementationCount).toBeUndefined()
    expect(record.implementationDesignator).toBeUndefined()
    expect(record.implementationDesignators).toEqual([])
    expect(record.getImplementationDesignator(0)).toBeUndefined()
  })
})
