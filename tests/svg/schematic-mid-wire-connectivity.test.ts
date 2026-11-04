import { expect, test } from "bun:test"
import { parseAltiumSchDoc, serializeAltiumSheetToSvg } from "../../lib"

const horizontalWire =
  "|RECORD=27|COLOR=128|LOCATIONCOUNT=2|X1=20|Y1=60|X2=100|Y2=60"
const verticalWire =
  "|RECORD=27|COLOR=128|LOCATIONCOUNT=2|X1=60|Y1=20|X2=60|Y2=100"
const scenarios = [
  {
    name: "mid-wire-label",
    netCount: 1,
    records: [
      horizontalWire,
      "|RECORD=25|TEXT=SIGNAL|FONTID=1|LOCATION.X=60|LOCATION.Y=60",
    ],
  },
  {
    name: "t-connection",
    netCount: 1,
    records: [
      horizontalWire,
      "|RECORD=27|COLOR=128|LOCATIONCOUNT=2|X1=60|Y1=60|X2=60|Y2=100",
    ],
  },
  {
    name: "diagonal-connection",
    netCount: 1,
    records: [
      "|RECORD=27|COLOR=128|LOCATIONCOUNT=2|X1=20|Y1=20|X2=100|Y2=100",
      "|RECORD=27|COLOR=128|LOCATIONCOUNT=2|X1=60|Y1=60|X2=100|Y2=20",
    ],
  },
  {
    name: "bare-crossing",
    netCount: 2,
    records: [horizontalWire, verticalWire],
  },
  {
    name: "junction-crossing",
    netCount: 1,
    records: [
      horizontalWire,
      verticalWire,
      "|RECORD=29|COLOR=128|LOCATION.X=60|LOCATION.Y=60",
    ],
  },
  {
    name: "generic-text-crossing",
    netCount: 2,
    records: [
      horizontalWire,
      verticalWire,
      "|RECORD=4|TEXT=NOTE|FONTID=1|LOCATION.X=60|LOCATION.Y=60",
    ],
  },
]

test.each(scenarios)(
  "snapshots schematic connectivity: $name",
  async ({ name, netCount, records }) => {
    const document = parseAltiumSchDoc(
      [
        "|RECORD=31|CUSTOMX=120|CUSTOMY=120|USECUSTOMSHEET=T|FONTNAME1=Arial|SIZE1=6",
        ...records,
      ].join("\n"),
    )
    const graph = document.netGraph
    const documentRecords = document.records
    expect(graph.nets).toHaveLength(netCount)
    // Snapshot connectivity explicitly: identical drawings can describe
    // different electrical graphs. Omit internal union-find root IDs.
    expect(
      graph.nets.map((net) => ({
        names: net.names.toSorted(),
        points: net.points.toSorted((a, b) => a.x - b.x || a.y - b.y),
        records: net.records
          .map((record) => ({
            index: documentRecords.indexOf(record),
            kind: record.recordKind,
          }))
          .sort((a, b) => a.index - b.index),
      })),
    ).toMatchSnapshot()

    // Colour this disposable fixture by public graph membership so SVG diffs
    // expose disconnected nets even when the source geometry is unchanged.
    const netColors = [0xcc6611, 0x2255cc]
    for (const [index, net] of graph.nets.entries()) {
      for (const record of net.records) {
        record.set("COLOR", String(netColors[index % netColors.length]))
      }
    }
    const svg = serializeAltiumSheetToSvg(document, {
      backgroundColor: "#fff",
      height: 480,
      margin: 0,
      showBorder: false,
      title: name,
      viewBox: { x: 0, y: 0, width: 120, height: 120 },
      width: 480,
    })
    const annotatedSvg = svg.replace(
      "</svg>",
      `<text x="8" y="114" font-family="Arial" font-size="6" fill="#111827">${graph.nets.length} electrical net${graph.nets.length === 1 ? "" : "s"}</text></svg>`,
    )
    await expect(annotatedSvg).toMatchSvgSnapshot(import.meta.path, name)
  },
)
