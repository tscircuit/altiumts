import { AltiumBinaryPcbDoc } from "../altium-binary-pcb-doc"
import { AltiumOutJob } from "../altium-out-job"
import { AltiumPcbDoc } from "../altium-pcb-doc"
import type { AltiumPcbDocument } from "../altium-pcb-document"
import { AltiumPrjPcb } from "../altium-prj-pcb"
import { AltiumSchDoc } from "../altium-sch-doc"
import type { AltiumCompoundFile } from "../compound-file/altium-compound-file"
import type {
  AltiumDiagnostic,
  AltiumDiagnosticHandler,
  AltiumDiagnosticSeverity,
} from "../diagnostics/altium-diagnostic"
import { AltiumIniDocument, AltiumIniSectionLine } from "../ini/altium-ini"
import {
  isAltiumPcbNoLayerSentinel,
  isKnownAltiumPcbLayerName,
} from "../pcb-layers"
import { getDanglingPcbReferences } from "../pcb-reference-resolution"
import { AltiumArcRecord } from "../records/altium-arc-record"
import { AltiumPadRecord } from "../records/altium-pad-record"
import { AltiumPolygonRecord } from "../records/altium-polygon-record"
import type { AltiumRecord } from "../records/altium-record"
import {
  type AltiumRuleMeasurementRange,
  type AltiumRuleNumericRange,
  AltiumRuleRecord,
} from "../records/altium-rule-record"
import { AltiumTrackRecord } from "../records/altium-track-record"
import { AltiumViaRecord } from "../records/altium-via-record"
import { getPcbVertexPoints } from "../svg-serialization/altium-values"

export type AltiumValidationProfile = "basic" | "strict"

export interface AltiumValidationIssue extends AltiumDiagnostic {
  nodeId?: string
}

export interface AltiumValidationOptions {
  loadCompoundStreams?: boolean
  maxIssues?: number
  onDiagnostic?: AltiumDiagnosticHandler
  profile?: AltiumValidationProfile
}

export interface AltiumValidationResult {
  issues: AltiumValidationIssue[]
  profile: AltiumValidationProfile
  summary: {
    errors: number
    fatals: number
    warnings: number
  }
  valid: boolean
}

export function validateAltiumDocument(
  document:
    | AltiumPcbDocument
    | AltiumSchDoc
    | AltiumCompoundFile
    | AltiumIniDocument,
  options: AltiumValidationOptions = {},
): AltiumValidationResult {
  const profile = options.profile ?? "basic"
  const issues: AltiumValidationIssue[] = []
  const maximumIssues = options.maxIssues ?? 10_000
  if (!Number.isSafeInteger(maximumIssues) || maximumIssues <= 0) {
    throw new RangeError("maxIssues must be a positive safe integer")
  }
  const report = (
    issue: Omit<AltiumValidationIssue, "severity"> & {
      severity?: AltiumDiagnosticSeverity
    },
  ): void => {
    if (issues.length >= maximumIssues) return
    const diagnostic: AltiumValidationIssue = {
      ...issue,
      severity: issue.severity ?? "error",
    }
    issues.push(diagnostic)
    options.onDiagnostic?.(diagnostic)
  }

  if (
    document instanceof AltiumPcbDoc ||
    document instanceof AltiumBinaryPcbDoc
  ) {
    validatePcbDocument(document, profile, report)
  } else if (document instanceof AltiumSchDoc) {
    validateSchematicDocument(document, profile, report)
  } else if (document instanceof AltiumIniDocument) {
    validateIniDocument(document, profile, report)
  } else {
    validateCompoundFile(document, options, report)
  }

  const summary = {
    errors: issues.filter((issue) => issue.severity === "error").length,
    fatals: issues.filter((issue) => issue.severity === "fatal").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length,
  }
  return {
    issues,
    profile,
    summary,
    valid: summary.errors === 0 && summary.fatals === 0,
  }
}

