# Native schematic rendering behavior

The renderer changes expose native-format mistakes that were hidden by the previous local preview. The parser continues to preserve original record fields, and rendering does not rewrite a document or change binary serialization.

The implementation covers:

- Signed integer coordinate fields plus `_FRAC / 100000`, including omitted zero fields. Decimal base values such as `X2=258.08` use the invalid-integer fallback instead of being accepted as valid coordinates.
- Sheet `SYSTEMFONT`, independently enabled pin name/designator custom-font IDs, and the missing-system-font fallback. A generic `FONTID` on a pin does not override these settings.
- Integer font-size fields and their fractions. Invalid decimal base sizes use the fallback size while retaining the selected family.
- Visible native net labels even when an exporter adds `ISHIDDEN=T`; supported hidden parameters/designators continue to be hidden.
- Separate input, output and bidirectional electrical-type indicators. Missing `ELECTRICAL` defaults to input; passive and power pins have no direction indicator.

The integer/fraction representation is supported by [KiCad's Altium importer](https://github.com/KiCad/kicad-source-mirror/blob/master/eeschema/sch_io/altium/altium_parser_sch.cpp). [Altium's pin documentation](https://www.altium.com/documentation/altium-designer/components-libraries/creating-schematic-symbol) describes the system font and separate pin custom settings. The [python-altium format notes](https://github.com/vadmium/python-altium/blob/master/format.md) document the native field names and electrical types.

Invalid-value fallback and net-label visibility are modeled from the Altium 365 screenshot supplied during the circuit-json-to-altium investigation. Exact fallback behavior across Altium versions still needs isolated native reference captures. This remains a local rendering implementation, not the official Altium engine. Exact glyph metrics, pin text margins/custom placement, clipping/borders, inferred junction dots and other electrical symbol types remain incomplete.

The regressions in [schematic-native-rendering.test.ts](../tests/svg/schematic-native-rendering.test.ts) exercise native documents directly, including valid fields, malformed values and preserved document data. The existing pin-font fixture now specifies its native system font; the port-width fixtures encode half a unit as `50000` rather than `5`.

```sh
bun test tests/svg/schematic-native-rendering.test.ts tests/svg/schematic-pin-font.test.ts tests/svg/schematic-port-direction.test.ts
bun run typecheck
bun run format:check
bun run build
```

A passing snapshot establishes a regression baseline, not correct conversion or pixel-identical Altium output. The corresponding circuit-json-to-altium baseline PR pins the commit containing these changes. Exporter fixes are reviewed separately on top of that baseline.
