import type { AltiumPadRecord } from "../records/altium-pad-record"

export function getFirstPadField({
  fieldNames,
  record,
}: {
  fieldNames: readonly string[]
  record: AltiumPadRecord
}): string | undefined {
  for (const fieldName of fieldNames) {
    const fieldContent = record.getCaseInsensitive(fieldName)
    if (fieldContent !== undefined) return fieldContent
  }
  return undefined
}