function validateIniDocument(
  document: AltiumIniDocument,
  profile: AltiumValidationProfile,
  report: (issue: AltiumValidationIssue) => void,
): void {
  const sectionNames = new Map<string, AltiumIniSectionLine[]>()
  for (const line of document.lines) {
    if (!(line instanceof AltiumIniSectionLine)) continue
    const key = line.name.toUpperCase()
    const matching = sectionNames.get(key) ?? []
    matching.push(line)
    sectionNames.set(key, matching)
  }
  for (const [name, headers] of sectionNames) {
    if (headers.length < 2) continue
    report({
      code: "INI_DUPLICATE_SECTION",
      location: headers[1]?.sourceLocation,
      message: `INI section ${name} appears ${headers.length} times`,
      nodeId: headers[1]?.nodeId,
      severity: "warning",
      suggestion:
        "Retain duplicate sections unless the consumer's merge semantics are known.",
    })
  }

  if (document instanceof AltiumPrjPcb) {
    if (document.documents.length === 0) {
      report({
        code: "PROJECT_DOCUMENTS_MISSING",
        message: "Project contains no document references",
        severity: profile === "strict" ? "error" : "warning",
        suggestion: "Add a DocumentPath entry for each design document.",
      })
    }
    for (const reference of document.documents) {
      if (reference.path.includes("\0") || /[\r\n]/u.test(reference.path)) {
        report({
          code: "PROJECT_DOCUMENT_PATH_INVALID",
          location: reference.section.header?.sourceLocation,
          message:
            "Project document path contains an invalid control character",
          severity: "error",
          suggestion:
            "Replace the path with a single-line relative or absolute path.",
        })
      }
      if (/^[a-z]:(?![\\/])/iu.test(reference.path)) {
        report({
          code: "PROJECT_DOCUMENT_PATH_DRIVE_RELATIVE",
          location: reference.section.header?.sourceLocation,
          message: `Project document path ${reference.path} is drive-relative and ambiguous`,
          severity: profile === "strict" ? "error" : "warning",
          suggestion:
            "Use a project-relative path or a drive-rooted absolute path.",
        })
      }
    }
  }

  if (document instanceof AltiumOutJob && document.outputs.length === 0) {
    report({
      code: "OUTPUT_JOB_OUTPUTS_MISSING",
      message: "Output job contains no recognized output generators",
      severity: profile === "strict" ? "error" : "warning",
      suggestion: "Add at least one output generator section.",
    })
  }
}

function validatePcbDocument(
  document: AltiumPcbDocument,
  profile: AltiumValidationProfile,
  report: (issue: AltiumValidationIssue) => void,
): void {
  if (!document.board) {
    report({
      code: "PCB_BOARD_MISSING",
      message: "PCB document has no Board record",
      severity: "fatal",
      suggestion: "Add or restore the Board root record.",
    })
  } else {
    validatePcbLayerStack(document.board, profile, report)
  }

  validatePcbPrimitiveLayerReferences(document, profile, report)

  for (const dangling of getDanglingPcbReferences(document)) {
    report({
      code: `PCB_DANGLING_${dangling.field}`,
      context: {
        fieldName: dangling.field,
        recordKind: dangling.record.recordKind,
      },
      location: dangling.record.sourceLocation,
      message: `${dangling.record.recordKind ?? "Record"} references missing ${dangling.field.toLowerCase()} index ${dangling.index}`,
      nodeId: dangling.record.nodeId,
      severity: dangling.field === "NET" ? "error" : "warning",
      suggestion:
        "Preserve the raw index unless the intended target can be identified.",
    })
  }

  for (const [uniqueId, records] of document.index.duplicateUniqueIds) {
    for (const record of records) {
      report({
        code: "PCB_DUPLICATE_UNIQUE_ID",
        context: { recordKind: record.recordKind },
        location: record.sourceLocation,
        message: `Unique ID ${uniqueId} is used by ${records.length} records`,
        nodeId: record.nodeId,
        severity: "error",
        suggestion: "Regenerate one colliding ID and update its references.",
      })
    }
  }

  for (const record of document.records) {
    validatePcbRecord(record, profile, report)
  }
}

