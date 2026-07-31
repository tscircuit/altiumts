# altiumts implementation checklist

This is the living roadmap for turning the current ASCII `.PcbDoc` prototype
into a dependable TypeScript toolkit for reading, inspecting, editing, and
writing Altium files.

- Checked items describe behavior already present in the initial prototype.
- Unchecked items are planned work, not claims about undocumented Altium
  internals.
- Binary layouts, stream names, record IDs, and version-specific behavior must
  be verified against real files before being treated as stable.
- Round-trip safety takes priority over semantic completeness: unknown data
  must be retained whenever possible.

## 1. Scope and compatibility policy

- [x] Define the officially supported Altium Designer versions.
- [x] Define the oldest file versions that must remain readable.
- [x] Define the newest file versions included in the fixture corpus.
- [x] Publish a compatibility matrix by Altium version and file type.
- [x] Distinguish read, write, edit, and exact-round-trip support in the matrix.
- [x] Distinguish ASCII and binary variants of each format.
- [x] Decide whether legacy Protel formats are in scope.
- [x] Decide whether CircuitMaker and CircuitStudio variants are in scope.
- [x] Decide whether Altium 365-specific metadata is in scope.
- [x] Define the browser-runtime support target.
- [x] Define the Node.js support target.
- [x] Define the Bun support target.
- [x] Define acceptable behavior for encrypted or password-protected documents.
- [x] Define acceptable behavior for corrupted or partially recovered files.
- [x] Define a deprecation policy for public APIs and parsed model fields.
- [x] Define a policy for experimental parsers and codecs.
- [x] Add capability flags so callers can query supported operations.
- [x] Add a machine-readable compatibility manifest.
- [x] Add format/version detection without requiring a filename extension.

## 2. Existing prototype foundation

- [x] Publish a TypeScript-first package structure with `lib/` and `tests/`.
- [x] Provide a common `AltiumNode` base class.
- [x] Provide generic `getChildren()` tree walking.
- [x] Provide an `AltiumPcbDoc` root class.
- [x] Provide `parseAltiumPcbDoc()` for ASCII PCB documents.
- [x] Provide the generic `parseAltiumAscii()` parser.
- [x] Provide deterministic `getString()` serialization.
- [x] Preserve record order.
- [x] Preserve field order.
- [x] Preserve duplicate fields.
- [x] Preserve unknown record kinds.
- [x] Preserve malformed lines in permissive mode.
- [x] Preserve CR, LF, CRLF, and mixed line endings.
- [x] Provide strict and permissive ASCII parsing modes.
- [x] Provide basic string, boolean, number, and measurement field accessors.
- [x] Model common PCB record kinds as dedicated classes.
- [x] Download a pinned, licensed real-world reference board.
- [x] Round-trip the current reference board exactly.
- [x] Run test, typecheck/build, and format/lint checks in CI.
- [x] Build ESM JavaScript and TypeScript declarations.
- [x] Add a stable package-level error hierarchy.
- [x] Add source-location metadata to parsed text, binary, and container nodes.
- [x] Add structured warnings without requiring thrown errors.
- [x] Add immutable or copy-on-write APIs where useful.
- [x] Add a visitor API in addition to `getChildren()`.
- [x] Add a transformer API that can replace or remove nodes.
- [x] Add parent/document references without creating serialization cycles.
- [x] Add source-derived stable node IDs for editor and diff tooling.

## 3. Format research and reference corpus

- [x] Inventory every Altium file extension we intend to support.
- [x] Collect ASCII and binary `.PcbDoc` files from multiple independent
      projects.
- [x] Collect ASCII and binary `.SchDoc` files from multiple independent
      projects.
- [ ] Collect `.PcbLib` files from multiple Altium releases.
- [ ] Collect `.SchLib` files from multiple Altium releases.
- [ ] Collect `.IntLib` files with multiple embedded libraries.
- [ ] Collect `.PrjPcb` and related project files.
- [ ] Collect `.OutJob` files.
- [ ] Collect workspace/session files if they are in scope.
- [ ] Collect files using Unicode names, values, and paths.
- [ ] Collect files using every common unit system.
- [ ] Collect single-layer, two-layer, multilayer, flex, and rigid-flex boards.
- [ ] Collect boards with blind, buried, micro, and stacked vias.
- [ ] Collect boards with differential pairs and length tuning.
- [ ] Collect boards with polygons, split planes, rooms, and embedded boards.
- [ ] Collect boards with component bodies and linked 3D models.
- [ ] Collect hierarchical and multichannel schematics.
- [ ] Collect schematics with harnesses, buses, directives, and variants.
- [ ] Collect schematic and PCB libraries with large component counts.
- [ ] Collect files containing unknown/newer record and field types.
- [ ] Collect intentionally malformed and truncated files.
- [ ] Collect files with empty streams and zero-length records.
- [x] Record the license and provenance of every downloadable fixture.
- [x] Pin every external fixture to an immutable commit or content digest.
- [x] Store fixture SHA-256 hashes and verify downloads.
- [x] Avoid committing third-party fixtures unless their licenses permit it.
- [ ] Add synthetic fixture generators for cases that cannot be redistributed.
- [ ] Add minimal one-feature fixtures for each entity or encoding.
- [x] Add a multi-megabyte real-world stress-test fixture.
- [ ] Add an anonymization tool for private customer fixtures.
- [x] Add a corpus inventory script that reports formats, versions, and record
      and stream counts.
- [x] Add stream-family inventory for unknown binary content.
- [ ] Add a fixture minimizer for reducing parser failures.
- [x] Document all external format references and reverse-engineering sources.
- [ ] Track unresolved format questions in issues linked from this checklist.

## 4. Input detection and decoding

