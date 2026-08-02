# altiumts

`altiumts` is a TypeScript-first parser and serializer for Altium document
formats.

The current experimental release supports source-preserving ASCII `.PcbDoc`,
`.SchDoc`, `.PrjPcb`, and `.OutJob` files plus read-only binary PCB and
schematic compound-file variants. It models syntax, semantic records,
references, connectivity, CFB storages, and streams as classes. Unknown
content remains available in the source tree, and untouched binary documents
retain their exact original bytes.

The support matrix is deliberately operation-specific: binary documents can
be inspected and round-tripped untouched, but modified binary serialization is
refused. See [Compatibility](./docs/compatibility.md) for tested versions and
explicit exclusions.

## Altium File Viewer by tscircuit

The repository includes a browser-local project viewer for opening a project
folder, a ZIP archive, a public GitHub repository or folder URL, or individual
`.PrjPcb`, `.SchDoc`, and `.PcbDoc` files. It renders schematic sheets,
complete PCBs, and individual PCB layers as SVGs. Local project contents stay
in the browser and are never uploaded; GitHub projects are downloaded directly
from GitHub and parsed locally.

[Open the hosted Altium File Viewer by tscircuit](https://altiumviewer.tscircuit.com)

This is an open-source community tool by tscircuit. It is not affiliated with
or endorsed by Altium.

```sh
bun run site:dev
```

Run `bun run site:typecheck` and `bun run site:build` to verify a production
build. If a design cannot be processed, the viewer prepares a GitHub bug report
containing filenames and parser errors, without including design contents.

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
requiring a `Board` root record. `parseAltiumAsciiStream()` accepts an async
iterable of decoded chunks. Every node supports `getChildren()`, `walk()`,
`visit()`, source locations, stable parsed IDs, parent/document references,
dirty state, structural hashes, and JSON debug output.

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
decodes common property streams, and creates semantic records for board
metadata, components, nets, classes, rules, polygons, pads, tracks, arcs, vias,
fills, regions with contour holes, bodies, models, and wide-string-backed
text. Extended pad records include top/middle/bottom and full-stack
layer geometry, custom corner radii, hole shapes and offsets, slot dimensions,
and plating state. Board geometry retains the source contour vertices and arc
metadata while exposing approximated points, bounds, winding, board cutouts,
layer-stack regions, and polygon cutouts. Binary `.SchDoc` parsing decodes framed property records,
`%UTF8%` fields, typed common record IDs, owner indexes, hierarchy links, and
schematic connectivity.

## Inspect from the command line

```sh
altiumts inspect board.PcbDoc --json
altiumts tree sheet.SchDoc
altiumts streams board.PcbDoc
altiumts records board.PcbDoc --json
altiumts validate board.PcbDoc --json
altiumts roundtrip board.PcbDoc
altiumts diff before.PcbDoc after.PcbDoc
altiumts extract board.PcbDoc extracted-streams
```

`extract` sanitizes stream names and rejects paths outside the requested
directory. Hex dumps and allocations are bounded.

## Render SVG previews

The SVG serialization module can render a complete PCB, one PCB layer, or an
ASCII/binary schematic sheet:

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
intentionally source-model based and also renders shape-based component-body
outlines, so visual snapshot differences expose parser or geometry regressions
directly. A PCB `viewBox` crops in board coordinates, uses no implicit margin,
and omits primitives that cannot intersect the crop; this keeps focused visual
tests small and makes dense features easier to inspect. Component
designator/comment text follows the parent component's `NAMEON` and `COMMENTON`
visibility flags; pass `{ showHidden: true }` when debugging hidden source
text.

Binary schematic rendering includes embedded images, Altium font-table sizes,
ordinary graphic lines, text frames, No-ERC markers, and paper-bound clipping.
Embedded Windows bitmaps are decoded with bounded allocation and emitted as
portable PNG data URLs, keeping the generated SVG self-contained.

Board cutouts are combined with the board outline using even-odd SVG fill.
Polygon cutouts erase poured-region color before independent fills, tracks,
pads, and vias are painted. Pass `{ showBoardCutouts: false }` to inspect the
uncut board substrate during debugging.

Single-layer PCB renders select the corresponding pad-stack geometry. Round,
rectangular, rounded-rectangle, octagonal, and obround pads are rendered
directly, along with round, square, and slotted holes.

## API

- `parseAltiumPcbDoc(source, options?)` parses and validates an ASCII
  `.PcbDoc`.
- `parseAltiumSchDoc(source, options?)` parses ASCII or binary `.SchDoc`
  input.
- Binary PCB documents expose typed `models` and `embeddedModels` collections.
  `getEmbeddedModelForComponentBody()` resolves duplicate model IDs using the
  body's stored 3D rotation, and `getDecompressedBytes()` extracts the
  corresponding zlib-compressed STEP payload with a configurable output-size
  limit.
- PCB documents resolve component and net indexes through
  `getComponentForRecord()`, `getNetForRecord()`,
  `getRecordsOwnedByComponent()`, and `getRecordsOnNet()`. The SVG serializer
  accepts `componentIndices` and `netIndices` for focused debugging renders.
- PCB documents expose lazy `index` and `connectivity` models, layer-stack
  metadata (including V8/V9 sub-stacks, layer pairs, and controlled-impedance
  profiles), `boardGeometry`, board-grid settings, typed rule constraints,
  polygon/rule references, unique-ID lookup, and component bounds. Individual
  board and region records expose `outline`/`geometry` helpers without changing
  their source fields. Rule helpers cover
  routing width/layers/vias, differential-pair gaps, impedance, matched-length
  tolerance, thermal relief, masks, holes, heights, silk clearances, and
  test-point dimensions.
- Schematic documents expose typed components, pins, wires, labels, ports,
  power ports, sheets, ownership indexes, sheet links, and `netGraph`.
- `parseAltiumPrjPcb()` and `parseAltiumOutJob()` provide source-preserving
  project/job parsing. Project references resolve Windows paths consistently
  on any host.
- `validateAltiumDocument()` returns machine-readable structural diagnostics.
  `serializeAltiumDocument()` validates by default and refuses unsafe modified
  binary output. PCB validation checks primitive layer references against
  standard, legacy, and document stack-specific names while preserving unknown
  names for inspection.
- `cloneAltiumNode()`, `transformAltiumTree()`, and
  `searchAltiumRecords()` support copy-on-write tooling and generic AST work.
- `altiumCompatibilityManifest` and `supportsAltiumOperation()` let callers
  query support without relying on prose.
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

Pass `{ mode: "strict" }` to reject malformed text, `"compatible"` for the
normal source-preserving behavior, or `"recovery"` to make recovery decisions
visible through `onDiagnostic`. Unknown record kinds remain preserved in every
mode for forward compatibility. Limits are available for files, lines, fields,
binary records, CFB chains, directories, decompressed models, and writes.

## Projects and output jobs

```ts
import { parseAltiumPrjPcb } from "altiumts"

const project = parseAltiumPrjPcb(projectText)
console.log(project.documents)
console.log(project.variants)
console.log(project.resolveDocumentPaths("/workspace/hardware"))

project.addDocument("sheets/power.SchDoc", { uniqueId: "POWER-SHEET" })
project.addVariant("Production", { description: "Shipping configuration" })
console.log(project.getDocumentGraph("/workspace/hardware").nodes)
```

Targeted PCB edits can be applied transactionally and exported as an undoable
change set:

```ts
import {
  reassignPcbRecordLayer,
  renamePcbNet,
  runPcbEditTransaction,
} from "altiumts"

const result = runPcbEditTransaction(board, (draft) => {
  renamePcbNet(draft, 1, "USB_D+")
  const track = draft.getRecordsByKind("Track")[0]
  if (track) reassignPcbRecordLayer(draft, track, "BOTTOM")
})

console.log(result.validation, result.changeSet)
```

## Reference files

Download the pinned SimpleFOC Mini, SimpleFOC Shield, Hyperpolyglot, Elk Pi,
Novena, and TI TMDS62LEVM Altium PCB/schematic references:

```sh
bun run download-references
bun run inventory-references
bun run inventory-schema
bun run benchmark
```

The TI fixture is extracted from the official nested SPRCAL9 Rev. B archive.
Its 60.5 MB PCB and all 57 binary schematic sheets exercise large
multilayer-board parsing, strict validation, board contours, polygon cutouts,
embedded schematic images, exact untouched round trips, and PCB/schematic SVG
rendering in CI.

Then run the complete suite:

```sh
bun test
bun run test:update-svg
bun run typecheck
bun run format:check
bun run build
bun run verify:browser
bun run verify:package
```

The imported reference files are not committed to this repository. Their
generated `.snap.svg` visual baselines are committed and compared with
`bun-match-svg`.

## Current limitations

Binary writing, semantic `.SchLib`/`.PcbLib`/`.IntLib` parsing, a complete
Altium rule evaluator, Circuit JSON conversion, and licensed Altium reopen
tests are not implemented. Library headers are detected so callers receive an
explicit unsupported-feature error instead of accidental document parsing.
Unverified fields, trailing bytes, streams, embedded blobs, and unknown records
are retained for inspection and exact untouched round trips. Project-level
variant fitted-state overlays and fully populated generated title blocks are
not yet reconstructed when an individual `.SchDoc` is rendered in isolation.

See [CHECKLIST.md](./CHECKLIST.md) for the implementation roadmap and
[docs/format-references.md](./docs/format-references.md) for research sources.
The checklist intentionally keeps fixture-, license-, and reverse-engineering-
dependent work open.

The packed npm artifact is limited to 1 MB compressed and 5 MB unpacked. The
minified browser-compatible core bundle is limited to 1.5 MB; both budgets are
enforced by repository scripts and CI.
