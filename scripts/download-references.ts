import { createHash } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { unzipSync } from "fflate"

type DirectReferenceSpec = {
  filename: string
  sha256: string
  source: string
  url: string
}

type NestedZipBundleSpec = {
  archiveSha256: string
  nestedArchivePath: string
  nestedArchiveSha256: string
  outputs: Array<{
    filename: string
    nestedFilePath: string
    sha256: string
  }>
  source: string
  url: string
}

const references: DirectReferenceSpec[] = [
  {
    filename: "altium-dsp-fpga-power.SchDoc",
    sha256: "a0e51aeb708bcb7d8f444073a16e5edf9e8aee63ce28329122942ca27150373f",
    source:
      "AmirhosseinR/Altium_DSP_FPGA@61e66e61a6b7fbcfbc370a0b756b2958f38ad493 (MIT)",
    url: "https://raw.githubusercontent.com/AmirhosseinR/Altium_DSP_FPGA/61e66e61a6b7fbcfbc370a0b756b2958f38ad493/power.SchDoc",
  },
  {
    filename: "dsp5509-ciii.PcbDoc",
    sha256: "20ab6308a67eb4b694c53e55095c6fe18fd0a9bb49fe69575d8eb32fc74579fd",
    source:
      "AmirhosseinR/Altium_DSP_FPGA@61e66e61a6b7fbcfbc370a0b756b2958f38ad493 (MIT)",
    url: "https://raw.githubusercontent.com/AmirhosseinR/Altium_DSP_FPGA/61e66e61a6b7fbcfbc370a0b756b2958f38ad493/DSP5509_CIII.PcbDoc",
  },
  {
    filename: "stm32-st-link-v2.SchDoc",
    sha256: "e571d8b66e23d73ebc7ecac53d17c116194c6117f534947d420fef87c6cd50c2",
    source:
      "yasir-shahzad/STM32-ST-Link-V2.0-Programmer@3284ac4fbd9a3f8471844db3c2b368fff2c33ca9 (GPL-3.0)",
    url: "https://raw.githubusercontent.com/yasir-shahzad/STM32-ST-Link-V2.0-Programmer/3284ac4fbd9a3f8471844db3c2b368fff2c33ca9/hardware/ST_LINK_V2-1.SchDoc",
  },
  {
    filename: "simplefocmini-2024-04-26.PcbDoc",
    sha256: "8328cebe97ba8623fb2b707490e3473c6f7dc13fb0502b596b0e40c7e1613d24",
    source:
      "simplefoc/SimpleFOCMini@8e10d4ba398624bd0ef970e82c03d7a6bcc2220d (MIT)",
    url: "https://raw.githubusercontent.com/simplefoc/SimpleFOCMini/8e10d4ba398624bd0ef970e82c03d7a6bcc2220d/Altium/simplefocmini_2024-04-26.pcbdoc",
  },
  {
    filename: "simplefocmini-2024-04-26.SchDoc",
    sha256: "bc2039ef59eabe030fea68eedb87e3924c8e6711fb774e2d80b880cf468100ef",
    source:
      "simplefoc/SimpleFOCMini@8e10d4ba398624bd0ef970e82c03d7a6bcc2220d (MIT)",
    url: "https://raw.githubusercontent.com/simplefoc/SimpleFOCMini/8e10d4ba398624bd0ef970e82c03d7a6bcc2220d/Altium/simplefocmini_2024-04-26.schdoc",
  },
  {
    filename: "sample-board-design.PcbDoc",
    sha256: "745a27e3b876767c9bc4caf7706c19b6f97b3313efdb00bc2771f22db8410174",
    source:
      "monkslc/hyperpolyglot@a55a3b58eaed09b4314ef93d78e50a80cfec36f4 (Apache-2.0)",
    url: "https://raw.githubusercontent.com/monkslc/hyperpolyglot/a55a3b58eaed09b4314ef93d78e50a80cfec36f4/samples/Altium%20Designer/Sample%20Board%20Design.PcbDoc",
  },
  {
    filename: "sample-schematic-sheet.SchDoc",
    sha256: "7215233b59c7d590feb77fd6c05f94adad63bd05f3c8e296a8d43d3c889cb958",
    source:
      "monkslc/hyperpolyglot@a55a3b58eaed09b4314ef93d78e50a80cfec36f4 (Apache-2.0)",
    url: "https://raw.githubusercontent.com/monkslc/hyperpolyglot/a55a3b58eaed09b4314ef93d78e50a80cfec36f4/samples/Altium%20Designer/Sample%20Schematic%20Sheet.SchDoc",
  },
  {
    filename: "simplefoc-shield-v3-2024-06-23.PcbDoc",
    sha256: "507a0feb04cf539edd110ff1fe6da8ca8025009140b1934a6fc4df78308bfec5",
    source:
      "simplefoc/Arduino-SimpleFOCShield@2a83626b86debd5fc5f309ba06b3fb36e3b25533 (MIT)",
    url: "https://raw.githubusercontent.com/simplefoc/Arduino-SimpleFOCShield/2a83626b86debd5fc5f309ba06b3fb36e3b25533/altium/SimpleFOCShieldV3.PcbDoc_2024-06-23.pcbdoc",
  },
  {
    filename: "simplefoc-shield-v3-2024-06-23.SchDoc",
    sha256: "84419ed6b8755c6490415cf3e439405d0d10a5855304db7ca8e8052f2add3af8",
    source:
      "simplefoc/Arduino-SimpleFOCShield@2a83626b86debd5fc5f309ba06b3fb36e3b25533 (MIT)",
    url: "https://raw.githubusercontent.com/simplefoc/Arduino-SimpleFOCShield/2a83626b86debd5fc5f309ba06b3fb36e3b25533/altium/SimpleFOCShieldV3.SchDoc_2024-06-23.schdoc",
  },
  {
    filename: "elk-pi.PcbDoc",
    sha256: "8d61c6c9b9eff6748340794db203a86057857b8ce0348b7510859d73e3bce210",
    source:
      "elk-audio/elk-pi-hardware@770960ce5e520cf450182160cd8cff9690a0a869 (CC BY-SA 4.0)",
    url: "https://media.githubusercontent.com/media/elk-audio/elk-pi-hardware/770960ce5e520cf450182160cd8cff9690a0a869/Altium_files/ElkPi.PcbDoc",
  },
  {
    filename: "elk-pi-main.SchDoc",
    sha256: "c74863eea1f3fb0ad7ebacf61beae465005d2fde2a2e517bbbd49aab9c22b9bb",
    source:
      "elk-audio/elk-pi-hardware@770960ce5e520cf450182160cd8cff9690a0a869 (CC BY-SA 4.0)",
    url: "https://media.githubusercontent.com/media/elk-audio/elk-pi-hardware/770960ce5e520cf450182160cd8cff9690a0a869/Altium_files/Main.SchDoc",
  },
  {
    filename: "novena-edp-adapter-dvt1.PcbDoc",
    sha256: "17896fdfeaac33a84ac3063db063d0a4d211c127c997632c8000837c0ce6fc12",
    source:
      "KiCad/kicad-source-mirror@c2a91caacf90b4d07261658ef44c0230116e667b (GPL-3.0-or-later mirror; Novena open-hardware fixture)",
    url: "https://raw.githubusercontent.com/KiCad/kicad-source-mirror/c2a91caacf90b4d07261658ef44c0230116e667b/qa/data/pcbnew/plugins/altium/eDP_adapter_dvt1_source/eDP_adapter_dvt1.PcbDoc",
  },
]

