import type { AltiumPrjPcb, AltiumProjectVariant } from "./altium-prj-pcb"
import type { AltiumSchDoc } from "./altium-sch-doc"
import type { AltiumIniSection } from "./ini/altium-ini"
import type { AltiumRecord } from "./records/altium-record"

type SchematicParameterName = string
type SchematicVariantName = string

interface CachedSchematicParameters {
  parameters: Map<SchematicParameterName, string>
  revision: number
}

interface CachedSchematicVariantParameters {
  parametersByVariantName: Map<
    SchematicVariantName,
    Map<SchematicParameterName, string>
  >
  revision: number
}

export interface ResolveSchematicParameterReferenceInput {
  /** Current date text used for Altium's built-in `=CurrentDate` reference. */
  currentDate?: string
  /** Current time text used for Altium's built-in `=CurrentTime` reference. */
  currentTime?: string
  document: AltiumSchDoc
  /** Current schematic filename, including its extension. */
  documentName?: string
  /** Parsed project that supplies user-defined project parameters. */
  project?: AltiumPrjPcb
  /** Current project filename, including its extension. */
  projectName?: string
  /** Record containing the reference, used to resolve component parameters. */
  record?: AltiumRecord
  reference: string
  /** Selected project variant whose parameters override document parameters. */
  variantName?: string
}

interface ResolveParameterInput {
  parameterName: SchematicParameterName
  parameters: ReadonlyMap<SchematicParameterName, string>
  visitedParameterNames: Set<SchematicParameterName>
}

interface AddVariantParameterSectionsInput {
  parameters: Map<SchematicParameterName, string>
  project: AltiumPrjPcb
  variant: AltiumProjectVariant
}

const PARAMETER_REFERENCE = /^=([A-Za-z][A-Za-z0-9_]*)$/u
const DOCUMENT_PARAMETER_CACHE = new WeakMap<
  AltiumSchDoc,
  CachedSchematicParameters
>()
const PROJECT_PARAMETER_CACHE = new WeakMap<
  AltiumPrjPcb,
  CachedSchematicParameters
>()
const VARIANT_PARAMETER_CACHE = new WeakMap<
  AltiumPrjPcb,
  CachedSchematicVariantParameters
>()
const EMPTY_SCHEMATIC_PARAMETERS: ReadonlyMap<SchematicParameterName, string> =
  new Map()

/**
 * Resolves an Altium `=ParameterName` reference against document-level
 * schematic parameters.
 */
export function resolveSchematicParameterReference(
  document: AltiumSchDoc,
  reference: string,
): string | undefined {
  return resolveSchematicParameterReferenceWithContext({
    document,
    reference,
  })
}

export function resolveSchematicParameterReferenceWithContext({
  currentDate,
  currentTime,
  document,
  documentName,
  project,
  projectName,
  record,
  reference,
  variantName,
}: ResolveSchematicParameterReferenceInput): string | undefined {
  const match = PARAMETER_REFERENCE.exec(reference)
  const parameterName = match?.[1]
  if (!parameterName) return undefined

  const parameters = new Map<SchematicParameterName, string>()
  if (project) {
    applySchematicParameterScope(
      parameters,
      getSchematicProjectParameters(project),
    )
  }
  applySchematicParameterScope(
    parameters,
    getSchematicDocumentParameters(document),
  )
  if (project && variantName) {
    applySchematicParameterScope(
      parameters,
      getSchematicVariantParameters(project, variantName),
    )
  }
  if (currentDate !== undefined) parameters.set("currentdate", currentDate)
  if (currentTime !== undefined) parameters.set("currenttime", currentTime)
  if (projectName) parameters.set("projectname", projectName)
  if (documentName) parameters.set("documentname", documentName)
  if (variantName) parameters.set("variantname", variantName)
  if (record) {
    for (const [name, text] of getSchematicComponentParameters(
      document,
      record,
    )) {
      parameters.set(name, text)
    }
  }

  return resolveParameter({
    parameterName,
    parameters,
    visitedParameterNames: new Set(),
  })
}

function applySchematicParameterScope(
  parameters: Map<SchematicParameterName, string>,
  parameterScope: ReadonlyMap<SchematicParameterName, string>,
): void {
  for (const [name, text] of parameterScope) {
    if (text !== "*") parameters.set(name, text)
  }
}

function getSchematicComponentParameters(
  document: AltiumSchDoc,
  record: AltiumRecord,
): Map<SchematicParameterName, string> {
  let component: AltiumRecord | undefined = record
  const visited = new Set<AltiumRecord>()

  while (component && component.recordKind !== "1") {
    if (visited.has(component)) return new Map()
    visited.add(component)
    component = document.getParent(component)
  }
  if (!component) return new Map()

  const parameters = new Map<SchematicParameterName, string>()
  for (const key of ["DESIGNATOR", "COMMENT", "LIBREFERENCE"] as const) {
    const value = component.getDecoded(key)
    if (value !== undefined) parameters.set(key.toLowerCase(), value)
  }
  for (const ownedRecord of document.getOwnedRecords(component)) {
    if (ownedRecord.recordKind !== "41") continue
    const name = ownedRecord.getDecoded("NAME")
    const text = ownedRecord.getDecoded("TEXT")
    if (name && text !== undefined) parameters.set(name.toLowerCase(), text)
  }

  return parameters
}

function getSchematicDocumentParameters(
  document: AltiumSchDoc,
): Map<SchematicParameterName, string> {
  const cached = DOCUMENT_PARAMETER_CACHE.get(document)
  if (cached?.revision === document.revision) return cached.parameters

  const parameters = new Map<SchematicParameterName, string>()
  for (const record of document.records) {
    if (
      record.recordKind !== "41" ||
      record.getBoolean("ISHIDDEN") !== true ||
      document.getParent(record) !== undefined
    ) {
      continue
    }

    const name = record.getDecoded("NAME")
    const parameterText = record.getDecoded("TEXT")
    if (name && parameterText !== undefined) {
      parameters.set(name.toLowerCase(), parameterText)
    }
  }

  DOCUMENT_PARAMETER_CACHE.set(document, {
    parameters,
    revision: document.revision,
  })
  return parameters
}

