import type { AltiumPcbDoc } from "../altium-pcb-doc"
import type { AltiumBounds, AltiumPoint } from "../geometry/altium-geometry"
import { normalizeAltiumAngle } from "../geometry/altium-geometry"
import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import {
  getFirstDecoded,
  getPcbRecordMeasurementMils,
  getPcbRecordPoint,
} from "./pcb-record-helpers"

export type AltiumPcbSide = "top" | "bottom" | "unknown"

export class AltiumComponentRecord extends AltiumRecord {
  override readonly type = "component-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get id(): number | undefined {
    return this.getNumber("ID")
  }

  get designator(): string | undefined {
    return getFirstDecoded(this, "SOURCEDESIGNATOR", "DESIGNATOR")
  }

  get comment(): string | undefined {
    return getFirstDecoded(this, "SOURCECOMMENT", "COMMENT")
  }

  get footprint(): string | undefined {
    return getFirstDecoded(this, "PATTERN", "FOOTPRINT")
  }

  get footprintLibrary(): string | undefined {
    return getFirstDecoded(this, "SOURCEFOOTPRINTLIBRARY")
  }

  get sourceLibrary(): string | undefined {
    return getFirstDecoded(this, "SOURCECOMPONENTLIBRARY")
  }

  get sourceLibraryReference(): string | undefined {
    return getFirstDecoded(this, "SOURCELIBREFERENCE")
  }

  get sourceUniqueId(): string | undefined {
    return getFirstDecoded(this, "SOURCEUNIQUEID")
  }

  get sourceHierarchicalPath(): string | undefined {
    return getFirstDecoded(this, "SOURCEHIERARCHICALPATH")
  }

  get position(): AltiumPoint | undefined {
    return getPcbRecordPoint(this, ["X", "LOCATION.X"], ["Y", "LOCATION.Y"])
  }

  get rotation(): number {
    return normalizeAltiumAngle(this.getNumber("ROTATION") ?? 0)
  }

  get side(): AltiumPcbSide {
    const layer = this.getCaseInsensitive("LAYER")?.toUpperCase()
    if (layer === "TOP" || layer === "TOP LAYER") return "top"
    if (layer === "BOTTOM" || layer === "BOTTOM LAYER") return "bottom"
    return "unknown"
  }

  get mirrored(): boolean {
    return this.side === "bottom"
  }

  get locked(): boolean | undefined {
    return this.getBoolean("LOCKED")
  }

  get selected(): boolean | undefined {
    return this.getBoolean("SELECTION")
  }

  get unionIndex(): number | undefined {
    return this.getNumber("UNIONINDEX")
  }

  get channelOffset(): number | undefined {
    return this.getNumber("CHANNELOFFSET")
  }

  get heightMils(): number | undefined {
    return getPcbRecordMeasurementMils(this, "HEIGHT")
  }

  getOwnedPrimitives(document: AltiumPcbDoc): AltiumRecord[] {
    return document.getRecordsOwnedByComponent(this)
  }

  getBounds(
    document: AltiumPcbDoc,
    layers?: string[],
  ): AltiumBounds | undefined {
    return document.getComponentBounds(this, layers)
  }
}
