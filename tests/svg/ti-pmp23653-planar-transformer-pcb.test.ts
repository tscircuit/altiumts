import { expect, test } from "bun:test"
import { TI_POWER_REFERENCE_PCB_FILENAMES } from "../../scripts/references/ti-power-references"
import { renderTiPowerReferencePcb } from "./render-ti-power-reference-pcb"

test("renders the TI PMP23653 planar transformer PCB", async () => {
  const svg = await renderTiPowerReferencePcb(
    TI_POWER_REFERENCE_PCB_FILENAMES.pmp23653PlanarTransformer,
    "TI PMP23653 planar transformer PCB",
  )

  expect(svg).toContain('data-record="BoardOutline"')
  expect(svg).toContain('data-record="Track"')
  expect(svg).toContain('data-record="Pad"')
  expect(svg).toContain('data-record="Via"')
  expect(svg).not.toMatch(/NaN|Infinity/)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
}, 45_000)