function getSchematicProjectParameters(
  project: AltiumPrjPcb,
): Map<SchematicParameterName, string> {
  const cached = PROJECT_PARAMETER_CACHE.get(project)
  if (cached?.revision === project.revision) return cached.parameters

  const parameters = new Map<SchematicParameterName, string>()
  for (const section of project.sections) {
    if (/^PARAMETER\d+$/iu.test(section.name)) {
      addNamedParameterSection(parameters, section)
      continue
    }

    if (!/^PARAMETERS?$/iu.test(section.name)) continue
    for (const entry of section.entries) {
      const separatorIndex = entry.value.indexOf("=")
      if (separatorIndex <= 0) continue
      const parameterName = entry.value.slice(0, separatorIndex).trim()
      const parameterText = entry.value.slice(separatorIndex + 1)
      if (parameterName) {
        parameters.set(parameterName.toLowerCase(), parameterText)
      }
    }
  }

  PROJECT_PARAMETER_CACHE.set(project, {
    parameters,
    revision: project.revision,
  })
  return parameters
}

function getSchematicVariantParameters(
  project: AltiumPrjPcb,
  variantName: string,
): ReadonlyMap<SchematicParameterName, string> {
  const cached = VARIANT_PARAMETER_CACHE.get(project)
  const parametersByVariantName =
    cached?.revision === project.revision
      ? cached.parametersByVariantName
      : createSchematicVariantParameterScopes(project)

  if (cached?.revision !== project.revision) {
    VARIANT_PARAMETER_CACHE.set(project, {
      parametersByVariantName,
      revision: project.revision,
    })
  }

  return (
    parametersByVariantName.get(variantName.toLowerCase()) ??
    EMPTY_SCHEMATIC_PARAMETERS
  )
}

function createSchematicVariantParameterScopes(
  project: AltiumPrjPcb,
): Map<SchematicVariantName, Map<SchematicParameterName, string>> {
  const parametersByVariantName = new Map<
    SchematicVariantName,
    Map<SchematicParameterName, string>
  >()

  for (const variant of project.variants) {
    const parameters = new Map<SchematicParameterName, string>()
    addInlineVariantParameters(parameters, variant)
    addVariantParameterSections({ parameters, project, variant })

    for (const variantName of getSchematicVariantNames(variant)) {
      parametersByVariantName.set(variantName.toLowerCase(), parameters)
    }
  }

  return parametersByVariantName
}

function addInlineVariantParameters(
  parameters: Map<SchematicParameterName, string>,
  variant: AltiumProjectVariant,
): void {
  for (const setting of variant.parameters) {
    if (!/^PARAMETER\d+$/iu.test(setting.key)) continue
    const separatorIndex = setting.value.indexOf("=")
    if (separatorIndex <= 0) continue
    const parameterName = setting.value.slice(0, separatorIndex).trim()
    const parameterText = setting.value.slice(separatorIndex + 1)
    if (parameterName) {
      parameters.set(parameterName.toLowerCase(), parameterText)
    }
  }
}

function addVariantParameterSections({
  parameters,
  project,
  variant,
}: AddVariantParameterSectionsInput): void {
  const variantMatch = /^(?:PROJECT)?VARIANT(\d+)$/iu.exec(variant.section.name)
  const variantIndex = Number(variantMatch?.[1])
  if (!Number.isSafeInteger(variantIndex) || variantIndex < 1) return

  // Altium reserves parameter owner 1 for the base project, so
  // ProjectVariant1 owns Parameter2_*, ProjectVariant2 owns Parameter3_*, etc.
  const parameterOwnerIndex = variantIndex + 1
  for (const section of project.sections) {
    const parameterMatch = /^PARAMETER(\d+)_(\d+)$/iu.exec(section.name)
    if (Number(parameterMatch?.[1]) !== parameterOwnerIndex) continue
    addNamedParameterSection(parameters, section)
  }
}

function addNamedParameterSection(
  parameters: Map<SchematicParameterName, string>,
  section: AltiumIniSection,
): void {
  const parameterName = section.entries.find(
    (entry) => entry.key.toUpperCase() === "NAME",
  )?.value
  const parameterText = section.entries.find(
    (entry) => entry.key.toUpperCase() === "VALUE",
  )?.value
  if (parameterName && parameterText !== undefined) {
    parameters.set(parameterName.toLowerCase(), parameterText)
  }
}

function getSchematicVariantNames(
  variant: AltiumProjectVariant,
): SchematicVariantName[] {
  return [variant.name, variant.description, variant.section.name].filter(
    (variantName): variantName is string => variantName !== undefined,
  )
}

function resolveParameter({
  parameterName,
  parameters,
  visitedParameterNames,
}: ResolveParameterInput): string | undefined {
  const normalizedName = parameterName.toLowerCase()
  if (visitedParameterNames.has(normalizedName)) return undefined

  const parameterText = parameters.get(normalizedName)
  if (parameterText === undefined || parameterText === "*") return undefined

  const nestedReference = PARAMETER_REFERENCE.exec(parameterText)?.[1]
  if (!nestedReference) return parameterText

  const nextVisitedParameterNames = new Set(visitedParameterNames)
  nextVisitedParameterNames.add(normalizedName)
  return resolveParameter({
    parameterName: nestedReference,
    parameters,
    visitedParameterNames: nextVisitedParameterNames,
  })
}