- [x] Detect ASCII Altium record streams.
- [x] Detect OLE/CFB compound binary documents by magic bytes.
- [x] Detect ZIP-based containers where applicable.
- [x] Detect INI-like project and job files.
- [x] Detect XML-based Altium formats where applicable.
- [x] Detect UTF-8 BOMs.
- [x] Detect UTF-16 LE and UTF-16 BE BOMs.
- [x] Fall back to Windows-1252 for non-UTF-8 text.
- [x] Provide an explicit encoding override.
- [x] Return the detected format, encoding, and confidence.
- [x] Reject binary input passed to a text-only parser with a helpful error.
- [x] Add `parseAltiumFile(Uint8Array, options)` as the main auto-detect entrypoint.
- [x] Add `parseAltiumFileFromPath()` as an optional Node/Bun convenience API.
- [x] Keep the core parser independent of filesystem APIs.
- [x] Preserve an original-byte snapshot when exact untouched serialization is
      possible.
- [x] Detect truncated compound-file headers before invoking deeper parsers.
- [x] Impose configurable file-size limits before allocating large buffers.

## 5. Diagnostics and error handling

- [x] Create an `AltiumError` base class.
- [x] Create `AltiumSyntaxError`.
- [x] Create `AltiumFormatDetectionError`.
- [x] Create `AltiumUnsupportedVersionError`.
- [x] Create `AltiumUnsupportedFeatureError`.
- [x] Create `AltiumCorruptContainerError`.
- [x] Create `AltiumTruncatedRecordError`.
- [x] Create `AltiumSerializationError`.
- [x] Add byte offsets to binary errors.
- [x] Add line and column locations to text errors.
- [ ] Add stream paths and record indexes to container errors.
- [x] Add record kind and field name context where available.
- [x] Support warning, error, and fatal diagnostic severities.
- [x] Support diagnostic codes suitable for programmatic handling.
- [x] Provide a callback or collector for nonfatal diagnostics.
- [x] Define strict, compatible, and recovery parsing modes.
- [x] Make recovery decisions visible in diagnostics.
- [x] Never silently drop bytes or fields during recovery.
- [x] Add readable error excerpts with bounded context.
- [x] Redact potentially sensitive field values from diagnostics on request.

## 6. Core AST and model architecture

- [x] Separate syntax-level nodes from semantic convenience models.
- [ ] Define a stable discriminated union for every public node type.
- [x] Define a base document interface shared by all root documents.
- [x] Define a base record interface shared by text and binary records.
- [ ] Define a raw/unknown node for every parse layer.
- [ ] Preserve original raw bytes on unknown binary nodes.
- [x] Preserve original raw text on unknown text nodes.
- [x] Track dirty state at field, record, stream, and document levels.
- [x] Reuse untouched raw source when a node has not changed.
- [x] Define deterministic ordering for newly authored records and fields.
- [x] Preserve original ordering for parsed records and fields.
- [x] Define how duplicate keys are queried and mutated.
- [x] Add first, last, and all-occurrence field accessors.
- [x] Add insertion APIs that specify position relative to other fields.
- [x] Add mutation APIs for replacing one duplicate occurrence.
- [x] Add cloning APIs.
- [x] Add deep equality APIs.
- [x] Add structural hashing for nodes.
- [x] Add typed references between records where indexes/IDs are used.
- [x] Add a document-level repository for resolving indexes and unique IDs.
- [x] Make dangling references representable.
- [x] Preserve unresolved references during serialization.
- [ ] Add lazy decoding for large streams and payloads.
- [ ] Add lazy loading for embedded images and 3D model blobs.
- [x] Lazily materialize compound-file stream contents on first access.
- [x] Add a stable JSON representation for debugging and interchange.
- [ ] Add JSON import only after round-trip semantics are defined.
- [ ] Add type guards for every public node subclass.
- [ ] Add exhaustive visitors for compile-time coverage.
- [x] Add generic search helpers by record kind, field, layer, and owner.

## 7. ASCII record parser completeness

- [x] Split records while preserving their original terminators.
- [x] Parse ordered `KEY=VALUE` fields.
- [x] Preserve empty and malformed field segments.
- [x] Preserve unknown record kinds.
- [x] Support BOM-prefixed files.
- [ ] Verify whether literal pipe characters can occur in field values.
- [ ] Implement every verified escape convention.
- [x] Decode `%UTF8%` field variants in binary property records.
- [ ] Handle triple-pipe UTF-8 terminators where applicable.
- [x] Preserve key casing.
- [x] Define optional case-insensitive and decoded lookup helpers.
- [x] Preserve whitespace around keys and values when encountered.
- [x] Distinguish absent values from empty values.
- [x] Distinguish raw numeric text from normalized numeric values.
- [x] Preserve exponent spelling and precision.
- [x] Preserve boolean spelling (`T/F`, `TRUE/FALSE`, and variants).
- [x] Preserve unit spelling and casing.
- [ ] Parse embedded backtick-delimited configuration payloads.
- [ ] Parse nested serialized hashes only behind an explicit codec.
- [x] Preserve unparsed nested configuration payloads exactly.
- [x] Support records longer than the current real-world examples.
- [x] Add configurable maximum line and field counts.
- [x] Add streaming/incremental ASCII parsing.
- [x] Add an async iterable parser for large text files.
- [x] Add a streaming serializer.
- [ ] Add fuzz tests for delimiters, empty segments, and malformed fields.

## 8. ASCII `.PcbDoc` typed records

### Board and document metadata

- [x] Add `AltiumBoardRecord`.
- [x] Model file kind, format version, date, and time.
- [x] Model board origin and sheet settings.
- [x] Model display units.
- [x] Model board grid settings.
- [x] Model layer stack records.
- [x] Model layer sub-stack and layer-pair metadata.
- [ ] Verify true rigid-flex sub-stack behavior against a fixture with a flex
      stack region.
