import { expect, test } from "bun:test"
import { parseAltiumBinaryPcbDoc } from "../lib"
import { readReferenceBytes } from "./svg/read-reference"

test("captures the opaque Connections6 parser error", async () => {
  const source = await readReferenceBytes("dsp5509-ciii.PcbDoc")

  expect(() => parseAltiumBinaryPcbDoc(source)).toThrow(
    'Connection property record at offset 0 does not begin with "|"',
  )
})