function validatePcbPrimitiveLayerReferences(
  document: AltiumPcbDocument,
  profile: AltiumValidationProfile,
  report: (issue: AltiumValidationIssue) => void,
): void {
  const stack = document.board?.layerStack
  for (const record of document.records) {
    if (record.recordKind === "Board") continue
    for (const fieldName of [
      "LAYER",
      "STARTLAYER",
      "ENDLAYER",
      "FROMLAYER",
      "TOLAYER",
    ]) {
      const layer = record.getDecoded(fieldName)
      if (layer === undefined) continue
      if (
        (fieldName === "FROMLAYER" || fieldName === "TOLAYER") &&
        isAltiumPcbNoLayerSentinel(layer)
      ) {
        continue
      }
      if (isKnownAltiumPcbLayerName(layer, stack)) continue
      report({
        code: "PCB_PRIMITIVE_LAYER_UNKNOWN",
        context: { fieldName, recordKind: record.recordKind },
        location: record.sourceLocation,
        message: `${record.recordKind ?? "Record"} references unknown layer ${layer} in ${fieldName}`,
        nodeId: record.nodeId,
        severity: profile === "strict" ? "error" : "warning",
        suggestion:
          "Preserve the raw layer name and verify it against the document layer stack before editing it.",
      })
    }
  }
}

function validatePcbRecord(
  record: AltiumRecord,
  profile: AltiumValidationProfile,
  report: (issue: AltiumValidationIssue) => void,
): void {
  const required = (
    condition: boolean,
    code: string,
    message: string,
  ): void => {
    if (condition) return
    report({
      code,
      context: { recordKind: record.recordKind },
      location: record.sourceLocation,
      message,
      nodeId: record.nodeId,
      severity: profile === "strict" ? "error" : "warning",
    })
  }

  if (record instanceof AltiumTrackRecord) {
    required(
      record.start !== undefined && record.end !== undefined,
      "PCB_TRACK_ENDPOINT_MISSING",
      "Track is missing a valid start or end point",
    )
    required(
      (record.widthMils ?? 0) > 0,
      "PCB_TRACK_WIDTH_INVALID",
      "Track width must be greater than zero",
    )
    return
  }

  if (record instanceof AltiumArcRecord) {
    required(
      record.center !== undefined,
      "PCB_ARC_CENTER_MISSING",
      "Arc is missing its center point",
    )
    required(
      (record.radiusMils ?? 0) > 0,
      "PCB_ARC_RADIUS_INVALID",
      "Arc radius must be greater than zero",
    )
    return
  }

  if (record instanceof AltiumPadRecord) {
    required(
      record.position !== undefined,
      "PCB_PAD_POSITION_MISSING",
      "Pad is missing its position",
    )
    required(
      record.size !== undefined &&
        record.size.width > 0 &&
        record.size.height > 0,
      "PCB_PAD_SIZE_INVALID",
      "Pad size must have positive X and Y dimensions",
    )
    return
  }

  if (record instanceof AltiumViaRecord) {
    required(
      record.position !== undefined,
      "PCB_VIA_POSITION_MISSING",
      "Via is missing its position",
    )
    required(
      (record.diameterMils ?? 0) > 0,
      "PCB_VIA_DIAMETER_INVALID",
      "Via diameter must be greater than zero",
    )
    required(
      (record.holeSizeMils ?? 0) > 0,
      "PCB_VIA_HOLE_INVALID",
      "Via hole size must be greater than zero",
    )
    if (
      record.diameterMils !== undefined &&
      record.holeSizeMils !== undefined &&
      record.holeSizeMils > record.diameterMils
    ) {
      report({
        code: "PCB_VIA_HOLE_EXCEEDS_DIAMETER",
        location: record.sourceLocation,
        message: "Via hole is larger than its copper diameter",
        nodeId: record.nodeId,
        severity: "error",
      })
    }
    return
  }

  if (record instanceof AltiumPolygonRecord) {
    required(
      getPcbVertexPoints(record).length >= 3,
      "PCB_POLYGON_CONTOUR_INVALID",
      "Polygon contour must contain at least three vertices",
    )
    return
  }

  if (record instanceof AltiumRuleRecord) {
    required(
      Boolean(record.name),
      "PCB_RULE_NAME_MISSING",
      "Rule is missing its name",
    )
    required(
      Boolean(record.ruleKind),
      "PCB_RULE_KIND_MISSING",
      "Rule is missing its rule kind",
    )
    validateRuleMeasurementRange(
      record,
      "width",
      record.widthConstraint,
      report,
    )
    validateRuleMeasurementRange(
      record,
      "via diameter",
      record.viaDiameterConstraint,
      report,
    )
    validateRuleMeasurementRange(
      record,
      "via hole",
      record.viaHoleConstraint,
      report,
    )
    validateRuleMeasurementRange(
      record,
      "differential-pair gap",
      record.differentialPairGap,
      report,
    )
    validateRuleMeasurementRange(
      record,
      "height",
      record.heightConstraint,
      report,
    )
    validateRuleMeasurementRange(
      record,
      "hole size",
      record.holeSizeConstraint,
      report,
    )
    validateRuleNumericRange(
      record,
      "impedance",
      record.impedanceConstraint,
      report,
    )
    for (const constraint of record.layerConstraints) {
      validateRuleMeasurementRange(
        record,
        `${constraint.layer} width`,
        constraint,
        report,
      )
      validateRuleMeasurementRange(
        record,
        `${constraint.layer} gap`,
        constraint.gap,
        report,
      )
    }
    const testPoint = record.testPointSettings
    validateRuleMeasurementRange(
      record,
      "testpoint hole size",
      testPoint?.holeSize,
      report,
    )
    validateRuleMeasurementRange(
      record,
      "testpoint pad size",
      testPoint?.padSize,
      report,
    )
  }
}