- [x] Model dielectric properties.
- [x] Model copper thickness and material metadata.
- [x] Model V9 controlled-impedance profiles and per-layer/sub-stack
      calculations.
- [ ] Model board-level view configurations.
- [ ] Model 2D and 3D configuration payloads.
- [x] Model board-level unique IDs.
- [x] Model board outline vertices and arcs.
- [x] Model board cutouts.
- [ ] Verify physical board cutouts against a non-degenerate real fixture.
- [ ] Reconcile ASCII files whose physical contour is represented by connected
      `POLYGONOUTLINE` keepout primitives instead of the larger `Board` contour.
- [x] Model embedded board settings.
- [x] Preserve application-specific configuration fields that are not semantic
      PCB data.

### Connectivity

- [x] Add `AltiumNetRecord`.
- [x] Model net IDs/indexes and names.
- [x] Model net classes.
- [x] Model differential-pair definitions.
- [x] Model from-to connectivity records.
- [x] Model connection/ratsnest records.
- [x] Resolve primitive net indexes to `AltiumNetRecord` references.
- [x] Resolve component ownership indexes.
- [x] Resolve polygon and rule indexes.
- [x] Preserve dangling or invalid indexes.
- [x] Add connectivity graph construction.
- [x] Add helpers for querying connected primitives.

### Components

- [x] Add `AltiumComponentRecord`.
- [x] Model designators, comments, footprints, and library references.
- [x] Model component position, rotation, and side.
- [x] Model component locking and selection flags.
- [x] Model component channels and source schematic identifiers.
- [ ] Model component parameters.
- [ ] Model component variants and fitted/not-fitted state.
- [ ] Model component rooms and classes.
- [x] Model union/group membership.
- [x] Model component body ownership.
- [x] Resolve owned pads, text, tracks, arcs, fills, and regions.
- [x] Add ergonomic component-bounds helpers.

### Pads

- [x] Add `AltiumPadRecord`.
- [x] Model pad names/numbers and ownership.
- [x] Model through-hole and SMD behavior.
- [ ] Model connector and test-point behavior from fixture-verified fields.
- [x] Model simple and top/middle/bottom pad-stack shapes.
- [ ] Verify full-stack pad geometry against a real `PADMODE=2` fixture.
- [x] Model round, rectangle, rounded-rectangle, and octagonal shapes.
- [ ] Model custom and region-based shapes.
- [x] Render asymmetric round pads as rotated obround/stadium shapes.
- [x] Model X/Y size by layer.
- [x] Model hole size and round, square, and slot shapes.
- [x] Model slot length and rotation.
- [x] Model plated and non-plated holes.
- [x] Model paste and solder-mask expansions.
- [ ] Model thermal relief settings.
- [x] Model local stack/mode flags.
- [x] Model pad-level net and pin references.
- [x] Model pad tenting flags.
- [ ] Model pad test-point flags from a real test-point fixture.
- [ ] Preserve unsupported per-layer pad stack fields.

### Vias

- [x] Add `AltiumViaRecord`.
- [x] Model via position, diameter, and hole size.
- [x] Model start and end layers.
- [x] Model through and blind/buried via types.
- [ ] Model via templates and local overrides.
- [x] Model via tenting.
- [ ] Model via solder-mask expansion from a real via-mask fixture.
- [ ] Model thermal relief settings.
- [x] Model via net references.
- [ ] Model via stitching and shielding metadata.
- [ ] Preserve unsupported via-stack fields.

### Tracks and arcs

- [x] Add `AltiumTrackRecord`.
- [x] Add `AltiumArcRecord`.
- [x] Model start/end points.
- [x] Model width and layer.
- [x] Model center, radius, start angle, and end angle for arcs.
- [x] Model net and component ownership.
- [x] Model keepout and polygon-outline flags.
- [x] Model user-routed state.
- [x] Model track union membership and unique IDs.
- [ ] Model arc union membership and unique IDs from fixture-verified fields.
- [x] Add exact geometry helpers without changing serialized precision.
- [x] Handle zero-length tracks and full-circle arcs.

### Fills, regions, and polygons

- [x] Add `AltiumFillRecord`.
- [x] Add `AltiumRegionRecord`.
- [x] Add `AltiumPolygonRecord`.
- [x] Model fill bounds and rotation.
- [x] Model region contours and holes.
- [x] Model region kind and layer.
- [x] Model polygon vertices, arcs, and contour holes.
- [x] Model polygon pour order and priority.
- [ ] Model polygon connect style and thermal settings.
- [x] Model shelved, unpoured, and poured polygon states.
- [x] Model polygon cutouts.
- [ ] Model split-plane regions.
- [x] Distinguish source regions from generated region-fill primitives.
- [x] Preserve generated-pour caches without treating them as authoritative.
- [x] Add polygon geometry validation.

### Text and dimensions

- [x] Add `AltiumTextRecord`.
- [x] Model text content and special strings.
- [x] Model font selection, stroke width, and text height.
- [x] Model justification, mirroring, rotation, and inversion.
- [ ] Model barcode and TrueType text options where present.
- [x] Model component designator/comment semantics.
- [x] Add `AltiumDimensionRecord`.
- [ ] Model linear, radial, angular, ordinate, baseline, and center dimensions.
- [x] Model dimension units, precision, prefixes, and suffixes.
- [x] Add `AltiumCoordinateRecord`.
- [ ] Preserve unsupported text rendering metadata.

### Models, bodies, rooms, and embedded content

- [x] Add `AltiumComponentBodyRecord`.
- [x] Add `AltiumModelRecord`.
- [x] Model 3D body type, position, rotation, standoff, and opacity.
- [x] Model extruded body outlines.
- [x] Model embedded STEP model references from component bodies.
- [ ] Resolve linked external STEP model references.
- [x] Model generic 3D model metadata.
- [x] Extract and decompress embedded model blobs on demand.
- [ ] Reinsert untouched embedded model blobs byte-for-byte.
- [x] Add `AltiumRoomRecord`.
- [x] Model room boundaries and rule references.
- [x] Add embedded-board records.
- [x] Resolve embedded-board transforms and source paths.

