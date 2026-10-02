import type { AltiumPoint } from "../geometry/altium-geometry"
import { AltiumRecord, type AltiumRecordInit } from "./altium-record"
import {
  getFirstDecoded,
  getFirstNumber,
  getPcbRecordMeasurementMils,
  getPcbRecordPoint,
} from "./pcb-record-helpers"

export class AltiumDimensionRecord extends AltiumRecord {
  override readonly type = "dimension-record"

  constructor(init: AltiumRecordInit = {}) {
    super(init)
  }

  get dimensionKind(): string | undefined {
    return getFirstDecoded(this, "DIMENSIONKIND", "KIND")
  }

  get start(): AltiumPoint | undefined {
    return this.referencePoints[0] ?? getPcbRecordPoint(this, ["X1"], ["Y1"])
  }

  get end(): AltiumPoint | undefined {
    return this.referencePoints[1] ?? getPcbRecordPoint(this, ["X2"], ["Y2"])
  }

  get dimensionLineAnchor(): AltiumPoint | undefined {
    return getPcbRecordPoint(this, ["X1"], ["Y1"])
  }

  get referencePoints(): AltiumPoint[] {
    return getIndexedDimensionPoints({
      pointInfix: "POINT",
      prefix: "REFERENCE",
      record: this,
    })
  }

  get textPoints(): AltiumPoint[] {
    // Native dimensions save the rendered text separately from the control point.
    const indexedPoints = getIndexedDimensionPoints({
      pointInfix: "",
      prefix: "TEXT",
      record: this,
    })
    if (indexedPoints.length > 0) return indexedPoints
    const unindexedTextPoint = getPcbRecordPoint(this, ["TEXTX"], ["TEXTY"])
    return unindexedTextPoint ? [unindexedTextPoint] : []
  }

  get unit(): string | undefined {
    return getFirstDecoded(this, "TEXTDIMENSIONUNIT", "DIMENSIONUNIT", "UNIT")
  }

  get precision(): number | undefined {
    return (
      getFirstNumber(this, "TEXTPRECISION", "PRECISION") ??
      getPcbRecordMeasurementMils(this, "TEXTPRECISION", "PRECISION")
    )
  }

  get prefix(): string | undefined {
    return getFirstDecoded(this, "TEXTPREFIX", "PREFIX")
  }

  get suffix(): string | undefined {
    return getFirstDecoded(this, "TEXTSUFFIX", "SUFFIX")
  }

  get lineWidthMils(): number | undefined {
    return getPcbRecordMeasurementMils(
      this,
      "LINEWIDTH",
      "ARROWLINEWIDTH",
      "WIDTH",
    )
  }

  get textHeightMils(): number | undefined {
    return getPcbRecordMeasurementMils(this, "TEXTHEIGHT", "HEIGHT")
  }
}

function getIndexedDimensionPoints({
  pointInfix,
  prefix,
  record,
}: {
  pointInfix: "POINT" | ""
  prefix: "REFERENCE" | "TEXT"
  record: AltiumRecord
}): AltiumPoint[] {
  const points: AltiumPoint[] = []
  const declaredCount =
    prefix === "REFERENCE" ? record.getNumber("REFERENCES_COUNT") : undefined
  const maximumPointCount = Math.min(Math.max(declaredCount ?? 100, 0), 10_000)
  const firstIndex = prefix === "REFERENCE" ? 0 : 1

  for (
    let index = firstIndex;
    index < firstIndex + maximumPointCount;
    index++
  ) {
    const point = getPcbRecordPoint(
      record,
      [`${prefix}${index}${pointInfix}X`],
      [`${prefix}${index}${pointInfix}Y`],
    )
    if (!point) break
    points.push(point)
  }
  return points
}

export class AltiumCoordinateRecord extends AltiumRecord {
  override readonly type = "coordinate-record"

  get position(): AltiumPoint | undefined {
    return getPcbRecordPoint(this, ["X", "LOCATION.X"], ["Y", "LOCATION.Y"])
  }
}
