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

- [ ] Define the officially supported Altium Designer versions.
- [ ] Define the oldest file versions that must remain readable.
- [ ] Define the newest file versions included in the fixture corpus.
- [ ] Publish a compatibility matrix by Altium version and file type.
- [ ] Distinguish read, write, edit, and exact-round-trip support in the matrix.
- [ ] Distinguish ASCII and binary variants of each format.
- [ ] Decide whether legacy Protel formats are in scope.
- [ ] Decide whether CircuitMaker and CircuitStudio variants are in scope.
- [ ] Decide whether Altium 365-specific metadata is in scope.
- [ ] Define the browser-runtime support target.
- [ ] Define the Node.js support target.
- [ ] Define the Bun support target.
- [ ] Define acceptable behavior for encrypted or password-protected documents.
- [ ] Define acceptable behavior for corrupted or partially recovered files.
- [ ] Define a deprecation policy for public APIs and parsed model fields.
- [ ] Define a policy for experimental parsers and codecs.
- [ ] Add capability flags so callers can query supported operations.
- [ ] Add a machine-readable compatibility manifest.
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
- [ ] Add source-location metadata to every parsed node.
- [ ] Add structured warnings without requiring thrown errors.
- [ ] Add immutable or copy-on-write APIs where useful.
- [ ] Add a visitor API in addition to `getChildren()`.
- [ ] Add a transformer API that can replace or remove nodes.
- [ ] Add parent/document references without creating serialization cycles.
- [ ] Add stable node IDs for editor and diff tooling.

## 3. Format research and reference corpus

- [ ] Inventory every Altium file extension we intend to support.
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
- [ ] Detect ZIP-based containers where applicable.
- [ ] Detect INI-like project and job files.
- [ ] Detect XML-based Altium formats where applicable.
- [x] Detect UTF-8 BOMs.
- [x] Detect UTF-16 LE and UTF-16 BE BOMs.
- [x] Fall back to Windows-1252 for non-UTF-8 text.
- [ ] Provide an explicit encoding override.
- [x] Return the detected format, encoding, and confidence.
- [ ] Reject binary input passed to a text-only parser with a helpful error.
- [x] Add `parseAltiumFile(Uint8Array, options)` as the main auto-detect entrypoint.
- [ ] Add `parseAltiumFileFromPath()` as an optional Node/Bun convenience API.
- [x] Keep the core parser independent of filesystem APIs.
- [x] Preserve an original-byte snapshot when exact untouched serialization is
      possible.
- [x] Detect truncated compound-file headers before invoking deeper parsers.
- [x] Impose configurable file-size limits before allocating large buffers.

## 5. Diagnostics and error handling

- [x] Create an `AltiumError` base class.
- [ ] Create `AltiumSyntaxError`.
- [x] Create `AltiumFormatDetectionError`.
- [x] Create `AltiumUnsupportedVersionError`.
- [ ] Create `AltiumUnsupportedFeatureError`.
- [x] Create `AltiumCorruptContainerError`.
- [x] Create `AltiumTruncatedRecordError`.
- [ ] Create `AltiumSerializationError`.
- [x] Add byte offsets to binary errors.
- [ ] Add line and column locations to text errors.
- [ ] Add stream paths and record indexes to container errors.
- [ ] Add record kind and field name context where available.
- [ ] Support warning, error, and fatal diagnostic severities.
- [x] Support diagnostic codes suitable for programmatic handling.
- [ ] Provide a callback or collector for nonfatal diagnostics.
- [ ] Define strict, compatible, and recovery parsing modes.
- [ ] Make recovery decisions visible in diagnostics.
- [ ] Never silently drop bytes or fields during recovery.
- [ ] Add readable error excerpts with bounded context.
- [ ] Redact potentially sensitive field values from diagnostics on request.

## 6. Core AST and model architecture