### Rules, classes, parameters, and options

- [x] Add `AltiumRuleRecord`.
- [x] Add `AltiumDxpRuleRecord`.
- [x] Model rule name, priority, scope expressions, and enabled state.
- [x] Model clearance rules.
- [x] Model width rules, including per-layer constraints.
- [x] Model via-style rules.
- [x] Model routing-layer rules.
- [x] Model differential-pair rules.
- [x] Model matched-length rules.
- [ ] Model absolute length rules from a real fixture.
- [x] Model impedance rules.
- [x] Model plane and polygon-connect rules.
- [x] Model solder-mask and paste-mask rules.
- [x] Model manufacturing height, hole-size, silk, mask-sliver, and testpoint
      rule fields.
- [ ] Model remaining manufacturing and assembly rule kinds from verified
      fixtures.
- [x] Preserve unknown rule kinds and opaque scope expressions.
- [x] Add `AltiumClassRecord`.
- [x] Model net, component, layer, pad, and rule classes.
- [x] Add `AltiumParameterRecord`.
- [x] Model option/configuration record families.
- [x] Treat printer, Gerber, DRC, ECO, and placer options as typed records where
      useful.
- [ ] Preserve tool UI state separately from design semantics.

### Remaining and future record kinds

- [x] Inventory all record kinds found across the reference corpus.
- [x] Register every verified PCB primitive record kind.
- [ ] Add a test fixture for every registered record class.
- [ ] Document unsupported fields on partially modeled record kinds.
- [x] Fail typed access predictably when required fields are absent.
- [x] Continue preserving unregistered record kinds as
      `AltiumUnknownRecord`.

## 9. Units, coordinates, angles, and geometry

- [x] Create an `AltiumMeasurement` value class.
- [x] Preserve raw measurement text alongside normalized values.
- [x] Support mil, inch, mm, cm, and verified internal coordinate units.
- [ ] Verify unit conversion constants against exported Altium files.
- [x] Avoid floating-point drift in parse/serialize cycles.
- [ ] Consider fixed-point integers or decimal arithmetic for coordinates.
- [x] Model coordinates, points, vectors, sizes, and bounding boxes.
- [x] Model rotations and angle normalization without rewriting untouched text.
- [x] Model colors from Altium integer color values.
- [x] Add initial layer-name and layer-ID normalization.
- [x] Preserve unknown layer IDs with a stable fallback name.
- [x] Add geometry helpers for arcs, polygons, and regions.
- [x] Add contour winding helpers.
- [x] Add geometry bounds for every currently rendered primitive.
- [x] Add transforms for component-owned primitives.
- [x] Add board-coordinate and component-local-coordinate conversions.
- [x] Add layer-stack region geometry.
- [ ] Verify rigid-flex stack-region geometry against a true flex fixture.
- [x] Add tolerance-aware comparisons for tests only.

## 10. OLE/CFB compound-file container support

- [x] Implement a bounded, dependency-free Compound File Binary reader.
- [x] Evaluate browser compatibility of the chosen CFB implementation.
- [x] Audit the dependency's license and security posture.
- [x] Parse the CFB header and sector sizes.
- [x] Parse DIFAT, FAT, MiniFAT, and directory sectors.
- [x] Parse regular and mini streams.
- [x] Preserve directory entry names exactly.
- [x] Preserve directory hierarchy.
- [x] Preserve stream ordering where observable.
- [x] Preserve CLSIDs, state bits, timestamps, and stream metadata.
- [x] Preserve empty storages and streams.
- [x] Detect FAT loops and invalid sector references.
- [x] Enforce bounds while following sector chains.
- [x] Add limits for chain length, directory entries, and total file size.
- [x] Expose storages and streams as typed `AltiumNode` classes.
- [x] Provide lazy stream content access.
- [ ] Support replacing one stream without decoding unrelated streams.
- [x] Return the original bytes when the container is untouched.
- [ ] Serialize modified CFB containers deterministically.
- [ ] Test output by reopening it with both altiumts and an independent CFB
      implementation.
- [ ] Compare rewritten files in Altium Designer when access is available.
- [ ] Add corruption and adversarial-container fixtures.
- [ ] Document which CFB metadata cannot be reproduced exactly.

## 11. Binary record infrastructure

- [x] Implement bounded little-endian byte readers.
- [x] Implement bounded byte writers.
- [x] Implement the bounded signed/unsigned integer and floating-point reads
      required by the first PCB primitive codecs.
- [x] Implement fixed-point internal-coordinate decoding for tracks, arcs, and
      vias.
- [x] Implement Pascal/length-prefixed string codecs.
- [x] Implement UTF-8, UTF-16, and Windows-1252 decoding where verified.
- [x] Implement null-terminated property payload handling where verified.
- [x] Implement GUID/UUID codecs.
- [x] Implement date/time codecs where verified.
- [x] Implement bit-field helpers.
- [x] Implement enum codecs that preserve unknown numeric values.
- [x] Implement bounded length-prefixed property and primitive framing.
- [ ] Verify two-byte-length plus type-byte record framing where it occurs.
- [x] Support record formats with alternate header sizes.
- [x] Detect record lengths that exceed the containing stream.
- [x] Preserve unknown property-record payload bytes.
- [ ] Preserve padding and alignment bytes.
- [x] Preserve decoded record ordering.
- [x] Add record-level dirty tracking.
- [ ] Serialize untouched records from their original payload bytes.
- [x] Add hex-dump and annotated-record debugging utilities.
- [ ] Add differential tests against an independent parser where licensing
      permits.
- [ ] Fuzz every binary primitive and record-framing codec.

