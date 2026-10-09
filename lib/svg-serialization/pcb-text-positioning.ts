export type PcbTextPositioning = {
  anchor: "start" | "middle" | "end"
  baseline: "text-after-edge" | "central" | "text-before-edge"
}

const DEFAULT_ALTIUM_PCB_TEXT_JUSTIFICATION = 3

export function getPcbTextPositioning(
  justification: number | undefined,
  valid = true,
): PcbTextPositioning {
  const normalizedJustification =
    !valid ||
    justification === undefined ||
    !Number.isInteger(justification) ||
    justification < 1 ||
    justification > 9
      ? DEFAULT_ALTIUM_PCB_TEXT_JUSTIFICATION
      : justification
  // Altium stores the 3×3 justification grid column-first and one-based.
  const column = Math.floor((normalizedJustification - 1) / 3)
  const row = (normalizedJustification - 1) % 3

  return {
    anchor: column === 1 ? "middle" : column === 2 ? "end" : "start",
    baseline:
      row === 1
        ? "central"
        : row === 2
          ? "text-after-edge"
          : "text-before-edge",
  }
}
