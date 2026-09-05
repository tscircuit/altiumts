import type { AltiumSchDoc } from "../altium-sch-doc"
import type { AltiumRecord } from "../records/altium-record"
import type { AltiumSchSheetRecord } from "../records/altium-schematic-records"
import type { SchematicConnectionSegment } from "./get-schematic-port-direction"

export interface SchematicRenderContext {
  document?: AltiumSchDoc
  records: AltiumRecord[]
  portConnectionSegments?: SchematicConnectionSegment[]
  sheetRecord?: AltiumSchSheetRecord
}
