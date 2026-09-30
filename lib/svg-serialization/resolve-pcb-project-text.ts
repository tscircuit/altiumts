/** Resolve PCB dot-prefixed parameters without guessing missing project values. */
export function resolvePcbProjectText(
  text: string,
  parameters: ReadonlyMap<string, string>,
): string {
  const valueFor = (name: string): string | undefined => {
    const value = parameters.get(name.toLowerCase())
    return value === "*" ? undefined : value
  }
  if (text.startsWith(".")) return valueFor(text.slice(1)) ?? text

  // PCB expressions quote dot-prefixed references, unlike schematic formulas.
  // TI headings also append a bare reference: '.PRJ_Number'.PCB_Rev.
  return text.replace(
    /'\.([^'\r\n]+)'(\.[A-Za-z][A-Za-z0-9_]*)?/gu,
    (_match, name: string, suffix: string | undefined) =>
      (valueFor(name) ?? `'.${name}'`) +
      (suffix ? (valueFor(suffix.slice(1)) ?? suffix) : ""),
  )
}
