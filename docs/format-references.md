# Format research references

`altiumts` is implemented from independently observed files and publicly
available format research. Code must not be copied from incompatible licenses.

## Primary implementation references

- [Microsoft Compound Binary File specification](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-cfb/53989ce4-7b05-4f8d-829b-d08d6148375b)
  for OLE/CFB header, allocation-table, directory, and mini-stream behavior.
- [KiCad Altium PCB parser source](https://github.com/KiCad/kicad-source-mirror/blob/master/pcbnew/pcb_io/altium/altium_parser_pcb.cpp)
  and [PCB importer](https://github.com/KiCad/kicad-source-mirror/blob/master/pcbnew/pcb_io/altium/altium_pcb.cpp)
  for cross-checking property framing, string encodings, bounded reader
  behavior, extended pad-stack field interpretation, and component-body model
  metadata. The importer also confirms that `Models/Data` record order maps to
  numeric `Models/<index>` streams containing zlib-compressed STEP data.

### Native PCB string origins

The PMP22712 evaluation warning and PMP23595 caution label both use 252-byte
`Texts6` property payloads. Byte 230 distinguishes frames from free strings;
byte 240 activates the saved justification. The parser exposes these only for
the corresponding complete 240- and 252-byte extensions.

For active free strings, saved X/Y is the lower-left origin of the unrotated
text cell. Horizontal alignment within an automatically sized glyph run leaves
its start at that origin; the cached `TEXTBOXWIDTH` can be stale after resolving
special strings. Top and center baselines need local Y offsets of `-HEIGHT` and
`-HEIGHT / 2` before applying rotation and mirroring. These observations agree
with KiCad's `ATEXT6` decoder and `HelperSetTextAlignmentAndPos`; SVG font metrics
remain a separate concern. ASCII anchors, framed text and older layouts are
not inferred from these two modern flags.

## Corpus and structural references

- [`tscircuit/kicadts`](https://github.com/tscircuit/kicadts) for the general
  shape of a source-preserving TypeScript parser library.
- [`seveibar/altium_js`](https://github.com/seveibar/altium_js) for public,
  MIT-licensed schematic stream research.
- [`simplefoc/SimpleFOCMini`](https://github.com/simplefoc/SimpleFOCMini),
  [`simplefoc/Arduino-SimpleFOCShield`](https://github.com/simplefoc/Arduino-SimpleFOCShield),
  [`monkslc/hyperpolyglot`](https://github.com/monkslc/hyperpolyglot), and
  [`elk-audio/elk-pi-hardware`](https://github.com/elk-audio/elk-pi-hardware)
  for pinned real-world fixtures.
- [KiCad's Novena eDP adapter fixture](https://github.com/KiCad/kicad-source-mirror/tree/master/qa/data/pcbnew/plugins/altium/eDP_adapter_dvt1_source)
  supplies a binary PCB with rotated `Fills6` records. The original
  [Novena project](https://www.crowdsupply.com/sutajio-kosagi/novena) is open
  hardware.

Exact fixture commits and digests are recorded in
`scripts/download-references.ts`.

These references are evidence, not an assertion that every version or record
layout has been fully verified. New binary offsets must be checked against
multiple independent fixtures before being treated as stable.
