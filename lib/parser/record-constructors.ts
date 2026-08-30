import { AltiumArcRecord } from "../records/altium-arc-record"
import { AltiumBoardRecord } from "../records/altium-board-record"
import {
  AltiumClassRecord,
  AltiumSignalClassRecord,
} from "../records/altium-class-record"
import { AltiumComponentBodyRecord } from "../records/altium-component-body-record"
import { AltiumComponentRecord } from "../records/altium-component-record"
import {
  AltiumConnectionRecord,
  AltiumDifferentialPairRecord,
  AltiumFromToRecord,
} from "../records/altium-connectivity-records"
import {
  AltiumCoordinateRecord,
  AltiumDimensionRecord,
} from "../records/altium-dimension-record"
import { AltiumEmbeddedBoardRecord } from "../records/altium-embedded-board-record"
import { AltiumFillRecord } from "../records/altium-fill-record"
import {
  AltiumAdvancedPlacerOptionsRecord,
  AltiumDesignRuleCheckerOptionsRecord,
  AltiumEngineeringChangeOrderOptionsRecord,
  AltiumFileVersionInfoRecord,
  AltiumGerberOptionsRecord,
  AltiumOutputOptionsRecord,
  AltiumPinSwapOptionsRecord,
  AltiumPrinterOptionsRecord,
  AltiumTestpointOptionsRecord,
  AltiumUniqueIdPrimitiveInformationRecord,
} from "../records/altium-metadata-records"
import { AltiumModelRecord } from "../records/altium-model-record"
import { AltiumNetRecord } from "../records/altium-net-record"
import { AltiumPadRecord } from "../records/altium-pad-record"
import { AltiumParameterRecord } from "../records/altium-parameter-record"
import { AltiumPolygonRecord } from "../records/altium-polygon-record"
import type { AltiumRecord, AltiumRecordInit } from "../records/altium-record"
import { AltiumRegionRecord } from "../records/altium-region-record"
import { AltiumRoomRecord } from "../records/altium-room-record"
import {
  AltiumDxpRuleRecord,
  AltiumRuleRecord,
} from "../records/altium-rule-record"
import {
  AltiumSchArcRecord,
  AltiumSchBezierRecord,
  AltiumSchBusRecord,
  AltiumSchComponentRecord,
  AltiumSchDesignatorRecord,
  AltiumSchEllipseRecord,
  AltiumSchEllipticalArcRecord,
  AltiumSchImageRecord,
  AltiumSchImplementationListRecord,
  AltiumSchImplementationMapRecord,
  AltiumSchImplementationParameterRecord,
  AltiumSchImplementationRecord,
  AltiumSchJunctionRecord,
  AltiumSchLabelRecord,
  AltiumSchLineRecord,
  AltiumSchNetLabelRecord,
  AltiumSchNoErcRecord,
  AltiumSchNoteRecord,
  AltiumSchParameterRecord,
  AltiumSchParameterSetRecord,
  AltiumSchPinRecord,
  AltiumSchPolygonRecord,
  AltiumSchPolylineRecord,
  AltiumSchPortRecord,
  AltiumSchPowerPortRecord,
  AltiumSchRectangleRecord,
  AltiumSchRoundedRectangleRecord,
  AltiumSchSheetEntryRecord,
  AltiumSchSheetFileNameRecord,
  AltiumSchSheetNameRecord,
  AltiumSchSheetRecord,
  AltiumSchSheetSymbolRecord,
  AltiumSchTemplateRecord,
  AltiumSchTextFrameRecord,
  AltiumSchWireRecord,
} from "../records/altium-schematic-records"
import { AltiumSmartUnionRecord } from "../records/altium-smart-union-record"
import { AltiumTextRecord } from "../records/altium-text-record"
import { AltiumTrackRecord } from "../records/altium-track-record"
import { AltiumViaRecord } from "../records/altium-via-record"

export type AltiumRecordConstructor = new (
  init?: AltiumRecordInit,
) => AltiumRecord

