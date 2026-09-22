export function normalizeLayerName(layer: string | undefined): string {
  return (layer ?? "").replace(/[\s_.-]+/gu, "").toUpperCase()
}
