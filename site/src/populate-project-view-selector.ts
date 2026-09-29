import type {
  ProjectDocumentManifest,
  ProjectPcbViewGroup,
} from "./project-viewer-types"

const GROUP_LABELS: Readonly<Record<ProjectPcbViewGroup, string>> = {
  board: "Board",
  copper: "Copper",
  mechanical: "Mechanical",
  other: "Other",
  paste_mask: "Paste Mask",
  silkscreen: "Silkscreen",
  solder_mask: "Solder Mask",
}

export function populateProjectViewSelector({
  documentManifest,
  viewSelector,
}: {
  documentManifest: ProjectDocumentManifest
  viewSelector: HTMLSelectElement
}): void {
  viewSelector.replaceChildren()
  const groups = new Map<ProjectPcbViewGroup, HTMLOptGroupElement>()

  for (const view of documentManifest.views) {
    const option = document.createElement("option")
    option.value = view.id
    option.textContent = view.label
    if (view.hasPrimitives === false) {
      option.className = "is-empty"
      option.title = "This configured layer has no primitives"
    }

    if (!view.group) {
      viewSelector.append(option)
      continue
    }

    let group = groups.get(view.group)
    if (!group) {
      group = document.createElement("optgroup")
      group.label = GROUP_LABELS[view.group]
      groups.set(view.group, group)
      viewSelector.append(group)
    }
    group.append(option)
  }
}