function validatePcbLayerStack(
  board: NonNullable<AltiumPcbDocument["board"]>,
  profile: AltiumValidationProfile,
  report: (issue: AltiumValidationIssue) => void,
): void {
  const stack = board.layerStack
  const subStackIds = new Set(
    stack.subStacks.flatMap(({ id }) =>
      id === undefined ? [] : [id.toUpperCase()],
    ),
  )
  const profileIds = new Set(
    stack.impedanceProfiles.flatMap(({ id }) =>
      id === undefined ? [] : [id.toUpperCase()],
    ),
  )
  const severity = profile === "strict" ? "error" : "warning"

  for (const pair of stack.layerPairs) {
    for (const subStackId of pair.subStackIds) {
      if (subStackIds.has(subStackId.toUpperCase())) continue
      report({
        code: "PCB_LAYER_PAIR_SUBSTACK_MISSING",
        location: board.sourceLocation,
        message: `Layer pair ${pair.index} references missing sub-stack ${subStackId}`,
        nodeId: board.nodeId,
        severity,
        suggestion:
          "Restore the referenced sub-stack or remove the dangling ID.",
      })
    }
  }

  for (const configuration of stack.traceImpedanceConfigurations) {
    if (
      configuration.subStackId !== undefined &&
      !subStackIds.has(configuration.subStackId.toUpperCase())
    ) {
      report({
        code: "PCB_IMPEDANCE_SUBSTACK_MISSING",
        location: board.sourceLocation,
        message: `Trace-impedance configuration ${configuration.index} references missing sub-stack ${configuration.subStackId}`,
        nodeId: board.nodeId,
        severity,
      })
    }
    if (
      configuration.profileId !== undefined &&
      !profileIds.has(configuration.profileId.toUpperCase())
    ) {
      report({
        code: "PCB_IMPEDANCE_PROFILE_MISSING",
        location: board.sourceLocation,
        message: `Trace-impedance configuration ${configuration.index} references missing profile ${configuration.profileId}`,
        nodeId: board.nodeId,
        severity,
      })
    }
  }
}

function validateRuleMeasurementRange(
  record: AltiumRuleRecord,
  label: string,
  range: AltiumRuleMeasurementRange | undefined,
  report: (issue: AltiumValidationIssue) => void,
): void {
  validateRuleRange(
    record,
    label,
    range?.minimumMils,
    range?.preferredMils,
    range?.maximumMils,
    report,
  )
}

function validateRuleNumericRange(
  record: AltiumRuleRecord,
  label: string,
  range: AltiumRuleNumericRange | undefined,
  report: (issue: AltiumValidationIssue) => void,
): void {
  validateRuleRange(
    record,
    label,
    range?.minimum,
    range?.preferred,
    range?.maximum,
    report,
  )
}