- [ ] Separate syntax-level nodes from semantic convenience models.
- [ ] Define a stable discriminated union for every public node type.
- [ ] Define a base document interface shared by all root documents.
- [ ] Define a base record interface shared by text and binary records.
- [ ] Define a raw/unknown node for every parse layer.
- [ ] Preserve original raw bytes on unknown binary nodes.
- [ ] Preserve original raw text on unknown text nodes.
- [ ] Track dirty state at field, record, stream, and document levels.
- [ ] Reuse untouched raw source when a node has not changed.
- [ ] Define deterministic ordering for newly authored records and fields.
- [ ] Preserve original ordering for parsed records and fields.
- [ ] Define how duplicate keys are queried and mutated.
- [ ] Add first, last, and all-occurrence field accessors.
- [ ] Add insertion APIs that specify position relative to other fields.
- [ ] Add mutation APIs for replacing one duplicate occurrence.
- [ ] Add cloning APIs.
- [ ] Add deep equality APIs.
- [ ] Add structural hashing for nodes.
- [ ] Add typed references between records where indexes/IDs are used.
- [ ] Add a document-level repository for resolving indexes and unique IDs.
- [ ] Make dangling references representable.
- [ ] Preserve unresolved references during serialization.
- [ ] Add lazy decoding for large streams and payloads.
- [ ] Add lazy loading for embedded images and 3D model blobs.
- [ ] Add a stable JSON representation for debugging and interchange.
- [ ] Add JSON import only after round-trip semantics are defined.
- [ ] Add type guards for every public node subclass.
- [ ] Add exhaustive visitors for compile-time coverage.
- [ ] Add generic search helpers by record kind, field, layer, and owner.

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
- [ ] Preserve whitespace around keys and values when encountered.
- [ ] Distinguish absent values from empty values.
- [ ] Distinguish raw numeric text from normalized numeric values.
- [ ] Preserve exponent spelling and precision.
- [ ] Preserve boolean spelling (`T/F`, `TRUE/FALSE`, and variants).
- [ ] Preserve unit spelling and casing.
- [ ] Parse embedded backtick-delimited configuration payloads.
- [ ] Parse nested serialized hashes only behind an explicit codec.
- [ ] Preserve unparsed nested configuration payloads exactly.
- [ ] Support records longer than the current real-world examples.
- [ ] Add configurable maximum line and field counts.
- [ ] Add streaming/incremental ASCII parsing.
- [ ] Add an async iterable parser for large text files.
- [ ] Add a streaming serializer.
- [ ] Add fuzz tests for delimiters, empty segments, and malformed fields.

## 8. ASCII `.PcbDoc` typed records

### Board and document metadata

- [x] Add `AltiumBoardRecord`.
- [ ] Model file kind, format version, date, and time.
- [ ] Model board origin and sheet settings.
- [ ] Model display units and grid settings.
- [ ] Model layer stack records.
- [ ] Model rigid-flex sub-stacks.
- [ ] Model dielectric properties.
- [ ] Model copper thickness and material metadata.
- [ ] Model board-level view configurations.
- [ ] Model 2D and 3D configuration payloads.
- [ ] Model board-level unique IDs.
- [ ] Model board outline vertices and arcs.
- [ ] Model board cutouts.
- [ ] Reconcile ASCII files whose physical contour is represented by connected
      `POLYGONOUTLINE` keepout primitives instead of the larger `Board` contour.
- [ ] Model embedded board settings.
- [ ] Preserve application-specific configuration fields that are not semantic
      PCB data.

### Connectivity

- [x] Add `AltiumNetRecord`.
- [ ] Model net IDs/indexes and names.
- [ ] Model net classes.
- [ ] Model differential-pair definitions.
- [ ] Model from-to connectivity records.
- [ ] Model connection/ratsnest records.
- [ ] Resolve primitive net indexes to `AltiumNetRecord` references.
- [ ] Resolve component ownership indexes.
- [ ] Resolve polygon and rule indexes.
- [ ] Preserve dangling or invalid indexes.
- [ ] Add connectivity graph construction.
- [ ] Add helpers for querying connected primitives.

### Components

- [x] Add `AltiumComponentRecord`.
- [ ] Model designators, comments, footprints, and library references.
- [ ] Model component position, rotation, and side.
- [ ] Model component locking and selection flags.
- [ ] Model component channels and source schematic identifiers.
- [ ] Model component parameters.
- [ ] Model component variants and fitted/not-fitted state.
- [ ] Model component rooms and classes.
- [ ] Model union/group membership.
- [ ] Model component body ownership.
- [ ] Resolve owned pads, text, tracks, arcs, fills, and regions.
- [ ] Add ergonomic component-bounds helpers.

### Pads

