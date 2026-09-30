import { expect, test } from "bun:test"
import { TI_POWER_REFERENCE_PCB_FILENAMES } from "../../scripts/references/ti-power-references"
import { renderTiPowerReferencePcb } from "./render-ti-power-reference-pcb"

test("renders the TI PMP22712 PCB", async () => {
  const svg = await renderTiPowerReferencePcb(
    TI_POWER_REFERENCE_PCB_FILENAMES.pmp22712,
    {
      title: "TI PMP22712 PCB",
      projectFilename: "ti-pmp22712.PrjPcb",
    },
  )

  expect(svg).toContain('data-record="BoardOutline"')
  expect(svg).toContain('data-record="Track"')
  expect(svg).toContain('data-record="Pad"')
  expect(svg).toContain('data-record="Via"')
  expect(svg).toContain(">PMP22712E2</text>")
  expect(svg).not.toContain(".PRJ_Number")
  expect(svg).not.toMatch(/NaN|Infinity/)
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
}, 45_000)
