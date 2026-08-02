import type { ProjectFileFailure } from "./project-viewer-types"

const ISSUE_URL = "https://github.com/tscircuit/altiumts/issues/new"

export function createBugReportUrl(params: {
  failures: ProjectFileFailure[]
  fileNames: string[]
  fatalMessage?: string
}): string {
  const { failures, fileNames, fatalMessage } = params
  const failureDetails = failures
    .slice(0, 12)
    .map(
      (failure) =>
        `- \`${sanitizeMarkdown(failure.path)}\`: ${sanitizeMarkdown(failure.message)}`,
    )
    .join("\n")
  const listedFiles = fileNames
    .slice(0, 30)
    .map((name) => `- \`${sanitizeMarkdown(name)}\``)
    .join("\n")
  const body = [
    "## What happened",
    "",
    fatalMessage
      ? sanitizeMarkdown(fatalMessage)
      : "The browser project viewer could not process one or more Altium files.",
    "",
    failureDetails ? "## Parser errors" : "",
    failureDetails,
    "",
    "## Selected filenames",
    "",
    listedFiles || "- (not available)",
    "",
    "## Browser",
    "",
    typeof navigator === "undefined" ? "Unknown" : navigator.userAgent,
    "",
    "> The viewer does not upload project contents. Attach a minimal design file only if you are comfortable sharing it publicly.",
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n")

  const search = new URLSearchParams({
    body,
    labels: "bug",
    title: "Browser viewer failed to process an Altium project",
  })
  return `${ISSUE_URL}?${search.toString()}`
}

function sanitizeMarkdown(value: string): string {
  return value
    .replaceAll("`", "'")
    .replace(/[\r\n]+/gu, " ")
    .slice(0, 800)
}
