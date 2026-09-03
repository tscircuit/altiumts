import { escapeXml } from "./svg-utils"

type TextRun = {
  negated: boolean
  value: string
}

/**
 * Altium negates names either with a backslash after each character or, when
 * Single '\\' Negation is enabled, with one backslash before the whole name.
 */
export function renderAltiumNegatedText(value: string): string {
  // A leading marker selects whole-name negation. Some library names retain
  // per-character markers as well; Altium does not display those separators.
  if (value.startsWith("\\")) {
    return renderNegatedRun(value.replaceAll("\\", ""))
  }

  const runs: TextRun[] = []
  const characters = [...value]

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index] ?? ""
    if (character === "\\") continue

    const negated = characters[index + 1] === "\\"
    if (negated) index += 1

    const previous = runs.at(-1)
    if (previous?.negated === negated) previous.value += character
    else runs.push({ negated, value: character })
  }

  return runs
    .map(({ negated, value: runValue }) =>
      negated ? renderNegatedRun(runValue) : escapeXml(runValue),
    )
    .join("")
}

function renderNegatedRun(value: string): string {
  return value
    ? `<tspan class="altium-negated-text" text-decoration="overline">${escapeXml(value)}</tspan>`
    : ""
}
