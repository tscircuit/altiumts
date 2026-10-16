import { expect, test } from "bun:test"
import { AltiumBoardRecord, AltiumField, getPcbLayerStack } from "../lib"

test("uses legacy copper stack when V7 metadata only describes mechanical layers", () => {
  const board = new AltiumBoardRecord({
    items: [
      new AltiumField({ key: "LAYER1NAME", value: "TOP" }),
      new AltiumField({ key: "LAYER1NEXT", value: "2" }),
      new AltiumField({ key: "LAYER2NAME", value: "LYR2_GND" }),
      new AltiumField({ key: "LAYER2PREV", value: "1" }),
      new AltiumField({ key: "LAYER2NEXT", value: "32" }),
      new AltiumField({ key: "LAYER32NAME", value: "BOTTOM" }),
      new AltiumField({ key: "LAYER32PREV", value: "2" }),
      new AltiumField({ key: "LAYERV7_0LAYERID", value: "16908305" }),
      new AltiumField({ key: "LAYERV7_0NAME", value: "Mechanical 17" }),
      new AltiumField({ key: "LAYERV7_0COPTHICK", value: "1.4mil" }),
    ],
  })

  expect(getPcbLayerStack(board).entries).toEqual([
    expect.objectContaining({
      index: 1,
      name: "TOP",
      next: "2",
      source: "legacy",
    }),
    expect.objectContaining({
      index: 2,
      name: "LYR2_GND",
      next: "32",
      previous: "1",
      source: "legacy",
    }),
    expect.objectContaining({
      index: 32,
      name: "BOTTOM",
      previous: "2",
      source: "legacy",
    }),
  ])
})
