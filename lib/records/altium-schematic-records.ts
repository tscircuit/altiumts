import type { AltiumPoint } from "../geometry/altium-geometry"
import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import { getFirstDecoded } from "./pcb-record-helpers"

export class AltiumSchematicRecord extends AltiumRecord {
  override readonly type: string = "schematic-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get ownerIndex(): number | undefined {
    return this.getNumber("OWNERINDEX")
  }

  get ownerPartId(): number | undefined {
    return this.getNumber("OWNERPARTID")
  }

  get indexInSheet(): number | undefined {
    return this.getNumber("INDEXINSHEET")
  }

  get uniqueId(): string | undefined {
    return getFirstDecoded(this, "UNIQUEID")
  }

  get position(): AltiumPoint | undefined {
    const x = getSchematicCoordinateValue(this, "LOCATION.X")
    const y = getSchematicCoordinateValue(this, "LOCATION.Y")
    return x === undefined || y === undefined ? undefined : { x, y }
  }
}

export class AltiumSchComponentRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-component-record"
  get libraryReference(): string | undefined {
    return getFirstDecoded(this, "LIBREFERENCE")
  }
}
export class AltiumSchPinRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-pin-record"
  get name(): string | undefined {
    return getFirstDecoded(this, "NAME")
  }
  get designator(): string | undefined {
    return getFirstDecoded(this, "DESIGNATOR")
  }
  get electricalType(): number | undefined {
    return this.getNumber("ELECTRICAL")
  }
  get hidden(): boolean | undefined {
    return this.getBoolean("ISHIDDEN")
  }
}
export class AltiumSchLabelRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-label-record"
  get text(): string | undefined {
    return getFirstDecoded(this, "TEXT")
  }
}
export class AltiumSchBezierRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-bezier-record"
}
export class AltiumSchPolylineRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-polyline-record"
}
export class AltiumSchPolygonRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-polygon-record"
}
export class AltiumSchEllipseRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-ellipse-record"
}
export class AltiumSchRoundedRectangleRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-rounded-rectangle-record"
}
export class AltiumSchEllipticalArcRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-elliptical-arc-record"
}
export class AltiumSchArcRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-arc-record"
}
export class AltiumSchLineRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-line-record"
}
export class AltiumSchRectangleRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-rectangle-record"
}
export class AltiumSchSheetSymbolRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-sheet-symbol-record"
  get fileName(): string | undefined {
    return getFirstDecoded(this, "FILENAME")
  }
}
export class AltiumSchSheetEntryRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-sheet-entry-record"
  get name(): string | undefined {
    return getFirstDecoded(this, "NAME")
  }
}
export class AltiumSchPowerPortRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-power-port-record"
  get text(): string | undefined {
    return getFirstDecoded(this, "TEXT")
  }
}
export class AltiumSchPortRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-port-record"
  get name(): string | undefined {
    return getFirstDecoded(this, "NAME")
  }
}
export class AltiumSchNetLabelRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-net-label-record"
  get text(): string | undefined {
    return getFirstDecoded(this, "TEXT")
  }
}
export class AltiumSchBusRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-bus-record"
}
export class AltiumSchWireRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-wire-record"
}
export class AltiumSchNoErcRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-no-erc-record"
}
export class AltiumSchTextFrameRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-text-frame-record"
  get text(): string | undefined {
    return getFirstDecoded(this, "TEXT")
  }
}
export class AltiumSchJunctionRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-junction-record"
}
export class AltiumSchImageRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-image-record"
  get fileName(): string | undefined {
    return getFirstDecoded(this, "FILENAME")
  }
}
export class AltiumSchSheetRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-sheet-record"
}
export class AltiumSchSheetNameRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-sheet-name-record"
}
export class AltiumSchSheetFileNameRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-sheet-file-name-record"
}
export class AltiumSchDesignatorRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-designator-record"
  get text(): string | undefined {
    return getFirstDecoded(this, "TEXT")
  }
}
export class AltiumSchParameterSetRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-parameter-set-record"
}
export class AltiumSchTemplateRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-template-record"
  get fileName(): string | undefined {
    return getFirstDecoded(this, "FILENAME")
  }
}
export class AltiumSchParameterRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-parameter-record"
  get name(): string | undefined {
    return getFirstDecoded(this, "NAME")
  }
  get text(): string | undefined {
    return getFirstDecoded(this, "TEXT")
  }
}
export class AltiumSchImplementationListRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-implementation-list-record"
}
export class AltiumSchImplementationRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-implementation-record"
  get modelName(): string | undefined {
    return getFirstDecoded(this, "MODELNAME")
  }
  get modelType(): string | undefined {
    return getFirstDecoded(this, "MODELTYPE")
  }
}
export class AltiumSchImplementationMapRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-implementation-map-record"
}
export class AltiumSchImplementationParameterRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-implementation-parameter-record"
}
export class AltiumSchNoteRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-note-record"
  get text(): string | undefined {
    return getFirstDecoded(this, "TEXT")
  }
}

function getSchematicCoordinateValue(
  record: AltiumRecord,
  key: string,
): number | undefined {
  const raw = record.getCaseInsensitive(key)
  if (raw === undefined) return undefined
  const integer = Number(raw)
  if (!Number.isFinite(integer)) return undefined
  const fraction = record.getCaseInsensitive(`${key}_FRAC`)
  if (fraction === undefined) return integer
  const fractionValue = Number(`0.${fraction.replace(/^[+-]/u, "")}`)
  if (!Number.isFinite(fractionValue)) return integer
  return integer < 0 ? integer - fractionValue : integer + fractionValue
}
