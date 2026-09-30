import type { AltiumPrjPcb } from "./altium-prj-pcb"

const PROJECT_PARAMETER_CACHE = new WeakMap<
  AltiumPrjPcb,
  { parameters: Map<string, string>; revision: number }
>()

export function getProjectParameters(
  project: AltiumPrjPcb,
): Map<string, string> {
  const cached = PROJECT_PARAMETER_CACHE.get(project)
  if (cached?.revision === project.revision) return cached.parameters

  const parameters = new Map<string, string>()
  for (const section of project.sections) {
    if (/^PARAMETER\d+$/iu.test(section.name)) {
      const parameterName = section.entries.find(
        (entry) => entry.key.toUpperCase() === "NAME",
      )?.value
      const parameterText = section.entries.find(
        (entry) => entry.key.toUpperCase() === "VALUE",
      )?.value
      if (parameterName && parameterText !== undefined) {
        parameters.set(parameterName.toLowerCase(), parameterText)
      }
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
