import type { AltiumRecord } from "../records/altium-record"
import {
  getPcbLayerColor,
  PCB_KEEPOUT_HATCH_PITCH_MILS,
  PCB_KEEPOUT_STROKE_WIDTH_MILS,
} from "./pcb-layer"

export const PCB_KEEPOUT_FILL_PATTERN_ID = "pcb-keepout-fill"

export function isKeepoutFill(record: AltiumRecord): boolean {
  return record.recordKind === "Fill" && record.getBoolean("KEEPOUT") === true
}

export function renderPcbKeepoutFillPattern(): string {
  const pitchMils = PCB_KEEPOUT_HATCH_PITCH_MILS
  return `<defs><pattern id="${PCB_KEEPOUT_FILL_PATTERN_ID}" patternUnits="userSpaceOnUse" width="${pitchMils}" height="${pitchMils}"><path d="M0 0L${pitchMils} ${pitchMils}M${pitchMils} 0L0 ${pitchMils}" fill="none" stroke="${getPcbLayerColor("KEEPOUT")}" stroke-width="${PCB_KEEPOUT_STROKE_WIDTH_MILS}"/></pattern></defs>`
}