const tiSchematicHashes: Record<string, string> = {
  "01": "3daedf995eb3c49c946360417c4a44ab834b437425709422f7f56d5355d38cf9",
  "02": "0f81da15cdd3b4c86749403f0cdf185d8c342addd8dcec23219abb5f380fbd76",
  "03": "dfb9bba2ada9767ed9e79de2a158cc029808ce1f53d75e43a2a85f2c5fdc6242",
  "04": "d19698c9ea72b4c54ef1c2eb9e15f980e6ea6b85a1b3555a41fce56608639740",
  "05": "bf2560e9c0bd9a8f347f9ecdeca9e28ae067c921fdef3b5d8b59f4f4697c09a4",
  "06": "f4f9b511c9c32f887b9698301a1c2cbf86e7567c1932a3fafedfbedcb786d813",
  "07": "38f2924d0104586c5703e5b218db26d1e96fddc3269c16da7d8fff4889afd1f8",
  "08": "fc3bf5e6fd9e9d49a6eb71f56386f10c8d69484c2a5ad57a9fa48a300a94f44d",
  "09": "07c0fdd45dff857276eab3cb605977cd0ae6f6599f0c4b460a22e782b3bc6c2b",
  "10": "c77dc2008904150dc34e9f939ad2644a481f06b8bb3c633455f4f0498b786dcb",
  "11": "f650f5d0f85917d37370fc5c5151c6b36bd8c556cd15045726afb4b5b07af1e9",
  "12": "f217da8b6b06e994fb723841af970239bfaee938ddb6d50a7332b353f7c66114",
  "13": "ddf9a5db07ad469acac778f2d2b5d32efbe164b5428f62202a37d44f009e323a",
  "14": "bbefcd9ce867c064ceb926dfb01f72d4f47480abd93045219c4594125fbb2b61",
  "15": "e7db38c1a7ba90636e613a03f2794791b4c28c590dadfafbd10b424cbe4785c2",
  "16": "dc87ca4eb6720fd094113e4f2fb8432bc1ac2f9b102d2bd6f17fe179af153eca",
  "17": "dae919e65c9e0c2d26cb6843701ad41ab4ee676bf7e6df5b97ad6e4586b2a9a3",
  "18": "6b269af7c77c5af888f7a19440465c60c3f0d6b69687ad930d879427193cef3b",
  "19": "35179900cbc314d1d61ae8512d175d6ad523f248fa3bf9a2c20654b5e87ca0ed",
  "20": "187d544764524cdeb6640a88ad23fb64e545ed0a114135349f54e35678765aff",
  "21": "497c9a1cae3007906b05eec05162f82e752dac41518e3d70ff13d79ca3819958",
  "22": "ff055e8872819658311dbb548e7288d017a9ded26644abe1b38af1e5cc724f15",
  "23": "bd0d160b8b89f2ecdb2d8d4fd2b69811f81696a7c14366cc795ba53f26c58666",
  "24": "c5a358315a556bb8dcd0a4cfff04dc8948ec84c3f89c4648ba3cc7ca43d5a502",
  "25": "10cc960fa46a38fb2a03dc1379d4302ce5381e3248cddbecc4ecbffa2e9bbc71",
  "26": "292f97168da7f7e2e023ad45f429e9570911471c7e1276d3bcfa218c66304c79",
  "27": "4669023a126654b585ccb669372ec06bb1586bf987e081bf11d5db464374fa23",
  "28": "bcd9cc4a5599b15f5f024bb4d37e96c498815560301c9039a86c00d4bcbe27d9",
  "29": "6d437dfaa3125dbb4cc1198465b5dd9db1105beea1c0ccb7a3ebf4af42230d7f",
  "30": "12d72ef1323bfb791898f0a95319e2dfd15066b3eb36bdffa13ca2e4dad754d2",
  "31": "94299862e4a77f2cdfa3f318011e67a8a4b8fdf013fb82a6b8181baddb3c1cb8",
  "32": "d64312376eb9358d6d69b4acf3ffd8cc16841e74538e7568b3d000e256dcc672",
  "33": "98c806b8856fa26186e3debf2ec763a59b95f0c2327e6c79a3f2717c150192f6",
  "34": "fb897c981983ca7dbbe9454f61a59199f3a7b689ac0666d28f7d8087b4272258",
  "35": "43ad337a7ed0b2c4259274ec196854bd1305775043f0efbf4dcc32e26ff91f4f",
  "36": "61581372bd6ffd46f34f178d94c4837ebdf212d3ae0a59f3bc6566ae007a8a6f",
  "37": "9f46d29964b739cf34f57cff3a65d537f12853fb3dcb7f3edd92588d8bcab758",
  "38": "fdc3e37d5207dc0ddd272933d9d772988bb0ba9fb115aeee1f9397781cbd0dcf",
  "39": "9962382fe121415dc5b8966f52246e1aaf88bb68af6f14614cfb3bdefd3faee7",
  "40": "3b59032dabbd2253cd69ba15e5b6545e1061eb0f7f1eb188270dbb4af782ac2b",
  "41": "20aa502d9003ff1bd17c8fe1a863117ac4359a01e8793181f84ca1c28f87b4a7",
  "42": "7f9ebe5b79c29839f92eb99b0706f641cfa802e6fef1b2b75c3a521c6bdef99c",
  "43": "d53baffa579676e31aa77adcf460b0b16f8f2ee1de111356a0b37b45007d0e7a",
  "44": "17d59b06159408d0a4b80dcb6e42fa9de2d5a9bcc9f876b3fa116af277c4d35d",
  "45": "aacf69e49e0dcb942de7a42039254a1b954522c003ab343f148266575401b4b1",
  "46": "e441dd979dc65b6d9f3e2c004cd4e9f1d5d7f24048e5208904c5517daa111a00",
  "47": "7f954a1134d7a8db2b47970b14538c6e1ad9ec1a5f40eb4c0fa51d0b7ec7aa23",
  "48": "6f4d2183e46951fcdd9a39fbac077892da455ebe75ce5a0e437f273f08f4fca1",
  "49": "de2896a91d1171c3f3d95c2cce877458f075f554553cc2c6cec4d90730858cad",
  "50": "8348a4c5148b3288a9b8c401caea8264c35cdd9792339f27c87b65df485f12da",
  "51": "a5b5f9feaf4d585ce28e2b9ca3e47bf854dd982ec11b8692531d60d52de0df15",
  "52": "09476a05905bf22fde1bbcf630602a9e13a04547bf56df49a3a27aff4b194214",
  "53": "d7281ad4c8f64086da1d35415f226d211f58f595832d0fa1228892b1b4a91513",
  "54": "d3cbeaeeade0c3cb0e75ad7a14b28476ebff83f289c2c76c9500e534f729d591",
  "55": "5d1e475cf86dde5d9e62f87becb64717b15012e824929448ed525bce925c9698",
  "56": "c875b2e89da73c75c302276a254b5adef7b27a7ba85a92d4f884d6e44dd662d1",
  "57": "8505b9f046ebae2d6bd8c9df7464928a73867e123d1bf760477e9262cc4be7f8",
}

