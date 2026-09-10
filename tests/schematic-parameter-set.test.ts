import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import {
  AltiumSchDifferentialPairRecord,
  AltiumSchDoc,
  AltiumSchParameterSetRecord,
  parseAltiumAscii,
  parseAltiumFile,
  serializeAltiumSheetToSvg,
} from "../lib"

describe("AltiumSchParameterSetRecord (RECORD=43)", () => {
  test("parses differential pair directives in stm32-st-link-v2.SchDoc", async () => {
    const filePath = resolve(
      import.meta.dir,
      "../references/stm32-st-link-v2.SchDoc",
    )
    const bytes = new Uint8Array(await readFile(filePath))
    const { document } = parseAltiumFile(bytes)

    expect(document).toBeInstanceOf(AltiumSchDoc)
    const schDoc = document as AltiumSchDoc

    expect(schDoc.parameterSets).toHaveLength(2)
    expect(schDoc.differentialPairs).toHaveLength(2)

    const [first, second] = schDoc.parameterSets
    expect(first).toBeInstanceOf(AltiumSchParameterSetRecord)
    expect(first).toBeInstanceOf(AltiumSchDifferentialPairRecord)
    expect(first?.type).toBe("schematic-parameter-set-record")
    expect(first?.recordKind).toBe("43")
    expect(first?.name).toBe("DIFFPAIR")
    expect(first?.isDifferentialPair).toBe(true)
    expect(first?.color).toBe(255)
    expect(first?.position).toEqual({ x: 670, y: 670 })
    expect(first?.uniqueId).toBe("CHJMHWXK")
    expect(first?.ownerPartId).toBe(-1)
    expect(first?.indexInSheet).toBe(177)

    expect(second).toBeInstanceOf(AltiumSchParameterSetRecord)
    expect(second?.name).toBe("DIFFPAIR")
    expect(second?.isDifferentialPair).toBe(true)
    expect(second?.color).toBe(255)
    expect(second?.position).toEqual({ x: 670, y: 660 })
    expect(second?.uniqueId).toBe("IEPVGKDF")
    expect(second?.indexInSheet).toBe(178)
  })

  test("parses parameter set directive in pidp11-io-expander.SchDoc", async () => {
    const filePath = resolve(
      import.meta.dir,
      "fixtures/pidp11-io-expander.SchDoc",
    )
    const bytes = new Uint8Array(await readFile(filePath))
    const { document } = parseAltiumFile(bytes)

    expect(document).toBeInstanceOf(AltiumSchDoc)
    const schDoc = document as AltiumSchDoc

    expect(schDoc.parameterSets).toHaveLength(1)
    expect(schDoc.differentialPairs).toHaveLength(0)

    const parameterSet = schDoc.parameterSets[0]
    expect(parameterSet).toBeInstanceOf(AltiumSchParameterSetRecord)
    expect(parameterSet?.name).toBe("1A")
    expect(parameterSet?.isDifferentialPair).toBe(false)
    expect(parameterSet?.color).toBe(255)
    expect(parameterSet?.position).toEqual({ x: 140, y: 590 })
    expect(parameterSet?.uniqueId).toBe("GRBYJXVH")
    expect(parameterSet?.indexInSheet).toBe(134)
  })

  test("parses and round-trips an ASCII parameter set / differential pair record", () => {
    const source =
      "|RECORD=43|INDEXINSHEET=1|OWNERPARTID=-1|LOCATION.X=100|LOCATION.Y=200|COLOR=255|NAME=DIFFPAIR|UNIQUEID=ABCDEF"
    const lines = parseAltiumAscii(source)
    expect(lines).toHaveLength(1)

    const record = lines[0]
    expect(record).toBeInstanceOf(AltiumSchParameterSetRecord)
    expect(record).toBeInstanceOf(AltiumSchDifferentialPairRecord)

    const paramSet = record as AltiumSchParameterSetRecord
    expect(paramSet.name).toBe("DIFFPAIR")
    expect(paramSet.isDifferentialPair).toBe(true)
    expect(paramSet.color).toBe(255)
    expect(paramSet.position).toEqual({ x: 100, y: 200 })
    expect(paramSet.uniqueId).toBe("ABCDEF")
    expect(paramSet.ownerPartId).toBe(-1)
    expect(paramSet.indexInSheet).toBe(1)
    expect(paramSet.getString()).toBe(source)
  })

  test("renders differential pair directive into SVG", () => {
    const source =
      "|RECORD=43|INDEXINSHEET=1|OWNERPARTID=-1|LOCATION.X=100|LOCATION.Y=200|COLOR=255|NAME=DIFFPAIR|UNIQUEID=ABCDEF"
    const lines = parseAltiumAscii(source)
    const svg = serializeAltiumSheetToSvg(lines)
    expect(svg).toContain('data-record="43"')
    expect(svg).toContain("DIFFPAIR")
  })
})
