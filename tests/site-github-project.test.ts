import { expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import {
  downloadGitHubProjectFiles,
  parseGitHubProjectUrl,
} from "../site/src/github-project"
import { parseBrowserProjectFiles } from "../site/src/parse-project"

const referencesDirectory = resolve(import.meta.dir, "..", "references")

test("parses public GitHub repository, folder, and file URLs", () => {
  expect(
    parseGitHubProjectUrl(
      "https://github.com/Prawinkumarjs/Altium-Projects/tree/main/Battery%20Level%20Indicator",
    ),
  ).toEqual({
    owner: "Prawinkumarjs",
    repository: "Altium-Projects",
    route: "tree",
    routeSegments: ["main", "Battery Level Indicator"],
  })
  expect(
    parseGitHubProjectUrl("https://github.com/tscircuit/altiumts"),
  ).toEqual({
    owner: "tscircuit",
    repository: "altiumts",
    route: "repository",
    routeSegments: [],
  })
  expect(() =>
    parseGitHubProjectUrl("https://gitlab.com/tscircuit/altiumts"),
  ).toThrow("Only public https://github.com URLs are supported")
})

test("downloads current Altium project files and excludes generated history", async () => {
  const [pcbBytes, schematicBytes] = await Promise.all([
    readFile(resolve(referencesDirectory, "sample-board-design.PcbDoc")),
    readFile(resolve(referencesDirectory, "sample-schematic-sheet.SchDoc")),
  ])
  const projectBytes = new TextEncoder().encode(
    [
      "[Design]",
      "ProjectName=GitHub viewer fixture",
      "[Document1]",
      "DocumentPath=Main.PcbDoc",
      "[Document2]",
      "DocumentPath=Main.SchDoc",
      "",
    ].join("\r\n"),
  )
  const rawFiles = new Map<string, Uint8Array>([
    ["Demo/Main.PcbDoc", new Uint8Array(pcbBytes)],
    ["Demo/Main.PrjPcb", projectBytes],
    ["Demo/Main.SchDoc", new Uint8Array(schematicBytes)],
  ])
  const tree = [
    ...[...rawFiles].map(([path, bytes], index) => ({
      path,
      sha: `file-${index}`,
      size: bytes.byteLength,
      type: "blob",
    })),
    {
      path: "Demo/History/Main.~(1).PcbDoc.Zip",
      sha: "history",
      size: 123,
      type: "blob",
    },
    {
      path: "Demo/Project Outputs for Demo/output.zip",
      sha: "output",
      size: 123,
      type: "blob",
    },
  ]
  const requests: string[] = []
  const fetcher = async (input: string | URL | Request): Promise<Response> => {
    const url = String(input)
    requests.push(url)
    if (url.includes("/git/trees/main?recursive=1")) {
      return Response.json({ sha: "tree-sha", tree, truncated: false })
    }
    if (url.includes("/commits/main")) {
      return Response.json({ sha: "commit-sha" })
    }
    const marker = "/commit-sha/"
    const markerIndex = url.indexOf(marker)
    if (markerIndex >= 0) {
      const path = url
        .slice(markerIndex + marker.length)
        .split("/")
        .map(decodeURIComponent)
        .join("/")
      const bytes = rawFiles.get(path)
      if (bytes) return new Response(bytes)
    }
    return new Response("Not found", { status: 404, statusText: "Not Found" })
  }
  const progress: string[] = []

  const files = await downloadGitHubProjectFiles(
    "https://github.com/example/hardware/tree/main/Demo",
    {
      fetcher,
      onProgress: (message) => progress.push(message),
    },
  )

  expect(files.map(({ path }) => path)).toEqual([
    "Demo/Main.PcbDoc",
    "Demo/Main.PrjPcb",
    "Demo/Main.SchDoc",
  ])
  expect(requests.some((url) => url.includes("History"))).toBeFalse()
  expect(requests.some((url) => url.includes("Project%20Outputs"))).toBeFalse()
  expect(progress.at(-1)).toBe("Downloaded 3 Altium files. Parsing locally…")

  const state = parseBrowserProjectFiles(files)
  expect(state.manifest.name).toBe("Main")
  expect(state.manifest.documents.map(({ kind }) => kind)).toEqual([
    "pcb",
    "schematic",
  ])
})

test("reports GitHub API rate limits with a local-folder fallback", async () => {
  const fetcher = async (): Promise<Response> =>
    new Response("rate limited", {
      headers: { "x-ratelimit-remaining": "0" },
      status: 403,
      statusText: "rate limit exceeded",
    })

  expect(
    downloadGitHubProjectFiles("https://github.com/example/hardware", {
      fetcher,
    }),
  ).rejects.toThrow("download the project and choose its folder")
})
