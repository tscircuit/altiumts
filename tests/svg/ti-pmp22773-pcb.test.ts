import { expect, test } from "bun:test"
import { TI_POWER_REFERENCE_PCB_FILENAMES } from "../../scripts/references/ti-power-references"
import { renderAltiumReferenceComparison } from "./render-altium-reference-comparison"
import { renderTiPowerReferencePcb } from "./render-ti-power-reference-pcb"

test("renders the TI PMP22773 PCB", async () => {
  const svg = await renderTiPowerReferencePcb(
    TI_POWER_REFERENCE_PCB_FILENAMES.pmp22773,
    "TI PMP22773 PCB",
  )

  expect(svg).toContain('data-record="BoardOutline"')
  expect(svg).toContain('data-record="Track"')
  expect(svg).toContain('data-record="Pad"')
  expect(svg).toContain('data-record="Via"')
  expect(svg).not.toMatch(/NaN|Infinity/)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
  const comparison = await renderAltiumReferenceComparison({
    reference: "pmp22773",
    converterSvg: svg,
  })
  await expect(comparison).toMatchSvgSnapshot(
    import.meta.path,
    "altium-comparison",
  )
}, 45_000)
