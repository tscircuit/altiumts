import { describe, expect, test } from "bun:test"
import { parseAltiumAscii, serializeAltiumSheetToSvg } from "../../lib"
import { renderAltiumNegatedText } from "../../lib/svg-serialization/render-altium-negated-text"

const negated = (text: string): string =>
  `<tspan class="altium-negated-text" text-decoration="overline">${text}</tspan>`

describe("renderAltiumNegatedText", () => {
  test("renders per-character and whole-name negation", () => {
    expect(renderAltiumNegatedText(String.raw`N\E\T\/A`)).toBe(
      `${negated("NET")}/A`,
    )
    expect(renderAltiumNegatedText(String.raw`\ENABLE`)).toBe(negated("ENABLE"))
  })

  test("escapes XML inside and outside negated runs", () => {
    expect(renderAltiumNegatedText(String.raw`A\<&`)).toBe(
      `${negated("A")}&lt;&amp;`,
    )
    expect(renderAltiumNegatedText(String.raw`\A<&`)).toBe(
      negated("A&lt;&amp;"),
    )
  })
})

test("renders Altium negation markers as overbars", () => {
  const source = [
    "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
    "|RECORD=31|CUSTOMX=200|CUSTOMY=140",
    String.raw`|RECORD=2|PINCONGLOMERATE=58|PINLENGTH=10|LOCATION.X=40|LOCATION.Y=40|NAME=R\E\S\E\T\|DESIGNATOR=1`,
    String.raw`|RECORD=2|PINCONGLOMERATE=58|PINLENGTH=10|LOCATION.X=40|LOCATION.Y=50|NAME=\I\N\T\/SQW|DESIGNATOR=2`,
    String.raw`|RECORD=2|PINCONGLOMERATE=58|PINLENGTH=10|LOCATION.X=40|LOCATION.Y=60|NAME=\ENABLE|DESIGNATOR=D\3\|ELECTRICAL=0`,
    "|RECORD=15|LOCATION.X=20|LOCATION.Y=120|XSIZE=100|YSIZE=80",
    String.raw`|RECORD=16|OWNERINDEX=4|DISTANCEFROMTOP=2|NAME=\ENTRY|TEXTFONTID=1`,
    String.raw`|RECORD=25|LOCATION.X=30|LOCATION.Y=90|TEXT=N\E\T\/A`,
    String.raw`|RECORD=18|LOCATION.X=60|LOCATION.Y=70|WIDTH=50|HEIGHT=10|NAME=\PORT`,
    String.raw`|RECORD=17|LOCATION.X=140|LOCATION.Y=50|TEXT=P\W\R\|STYLE=2`,
  ].join("\n")
  const svg = serializeAltiumSheetToSvg(parseAltiumAscii(source), {
    title: "Schematic active-low overbars",
  })

  expect(svg).toContain(`${negated("RESET")}</text>`)
  expect(svg).toContain(`${negated("INT/SQW")}</text>`)
  expect(svg).toContain(`${negated("ENABLE")}</text>`)
  expect(svg).toContain(">D\\3\\</text>")
  expect(svg).toContain(`${negated("ENTRY")}</text>`)
  expect(svg).toContain(`${negated("NET")}/A</text>`)
  expect(svg).toContain(`${negated("PORT")}</text>`)
  expect(svg).toContain(`${negated("PWR")}</text>`)
})
