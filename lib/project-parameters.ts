import type { AltiumPrjPcb } from "./altium-prj-pcb"
import type { AltiumIniSection } from "./ini/altium-ini"

export type ProjectParameterName = string

const PROJECT_PARAMETER_CACHE = new WeakMap<
  AltiumPrjPcb,
  { revision: number; parameters: Map<ProjectParameterName, string> }
>()

export function getProjectParameters(
  project: AltiumPrjPcb,
): Map<ProjectParameterName, string> {
  const cached = PROJECT_PARAMETER_CACHE.get(project)
  if (cached?.revision === project.revision) return cached.parameters

  const parameters = new Map<ProjectParameterName, string>()
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

export function addNamedParameterSection(
  parameters: Map<ProjectParameterName, string>,
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
