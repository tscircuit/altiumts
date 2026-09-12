# SimpleFOC Mini custom-power repro

[simplefoc-mini-native-power.SchDoc](./simplefoc-mini-native-power.SchDoc) is a
converter export of the real [SimpleFOC Mini board](https://github.com/simplefoc/SimpleFOCMini/tree/8e10d4ba398624bd0ef970e82c03d7a6bcc2220d).
The original [Altium schematic](https://github.com/simplefoc/SimpleFOCMini/blob/8e10d4ba398624bd0ef970e82c03d7a6bcc2220d/Altium/simplefocmini_2024-04-26.schdoc)
is MIT licensed; its copyright notice is in [simplefoc-mini.LICENSE](./simplefoc-mini.LICENSE).

The complete converted sheet contains 14 components, 64 pins, 146 wires and
15 GND/VCC/3.3V power ports referencing two definitions in `/ObjectDefinitions`.
Those definitions contain native `LineWidth=0` graphics. Altiumts main at
`ec5f177` ignores that stream and renders thicker built-in power symbols.

The [test](../svg/simplefocmini-native-power-repro.test.ts) records this current
behavior in a full-sheet snapshot and a zoomed view of the power input and
motor driver. The baseline is a repro of the bug, not the desired appearance.
The stacked implementation should update those same snapshots using the same
SchDoc bytes. This fixture is a converter export, not an unmodified upstream
Altium file or a verified Altium Viewer capture.

## Provenance and regeneration

- Source schematic SHA-256: `bc2039ef59eabe030fea68eedb87e3924c8e6711fb774e2d80b880cf468100ef`.
- Converter: [circuit-json-to-altium `54b28c4`](https://github.com/tscircuit/circuit-json-to-altium/tree/54b28c42a0c7b7f04dd1d5bd65fed9bb8cd6f48e), whose package.json pins the earlier working native exporter, altiumts `2cee1e06af91a4954ce1be6469301c76340e79ef`.
- Export SHA-256: `154644de8483758d47c6547116b673b24ed1913faaf6f5389b8be4c556385064`.

In a converter checkout at that commit, run `bun install` and
`bun run download-references`. Save the following as `export-repro.ts` in its
root and run `bun export-repro.ts`. It follows the existing
[SimpleFOC Mini round-trip pipeline](https://github.com/tscircuit/circuit-json-to-altium/blob/54b28c42a0c7b7f04dd1d5bd65fed9bb8cd6f48e/tests/fixtures/create-open-source-schematic-round-trip.ts)
and preserves the source sheet's 761-by-463 Altium-unit page size. Copy the
generated SchDoc here without editing its records.

```ts
import { parseAltiumSchDoc } from "altiumts"
import { CircuitJsonToAltiumConverter } from "./lib"
import { convertAltiumSchematicToCircuitJson } from "./tests/fixtures/convert-altium-schematic-to-circuit-json"

const source = parseAltiumSchDoc(
  await Bun.file("references/simplefoc-mini.SchDoc").bytes(),
)
const converter = new CircuitJsonToAltiumConverter(
  convertAltiumSchematicToCircuitJson(source),
  {
    projectName: "SimpleFOC Mini schematic",
    schematicSheets: [{
      circuitOrigin: { x: 0, y: 0 },
      width: 761 / 20,
      height: 463 / 20,
    }],
  },
)
converter.runUntilFinished()
await Bun.write(
  "simplefoc-mini-native-power.SchDoc",
  converter.getOutput().schematics[0]!.content,
)
```
