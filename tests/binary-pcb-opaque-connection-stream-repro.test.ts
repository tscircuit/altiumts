import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc } from "../lib"
import { readReferenceBytes } from "./svg/read-reference"

test("reproduces opaque Connections6 records preventing a binary PCB from parsing", async () => {
  const source = await readReferenceBytes("dsp5509-ciii.PcbDoc")

  expect(() => parseAltiumBinaryPcbDoc(source)).not.toThrow()
})
