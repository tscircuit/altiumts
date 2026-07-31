import type { AltiumPoint, AltiumSize } from "../geometry/altium-geometry"
import { type AltiumPcbContour, getPcbContour } from "../pcb-contours"
import { type AltiumPcbLayerStack, getPcbLayerStack } from "../pcb-layer-stack"
import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import {
  getFirstDecoded,
  getPcbRecordMeasurementMils,
  getPcbRecordPoint,
  getPcbRecordSize,
} from "./pcb-record-helpers"

export interface AltiumPcbGridSettings {
  dotGrid?: boolean
  electricalGridEnabled?: boolean
  electricalGridRangeMils?: number
  largeVisibleGridMultiplier?: number
  largeVisibleGridSize?: number
  snapEnabled?: boolean
  snapSizeMils?: number
  visibleGridMultiplier?: number
  visibleGridSize?: number
}

export class AltiumBoardRecord extends AltiumRecord {
  override readonly type = "board-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get fileName(): string | undefined {
    return getFirstDecoded(this, "FILENAME")
  }

  get version(): string | undefined {
    return getFirstDecoded(this, "VERSION")
  }

  get date(): string | undefined {
    return getFirstDecoded(this, "DATE")
  }

  get time(): string | undefined {
    return getFirstDecoded(this, "TIME")
  }

  get displayUnit(): string | undefined {
    return getFirstDecoded(this, "DISPLAYUNIT")
  }

  get origin(): AltiumPoint | undefined {
    return getPcbRecordPoint(
      this,
      ["ORIGINX", "ORIGIN.X"],
      ["ORIGINY", "ORIGIN.Y"],
    )
  }

  get sheetOrigin(): AltiumPoint | undefined {
    return getPcbRecordPoint(this, ["SHEETX"], ["SHEETY"])
  }

  get sheetSize(): AltiumSize | undefined {
    return getPcbRecordSize(this, ["SHEETWIDTH"], ["SHEETHEIGHT"])
  }

  get uniqueId(): string | undefined {
    return getFirstDecoded(this, "UNIQUEID")
  }

  get grid(): AltiumPcbGridSettings {
    return {
      dotGrid: this.getBoolean("DOTGRID"),
      electricalGridEnabled: this.getBoolean("ELECTRICALGRIDENABLED"),
      electricalGridRangeMils: getPcbRecordMeasurementMils(
        this,
        "ELECTRICALGRIDRANGE",
      ),
      largeVisibleGridMultiplier: this.getNumber("BIGVISIBLEGRIDMULTFACTOR"),
      largeVisibleGridSize: this.getNumber("BIGVISIBLEGRIDSIZE"),
      snapEnabled: this.getBoolean("GRIDSNAPENABLED"),
      snapSizeMils: getPcbRecordMeasurementMils(this, "GRIDSIZE"),
      visibleGridMultiplier: this.getNumber("VISIBLEGRIDMULTFACTOR"),
      visibleGridSize: this.getNumber("VISIBLEGRIDSIZE"),
    }
  }

  get outline(): AltiumPcbContour {
    return getPcbContour(this)
  }

  get layerStack(): AltiumPcbLayerStack {
    return getPcbLayerStack(this)
  }
}
