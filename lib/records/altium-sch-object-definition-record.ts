import { AltiumSchematicRecord } from "./altium-schematic-records"

/** A reusable graphical definition in a schematic's ObjectDefinitions stream. */
export class AltiumSchObjectDefinitionRecord extends AltiumSchematicRecord {
  override readonly type = "schematic-object-definition-record"

  get objectDefinitionId(): string | undefined {
    return this.getCaseInsensitive("ObjectDefinitionId")
  }
}
