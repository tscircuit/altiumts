/** Resolve a whole PCB parameter expression, leaving unsupported text intact. */
export function resolvePcbSpecialStrings(
  text: string,
  parameters: ReadonlyMap<string, string>,
): string | undefined {
  // PMP22712 uses adjacent quoted/bare references: '.PRJ_Number'.PCB_Rev.
  // Parse only this string grammar, never evaluate expressions as code.
  const tokens = text.match(/'[^'\r\n]*'|\.[A-Za-z_][A-Za-z0-9_]*/gu)
  if (!tokens || tokens.join("") !== text) return undefined
  let hasParameter = false
  const values: string[] = []
  for (const token of tokens) {
    const value = token.startsWith("'") ? token.slice(1, -1) : token
    if (!value.startsWith(".")) {
      values.push(value)
      continue
    }
    hasParameter = true
    const parameter = parameters.get(value.slice(1).toLowerCase())
    if (parameter === undefined || parameter === "*") return undefined
    values.push(parameter)
  }
  return hasParameter ? values.join("") : undefined
}
