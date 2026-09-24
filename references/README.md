# Reference files

Run `bun run download-references` to download:

- `altium-dsp-fpga-power.SchDoc` from the MIT-licensed
  [`AmirhosseinR/Altium_DSP_FPGA`](https://github.com/AmirhosseinR/Altium_DSP_FPGA)
  open-source hardware repository, pinned to commit
  `61e66e61a6b7fbcfbc370a0b756b2958f38ad493`.
- `dsp5509-ciii.PcbDoc` from the same MIT-licensed
  [`AmirhosseinR/Altium_DSP_FPGA`](https://github.com/AmirhosseinR/Altium_DSP_FPGA)
  repository and commit.
- `stm32-st-link-v2.PcbDoc` and `stm32-st-link-v2.SchDoc` from the GPL-3.0-licensed
  [`yasir-shahzad/STM32-ST-Link-V2.0-Programmer`](https://github.com/yasir-shahzad/STM32-ST-Link-V2.0-Programmer)
  open-source hardware repository, pinned to commit
  `3284ac4fbd9a3f8471844db3c2b368fff2c33ca9`.
- `c17-main.PcbDoc` and `led-matrix-sheet.SchDoc` from the MIT-licensed
  [`phonght32/altium`](https://github.com/phonght32/altium) open-source hardware
  repository, pinned to commit
  `85e2bfc3aac1daaa4eb8dc7be4f0649d12b2fc28`.
- `simplefocmini-2024-04-26.PcbDoc` and
  `simplefocmini-2024-04-26.SchDoc` from the MIT-licensed
  [`simplefoc/SimpleFOCMini`](https://github.com/simplefoc/SimpleFOCMini)
  repository, pinned to commit
  `8e10d4ba398624bd0ef970e82c03d7a6bcc2220d`.
- `sample-board-design.PcbDoc` and `sample-schematic-sheet.SchDoc` from the
  Apache-2.0-licensed
  [`monkslc/hyperpolyglot`](https://github.com/monkslc/hyperpolyglot)
  repository, pinned to commit
  `a55a3b58eaed09b4314ef93d78e50a80cfec36f4`.
- `simplefoc-shield-v3-2024-06-23.PcbDoc` and
  `simplefoc-shield-v3-2024-06-23.SchDoc` from the MIT-licensed
  [`simplefoc/Arduino-SimpleFOCShield`](https://github.com/simplefoc/Arduino-SimpleFOCShield)
  repository, pinned to commit
  `2a83626b86debd5fc5f309ba06b3fb36e3b25533`.
- `elk-pi.PcbDoc` and `elk-pi-main.SchDoc` from the CC BY-SA 4.0-licensed
  [`elk-audio/elk-pi-hardware`](https://github.com/elk-audio/elk-pi-hardware)
  repository, pinned to commit
  `770960ce5e520cf450182160cd8cff9690a0a869`.
- `novena-edp-adapter-dvt1.PcbDoc` from the GPL-3.0-or-later
  [`KiCad/kicad-source-mirror`](https://github.com/KiCad/kicad-source-mirror)
  QA corpus, pinned to commit
  `c2a91caacf90b4d07261658ef44c0230116e667b`.
- `ti-tmds62levm-rev-b.PcbDoc` and all 57 sheets under
  `ti-tmds62levm-rev-b/*.SchDoc` from the official Texas Instruments
  [TMDS62LEVM design file package](https://www.ti.com/tool/TMDS62LEVM),
  SPRCAL9 Rev. B. The script verifies the outer ZIP, nested Altium project ZIP,
  extracted PCB, and every extracted schematic independently. TI's archive
  notice and website terms apply to these downloaded fixtures.
- `ti-pmp22650-main.PcbDoc`, `ti-pmp22712.PcbDoc`, and `ti-pmp22773.PcbDoc`
  from the official Texas Instruments [PMP22650 CAD/CAE files](https://www.ti.com/lit/zip/TIDM925),
  TIDM925. The three boards are extracted from separate nested Altium ZIPs.
- `ti-pmp23595.PcbDoc` from the official Texas Instruments
  [PMP23595 CAD/CAE files](https://www.ti.com/lit/zip/SLVMEP2), SLVMEP2A.
- `ti-pmp23653-main.PcbDoc` and `ti-pmp23653-planar-transformer.PcbDoc`
  from the official Texas Instruments [PMP23653 CAD/CAE files](https://www.ti.com/lit/zip/SLVMF61),
  SLVMF61. TI's archive notices and website terms apply to all six power-board
  fixtures. Archive, nested archive, and extracted PCB hashes match the fixtures
  used by `altium-to-circuit-json`.

The six TI power boards have parser, byte-preserving round-trip, and PCB SVG
snapshot coverage. Snapshots focus on each board outline with 5% padding so
external fabrication drawings do not shrink the PCB. Strict validation passes
for five boards; PMP22650 retains its two original negative-pad-size diagnostics
(`/Pads6/Data` records 26 and 27), which the parser test explicitly checks.

Downloaded `.PcbDoc` and `.SchDoc` files are ignored by git. Each imported
file has a corresponding SVG visual snapshot test. The download script stores
and verifies a pinned SHA-256 digest for every file before writing it. Nested
archives are filtered during extraction so unrelated design-package content is
not written into the repository.

Run `bun run inventory-references` for a concise corpus report, or
`bun run inventory-references --json` for machine-readable record and stream
counts.
