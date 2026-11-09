# PMP22712 Altium reference

`pmp22712.png` is the unmodified user-supplied **Screenshot 2026-10-02 at
15.41.43.png**, attached to the AltiumTS Support Comparison conversation. It
shows the PMP22712 E2 board in the Altium reference viewer. It is not an
AltiumTS-generated image. Original size: 986 × 954 pixels.

SHA-256: `c4c8bbc1a27fd7b8347dda947ecd00aca50615ad9ad7d8ed33531f98425a6e31`.

`tests/svg/ti-pmp22712-altium-text-comparison.test.ts` embeds these original
pixels in the left panel of a self-contained SVG. The right panel renders
the matching `ti-pmp22712.PcbDoc` fixture, downloaded from the pinned Texas
Instruments ZIP by `bun run download-references`.

The screenshot's board rectangle is approximately `(80, 214)-(928, 909)`.
The comparison aligns it with the PCB's saved outline bounds and crops the
top 300 mils. No text, font, location, or source PCB bytes are replaced to
make the comparison match. Only the converter's top and bottom overlay
layers are selected, to focus on the title and warning. The colors differ
between viewers, and the original screenshot has limited pixel resolution.

This is a visual baseline, not an assertion of parity: it deliberately
records the current misplaced title and oversized warning so their fixes
can be reviewed as changes to the right panel. Project-string resolution
is a separate renderer capability; the baseline keeps its unresolved title
expression visible.

Regenerate after a rendering change:

```sh
BUN_UPDATE_SNAPSHOTS=1 bun test tests/svg/ti-pmp22712-altium-text-comparison.test.ts
```
