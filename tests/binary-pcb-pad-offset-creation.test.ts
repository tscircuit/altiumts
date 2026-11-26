import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc, serializeAltiumPcbDocToBinary } from "../lib"

for (const holeShape of ["ROUND", "SLOT", "SQUARE"]) {
  test(`writes signed per-layer drill offsets for ${holeShape} holes`, () => {
    const offsets = Array.from(
      { length: 32 },
      (_, ordinal) =>
        `LAYER${ordinal}HOLEXOFFSET=${ordinal - 16}mil|LAYER${ordinal}HOLEYOFFSET=${16 - ordinal}mil`,
    ).join("|")
    const pcb = parseAltiumBinaryPcbDoc(
      serializeAltiumPcbDocToBinary(
        `|RECORD=Board|VERSION=5.0|VX0=0mil|VY0=0mil|VX1=1000mil|VY1=0mil|VX2=1000mil|VY2=1000mil|VX3=0mil|VY3=1000mil\n|RECORD=Pad|LAYER=MULTILAYER|X=100mil|Y=200mil|XSIZE=80mil|YSIZE=100mil|SHAPE=RECTANGLE|HOLESIZE=20mil|HOLEWIDTH=40mil|HOLESHAPE=${holeShape}|HOLEROTATION=30|PLATED=TRUE|${offsets}`,
      ),
    )
    const pad = pcb.getRecordsByKind("Pad")[0]!
    expect(pad.get("HOLESHAPE")).toBe(holeShape)
    for (let ordinal = 0; ordinal < 32; ordinal++) {
      expect(
        pad.getAltiumMeasurement(`LAYER${ordinal}HOLEXOFFSET`)?.toMils(),
      ).toBe(ordinal - 16)
      expect(
        pad.getAltiumMeasurement(`LAYER${ordinal}HOLEYOFFSET`)?.toMils(),
      ).toBe(16 - ordinal)
    }
    expect(pad.getNumber("SLOTROTATION")).toBe(30)
  })
}
