# Full-board Altium reference comparisons

The existing PMP22712 and PMP22773 PCB tests produce a second SVG snapshot
with the uploaded real Altium viewer screenshot on the left and their
current AltiumTS output on the right. The original standalone snapshots
remain unchanged. The converter panel uses the exact same generated SVG,
including its existing layer visibility, colors, text and dimensions.

## Reference provenance

These are unmodified screenshots supplied in the AltiumTS Support Comparison
conversation, not AltiumTS renders or generated reference artwork.

| Fixture | Original screenshot | Size | SHA-256 |
| --- | --- | --- | --- |
| `pmp22712.png` | Screenshot 2026-10-02 at 15.41.43.png | 986 × 954 | `c4c8bbc1a27fd7b8347dda947ecd00aca50615ad9ad7d8ed33531f98425a6e31` |
| `pmp22773.png` | Screenshot 2026-10-02 at 15.42.31.png | 1034 × 1188 | `48ee04bc03187e103e503ec56de8856c43c923ccaef0a2b2911b869aacb1cfc2` |

The right panels parse the matching `ti-pmp22712.PcbDoc` and
`ti-pmp22773.PcbDoc` fixtures downloaded from pinned Texas Instruments ZIPs
by `bun run download-references`. The reference PNGs are embedded in the SVGs
so the comparisons can be viewed without external image dependencies.

## Alignment and scope

The screenshot board rectangles are approximately `(80,214)-(928,909)` for
PMP22712 and `(148,260)-(852,1006)` for PMP22773. The comparison adds the same
5% board-outline padding used by `renderTiPowerReferencePcb`, preserves the
source image's aspect ratio, and displays both panels at 800 × 600 pixels.
The PNG files retain the entire original screenshot; only their SVG viewport
is cropped. Content outside the padded board viewport, including the ends
of PMP22773's connector pins, can be clipped just as in the existing test.

This records the current baseline, not a claim of rendering parity. The
screenshots have different colors and visible layers from the converter's
default view, and their raster resolution limits fine measurement. Project
strings remain unresolved in the current standalone-PCB renderer. Subsequent
fixes should update the generated panel while keeping reference pixels intact.
No renderer code or PCB data is changed by these comparisons.

Only these two boards have uploaded real Altium reference screenshots. The
other existing PCB tests retain their original snapshots until references
are available for them.

## Regeneration

```sh
bun run download-references
BUN_UPDATE_SNAPSHOTS=1 bun test tests/svg/ti-pmp22712-pcb.test.ts tests/svg/ti-pmp22773-pcb.test.ts
```

Normal test runs check both each original PCB snapshot and its
`altium-comparison` snapshot. Future rendering changes appear in both outputs.