- [x] Add `AltiumPadRecord`.
- [ ] Model pad names/numbers and ownership.
- [ ] Model through-hole, SMD, connector, and test-point behavior.
- [ ] Model top, middle, bottom, and full-stack shapes.
- [ ] Model rounded rectangle, octagonal, custom, and region-based shapes.
- [x] Render asymmetric round pads as rotated obround/stadium shapes.
- [ ] Model X/Y size by layer.
- [ ] Model hole size and hole shape.
- [ ] Model slot length and rotation.
- [ ] Model plated and non-plated holes.
- [ ] Model paste and solder-mask expansions.
- [ ] Model thermal relief settings.
- [ ] Model local stack/mode flags.
- [ ] Model pad-level net and pin references.
- [ ] Model pad tenting and test-point flags.
- [ ] Preserve unsupported per-layer pad stack fields.

### Vias

- [x] Add `AltiumViaRecord`.
- [ ] Model via position, diameter, and hole size.
- [ ] Model start and end layers.
- [ ] Model through, blind, buried, micro, and stacked via types.
- [ ] Model via templates and local overrides.
- [ ] Model solder-mask expansion and tenting.
- [ ] Model thermal relief settings.
- [ ] Model via net references.
- [ ] Model via stitching and shielding metadata.
- [ ] Preserve unsupported via-stack fields.

### Tracks and arcs

- [x] Add `AltiumTrackRecord`.
- [x] Add `AltiumArcRecord`.
- [ ] Model start/end points.
- [ ] Model width and layer.
- [ ] Model center, radius, start angle, and end angle for arcs.
- [ ] Model net and component ownership.
- [ ] Model keepout and polygon-outline flags.
- [ ] Model user-routed state.
- [ ] Model union membership and unique IDs.
- [ ] Add exact geometry helpers without changing serialized precision.
- [ ] Handle zero-length tracks and full-circle arcs.

### Fills, regions, and polygons

- [ ] Add `AltiumFillRecord`.
- [x] Add `AltiumRegionRecord`.
- [x] Add `AltiumPolygonRecord`.
- [ ] Model fill bounds and rotation.
- [x] Model region contours and holes.
- [x] Model region kind and layer.
- [ ] Model polygon vertices, arcs, and contour holes.
- [ ] Model polygon pour order and priority.
- [ ] Model polygon connect style and thermal settings.
- [ ] Model shelved, unpoured, and poured polygon states.
- [ ] Model polygon cutouts.
- [ ] Model split-plane regions.
- [x] Distinguish source regions from generated region-fill primitives.
- [x] Preserve generated-pour caches without treating them as authoritative.
- [ ] Add polygon geometry validation.

### Text and dimensions

- [x] Add `AltiumTextRecord`.
- [ ] Model text content and special strings.
- [x] Model font selection, stroke width, and text height.
- [x] Model justification, mirroring, rotation, and inversion.
- [ ] Model barcode and TrueType text options where present.
- [ ] Model component designator/comment semantics.
- [ ] Add `AltiumDimensionRecord`.
- [ ] Model linear, radial, angular, ordinate, baseline, and center dimensions.
- [ ] Model dimension units, precision, prefixes, and suffixes.
- [ ] Add `AltiumCoordinateRecord`.
- [ ] Preserve unsupported text rendering metadata.

### Models, bodies, rooms, and embedded content

- [ ] Add `AltiumComponentBodyRecord`.
- [ ] Model 3D body type, position, rotation, standoff, and opacity.
- [ ] Model extruded body outlines.
- [ ] Model linked and embedded STEP model references.
- [ ] Model generic 3D model metadata.
- [ ] Extract embedded model blobs without loading them eagerly.
- [ ] Reinsert untouched embedded model blobs byte-for-byte.
- [ ] Add `AltiumRoomRecord`.
- [ ] Model room boundaries, rules, and component membership.
- [ ] Add embedded-board records.
- [ ] Resolve embedded-board transforms and source paths.

### Rules, classes, parameters, and options

- [ ] Add `AltiumRuleRecord`.
- [ ] Add `AltiumDxpRuleRecord`.
- [ ] Model rule name, priority, scope expressions, and enabled state.
- [ ] Model clearance rules.
- [ ] Model width rules.
- [ ] Model via-style rules.
- [ ] Model routing-layer rules.
- [ ] Model differential-pair rules.
- [ ] Model length and matched-length rules.
- [ ] Model impedance rules.
- [ ] Model plane and polygon-connect rules.
- [ ] Model solder-mask and paste-mask rules.
- [ ] Model manufacturing and assembly rules.
- [ ] Preserve unknown rule kinds and opaque scope expressions.
- [ ] Add `AltiumClassRecord`.
- [ ] Model net, component, layer, pad, and rule classes.
- [ ] Add `AltiumParameterRecord`.
- [ ] Model option/configuration record families.
- [ ] Treat printer, Gerber, DRC, ECO, and placer options as typed records where
      useful.