function validateRuleRange(
  record: AltiumRuleRecord,
  label: string,
  minimum: number | undefined,
  preferred: number | undefined,
  maximum: number | undefined,
  report: (issue: AltiumValidationIssue) => void,
): void {
  if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
    report({
      code: "PCB_RULE_RANGE_INVERTED",
      context: { recordKind: record.recordKind },
      location: record.sourceLocation,
      message: `${record.name ?? record.ruleKind ?? "Rule"} has ${label} minimum ${minimum} greater than maximum ${maximum}`,
      nodeId: record.nodeId,
      severity: "error",
    })
  }
  if (
    preferred !== undefined &&
    ((minimum !== undefined && preferred < minimum) ||
      (maximum !== undefined && preferred > maximum))
  ) {
    report({
      code: "PCB_RULE_PREFERRED_OUT_OF_RANGE",
      context: { recordKind: record.recordKind },
      location: record.sourceLocation,
      message: `${record.name ?? record.ruleKind ?? "Rule"} has ${label} preferred value ${preferred} outside its minimum/maximum range`,
      nodeId: record.nodeId,
      severity: "error",
    })
  }
}

function validateSchematicDocument(
  document: AltiumSchDoc,
  profile: AltiumValidationProfile,
  report: (issue: AltiumValidationIssue) => void,
): void {
  if (!document.header && document.getRecordsByKind("31").length === 0) {
    report({
      code: "SCHEMATIC_ROOT_MISSING",
      message: "Schematic has neither a header nor a sheet record",
      severity: "fatal",
    })
  }

  for (const record of document.records) {
    const ownerIndex = record.getNumber("OWNERINDEX")
    if (
      ownerIndex !== undefined &&
      ownerIndex >= 0 &&
      ownerIndex >= document.records.length
    ) {
      report({
        code: "SCHEMATIC_OWNER_OUT_OF_BOUNDS",
        context: {
          fieldName: "OWNERINDEX",
          recordKind: record.recordKind,
        },
        location: record.sourceLocation,
        message: `${record.recordKind ?? "Record"} owner index ${ownerIndex} exceeds the ${document.records.length}-record document`,
        nodeId: record.nodeId,
        severity: "error",
        suggestion: "Preserve the raw owner index until its target is known.",
      })
    }
  }

  for (const cycle of document.index.getOwnershipCycles()) {
    report({
      code: "SCHEMATIC_OWNERSHIP_CYCLE",
      location: cycle[0]?.sourceLocation,
      message: `Schematic ownership cycle contains ${cycle.length} records`,
      nodeId: cycle[0]?.nodeId,
      severity: "error",
      suggestion: "Break the owner cycle without reordering unrelated records.",
    })
  }

  for (const [uniqueId, records] of document.index.duplicateUniqueIds) {
    report({
      code: "SCHEMATIC_DUPLICATE_UNIQUE_ID",
      location: records[0]?.sourceLocation,
      message: `Unique ID ${uniqueId} is used by ${records.length} schematic records`,
      nodeId: records[0]?.nodeId,
      severity: profile === "strict" ? "error" : "warning",
    })
  }
}

function validateCompoundFile(
  document: AltiumCompoundFile,
  options: AltiumValidationOptions,
  report: (issue: AltiumValidationIssue) => void,
): void {
  if (
    document.header.sectorSize !== 512 &&
    document.header.sectorSize !== 4096
  ) {
    report({
      code: "CFB_SECTOR_SIZE_INVALID",
      location: document.sourceLocation,
      message: `Unexpected CFB sector size ${document.header.sectorSize}`,
      severity: "fatal",
    })
  }
  if (!options.loadCompoundStreams) return
  for (const stream of document.streams) {
    if (stream.content.byteLength !== stream.metadata.size) {
      report({
        code: "CFB_STREAM_SIZE_MISMATCH",
        location: stream.sourceLocation,
        message: `${stream.pathString} declares ${stream.metadata.size} bytes but exposes ${stream.content.byteLength}`,
        nodeId: stream.nodeId,
        severity: "error",
      })
    }
  }
}