## 12. Binary `.PcbDoc` support

- [x] Identify and verify the `Board6` root/header streams.
- [x] Inventory all stream/storage families in the binary reference corpus.
- [x] Verify the `*6` stream convention against the current corpus.
- [x] Implement board property/header stream parsing.
- [x] Implement layer-stack metadata parsing from board properties.
- [x] Implement component property stream parsing.
- [x] Implement net property stream parsing.
- [x] Implement class property stream parsing.
- [x] Implement rule stream parsing.
- [x] Implement initial track stream parsing.
- [x] Implement initial arc stream parsing.
- [x] Implement initial pad stream parsing, including nested subrecord framing
      and common geometry fields.
- [x] Implement initial via stream parsing.
- [x] Implement text stream parsing.
- [x] Implement fill stream parsing.
- [x] Implement region stream parsing.
- [x] Decode source `ShapeBasedRegions6` geometry separately from generated
      `Regions6` fill caches.
- [x] Decode and classify `BoardRegions` layer-stack-region geometry in the
      current binary corpus.
- [ ] Verify binary physical board-cutout regions against a real fixture.
- [x] Decode extended region vertices with arc centers, radii, and angles.
- [x] Implement polygon property stream parsing; binary polygon primitives and
      pours remain pending.
- [ ] Implement dimension stream parsing.
- [x] Implement component-body stream parsing.
- [x] Implement model metadata and embedded model stream parsing.
- [x] Implement wide-string table parsing.
- [x] Resolve stream-local string/index tables.
- [x] Resolve owner, component, net, rule, and polygon indexes.
- [x] Preserve unknown streams without decoding them.
- [ ] Preserve unknown records inside known streams.
- [x] Build the same semantic PCB model from ASCII and binary input.
- [ ] Serialize model edits back to binary streams.
- [ ] Add binary-to-ASCII and ASCII-to-binary conversion only after both
      serializers are independently reliable.
- [ ] Validate rewritten documents by reopening them in Altium Designer.

## 13. `.SchDoc` schematic support

- [x] Add an `AltiumSchDoc` root class.
- [x] Add `parseAltiumSchDoc()`.
- [x] Detect ASCII and binary schematic variants.
- [x] Parse and validate schematic headers.
- [x] Add parent/owned-record queries from owner indexes.
- [x] Preserve record order independently of ownership queries.
- [x] Parse sheet/header records as source-preserving property records.
- [x] Implement component records.
- [x] Implement common pin property records.
- [ ] Implement IEEE symbol records.
- [x] Implement labels and net labels.
- [x] Implement wires and junctions.
- [x] Implement buses.
- [x] Implement ports and power ports.
- [ ] Implement harness connectors, entries, and harness wires.
- [ ] Implement No ERC markers.
- [x] Implement parameter-set objects.
- [x] Implement designators.
- [x] Implement parameters.
- [x] Implement arcs and elliptical arcs.
- [x] Implement polylines and polygons.
- [x] Implement rectangles, rounded rectangles, and ellipses.
- [x] Implement notes.
- [x] Implement image property records.
- [x] Implement sheet symbols and sheet entries.
- [x] Implement sheet names and sheet filenames.
- [x] Implement templates.
- [ ] Implement hyperlinks.
- [x] Implement implementation-list and model-link records.
- [ ] Implement alternate graphical modes and multipart components.
- [ ] Implement hidden pins and pin electrical types.
- [ ] Implement pin name/designator text positioning.
- [x] Implement unique-ID and ownership reference resolution.
- [x] Implement hierarchical document links.
- [ ] Implement multichannel/repeated-sheet metadata.
- [ ] Implement variant and fitted-state metadata.
- [x] Preserve unknown schematic record IDs and property fields.
- [ ] Verify historical record IDs against fixtures before documenting them as
      stable.
- [ ] Add exact round-trip fixtures for every supported schematic version.

## 14. `.SchLib` schematic-library support

- [ ] Add an `AltiumSchLib` root class.
- [ ] Add `parseAltiumSchLib()`.
- [ ] Parse library header and component index information.
- [ ] Enumerate component storages.
- [ ] Parse component aliases.
- [ ] Parse multipart component definitions.
- [ ] Parse display modes.
- [ ] Parse pins and graphical primitives.
- [ ] Parse component parameters.
- [ ] Parse linked footprint/model implementations.
- [ ] Parse simulation and signal-integrity model links where present.
- [ ] Preserve per-component raw storage data.
- [ ] Add ergonomic component lookup by name and alias.
- [ ] Add library component insertion/removal APIs.
- [ ] Add deterministic component storage naming.
- [ ] Round-trip libraries with Unicode component names.
- [ ] Round-trip libraries with duplicate or unusual aliases.
- [ ] Validate rewritten libraries in Altium Designer.

## 15. `.PcbLib` PCB-library support

- [ ] Add an `AltiumPcbLib` root class.
- [ ] Add `parseAltiumPcbLib()`.
- [ ] Parse library headers and footprint indexes.
- [ ] Enumerate footprint/component storages.
- [ ] Parse footprint pads, tracks, arcs, fills, text, and regions.
- [ ] Parse footprint component bodies and 3D models.
- [ ] Parse height, courtyard, assembly, and placement metadata.
- [ ] Parse footprint parameters and descriptions.
- [ ] Parse footprint origin and reference point.
- [ ] Preserve per-footprint raw storage data.
- [ ] Add ergonomic footprint lookup.
- [ ] Add footprint insertion/removal APIs.
- [ ] Add deterministic footprint storage naming.
- [ ] Round-trip Unicode footprint names.
- [ ] Validate rewritten libraries in Altium Designer.

## 16. `.IntLib` integrated-library support