- [ ] Preserve tool UI state separately from design semantics.

### Remaining and future record kinds

- [ ] Inventory all record kinds found across the reference corpus.
- [ ] Register every verified PCB primitive record kind.
- [ ] Add a test fixture for every registered record class.
- [ ] Document unsupported fields on partially modeled record kinds.
- [ ] Fail typed access predictably when required fields are absent.
- [ ] Continue preserving unregistered record kinds as
      `AltiumUnknownRecord`.

## 9. Units, coordinates, angles, and geometry

- [ ] Create an `AltiumMeasurement` value class.
- [ ] Preserve raw measurement text alongside normalized values.
- [ ] Support mil, inch, mm, cm, and verified internal coordinate units.
- [ ] Verify unit conversion constants against exported Altium files.
- [ ] Avoid floating-point drift in parse/serialize cycles.
- [ ] Consider fixed-point integers or decimal arithmetic for coordinates.
- [ ] Model coordinates, points, vectors, sizes, and bounding boxes.
- [ ] Model rotations and angle normalization without rewriting untouched text.
- [ ] Model colors from Altium integer color values.
- [x] Add initial layer-name and layer-ID normalization.
- [x] Preserve unknown layer IDs with a stable fallback name.
- [ ] Add geometry helpers for arcs, polygons, and regions.
- [ ] Add contour winding and hole classification.
- [ ] Add geometry bounds for every primitive.
- [ ] Add transforms for component-owned primitives.
- [ ] Add board-coordinate and component-local-coordinate conversions.
- [ ] Add rigid-flex stack-region geometry.
- [ ] Add tolerance-aware comparisons for tests only.

## 10. OLE/CFB compound-file container support

- [x] Implement a bounded, dependency-free Compound File Binary reader.
- [ ] Evaluate browser compatibility of the chosen CFB implementation.
- [ ] Audit the dependency's license and security posture.
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
- [ ] Provide lazy stream content access.
- [ ] Support replacing one stream without decoding unrelated streams.
- [x] Return the original bytes when the container is untouched.
- [ ] Serialize modified CFB containers deterministically.
- [ ] Test output by reopening it with both altiumts and an independent CFB
      implementation.
- [ ] Compare rewritten files in Altium Designer when access is available.
- [ ] Add corruption and adversarial-container fixtures.
- [ ] Document which CFB metadata cannot be reproduced exactly.

## 11. Binary record infrastructure

- [ ] Implement bounded little-endian byte readers.
- [ ] Implement bounded byte writers.
- [x] Implement the bounded signed/unsigned integer and floating-point reads
      required by the first PCB primitive codecs.
- [x] Implement fixed-point internal-coordinate decoding for tracks, arcs, and
      vias.
- [ ] Implement Pascal/length-prefixed string codecs.
- [x] Implement UTF-8, UTF-16, and Windows-1252 decoding where verified.
- [x] Implement null-terminated property payload handling where verified.
- [ ] Implement GUID/UUID codecs.
- [ ] Implement date/time codecs where verified.
- [ ] Implement bit-field helpers.
- [ ] Implement enum codecs that preserve unknown numeric values.
- [x] Implement bounded length-prefixed property and primitive framing.
- [ ] Verify two-byte-length plus type-byte record framing where it occurs.
- [ ] Support record formats with alternate header sizes.
- [x] Detect record lengths that exceed the containing stream.
- [ ] Preserve unknown record payload bytes.
- [ ] Preserve padding and alignment bytes.
- [x] Preserve decoded record ordering.
- [ ] Add record-level dirty tracking.
- [ ] Serialize untouched records from their original payload bytes.
- [ ] Add hex-dump and annotated-record debugging utilities.
- [ ] Add differential tests against an independent parser where licensing
      permits.
- [ ] Fuzz every binary primitive and record-framing codec.

## 12. Binary `.PcbDoc` support

