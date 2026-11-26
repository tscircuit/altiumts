import { AltiumSerializationError } from "../errors/altium-error"

export function parseAltiumMaskExpansionMode(
  value: string | undefined,
): number {
  switch (value?.trim().toUpperCase() ?? "NONE") {
    case "NONE":
    case "0":
      return 0
    case "RULE":
    case "1":
      return 1
    case "MANUAL":
    case "2":
      return 2
    default:
      throw new AltiumSerializationError(
        `Unsupported solder mask expansion mode: ${value}`,
      )
  }
}
