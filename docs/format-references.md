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

### Arial PCB text metrics

Native TrueType text uses a font-cell height; SVG `font-size` uses em units.
The Arial regular, bold, italic and bold-italic font tables were checked for
`head.unitsPerEm = 2048`, `OS/2.usWinAscent = 1854`, and
`OS/2.usWinDescent = 434`. Their conversion is therefore
`HEIGHT * 2048 / (1854 + 434)`, including multiline spacing. The field meanings
are defined in Microsoft's OpenType [head table](https://learn.microsoft.com/en-us/typography/opentype/spec/head)
and [Windows metrics](https://learn.microsoft.com/en-us/typography/opentype/spec/os2#uswinascent).

The real PMP22712/PMP22773 titles and PMP22712/PMP23595 warnings cover this
conversion alongside the original Altium comparison images. These metrics
apply only to Arial TrueType text; explicit stroke-font selection, unknown
families and related but different fonts such as Arial Narrow retain their
existing sizing. Font binaries are not bundled, so host font substitution can
still affect glyph shapes. Stroke-font rendering remains separate.

For modern native Arial free strings (`ISFRAME=FALSE` with a present
`JUSTIFICATIONVALID` flag), the saved X/Y locates the alphabetic glyph origin.
Use `dominant-baseline="alphabetic"` at that origin for either validity state
(see the [SVG baseline definitions](https://www.w3.org/TR/SVG11/text.html#BaselineAlignmentProperties)).
The previous SVG cell-edge baselines introduced an extra font-dependent
vertical offset: in the existing 800×600 PMP22712 comparison, the title and
warning sat roughly 9–12 pixels above their reference positions. A pixel-bound
regression compares both strings with the original uploaded Altium image at
the unchanged board scale, allowing five pixels for antialiasing and board
registration. It checks both position and size, rather than only SVG attributes.
Rotation and mirroring operate around the same saved origin. ASCII, frames,
older native layouts, unknown families and stroke fonts keep their existing
alignment rules.

### Native PCB string origins

The PMP22712 evaluation warning and PMP23595 caution label both use 252-byte
`Texts6` property payloads. Byte 230 distinguishes frames from free strings;
byte 240 activates the saved justification. The parser exposes these only for
the corresponding complete 240- and 252-byte extensions.

For active free strings outside the Arial case above, saved X/Y is treated as
the lower-left origin of the unrotated
text cell. Horizontal alignment within an automatically sized glyph run leaves
its start at that origin; the cached `TEXTBOXWIDTH` can be stale after resolving
special strings. Top and center baselines need local Y offsets of `-HEIGHT` and
`-HEIGHT / 2` before applying rotation and mirroring. These observations agree
with KiCad's `ATEXT6` decoder and `HelperSetTextAlignmentAndPos`. These generic
cell offsets are not reapplied to the verified Arial alphabetic origin.
ASCII anchors, framed text and older layouts are
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