- [x] Identify and verify the `Board6` root/header streams.
- [x] Inventory all stream/storage families in the binary reference corpus.
- [x] Verify the `*6` stream convention against the current corpus.
- [x] Implement board property/header stream parsing.
- [ ] Implement layer-stack stream parsing.
- [x] Implement component property stream parsing.
- [x] Implement net property stream parsing.
- [x] Implement class property stream parsing.
- [ ] Implement rule stream parsing.
- [x] Implement initial track stream parsing.
- [x] Implement initial arc stream parsing.
- [x] Implement initial pad stream parsing, including nested subrecord framing
      and common geometry fields.
- [x] Implement initial via stream parsing.
- [x] Implement text stream parsing.
- [ ] Implement fill stream parsing.
- [x] Implement region stream parsing.
- [x] Decode source `ShapeBasedRegions6` geometry separately from generated
      `Regions6` fill caches.
- [x] Decode `BoardRegions` cutout geometry.
- [x] Decode extended region vertices with arc centers, radii, and angles.
- [x] Implement polygon property stream parsing; binary polygon primitives and
      pours remain pending.
- [ ] Implement dimension stream parsing.
- [ ] Implement component-body stream parsing.
- [ ] Implement model metadata and embedded model stream parsing.
- [x] Implement wide-string table parsing.
- [x] Resolve stream-local string/index tables.
- [ ] Resolve owner, component, net, rule, and polygon indexes.
- [x] Preserve unknown streams without decoding them.
- [ ] Preserve unknown records inside known streams.
- [ ] Build the same semantic PCB model from ASCII and binary input.
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
- [ ] Implement component records.
- [ ] Implement pin records, including binary pin payloads.
- [ ] Implement IEEE symbol records.
- [ ] Implement labels and net labels.
- [ ] Implement wires and junctions.
- [ ] Implement buses and bus entries.
- [ ] Implement ports and power ports.
- [ ] Implement harness connectors, entries, and harness wires.
- [ ] Implement No ERC markers.
- [ ] Implement directives and parameter-set objects.
- [ ] Implement designators and comments.
- [ ] Implement parameters.
- [ ] Implement arcs and elliptical arcs.
- [ ] Implement lines, polylines, polygons, and Beziers.
- [ ] Implement rectangles, rounded rectangles, ellipses, and pie charts.
- [ ] Implement text frames and notes.
- [ ] Implement images and embedded image payloads.
- [ ] Implement sheet symbols and sheet entries.
- [ ] Implement sheet names and sheet filenames.
- [ ] Implement templates.
- [ ] Implement hyperlinks.
- [ ] Implement implementation-list and model-link records.
- [ ] Implement alternate graphical modes and multipart components.
- [ ] Implement hidden pins and pin electrical types.
- [ ] Implement pin name/designator text positioning.
- [ ] Implement unique-ID and ownership reference resolution.
- [ ] Implement hierarchical document links.
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

- [ ] Add an `AltiumPrjPcb` root class.
- [ ] Add `parseAltiumPrjPcb()`.
- [ ] Preserve INI section and key ordering.
- [ ] Preserve duplicate keys and comments.
- [ ] Parse document paths and document kinds.
- [ ] Parse project options.
- [ ] Parse project parameters.
- [ ] Parse compiler and ECO settings.
- [ ] Parse variant definitions.
- [ ] Parse alternate-part and fitted-state definitions.
- [ ] Parse parameter variations.
- [ ] Resolve project-relative paths.
- [ ] Support Windows path semantics without requiring Windows.
- [ ] Preserve unknown project sections and keys.

### Workspaces and sessions

- [ ] Decide whether `.DsnWrk` and session files are in scope.
- [ ] Parse workspace project lists if supported.
- [ ] Preserve UI/session state separately from design data.
- [ ] Avoid serializing machine-specific absolute paths unless explicitly
      changed.

### Output jobs

- [ ] Add an `AltiumOutJob` root class.
- [ ] Add `parseAltiumOutJob()`.
- [ ] Parse output generators.
- [ ] Parse output containers.
- [ ] Parse variants and data sources.
- [ ] Parse Gerber/ODB++/IPC-2581 settings where present.
- [ ] Parse NC drill settings.
- [ ] Parse pick-and-place settings.
- [ ] Parse BOM settings.
- [ ] Parse drawing/PDF settings.
- [ ] Parse report and validation outputs.
- [ ] Preserve unsupported output types and provider-specific settings.

## 18. Serialization and round-trip guarantees

