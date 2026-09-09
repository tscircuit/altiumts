# Native schematic rendering behavior

The renderer changes expose native-format mistakes that were hidden by the previous local preview. The parser continues to preserve original record fields, and rendering does not rewrite a document or change binary serialization.

The implementation covers:

- Signed integer coordinate fields plus `_FRAC / 100000`, including omitted zero fields. Decimal base values such as `X2=258.08` use the invalid-integer fallback instead of being accepted as valid coordinates.
- Sheet `SYSTEMFONT`, independently enabled pin name/designator custom-font IDs, and the missing-system-font fallback. A generic `FONTID` on a pin does not override these settings.
- Integer font-size fields (font-table `SIZE*_FRAC` is ignored). Invalid decimal base sizes use the fallback size while retaining the selected family.
- Visible native net labels even when an exporter adds `ISHIDDEN=T`; supported hidden parameters/designators continue to be hidden.
- Separate input, output and bidirectional electrical-type indicators. Missing `ELECTRICAL` defaults to input; passive and power pins have no direction indicator.

The integer/fraction representation is supported by [KiCad's Altium importer](https://github.com/KiCad/kicad-source-mirror/blob/master/eeschema/sch_io/altium/altium_parser_sch.cpp). [Altium's pin documentation](https://www.altium.com/documentation/altium-designer/components-libraries/creating-schematic-symbol) describes the system font and separate pin custom settings. The [python-altium format notes](https://github.com/vadmium/python-altium/blob/master/format.md) document the native field names and electrical types.

Invalid-value fallback and net-label visibility are modeled from the Altium 365 screenshot supplied during the circuit-json-to-altium investigation. Exact fallback behavior across Altium versions still needs isolated native reference captures. This remains a local rendering implementation, not the official Altium engine. Default pin margins and enabled custom margins/colors are handled. Exact glyph metrics, custom text rotation/vertical margins, clipping/borders, inferred junction dots and other electrical symbol types remain incomplete.

The `schematic-native-*.test.ts` regressions each contain one test and exercise native documents directly, including [coordinate encoding](../tests/svg/schematic-native-fixed-point-coordinates.test.ts), [independent pin fonts](../tests/svg/schematic-native-pin-custom-fonts.test.ts) and [preserved document data](../tests/svg/schematic-native-preserved-fields.test.ts). Shared document construction lives in [the native fixture helper](../tests/fixtures/native-schematic-rendering.ts). Detailed renderer behavior is tested here; circuit-json-to-altium uses a small export-to-render integration test instead of copying these cases. The existing pin-font fixture now specifies its native system font; the port-width fixtures encode half a unit as `50000` rather than `5`.

```sh
bun test tests/svg/schematic-native-*.test.ts tests/svg/schematic-pin-font.test.ts tests/svg/schematic-port-direction.test.ts
bun run typecheck
bun run format:check
bun run build
```

A passing snapshot establishes a regression baseline, not correct conversion or pixel-identical Altium output. The corresponding circuit-json-to-altium baseline PR pins the commit containing these changes. Exporter fixes are reviewed separately on top of that baseline.

To refresh SVG baselines after reviewing a rendering change, set both `BUN_UPDATE_SNAPSHOTS=1` and `FORCE_BUN_UPDATE_SNAPSHOTS=1`. The ordinary update flag can leave old SVG text unchanged when raster comparison reports equal images.


The September 9 Altium 365 capture exposed further preview-only assumptions:
custom-font pin text defaults to black unless `NAME_CUSTOMCOLOR` or
`DESIGNATOR_CUSTOMCOLOR` is present; position bit 0 enables the independent
signed name/designator margin. The default margins are -7 and +9. `LINEWIDTH`
is the TSize enum (0–3), including the smallest line style, rather than a raw
coordinate. An IEEE clock symbol belongs inside the component boundary.

The font-table and packed pin-text fields are also documented in the independent
[native format reference](https://github.com/akiselev/altium-cli/blob/master/docs/reference/ad26/file-format-constants.md).
KiCad's acceptance of a fractional font field is not proof that Altium uses it.
The integer font handling now deliberately ignores those unsupported fractions.
New exporter files still need a fresh Altium 365 render to verify the final
appearance; local SVG snapshots alone do not establish parity.