export const recordConstructors = new Map<string, AltiumRecordConstructor>([
  ["Arc", AltiumArcRecord],
  ["1", AltiumSchComponentRecord],
  ["2", AltiumSchPinRecord],
  ["4", AltiumSchLabelRecord],
  ["5", AltiumSchBezierRecord],
  ["6", AltiumSchPolylineRecord],
  ["7", AltiumSchPolygonRecord],
  ["8", AltiumSchEllipseRecord],
  ["10", AltiumSchRoundedRectangleRecord],
  ["11", AltiumSchEllipticalArcRecord],
  ["12", AltiumSchArcRecord],
  ["13", AltiumSchLineRecord],
  ["14", AltiumSchRectangleRecord],
  ["15", AltiumSchSheetSymbolRecord],
  ["16", AltiumSchSheetEntryRecord],
  ["17", AltiumSchPowerPortRecord],
  ["18", AltiumSchPortRecord],
  ["22", AltiumSchNoErcRecord],
  ["25", AltiumSchNetLabelRecord],
  ["26", AltiumSchBusRecord],
  ["27", AltiumSchWireRecord],
  ["28", AltiumSchTextFrameRecord],
  ["29", AltiumSchJunctionRecord],
  ["30", AltiumSchImageRecord],
  ["31", AltiumSchSheetRecord],
  ["32", AltiumSchSheetNameRecord],
  ["33", AltiumSchSheetFileNameRecord],
  ["34", AltiumSchDesignatorRecord],
  ["37", AltiumSchParameterSetRecord],
  ["39", AltiumSchTemplateRecord],
  ["41", AltiumSchParameterRecord],
  ["44", AltiumSchImplementationListRecord],
  ["45", AltiumSchImplementationRecord],
  ["46", AltiumSchImplementationMapRecord],
  ["48", AltiumSchImplementationParameterRecord],
  ["209", AltiumSchNoteRecord],
  ["AdvancedPlacerOptions", AltiumAdvancedPlacerOptionsRecord],
  ["Board", AltiumBoardRecord],
  ["BoardRegion", AltiumRegionRecord],
  ["Class", AltiumClassRecord],
  ["ComponentBody", AltiumComponentBodyRecord],
  ["ComponentBodyLegacy", AltiumComponentBodyRecord],
  ["Component", AltiumComponentRecord],
  ["Connection", AltiumConnectionRecord],
  ["Coordinate", AltiumCoordinateRecord],
  ["DesignRuleCheckerOptions", AltiumDesignRuleCheckerOptionsRecord],
  ["DifferentialPair", AltiumDifferentialPairRecord],
  ["Dimension", AltiumDimensionRecord],
  ["DXPRule", AltiumDxpRuleRecord],
  ["EmbeddedBoard", AltiumEmbeddedBoardRecord],
  ["EngineeringChangeOrderOptions", AltiumEngineeringChangeOrderOptionsRecord],
  ["FileVersionInfo", AltiumFileVersionInfoRecord],
  ["Fill", AltiumFillRecord],
  ["FromTo", AltiumFromToRecord],
  ["GerberOptions", AltiumGerberOptionsRecord],
  ["Model", AltiumModelRecord],
  ["Net", AltiumNetRecord],
  ["OutputOptions", AltiumOutputOptionsRecord],
  ["Pad", AltiumPadRecord],
  ["ParamItem", AltiumParameterRecord],
  ["PinSwapOptions", AltiumPinSwapOptionsRecord],
  ["Polygon", AltiumPolygonRecord],
  ["PrinterOptions", AltiumPrinterOptionsRecord],
  ["Region", AltiumRegionRecord],
  ["RegionFill", AltiumRegionRecord],
  ["Room", AltiumRoomRecord],
  ["Rule", AltiumRuleRecord],
  ["SignalClass", AltiumSignalClassRecord],
  ["SmartUnion", AltiumSmartUnionRecord],
  ["TestpointOptions", AltiumTestpointOptionsRecord],
  ["Text", AltiumTextRecord],
  ["Track", AltiumTrackRecord],
  ["UniqueIDPrimitiveInformation", AltiumUniqueIdPrimitiveInformationRecord],
  ["Via", AltiumViaRecord],
])
