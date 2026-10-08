import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { readdir, readFile } from "node:fs/promises"
import sharp from "sharp"
import coverage from "./fixtures/altium-reference/coverage.json"
import { renderAltiumReferenceComparison } from "./svg/render-altium-reference-comparison"

const directory = new URL("./fixtures/altium-reference/", import.meta.url)
const snapshots = new URL("./svg/__snapshots__/", import.meta.url)

test("accounts for every existing PCB snapshot and marks missing references explicitly", async () => {
  const pcbSnapshots = []
  for (const name of await readdir(snapshots)) {
    if (!name.endsWith(".snap.svg")) continue
    const svg = await readFile(new URL(name, snapshots), "utf8")
    if (svg.includes('class="altium-pcb"')) {
      pcbSnapshots.push(name.replace(/\.snap\.svg$/u, ""))
    }
  }
  expect(coverage.map(({ name }) => name).sort()).toEqual(pcbSnapshots.sort())
  for (const entry of coverage) {
    const svg = await readFile(
      new URL(`${entry.name}.snap.svg`, snapshots),
      "utf8",
    )
    if (entry.status === "captured") {
      expect(
        svg.includes(`data-altium-reference="${entry.name}"`),
        entry.name,
      ).toBe(true)
    } else {
      expect(entry.reason.length).toBeGreaterThan(0)
      expect(svg).not.toContain("data-altium-reference=")
    }
  }
})

test("embeds the unchanged reference bytes with their actual format and dimensions", async () => {
  for (const { name, status } of coverage) {
    if (status !== "captured") continue
    const view = JSON.parse(
      await readFile(new URL(`${name}.json`, directory), "utf8"),
    )
    const image = await readFile(new URL(view.image, directory))
    const metadata = await sharp(image).metadata()
    expect(view.mimeType).toBe(`image/${metadata.format}`)
    expect(view.width).toBe(metadata.width)
    expect(view.height).toBe(metadata.height)
    expect(view.screenshotSha256).toBe(
      createHash("sha256").update(image).digest("hex"),
    )
    const svg = await readFile(new URL(`${name}.snap.svg`, snapshots), "utf8")
    expect(
      svg.includes(
        `href="data:${view.mimeType};base64,${image.toString("base64")}"`,
      ),
      name,
    ).toBe(true)
    expect(svg).toContain(`width="${view.width}" height="${view.height}"`)
  }
})

test("keeps the exact converter SVG and its panel dimensions", async () => {
  const converterSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 10 20"><text x="1" y="2">unresolved .PCB_Rev</text></svg>'
  const comparison = await renderAltiumReferenceComparison({
    reference: "ti-pmp22712-pcb",
    converterSvg,
  })
  expect(comparison).toContain(converterSvg)
  expect(comparison).toContain('width="696" height="314"')
  expect(comparison).toContain(
    `<g transform="translate(360 70)">${converterSvg}</g>`,
  )
})
