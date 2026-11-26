import { expect, test } from "bun:test"
import { AltiumField, AltiumRecord } from "../lib"

test("deleting a record field detaches it from the record tree", () => {
  const field = new AltiumField({ key: "VALUE", value: "before" })
  const record = new AltiumRecord({ items: [field] })

  expect(field.parent).toBe(record)
  expect(record.delete("VALUE")).toBe(1)
  expect(field.parent).toBeUndefined()

  record.clearDirty()
  field.value = "after"
  expect(record.isDirty).toBe(false)
})
