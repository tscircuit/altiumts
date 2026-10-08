import type { ProjectParameterName } from "../project-parameters"

/** Resolve PCB dot-prefixed parameters without guessing missing project values. */
export function resolvePcbProjectText(
  text: string,
  parameters: ReadonlyMap<ProjectParameterName, string>,
): string {
  if (text.startsWith(".")) {
    return getPcbProjectParameterValue(parameters, text.slice(1)) ?? text
  }

  // PCB expressions quote dot-prefixed references, unlike schematic formulas.
  // TI headings also append a bare reference: '.PRJ_Number'.PCB_Rev.
  return text.replace(
    /'\.([^'\r\n]+)'(\.[A-Za-z][A-Za-z0-9_]*)?/gu,
    (_match, name: ProjectParameterName, suffix: string | undefined) =>
      (getPcbProjectParameterValue(parameters, name) ?? `'.${name}'`) +
      (suffix
        ? (getPcbProjectParameterValue(parameters, suffix.slice(1)) ?? suffix)
        : ""),
  )
}

function getPcbProjectParameterValue(
  parameters: ReadonlyMap<ProjectParameterName, string>,
  parameterName: ProjectParameterName,
): string | undefined {
  const value = parameters.get(parameterName.toLowerCase())
  return value === "*" ? undefined : value
}
