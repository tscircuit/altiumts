import { AltiumSerializationError } from "../errors/altium-error"
import {
  type AltiumRecordFields,
  getAltiumRecordFieldNames,
  getAltiumRecordFields,
  parseAltiumBoolean,
} from "./altium-binary-record-encoding"
import { getAltiumPcbLayerId } from "./altium-pcb-binary-layers"

export type SupportedAltiumPcbPrimitiveKind =
  | "Arc"
  | "Fill"
  | "Pad"
  | "Region"
  | "Text"
  | "Track"
  | "Via"

const COMMON_PRIMITIVE_FIELDS = [
  "COMPONENT",
  "LAYER",
  "LOCKED",
  "NET",
  "POLYGON",
  "RECORD",
] as const

const SUPPORTED_PRIMITIVE_FIELDS: Record<
  SupportedAltiumPcbPrimitiveKind,
  ReadonlySet<string>
> = {
  Arc: new Set([
    ...COMMON_PRIMITIVE_FIELDS,
    "ENDANGLE",
    "KEEPOUT",
    "LOCATION.X",
    "LOCATION.Y",
    "RADIUS",
    "STARTANGLE",
    "WIDTH",
  ]),
  Fill: new Set([
    ...COMMON_PRIMITIVE_FIELDS,
    "KEEPOUT",
    "ROTATION",
    "X1",
    "X2",
    "Y1",
    "Y2",
  ]),
  Pad: new Set([
    ...COMMON_PRIMITIVE_FIELDS,
    "HOLESHAPE",
    "HOLESIZE",
    "HOLEROTATION",
    "HOLEWIDTH",
    "NAME",
    "PLATED",
    "ROTATION",
    "SHAPE",
    "TENTEDBOTTOM",
    "TENTEDTOP",
    "X",
    "XSIZE",
    "Y",
    "YSIZE",
  ]),
  Region: new Set([
    ...COMMON_PRIMITIVE_FIELDS,
    "HOLECOUNT",
    "KEEPOUT",
    "REGIONKIND",
    "TEARDROP",
  ]),
  Text: new Set([
    ...COMMON_PRIMITIVE_FIELDS,
    "BOLD",
    "COMMENT",
    "DESIGNATOR",
    "FONTNAME",
    "HEIGHT",
    "INVERTED",
    "INVERTEDRECT",
    "ITALIC",
    "JUSTIFICATION",
    "MARGINBORDERWIDTH",
    "MIRROR",
    "ROTATION",
    "STROKEFONT",
    "TEXT",
    "TEXTBOXHEIGHT",
    "TEXTBOXWIDTH",
    "TEXTOFFSET",
    "USETTFONTS",
    "WIDESTRING",
    "WIDTH",
    "X",
    "Y",
  ]),
  Track: new Set([...COMMON_PRIMITIVE_FIELDS, "WIDTH", "X1", "X2", "Y1", "Y2"]),
  Via: new Set([
    ...COMMON_PRIMITIVE_FIELDS,
    "DIAMETER",
    "ENDLAYER",
    "HOLESIZE",
    "STARTLAYER",
    "STOPLAYER",
    "TENTEDBOTTOM",
    "TENTEDTOP",
    "X",
    "Y",
  ]),
}

export function assertSupportedAltiumPcbPrimitive(
  recordSource: string,
  recordKind: SupportedAltiumPcbPrimitiveKind,
): void {
  const fieldNames = getAltiumRecordFieldNames(recordSource)
  const duplicateFieldNames = fieldNames.filter(
    (fieldName, index) => fieldNames.indexOf(fieldName) !== index,
  )
  if (duplicateFieldNames.length > 0) {
    throw new AltiumSerializationError(
      `${recordKind} binary serialization does not support duplicate fields: ${[
        ...new Set(duplicateFieldNames),
      ].join(", ")}`,
    )
  }

  const unsupportedFieldNames = fieldNames.filter(
    (fieldName) => !isSupportedPrimitiveFieldName(fieldName, recordKind),
  )
  if (unsupportedFieldNames.length > 0) {
    throw new AltiumSerializationError(
      `${recordKind} binary serialization does not support fields: ${unsupportedFieldNames.join(", ")}`,
    )
  }

  validateSupportedPrimitiveFieldText(
    getAltiumRecordFields(recordSource),
    recordKind,
  )
}

export function getAltiumPadShapeId(shapeName: string | undefined): number {
  if (shapeName === undefined || shapeName.toUpperCase() === "RECTANGLE")
    return 2
  if (shapeName.toUpperCase() === "ROUND") return 1
  throw new AltiumSerializationError(
    `Unsupported Altium pad shape: ${JSON.stringify(shapeName)}`,
  )
}

function validateSupportedPrimitiveFieldText(
  fields: AltiumRecordFields,
  recordKind: SupportedAltiumPcbPrimitiveKind,
): void {
  getAltiumPcbLayerId(fields.get("LAYER"), recordKind === "Via" ? 74 : 1)
  for (const booleanFieldName of [
    "BOLD",
    "COMMENT",
    "DESIGNATOR",
    "INVERTED",
    "INVERTEDRECT",
    "ITALIC",
    "KEEPOUT",
    "LOCKED",
    "MIRROR",
    "PLATED",
    "TENTEDBOTTOM",
    "TENTEDTOP",
    "TEARDROP",
    "USETTFONTS",
  ]) {
    if (fields.has(booleanFieldName)) {
      parseAltiumBoolean(fields.get(booleanFieldName))
    }
  }
  if (recordKind === "Pad") {
    getAltiumPadShapeId(fields.get("SHAPE"))
    const holeShape = fields.get("HOLESHAPE")?.toUpperCase()
    if (
      holeShape !== undefined &&
      holeShape !== "ROUND" &&
      holeShape !== "SLOT" &&
      holeShape !== "SQUARE"
    ) {
      throw new AltiumSerializationError(
        `Unsupported Altium pad hole shape: ${JSON.stringify(holeShape)}`,
      )
    }
  }
  if (recordKind === "Via") {
    const layerName = fields.get("LAYER")?.toUpperCase()
    if (layerName !== undefined && layerName !== "MULTILAYER") {
      throw new AltiumSerializationError(
        `Via binary serialization requires MULTILAYER, got ${JSON.stringify(layerName)}`,
      )
    }
    getAltiumPcbLayerId(fields.get("STARTLAYER"), 1)
    getAltiumPcbLayerId(fields.get("ENDLAYER") ?? fields.get("STOPLAYER"), 32)
  }
  if (recordKind === "Region") {
    const regionKind = fields.get("REGIONKIND")?.toUpperCase() ?? "COPPER"
    if (regionKind !== "COPPER") {
      throw new AltiumSerializationError(
        `Unsupported Altium region kind: ${JSON.stringify(regionKind)}`,
      )
    }
  }
}

function isSupportedPrimitiveFieldName(
  fieldName: string,
  recordKind: SupportedAltiumPcbPrimitiveKind,
): boolean {
  if (SUPPORTED_PRIMITIVE_FIELDS[recordKind].has(fieldName)) return true
  if (recordKind !== "Region") return false
  return (
    /^(?:KIND|VX|VY|CX|CY|R|SA|EA)\d+$/u.test(fieldName) ||
    /^HOLE\d+(?:COUNT|V[XY]\d+)$/u.test(fieldName)
  )
}