- [ ] Define exact, structural, and semantic round-trip levels.
- [ ] Report which level is available for a parsed document.
- [x] Return the original bytes for untouched binary documents.
- [x] Return the original text for untouched text documents.
- [x] Preserve unknown fields, records, streams, and embedded blobs in the
      read-only source model.
- [x] Preserve original line endings.
- [ ] Preserve original encoding when possible.
- [ ] Preserve numeric precision and exponent formatting.
- [ ] Preserve duplicate keys and their positions.
- [ ] Preserve padding and alignment bytes.
- [ ] Preserve empty streams and storages.
- [ ] Preserve timestamps unless a caller opts to update them.
- [ ] Preserve GUIDs and unique IDs unless a caller opts to regenerate them.
- [ ] Define deterministic formatting for newly authored text records.
- [ ] Define deterministic binary record ordering for newly authored content.
- [ ] Define where canonicalization is allowed.
- [ ] Add serialization options for canonical versus preserve-source modes.
- [ ] Add atomic file-writing helpers for Node/Bun.
- [ ] Add validation before serialization.
- [ ] Refuse serialization when an edit cannot be represented safely.
- [ ] Surface lossy operations explicitly.
- [ ] Test parse → serialize → parse model equivalence.
- [x] Test byte equality for untouched documents.
- [ ] Test targeted edits with minimal binary/text diffs.
- [ ] Test files by reopening them with Altium Designer when available.

## 19. Semantic model and reference resolution

- [ ] Build document indexes lazily.
- [ ] Resolve component ownership.
- [ ] Resolve net ownership.
- [ ] Resolve primitive-to-rule relationships.
- [ ] Resolve polygon source/generated relationships.
- [ ] Resolve schematic owner indexes.
- [ ] Resolve hierarchical sheet relationships.
- [ ] Resolve library references.
- [ ] Resolve model and footprint implementations.
- [ ] Resolve project document references.
- [ ] Represent missing targets without destroying raw IDs.
- [ ] Detect duplicate unique IDs.
- [ ] Add optional unique-ID regeneration.
- [ ] Update dependent references when IDs/indexes change.
- [ ] Reindex collections safely after insertion/removal.
- [ ] Add connectivity graph APIs.
- [ ] Add schematic net graph APIs.
- [ ] Add board layer-stack queries.
- [ ] Add component/pad/pin cross-probing helpers.
- [ ] Add project-level document graph APIs.
- [ ] Keep semantic indexes out of deterministic serialized output.

## 20. Validation

- [ ] Add structural validation for every root format.
- [ ] Add required-field validation for typed records.
- [ ] Add enum-value validation while preserving unknown values.
- [ ] Add owner/index bounds validation.
- [ ] Add unique-ID collision validation.
- [ ] Add layer-reference validation.
- [ ] Add net-reference validation.
- [ ] Add geometry sanity validation.
- [ ] Add polygon contour validation.
- [ ] Add schematic ownership-cycle validation.
- [ ] Add project path validation.
- [ ] Add container stream consistency validation.
- [ ] Separate errors from warnings.
- [ ] Allow callers to select validation profiles.
- [ ] Avoid pretending to replace Altium's full DRC/ERC engines.
- [ ] Export machine-readable validation results.
- [ ] Attach validation results to source locations.
- [ ] Add repair suggestions without automatically mutating documents.

## 21. Editing and authoring APIs

- [ ] Add object-shaped ergonomic constructors for every typed node.
- [ ] Add normalized inputs for points, sizes, angles, and measurements.
- [ ] Add document methods for inserting/removing records.
- [ ] Add component methods for owned primitives.
- [ ] Add board methods for nets, classes, and rules.
- [ ] Add schematic methods for components, wires, labels, and ports.
- [ ] Add library methods for components and footprints.
- [ ] Add project methods for documents and variants.
- [ ] Add safe ID/index allocation.
- [ ] Add safe rename operations that update references.
- [ ] Add layer reassignment helpers.
- [ ] Add net reassignment helpers.
- [ ] Add component transform helpers.
- [ ] Add batch edit transactions.
- [ ] Add undoable change-set representation.
- [ ] Add document diff generation.
- [ ] Add patch application with conflict diagnostics.
- [ ] Add source-preserving edits where only changed fields are rewritten.
- [ ] Document which APIs can cause canonical reserialization.

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
- [ ] Add tests for every public class and helper.
- [ ] Add tests for every known ASCII record kind.
- [ ] Add tests for every binary record codec.
- [x] Add tests for each currently supported ASCII/binary PCB and schematic
      root.