- [ ] Identify and document the integrated-library container structure.
- [ ] Add an `AltiumIntLib` root class.
- [ ] Add `parseAltiumIntLib()`.
- [ ] Enumerate embedded schematic libraries.
- [ ] Enumerate embedded PCB libraries.
- [ ] Enumerate embedded model and database assets.
- [ ] Preserve unknown embedded files.
- [ ] Expose embedded files without eagerly parsing all of them.
- [ ] Allow extraction of embedded libraries.
- [ ] Allow replacement of one embedded library.
- [ ] Rebuild integrated libraries deterministically.
- [ ] Validate rebuilt integrated libraries in Altium Designer.

## 17. Project, workspace, and output-job files

### Projects

- [x] Add an `AltiumPrjPcb` root class.
- [x] Add `parseAltiumPrjPcb()`.
- [x] Preserve INI section and key ordering.
- [x] Preserve duplicate keys and comments.
- [x] Parse document paths and document kinds.
- [x] Parse project options.
- [x] Parse project parameters.
- [x] Parse compiler and ECO settings.
- [x] Parse variant definitions.
- [x] Parse alternate-part definitions.
- [ ] Parse fitted-state definitions from a fixture.
- [x] Parse parameter variations.
- [x] Resolve project-relative paths.
- [x] Support Windows path semantics without requiring Windows.
- [x] Preserve unknown project sections and keys.

### Workspaces and sessions

- [x] Decide whether `.DsnWrk` and session files are in scope.
- [x] Parse workspace project lists.
- [x] Preserve UI/session state separately from design data.
- [x] Avoid serializing machine-specific absolute paths unless explicitly
      changed.

### Output jobs

- [x] Add an `AltiumOutJob` root class.
- [x] Add `parseAltiumOutJob()`.
- [x] Parse output generators.
- [x] Parse output containers.
- [x] Parse variants and data sources.
- [x] Parse and classify Gerber/ODB++/IPC-2581 output settings.
- [x] Parse and classify NC drill output settings.
- [x] Parse and classify pick-and-place output settings.
- [x] Parse and classify BOM output settings.
- [x] Parse and classify drawing/PDF output settings.
- [x] Parse and classify report and validation outputs.
- [x] Preserve unsupported output types and provider-specific settings.

## 18. Serialization and round-trip guarantees

- [x] Define exact, structural, and semantic round-trip levels.
- [x] Report which level is available for a parsed document.
- [x] Return the original bytes for untouched binary documents.
- [x] Return the original text for untouched text documents.
- [x] Preserve unknown fields, records, streams, and embedded blobs in the
      read-only source model.
- [x] Preserve original line endings.
- [x] Preserve original encoding when possible.
- [x] Preserve numeric precision and exponent formatting.
- [x] Preserve duplicate keys and their positions.
- [ ] Preserve padding and alignment bytes.
- [x] Preserve empty streams and storages.
- [x] Preserve timestamps unless a caller opts to update them.
- [x] Preserve GUIDs and unique IDs unless a caller opts to regenerate them.
- [x] Define deterministic formatting for newly authored text records.
- [ ] Define deterministic binary record ordering for newly authored content.
- [x] Define where canonicalization is allowed.
- [x] Add serialization options for canonical versus preserve-source modes.
- [x] Add atomic file-writing helpers for Node/Bun.
- [x] Add validation before serialization.
- [x] Refuse serialization when an edit cannot be represented safely.
- [x] Surface lossy operations explicitly.
- [x] Test parse → serialize → parse model equivalence.
- [x] Test byte equality for untouched documents.
- [x] Test targeted text edits with minimal diffs.
- [ ] Test targeted binary edits with minimal diffs after binary writing exists.
- [ ] Test files by reopening them with Altium Designer when available.

## 19. Semantic model and reference resolution

- [x] Build document indexes lazily.
- [x] Resolve component ownership.
- [x] Resolve net ownership.
- [x] Resolve primitive-to-rule relationships.
- [x] Resolve polygon source/generated relationships.
- [x] Resolve schematic owner indexes.
- [x] Resolve hierarchical sheet relationships.
- [ ] Resolve library references.
- [ ] Resolve model and footprint implementations.
- [x] Resolve project document references.
- [x] Represent missing targets without destroying raw IDs.
- [x] Detect duplicate unique IDs.
- [ ] Add optional unique-ID regeneration.
- [ ] Update dependent references when IDs/indexes change.
- [x] Reindex collections safely after insertion/removal.
- [x] Add connectivity graph APIs.
- [x] Add schematic net graph APIs.
- [x] Add board layer-stack queries.
- [x] Add component/pad/pin cross-probing helpers.
- [x] Add project-level document graph APIs.
- [x] Keep semantic indexes out of deterministic serialized output.

## 20. Validation

- [x] Add structural validation for currently parsed root formats.
- [x] Add required-field validation for typed records.
- [ ] Add enum-value validation while preserving unknown values.
- [x] Add owner/index bounds validation.
- [x] Add unique-ID collision validation.
- [x] Add layer-stack, layer-pair, and impedance-profile reference validation.
- [x] Add primitive layer-reference validation for every verified layer naming
      variant.
- [x] Add net-reference validation.
- [x] Add rule constraint range validation.
- [x] Add geometry sanity validation.
- [x] Add polygon contour validation.
- [x] Add schematic ownership-cycle validation.
- [x] Add project path validation.
- [x] Add container stream consistency validation.
- [x] Separate errors from warnings.
- [x] Allow callers to select validation profiles.
- [x] Avoid pretending to replace Altium's full DRC/ERC engines.
- [x] Export machine-readable validation results.
- [x] Attach validation results to source locations.
- [x] Add repair suggestions without automatically mutating documents.

## 21. Editing and authoring APIs

