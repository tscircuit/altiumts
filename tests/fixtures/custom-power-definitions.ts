export const powerDefinitionIds = {
  bar: "{7A26769B-8D24-4D38-A6CA-BA64A3D733D7}",
  ground: "{FD25F151-3EBA-4E5E-96D9-AC08AB764A51}",
}

export const customPowerDefinitions = [
  `|RECORD=129|ObjectDefinitionId=${powerDefinitionIds.bar}|LibReference=CustomBar|PartCount=2|CurrentPartId=1|DisplayModeCount=1|Location.X=0|Location.Y=0|OwnerPartId=-1`,
  "|RECORD=13|OwnerIndex=0|OwnerPartId=-1|Location.X=0|Location.Y=0|Corner.X=10|Corner.Y=0|LineWidth=0|Color=136",
  "|RECORD=13|OwnerIndex=0|OwnerPartId=-1|Location.X=10|Location.Y=-5|Corner.X=10|Corner.Y=5|LineWidth=0|Color=136",
  `|RECORD=129|ObjectDefinitionId=${powerDefinitionIds.ground}|LibReference=CustomGround|PartCount=2|CurrentPartId=1|DisplayModeCount=1|Location.X=0|Location.Y=0|OwnerPartId=-1`,
  "|RECORD=13|OwnerIndex=3|OwnerPartId=-1|Location.X=0|Location.Y=0|Corner.X=4|Corner.Y=0|LineWidth=0|Color=136",
  "|RECORD=13|OwnerIndex=3|OwnerPartId=-1|Location.X=4|Location.Y=-7|Corner.X=4|Corner.Y=7|LineWidth=0|Color=136",
  "|RECORD=13|OwnerIndex=3|OwnerPartId=-1|Location.X=8|Location.Y=-4|Corner.X=8|Corner.Y=4|LineWidth=0|Color=136",
  "|RECORD=13|OwnerIndex=3|OwnerPartId=-1|Location.X=12|Location.Y=-2|Corner.X=12|Corner.Y=2|LineWidth=0|Color=136",
] as const

export const customPowerSheet = [
  "|HEADER=Protel for Windows - Schematic Capture Ascii File Version 5.0",
  "|RECORD=31|USECUSTOMSHEET=T|CUSTOMX=300|CUSTOMY=180|AREACOLOR=16777215|FONTIDCOUNT=1|FONTNAME1=Arial|SIZE1=4",
  ...(
    [
      [-8, 0],
      [0, -8],
      [8, 0],
      [0, 8],
    ] as const
  ).flatMap(([wireDx, wireDy], orientation) =>
    (["bar", "ground"] as const).flatMap((kind, index) => {
      const x = 45 + 70 * orientation
      const y = 50 + 80 * index
      return [
        `|RECORD=17|OWNERINDEX=-1|LOCATION.X=${x}|LOCATION.Y=${y}|ORIENTATION=${orientation}|STYLE=${kind === "bar" ? 2 : 4}|TEXT=${kind === "bar" ? "VDD" : "GND"}|SHOWNETNAME=T|FONTID=1|COLOR=136|ObjectDefinitionId=${powerDefinitionIds[kind]}`,
        `|RECORD=27|OWNERINDEX=-1|LOCATIONCOUNT=2|X1=${x}|Y1=${y}|X2=${x + wireDx}|Y2=${y + wireDy}|LINEWIDTH=0|COLOR=32768`,
      ]
    }),
  ),
].join("\n")
