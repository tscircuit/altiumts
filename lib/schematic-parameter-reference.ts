import type { AltiumSchDoc } from "./altium-sch-doc"

interface CachedSchematicParameters {
  parameters: Map<string, string>
  revision: number
}

const PARAMETER_REFERENCE = /^=([A-Za-z][A-Za-z0-9_]*)$/u
const PARAMETER_CACHE = new WeakMap<AltiumSchDoc, CachedSchematicParameters>()

/**
 * Resolves an Altium `=ParameterName` reference against document-level
 * schematic parameters. Returns undefined when the reference depends on
 * project or runtime context that is not stored in the SchDoc.
 */
export function resolveSchematicParameterReference(
  document: AltiumSchDoc,
  reference: string,
): string | undefined {
  const match = PARAMETER_REFERENCE.exec(reference)
  const parameterName = match?.[1]
  if (!parameterName) return undefined

  return resolveParameter(
    getSchematicDocumentParameters(document),
    parameterName,
    new Set(),
  )
}

function getSchematicDocumentParameters(
  document: AltiumSchDoc,
): Map<string, string> {
  const cached = PARAMETER_CACHE.get(document)
  if (cached?.revision === document.revision) return cached.parameters

  const parameters = new Map<string, string>()
  for (const record of document.records) {
    if (
      record.recordKind !== "41" ||
      record.getBoolean("ISHIDDEN") !== true ||
      document.getParent(record) !== undefined
    ) {
      continue
    }

    const name = record.getDecoded("NAME")
    const value = record.getDecoded("TEXT")
    if (name && value !== undefined) {
      parameters.set(name.toLowerCase(), value)
    }
  }

  PARAMETER_CACHE.set(document, { parameters, revision: document.revision })
  return parameters
}

function resolveParameter(
  parameters: ReadonlyMap<string, string>,
  parameterName: string,
  visitedNames: Set<string>,
): string | undefined {
  const normalizedName = parameterName.toLowerCase()
  if (visitedNames.has(normalizedName)) return undefined

  const value = parameters.get(normalizedName)
  if (value === undefined || value === "*") return undefined

  const nestedReference = PARAMETER_REFERENCE.exec(value)?.[1]
  if (!nestedReference) return value

  const nextVisitedNames = new Set(visitedNames)
  nextVisitedNames.add(normalizedName)
  return resolveParameter(parameters, nestedReference, nextVisitedNames)
}
