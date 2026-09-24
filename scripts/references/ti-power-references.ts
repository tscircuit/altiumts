export const TI_POWER_REFERENCE_PCB_FILENAMES = {
  pmp22650: "ti-pmp22650-main.PcbDoc",
  pmp22712: "ti-pmp22712.PcbDoc",
  pmp22773: "ti-pmp22773.PcbDoc",
  pmp23595: "ti-pmp23595.PcbDoc",
  pmp23653Main: "ti-pmp23653-main.PcbDoc",
  pmp23653PlanarTransformer: "ti-pmp23653-planar-transformer.PcbDoc",
} as const

export const TI_POWER_REFERENCE_ZIP_BUNDLES = [
  {
    archiveSha256:
      "73a47918b97d87275e6365ebde58fefc874f80eb2d473e28ee95a8d13b8751d5",
    nestedArchives: [],
    outputs: [
      {
        archivePath: "PMP23595.PcbDoc",
        filename: TI_POWER_REFERENCE_PCB_FILENAMES.pmp23595,
        sha256:
          "18913410812b0993e4c8c3a00a489335d0fa58d27b79ec02e1294a8a6471e0f6",
      },
    ],
    source: "Texas Instruments PMP23595 CAD/CAE files SLVMEP2A",
    url: "https://www.ti.com/lit/zip/SLVMEP2",
  },
  {
    archiveSha256:
      "f2d4383b8c3713a8e3c68bb46568227075076f55f6f36977fbbef83e7e86bf9e",
    nestedArchives: [],
    outputs: [
      {
        archivePath: "PMP23653B Main CAD/PMP23653B.PcbDoc",
        filename: TI_POWER_REFERENCE_PCB_FILENAMES.pmp23653Main,
        sha256:
          "18a785d61c6fbe381c504f416bb25fa50f16475710b9ce00f36b13b58d57c544",
      },
      {
        archivePath:
          "PMP23653-Planar-Transformer CAD/PMP23653-Planar-Transformer.PcbDoc",
        filename: TI_POWER_REFERENCE_PCB_FILENAMES.pmp23653PlanarTransformer,
        sha256:
          "e291efae1b3d42c8a90d3a01295a3a3129e6721d14163fc7c81045ffa2e29a5c",
      },
    ],
    source: "Texas Instruments PMP23653 CAD/CAE files SLVMF61",
    url: "https://www.ti.com/lit/zip/SLVMF61",
  },
  {
    archiveSha256:
      "4b3ae2e343346c36ffdc60402dcfe330ae07b7c7fd543c8bd2aee413fd1ea5d4",
    nestedArchives: [
      {
        archivePath: "PMP22650 - E2 Altium.zip",
        outputs: [
          {
            archivePath: "PMP22650 PCB.PcbDoc",
            filename: TI_POWER_REFERENCE_PCB_FILENAMES.pmp22650,
            sha256:
              "bc20338d29b9323b5af9182f91041c14b192aa363cf2d7a323441a7f28210002",
          },
        ],
        sha256:
          "b5c33aec2738246f813de7896023dd2d8ff0053c2e3e67d5782f45295bf9a01f",
      },
      {
        archivePath: "PMP22712 - E2 Altium.zip",
        outputs: [
          {
            archivePath: "PMP22712_PCB.PcbDoc",
            filename: TI_POWER_REFERENCE_PCB_FILENAMES.pmp22712,
            sha256:
              "3343b2cb765db52243ccfa584cdded44588d3ad85067e89192f09931b9a309c1",
          },
        ],
        sha256:
          "6c75258db0633e06ed5b117652534e74b53fbb5b69a81417b8068f00ad7f542d",
      },
      {
        archivePath: "PMP22773 - E3 Altium.zip",
        outputs: [
          {
            archivePath: "PMP22773 Rev E3 PCB.PcbDoc",
            filename: TI_POWER_REFERENCE_PCB_FILENAMES.pmp22773,
            sha256:
              "a84ae2b3f463084053987c1bac0ce6c51c1b38b16bf53097d769366cd0eb59f7",
          },
        ],
        sha256:
          "1c2e563678a71c32e8459506430395ddfad17ca42cbe27abc75e594f5b3d6f0c",
      },
    ],
    outputs: [],
    source: "Texas Instruments PMP22650 CAD/CAE files TIDM925",
    url: "https://www.ti.com/lit/zip/TIDM925",
  },
]
