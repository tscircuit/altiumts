# altiumts

`altiumts` is a TypeScript-first parser and serializer for Altium document
formats.

The current prototype supports source-preserving ASCII `.PcbDoc` and `.SchDoc`
files plus read-only binary compound-file variants. It models documents,
records, fields, CFB storages, and streams as classes. Unknown content remains
available in the source tree, and untouched binary documents retain their
exact original bytes.

## Install

```sh
bun add altiumts
```

## Parse and edit a board

```ts
import { readFile, writeFile } from "node:fs/promises"
import {
  AltiumTrackRecord,
  parseAltiumPcbDoc,
} from "altiumts"

const source = await readFile("board.PcbDoc", "utf8")
const board = parseAltiumPcbDoc(source)

const tracks = board.records.filter(
  (record): record is AltiumTrackRecord =>
    record instanceof AltiumTrackRecord,
)

for (const track of tracks) {
  if (track.get("LAYER") === "TOP") {
    track.set("WIDTH", "8mil")
  }
}

await writeFile("board-modified.PcbDoc", board.getString())
```

The generic `parseAltiumAscii` function returns document lines without
requiring a `Board` root record. `getChildren()` is available on every node for
generic tree walking.

## Auto-detect ASCII and binary files

Use the byte-oriented entrypoint when the container or encoding is not known:

```ts
import { readFile } from "node:fs/promises"
import {
  AltiumBinaryPcbDoc,
  AltiumSchDoc,
  parseAltiumFile,
} from "altiumts"

const bytes = new Uint8Array(await readFile("design.PcbDoc"))
const { detection, document } = parseAltiumFile(bytes)

console.log(detection.container, detection.documentKind, detection.encoding)

if (document instanceof AltiumBinaryPcbDoc) {
  console.log(document.components.length, document.nets.length)
  console.log(
    document.pads.length,
    document.tracks.length,
    document.arcs.length,
    document.vias.length,
    document.regions.length,
    document.texts.length,
  )
}

if (document instanceof AltiumSchDoc) {
  console.log(document.sourceFormat, document.records.length)
}
```

Binary `.PcbDoc` parsing currently inventories every CFB storage family,
decodes common property streams, and creates semantic records for pads, tracks,
arcs, vias, polygon-fill regions with contour holes, and wide-string-backed
text. Binary `.SchDoc` parsing decodes its framed `FileHeader` property
records, `%UTF8%` fields, and owner indexes.

## Render SVG previews

The SVG serialization module can render a complete PCB, one PCB layer, or a
generic ASCII schematic sheet:

```ts
import { readFile, writeFile } from "node:fs/promises"
import {
  parseAltiumPcbDoc,
  serializeAltiumPcbLayerToSvg,
  serializeAltiumPcbToSvg,
} from "altiumts"

const board = parseAltiumPcbDoc(await readFile("board.PcbDoc", "utf8"))

await writeFile("board.svg", serializeAltiumPcbToSvg(board))
await writeFile(
  "board-top.svg",
  serializeAltiumPcbLayerToSvg(board, "TOP"),
)
await writeFile(
  "board-top-detail.svg",
  serializeAltiumPcbLayerToSvg(board, "TOP", {
    // Lower-left origin and dimensions in normalized Altium board units.
    viewBox: { x: 4200, y: 2500, width: 1200, height: 900 },
  }),
)
```

`serializeAltiumSheetToSvg()` accepts `AltiumSchDoc`, `AltiumPcbDoc`, or the
lines returned by `parseAltiumAscii()`. The PCB serializers accept either
ASCII or binary PCB documents. PCB rendering currently prioritizes outlines,
tracks, arcs, pads, vias, regions, polygons, fills, and text. The renderer is
intentionally source-model based, so visual snapshot differences expose parser
or geometry regressions directly. A PCB `viewBox` crops in board coordinates,
uses no implicit margin, and omits primitives that cannot intersect the crop;
this keeps focused visual tests small and makes dense features easier to
inspect. Component designator/comment text follows the parent component's
`NAMEON` and `COMMENTON` visibility flags; pass `{ showHidden: true }` when
debugging hidden source text.

## API

- `parseAltiumPcbDoc(source, options?)` parses and validates an ASCII
  `.PcbDoc`.
- `parseAltiumSchDoc(source, options?)` parses ASCII or binary `.SchDoc`
  input.
- `parseAltiumBinaryPcbDoc(bytes, options?)` parses a binary `.PcbDoc`.
- `parseAltiumCompoundFile(bytes, options?)` exposes a bounded, read-only
  OLE/CFB tree.
- `detectAltiumFile(bytes)` and `parseAltiumFile(bytes, options?)` provide
  extension-independent format detection and dispatch.
- `parseAltiumAscii(source, options?)` parses any Altium ASCII record stream.
- `AltiumPcbDoc#getString()` serializes a complete board.
- `AltiumRecord#get()`, `getAll()`, `set()`, and `delete()` provide ergonomic
  field access while the ordered `items` array preserves duplicate and unknown
  fields.
- Known PCB primitives are represented by dedicated record classes:
  `AltiumArcRecord`, `AltiumBoardRecord`, `AltiumComponentRecord`,
  `AltiumNetRecord`, `AltiumPadRecord`, `AltiumPolygonRecord`,
  `AltiumRegionRecord`, `AltiumTextRecord`, `AltiumTrackRecord`, and
  `AltiumViaRecord`.
- Unrecognized record kinds become `AltiumUnknownRecord` instances and
  malformed lines become `AltiumRawLine` instances, so permissive parsing does
  not discard data.
- `serializeAltiumPcbToSvg()`, `serializeAltiumPcbLayerToSvg()`, and
  `serializeAltiumSheetToSvg()` provide visual inspection and regression-test
  output.

Pass `{ strict: true }` to reject malformed non-record lines. Unknown record
kinds are still preserved in strict mode for forward compatibility.

## Reference files

Download the pinned SimpleFOC Mini, SimpleFOC Shield, Hyperpolyglot, and Elk Pi
Altium PCB/schematic references:

```sh
bun run download-references
bun run inventory-references
```

Then run the complete suite:

```sh
bun test
bun run test:update-svg
bun run typecheck
bun run format:check
bun run build
```

The imported reference files are not committed to this repository. Their
generated `.snap.svg` visual baselines are committed and compared with
`bun-match-svg`.

## Current scope

Binary support is currently read-only: untouched documents can return their
original bytes, but edits are not serialized back into CFB streams. The PCB
parser now distinguishes source shape-based regions from generated region-fill
caches and decodes board cutout regions. It does not yet semantically decode
fills, component bodies, dimensions, or embedded 3D models. Text barcode/frame
metadata and per-layer full-stack pad details beyond the top/middle/bottom shape
model also remain pending. Those streams remain available through
`AltiumCompoundFile` and appear in stream summaries.

Schematic property records are parsed generically and visualized, but the
numeric record IDs do not yet have a complete typed semantic model. Library,
project, output-job, and integrated-library roots are still future work.

See [CHECKLIST.md](./CHECKLIST.md) for the implementation roadmap and
[docs/format-references.md](./docs/format-references.md) for research sources.