- [ ] Add object-shaped ergonomic constructors for every typed node.
- [x] Add normalized inputs for points, sizes, angles, and measurements.
- [x] Add document methods for inserting/removing records.
- [x] Add component methods for owned primitives.
- [x] Add board/document methods for nets, classes, and rules.
- [x] Add schematic document methods for components, wires, labels, and ports.
- [ ] Add library methods for components and footprints.
- [x] Add project methods for documents and variants.
- [x] Add safe ID/index allocation.
- [x] Add safe PCB net rename operations.
- [x] Add layer reassignment helpers.
- [x] Add net reassignment helpers.
- [ ] Add component transform helpers.
- [x] Add batch edit transactions.
- [x] Add undoable change-set representation.
- [x] Add document diff generation.
- [x] Add patch application with conflict diagnostics.
- [x] Add source-preserving edits where only changed fields are rewritten.
- [x] Document which APIs can cause canonical reserialization.

## 22. Conversion and tscircuit integration

- [ ] Define a conversion boundary between altiumts syntax models and Circuit
      JSON.
- [ ] Convert Altium PCB layers to Circuit JSON layers.
- [ ] Convert components and footprints.
- [ ] Convert pads and holes.
- [ ] Convert tracks, arcs, vias, fills, regions, and polygons.
- [ ] Convert nets and connectivity.
- [ ] Convert text and board outlines.
- [ ] Convert schematic components and pins.
- [ ] Convert wires, labels, buses, ports, and power symbols.
- [ ] Preserve source IDs for traceability.
- [ ] Emit diagnostics for unsupported conversion features.
- [ ] Avoid putting Circuit JSON dependencies in the low-level parser core.
- [ ] Add optional adapters in a separate module or package.
- [ ] Add Altium-to-Circuit-JSON integration fixtures.
- [ ] Add Circuit-JSON-to-Altium experiments only after authoring is stable.
- [ ] Document unavoidable semantic mismatches.

## 23. Testing strategy

- [x] Add unit tests for basic ASCII parsing and mutation.
- [x] Add an exact real-file ASCII `.PcbDoc` round-trip test.
- [x] Add `bun-match-svg` visual regression infrastructure.
- [x] Add SVG snapshots for every imported PCB and schematic reference.
- [x] Add full-PCB and per-layer visual snapshots.
- [x] Add board-coordinate `viewBox` crops for focused PCB snapshots.
- [x] Add focused snapshots for pad stacks, rounded rectangles, and slots.
- [x] Add focused snapshots for rotated binary fills.
- [x] Add a focused polygon-cutout snapshot.
- [x] Add an isolated mechanical-layer snapshot for component-body contours.
- [x] Add component-owned and net-isolated PCB snapshots.
- [ ] Add tests for every public class and helper.
- [ ] Add tests for every known ASCII record kind.
- [ ] Add tests for every binary record codec.
- [x] Add tests for each currently supported ASCII/binary PCB and schematic
      root.
- [ ] Add tests for every supported Altium version.
- [x] Add tests for mixed and unusual encodings.
- [x] Add tests for Unicode identifiers and values.
- [x] Add tests for duplicate fields and records.
- [ ] Add tests for empty fields, records, streams, and documents.
- [x] Add initial tests for malformed and truncated compound-file input.
- [x] Add initial tests for integer overflow and pathological lengths.
- [ ] Add tests for cyclic and invalid CFB sector chains.
- [x] Add initial tests for parser resource limits.
- [ ] Add property-based tests for text field parsing.
- [ ] Add property-based tests for measurement parsing.
- [ ] Add property-based tests for record framing.
- [ ] Add fuzz testing for ASCII parsing.
- [ ] Add fuzz testing for CFB parsing.
- [ ] Add fuzz testing for every binary stream parser.
- [ ] Add mutation fuzz tests followed by reparse.
- [ ] Add snapshot tests for canonical newly authored output.
- [x] Add structural equivalence tests after round trips.
- [ ] Add minimal-diff tests for targeted edits.
- [x] Add cross-runtime tests for Bun and Node.js.
- [x] Add browser bundling tests.
- [ ] Add performance regression benchmarks.
- [ ] Add memory-use regression benchmarks.
- [ ] Add coverage reporting with meaningful per-format targets.
- [ ] Add a nightly extended-corpus test workflow.
- [ ] Keep PR CI fast with a representative smaller corpus.
- [ ] Add optional Altium Designer smoke tests on an appropriate licensed
      runner.

## 24. Security and robustness

- [x] Treat all input files as untrusted.
- [x] Bound allocations derived from file and record length fields.
- [ ] Bound recursion and ownership-tree depth.
- [x] Bound record, field, stream, and directory counts.
- [x] Detect arithmetic overflow before slicing or allocating.
- [x] Reject paths that escape an extraction directory.
- [x] Sanitize embedded filenames during extraction.
- [x] Avoid executing or dynamically importing embedded content.
- [x] Avoid catastrophic regular expressions.
- [x] Add cancellation points for long text operations.
- [x] Add `AbortSignal` support to async text parsing.
- [ ] Avoid exposing sensitive source data in thrown errors by default.
- [x] Run dependency audits and keep the checked-in graph advisory-free.
- [x] Pin GitHub Actions by trusted major versions or commit hashes.
- [x] Add CodeQL or an equivalent static-analysis workflow.
- [x] Add dependency update automation.
- [ ] Add fuzzing crash corpus retention.
- [x] Document the security-reporting process.

## 25. Performance and scalability

- [x] Establish baseline parse/serialize benchmarks.
- [ ] Benchmark small, medium, and very large boards.
- [ ] Benchmark large schematic and PCB libraries.
- [ ] Avoid copying entire binary buffers unnecessarily.
- [x] Use bounded views/slices for record payloads.
- [x] Add lazy stream decoding.
- [x] Add lazy semantic index construction.
- [x] Add streaming ASCII parsing.
- [x] Add incremental serialization where safe.
- [x] Add cancellation points in long-running text parses.
- [ ] Document expected memory overhead.
- [ ] Detect performance regressions in CI.
- [ ] Keep convenience indexes optional for low-memory use.
- [ ] Evaluate worker-thread/Web Worker parsing for large files.