const nestedZipBundles: NestedZipBundleSpec[] = [
  {
    archiveSha256:
      "40e6c4d0bea5381bf7b4e0ef26ec4ec9adae156be308e4a3838bd344972b7615",
    nestedArchivePath:
      "TMDS62LEVM Design File Package Altium (Rev. B)/PROC180/PROC181E1_1/3_BoardFile/Altium/PROC181E1-1_PRJPCB.zip",
    nestedArchiveSha256:
      "636a654aa21de431d5c80519c5b8910a9e0e629cba5216dc3b1cbb4b0e598532",
    outputs: [
      {
        filename: "ti-tmds62levm-rev-b.PcbDoc",
        nestedFilePath: "PROC181E1-1_BRD_11_3.pcbdoc",
        sha256:
          "8444ad8456ff028b7aa11389362ba2fbc01291e87ff46e394576cb044c3612fc",
      },
      ...Object.entries(tiSchematicHashes).map(([sheet, sha256]) => ({
        filename: `ti-tmds62levm-rev-b/${sheet}.SchDoc`,
        nestedFilePath: `${sheet}.SchDoc`,
        sha256,
      })),
    ],
    source: "Texas Instruments TMDS62LEVM design files SPRCAL9 Rev. B",
    url: "https://www.ti.com/lit/zip/sprcal9",
  },
]