- [ ] Add tests for every supported Altium version.
- [ ] Add tests for mixed and unusual encodings.
- [ ] Add tests for Unicode identifiers and values.
- [ ] Add tests for duplicate fields and records.
- [ ] Add tests for empty fields, records, streams, and documents.
- [x] Add initial tests for malformed and truncated compound-file input.
- [ ] Add tests for integer overflow and pathological lengths.
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
- [ ] Add structural equivalence tests after round trips.
- [ ] Add minimal-diff tests for targeted edits.
- [ ] Add cross-runtime tests for Bun and Node.js.
- [ ] Add browser bundling tests.
- [ ] Add performance regression benchmarks.
- [ ] Add memory-use regression benchmarks.
- [ ] Add coverage reporting with meaningful per-format targets.
- [ ] Add a nightly extended-corpus test workflow.
- [ ] Keep PR CI fast with a representative smaller corpus.
- [ ] Add optional Altium Designer smoke tests on an appropriate licensed
      runner.

## 24. Security and robustness

- [ ] Treat all input files as untrusted.
- [ ] Bound every allocation derived from file content.
- [ ] Bound recursion and ownership-tree depth.
- [ ] Bound record, field, stream, and directory counts.
- [ ] Detect arithmetic overflow before slicing or allocating.
- [ ] Reject paths that escape an extraction directory.
- [ ] Sanitize embedded filenames during extraction.
- [ ] Avoid executing or dynamically importing embedded content.
- [ ] Avoid catastrophic regular expressions.
- [ ] Add timeouts/cancellation for long operations.
- [ ] Add `AbortSignal` support to async parsing and downloads.
- [ ] Avoid exposing sensitive source data in thrown errors by default.
- [ ] Run dependency audits.
- [ ] Pin GitHub Actions by trusted major versions or commit hashes.
- [ ] Add CodeQL or an equivalent static-analysis workflow.
- [ ] Add dependency update automation.
- [ ] Add fuzzing crash corpus retention.
- [ ] Document the security-reporting process.

## 25. Performance and scalability

- [ ] Establish baseline parse/serialize benchmarks.
- [ ] Benchmark small, medium, and very large boards.
- [ ] Benchmark large schematic and PCB libraries.
- [ ] Avoid copying entire binary buffers unnecessarily.
- [ ] Use bounded views/slices for record payloads.
- [ ] Add lazy stream decoding.
- [ ] Add lazy semantic index construction.
- [ ] Add streaming ASCII parsing.
- [ ] Add incremental serialization where safe.
- [ ] Add cancellation points in long-running parses.
- [ ] Document expected memory overhead.
- [ ] Detect performance regressions in CI.
- [ ] Keep convenience indexes optional for low-memory use.
- [ ] Evaluate worker-thread/Web Worker parsing for large files.

## 26. Developer tooling

- [x] Add basic PCB-to-SVG serialization.
- [x] Add basic PCB-layer-to-SVG serialization.
- [x] Add basic schematic-sheet-to-SVG serialization.
- [ ] Add a CLI package or `altiumts` binary.
- [ ] Add `altiumts inspect <file>`.
- [ ] Add `altiumts tree <file>`.
- [ ] Add `altiumts streams <file>`.
- [ ] Add `altiumts records <file>`.
- [ ] Add `altiumts validate <file>`.
- [ ] Add `altiumts roundtrip <file>`.
- [ ] Add `altiumts diff <before> <after>`.
- [ ] Add `altiumts extract <file>`.
- [ ] Add `altiumts fixture-info <file>`.
- [ ] Add JSON output for automation.
- [ ] Add bounded hex dumps for unknown binary records.
- [ ] Add source-location display for text records.
- [ ] Add a browser-based document inspector.
- [ ] Add a record/stream search UI.
- [x] Add a fixture corpus report.
- [ ] Add scripts for identifying new record kinds and fields.
- [ ] Add scripts for comparing output across Altium versions.
- [ ] Add a release-size check.
- [ ] Add API Extractor or equivalent public API review if needed.

## 27. Documentation and examples