## 26. Developer tooling

- [x] Add basic PCB-to-SVG serialization.
- [x] Add basic PCB-layer-to-SVG serialization.
- [x] Add basic schematic-sheet-to-SVG serialization.
- [x] Add a CLI package or `altiumts` binary.
- [x] Add `altiumts inspect <file>`.
- [x] Add `altiumts tree <file>`.
- [x] Add `altiumts streams <file>`.
- [x] Add `altiumts records <file>`.
- [x] Add `altiumts validate <file>`.
- [x] Add `altiumts roundtrip <file>`.
- [x] Add `altiumts diff <before> <after>`.
- [x] Add `altiumts extract <file>`.
- [x] Add `altiumts fixture-info <file>`.
- [x] Add JSON output for automation.
- [x] Add bounded hex dumps for unknown binary records.
- [x] Add source-location display for text records.
- [ ] Add a browser-based document inspector.
- [ ] Add a record/stream search UI.
- [x] Add a fixture corpus report.
- [x] Add scripts for identifying new record kinds and fields.
- [ ] Add scripts for comparing output across Altium versions.
- [x] Add a release-size check.
- [ ] Add API Extractor or equivalent public API review if needed.

## 27. Documentation and examples

- [x] Document the initial ASCII `.PcbDoc` API.
- [x] Document the current binary/schematic capabilities and limitations.
- [x] Add architecture documentation.
- [x] Add a concise supported-format summary to the README.
- [x] Add a version compatibility table.
- [x] Document strict, permissive, and recovery modes.
- [x] Document round-trip guarantee levels.
- [x] Document unknown-node behavior.
- [x] Document mutation and dirty-state behavior.
- [x] Document encoding behavior.
- [x] Document measurement and coordinate handling.
- [x] Add an ASCII PCB inspection/edit example.
- [x] Add a targeted PCB edit example.
- [x] Add a binary PCB inspection example.
- [x] Add a schematic inspection example.
- [ ] Add a schematic-library lookup example.
- [ ] Add a PCB-library footprint extraction example.
- [x] Add a project variant example.
- [ ] Add a Circuit JSON conversion example.
- [ ] Add API reference generation.
- [x] Add contributor guidance for implementing a new record class.
- [x] Add contributor guidance for adding licensed fixtures.
- [x] Add format-research notes.
- [x] Add a changelog.
- [x] Add a security policy.
- [ ] Add a code of conduct if required by the organization.

## 28. Package and release engineering

- [x] Produce ESM and `.d.ts` outputs.
- [x] Verify package contents with `npm pack --dry-run`.
- [x] Decide that CommonJS output is not required for the ESM-first package.
- [x] Add explicit `sideEffects` metadata.
- [x] Add runtime and package-size budgets.
- [x] Add a package export subpath for Node-only helpers.
- [x] Keep Node-only helpers out of the browser-compatible core export.
- [x] Add browser bundle validation.
- [x] Add source maps.
- [ ] Add provenance/SBOM generation.
- [x] Add npm publishing automation.
- [x] Add versioning automation consistent with tscircuit repositories.
- [ ] Add pre-release channels for experimental format support.
- [x] Define semantic-versioning rules for AST changes.
- [x] Define how newly recognized unknown records affect versioning.
- [x] Publish release notes with compatibility changes.
- [ ] Sign or attest release artifacts.
- [ ] Verify clean installation in a new project.
- [ ] Verify TypeScript imports under common module-resolution modes.
- [x] Verify Bun and Node.js ESM consumption.
- [x] Publish only after the public API and support claims match reality.

## 29. Milestone exit criteria

### Milestone A: production-quality ASCII `.PcbDoc` reader

- [x] All common PCB record kinds in the corpus have typed classes.
- [x] Unknown records and fields round-trip exactly.
- [x] Every corpus fixture round-trips exactly when untouched.
- [x] Diagnostics include useful line/record context.
- [ ] Resource limits and fuzz tests are in place.
- [x] The compatibility matrix accurately describes tested versions.
- [ ] The public ASCII API is documented and stable.

### Milestone B: binary `.PcbDoc` reader

- [x] CFB parsing is bounded and security-tested.
- [x] Common PCB streams and records are decoded.
- [x] Unknown streams and records are preserved.
- [x] Binary documents build the shared semantic PCB model.
- [x] The binary corpus reparses successfully after untouched serialization.
- [ ] Targeted edits can be reopened in Altium Designer.

### Milestone C: schematic and library reader

- [ ] `.SchDoc`, `.SchLib`, and `.PcbLib` root parsers are available.
- [x] Ownership and reference graphs are resolved without losing raw IDs.
- [ ] Common schematic and library entities have typed models.
- [x] Unknown schematic records remain round-trippable.
- [ ] Real-world hierarchical and multipart fixtures pass.

### Milestone D: safe editor and serializer

- [x] Dirty tracking limits rewrites to changed data where feasible.
- [ ] Typed authoring APIs allocate references safely.
- [x] Structural validation runs before writes.
- [x] Lossy edits are rejected or explicitly acknowledged.
- [ ] Rewritten files pass independent parsing and Altium smoke tests.
- [x] Exact, structural, and semantic round-trip guarantees are documented.

### Milestone E: ecosystem integration and stable release

- [ ] Circuit JSON adapters cover the agreed PCB and schematic subset.
- [x] CLI inspection and validation tools are available.
- [ ] Browser and Node/Bun consumption tests pass.
- [ ] Package publishing and provenance automation are operational.
- [x] Documentation and compatibility claims are complete for the tested corpus.
- [x] The remaining unsupported features are clearly enumerated.
