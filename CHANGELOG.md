# Changelog

All notable changes are recorded here. Before 1.0, breaking API changes use a
minor release and are called out explicitly.

## Unreleased

- Added typed PCB rules, connectivity records, layer-stack metadata, semantic
  indexes, connectivity graphs, and component bounds.
- Added board-grid settings, V8/V9 layer sub-stacks and layer pairs, V9
  controlled-impedance profiles, and typed PCB constraint details for routing,
  impedance, thermal relief, masks, holes, heights, and test points.
- Added typed common schematic records, ownership/hierarchy indexes, and a
  schematic net graph.
- Added source-preserving project, workspace, output-job, and generic INI
  parsing, including document graphs and classified output settings.
- Added source locations, diagnostics, dirty tracking, AST cloning,
  transformations, search, structural hashes, and debug JSON.
- Added measurement, geometry, bounded binary I/O, validation, safe
  serialization, Node filesystem helpers, and the `altiumts` CLI.
- Added rule-range and layer-stack relationship validation for typed PCB
  constraint models.
- Added compatibility metadata, incremental ASCII parsing/serialization, and
  binary source-payload retention.
- Added validated PCB edit transactions, undoable/conflict-checked change
  sets, net/layer reassignment, and safe net renames.
- Added the Node package subpath and CLI, browser/package verification,
  dependency hardening, schema inventory tooling, and parser benchmarks.