const referencesDirectory = resolve(import.meta.dir, "..", "references")

async function downloadReference(
  reference: DirectReferenceSpec,
): Promise<void> {
  const response = await fetch(reference.url)
  if (!response.ok) {
    throw new Error(
      `${reference.url} (${response.status} ${response.statusText})`,
    )
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  verifySha256(reference.filename, bytes, reference.sha256)
  await writeReference(reference.filename, bytes)
  console.log(
    `Saved ${reference.filename} (${bytes.byteLength} bytes) from ${reference.source}`,
  )
}

async function downloadNestedBundle(
  reference: NestedZipBundleSpec,
): Promise<void> {
  const response = await fetch(reference.url)
  if (!response.ok) {
    throw new Error(
      `${reference.url} (${response.status} ${response.statusText})`,
    )
  }
  const archiveBytes = new Uint8Array(await response.arrayBuffer())
  verifySha256(
    `${reference.source} outer archive`,
    archiveBytes,
    reference.archiveSha256,
  )
  const nestedArchive = getOnlyExtractedEntry(
    unzipSync(archiveBytes, {
      filter: ({ name }) => name === reference.nestedArchivePath,
    }),
    reference.nestedArchivePath,
  )
  verifySha256(
    `${reference.source} nested archive`,
    nestedArchive,
    reference.nestedArchiveSha256,
  )

  const outputPaths = new Set(
    reference.outputs.map((output) => output.nestedFilePath),
  )
  const entries = unzipSync(nestedArchive, {
    filter: ({ name }) => outputPaths.has(name),
  })
  for (const output of reference.outputs) {
    const bytes = getOnlyExtractedEntry(entries, output.nestedFilePath)
    verifySha256(output.filename, bytes, output.sha256)
    await writeReference(output.filename, bytes)
    console.log(
      `Saved ${output.filename} (${bytes.byteLength} bytes) from ${reference.source}`,
    )
  }
}

async function writeReference(
  filename: string,
  bytes: Uint8Array,
): Promise<void> {
  const outputPath = resolve(referencesDirectory, filename)
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, bytes)
}

function getOnlyExtractedEntry(
  entries: Record<string, Uint8Array>,
  expectedPath: string,
): Uint8Array {
  const entry = entries[expectedPath]
  if (!entry) throw new Error(`ZIP archive does not contain ${expectedPath}`)
  return entry
}

function verifySha256(
  label: string,
  bytes: Uint8Array,
  expectedHash: string,
): void {
  const actualHash = createHash("sha256").update(bytes).digest("hex")
  if (actualHash !== expectedHash) {
    throw new Error(
      `${label} SHA-256 mismatch: expected ${expectedHash}, got ${actualHash}`,
    )
  }
}

await mkdir(referencesDirectory, { recursive: true })
await Promise.all([
  ...references.map(downloadReference),
  ...nestedZipBundles.map(downloadNestedBundle),
])