- [x] Document the initial ASCII `.PcbDoc` API.
- [x] Document the current binary/schematic capabilities and limitations.
- [ ] Add architecture documentation.
- [x] Add a concise supported-format summary to the README.
- [ ] Add a version compatibility table.
- [ ] Document strict, permissive, and recovery modes.
- [ ] Document round-trip guarantee levels.
- [ ] Document unknown-node behavior.
- [ ] Document mutation and dirty-state behavior.
- [ ] Document encoding behavior.
- [ ] Document measurement and coordinate handling.
- [x] Add an ASCII PCB inspection/edit example.
- [ ] Add a targeted PCB edit example.
- [x] Add a binary PCB inspection example.
- [x] Add a schematic inspection example.
- [ ] Add a schematic-library lookup example.
- [ ] Add a PCB-library footprint extraction example.
- [ ] Add a project variant example.
- [ ] Add a Circuit JSON conversion example.
- [ ] Add API reference generation.
- [ ] Add contributor guidance for implementing a new record class.
- [ ] Add contributor guidance for adding licensed fixtures.
- [x] Add format-research notes.
- [ ] Add a changelog.
- [ ] Add a security policy.
- [ ] Add a code of conduct if required by the organization.

## 28. Package and release engineering

- [x] Produce ESM and `.d.ts` outputs.
- [x] Verify package contents with `npm pack --dry-run`.
- [ ] Decide whether CommonJS output is required.
- [ ] Add explicit `sideEffects` metadata.
- [ ] Add runtime and package-size budgets.
- [ ] Add package export subpaths if format modules grow large.
- [ ] Keep Node-only helpers out of the browser-compatible core export.
- [ ] Add browser bundle validation.
- [ ] Add source maps.
- [ ] Add provenance/SBOM generation.
- [ ] Add npm publishing automation.
- [ ] Add versioning automation consistent with tscircuit repositories.
- [ ] Add pre-release channels for experimental format support.
- [ ] Define semantic-versioning rules for AST changes.
- [ ] Define how newly recognized unknown records affect versioning.
- [ ] Publish release notes with compatibility changes.
- [ ] Sign or attest release artifacts.
- [ ] Verify clean installation in a new project.
- [ ] Verify TypeScript imports under common module-resolution modes.
- [ ] Verify Bun, Node.js, and bundler consumption.
- [ ] Publish only after the public API and support claims match reality.

## 29. Milestone exit criteria

### Milestone A: production-quality ASCII `.PcbDoc` reader

- [ ] All common PCB record kinds in the corpus have typed classes.
- [ ] Unknown records and fields round-trip exactly.
- [ ] Every corpus fixture round-trips exactly when untouched.
- [ ] Diagnostics include useful line/record context.
- [ ] Resource limits and fuzz tests are in place.
- [ ] The compatibility matrix accurately describes tested versions.
- [ ] The public ASCII API is documented and stable.

### Milestone B: binary `.PcbDoc` reader

- [ ] CFB parsing is bounded and security-tested.
- [ ] Common PCB streams and records are decoded.
- [ ] Unknown streams and records are preserved.
- [ ] Binary documents build the shared semantic PCB model.
- [ ] The binary corpus reparses successfully after untouched serialization.
- [ ] Targeted edits can be reopened in Altium Designer.

### Milestone C: schematic and library reader

- [ ] `.SchDoc`, `.SchLib`, and `.PcbLib` root parsers are available.
- [ ] Ownership and reference graphs are resolved without losing raw IDs.
- [ ] Common schematic and library entities have typed models.
- [ ] Unknown records remain round-trippable.
- [ ] Real-world hierarchical and multipart fixtures pass.

### Milestone D: safe editor and serializer

- [ ] Dirty tracking limits rewrites to changed data where feasible.
- [ ] Typed authoring APIs allocate references safely.
- [ ] Structural validation runs before writes.
- [ ] Lossy edits are rejected or explicitly acknowledged.
- [ ] Rewritten files pass independent parsing and Altium smoke tests.
- [ ] Exact, structural, and semantic round-trip guarantees are documented.

### Milestone E: ecosystem integration and stable release

- [ ] Circuit JSON adapters cover the agreed PCB and schematic subset.
- [ ] CLI inspection and validation tools are available.
- [ ] Browser and Node/Bun consumption tests pass.
- [ ] Package publishing and provenance automation are operational.
- [ ] Documentation and compatibility claims are complete.
- [ ] The remaining unsupported features are clearly enumerated.
