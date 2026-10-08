import { expect, test } from "bun:test"
import {
  TI_POWER_REFERENCE_PCB_FILENAMES,
  TI_POWER_REFERENCE_PROJECT_FILENAMES,
} from "../../scripts/references/ti-power-references"
import { renderAltiumReferenceComparison } from "./render-altium-reference-comparison"
import { renderTiPowerReferencePcb } from "./render-ti-power-reference-pcb"

test("renders the TI PMP22650 PCB", async () => {
  const svg = await renderTiPowerReferencePcb({
    filename: TI_POWER_REFERENCE_PCB_FILENAMES.pmp22650,
    projectFilename: TI_POWER_REFERENCE_PROJECT_FILENAMES.pmp22650,
    title: "TI PMP22650 PCB",
  })

  expect(svg).toContain('data-record="BoardOutline"')
  expect(svg).toContain('data-record="Track"')
  expect(svg).toContain('data-record="Pad"')
  expect(svg).toContain('data-record="Via"')
  expect(svg).toContain(">PMP22650E2</text>")
  expect(svg).not.toContain(".PRJ_Number")
  expect(svg).not.toContain(".PCB_Rev")
  expect(svg).not.toMatch(/NaN|Infinity/)
  const comparison = await renderAltiumReferenceComparison({
    reference: "ti-pmp22650-pcb",
    converterSvg: svg,
  })
  await expect(comparison).toMatchSvgSnapshot(import.meta.path)
}, 45_000)
