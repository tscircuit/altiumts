import { expect, test } from "bun:test"
import {
  AltiumSchComponentRecord,
  AltiumSchImplementationListRecord,
  AltiumSchImplementationMapRecord,
  AltiumSchImplementationRecord,
  AltiumUnknownRecord,
  parseAltiumSchDoc,
} from "../lib"
import { readReferenceBytes } from "./svg/read-reference"

test("reproduces untyped Record 47 pin-to-pad mapping in the DSP/FPGA schematic", async () => {
  const source = await readReferenceBytes("altium-dsp-fpga-power.SchDoc")
  const document = parseAltiumSchDoc(source)
  const mapDefiners = document.getRecordsByKind("47")

  expect(mapDefiners).toHaveLength(1)
  const mapDefiner = mapDefiners[0]
  if (!mapDefiner) throw new Error("Expected the fixture's Record 47")

  // Capture the current missing typed support. Update this expectation when
  // Record 47 receives its dedicated class. Direct assertions cover this
  // non-visual mapping metadata that a schematic SVG would not show.
  expect(mapDefiner).toBeInstanceOf(AltiumUnknownRecord)

  const implementationMap = document.getParent(mapDefiner)
  if (!implementationMap) throw new Error("Expected Record 46 parent")
  const implementation = document.getParent(implementationMap)
  if (!implementation) throw new Error("Expected Record 45 parent")
  const implementationList = document.getParent(implementation)
  if (!implementationList) throw new Error("Expected Record 44 parent")
  const component = document.getParent(implementationList)
  if (!component) throw new Error("Expected the owning schematic component")

  expect(implementationMap).toBeInstanceOf(AltiumSchImplementationMapRecord)
  expect(implementation).toBeInstanceOf(AltiumSchImplementationRecord)
  expect(implementationList).toBeInstanceOf(AltiumSchImplementationListRecord)
  expect(component).toBeInstanceOf(AltiumSchComponentRecord)
  expect(document.getOwnedRecords(implementationMap)).toContain(mapDefiner)
  expect(mapDefiner.getDecoded("DESINTF")).toBe("2")
  expect(mapDefiner.getNumber("DESIMPCOUNT")).toBe(1)
  expect(mapDefiner.getDecoded("DESIMP0")).toBe("6")
  expect(implementation.getDecoded("MODELNAME")).toBe("DIP-6")
  expect(implementation.getDecoded("MODELTYPE")).toBe("PCBLIB")
  expect(component.getDecoded("LIBREFERENCE")).toBe("SW-SPST")
  expect(mapDefiner.getString()).toBe(
    "|RECORD=47|OWNERINDEX=5868|DESINTF=2|DESIMPCOUNT=1|DESIMP0=6",
  )

  // Missing semantic typing must not discard the native mapping payload.
  expect(mapDefiner.originalBinaryPayload?.byteLength).toBeGreaterThan(0)
  expect(document.getBytes()).toEqual(source)
})
