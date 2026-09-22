import { expect, test } from "bun:test"
import { approximateAltiumArc } from "../../lib"

test("wraps Altium arcs counterclockwise through zero degrees", () => {
  const points = approximateAltiumArc({
    center: { x: 10, y: 20 },
    radius: 5,
    startAngleDegrees: 360,
    endAngleDegrees: 90,
  })

  expect(points).toHaveLength(13)
  expect(points[0]?.x).toBeCloseTo(15)
  expect(points[0]?.y).toBeCloseTo(20)
  expect(points.at(-1)?.x).toBeCloseTo(10)
  expect(points.at(-1)?.y).toBeCloseTo(25)
  expect(points.every(({ x, y }) => x >= 10 && y >= 20)).toBe(true)
})

test("preserves equal-angle Altium arcs as full circles", () => {
  const points = approximateAltiumArc({
    center: { x: 0, y: 0 },
    radius: 5,
    startAngleDegrees: 45,
    endAngleDegrees: 45,
  })

  expect(points).toHaveLength(49)
  expect(points.at(-1)?.x).toBeCloseTo(points[0]?.x ?? 0)
  expect(points.at(-1)?.y).toBeCloseTo(points[0]?.y ?? 0)
})
