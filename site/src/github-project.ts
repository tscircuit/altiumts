import type { BrowserProjectFile } from "./project-viewer-types"

const GITHUB_API_ORIGIN = "https://api.github.com"
const GITHUB_RAW_ORIGIN = "https://raw.githubusercontent.com"
const MAX_GITHUB_FILE_COUNT = 2_000
const MAX_GITHUB_PROJECT_BYTES = 768 * 1024 * 1024
const MAX_PARALLEL_DOWNLOADS = 4
const VIEWER_SOURCE_PATTERN = /\.(?:dsnwrk|outjob|pcbdoc|prjpcb|schdoc)$/iu

type Fetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

interface GitHubTreeEntry {
  path: string
  sha: string
  size?: number
  type: "blob" | "commit" | "tree"
}

interface GitHubTreeResponse {
  sha: string
  tree: GitHubTreeEntry[]
  truncated: boolean
}

interface GitHubCommitResponse {
  sha: string
}

interface GitHubRepositoryResponse {
  default_branch: string
}

export interface ParsedGitHubProjectUrl {
  owner: string
  repository: string
  route: "blob" | "repository" | "tree"
  routeSegments: string[]
}

interface ResolvedGitHubProject {
  commitSha: string
  directory: string
  entries: GitHubTreeEntry[]
  owner: string
  repository: string
}

export function parseGitHubProjectUrl(value: string): ParsedGitHubProjectUrl {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error("Enter a complete public GitHub repository or folder URL.")
  }
  if (
    url.protocol !== "https:" ||
    (url.hostname !== "github.com" && url.hostname !== "www.github.com")
  ) {
    throw new Error("Only public https://github.com URLs are supported.")
  }

  const segments = decodePathSegments(url.pathname)
  const owner = segments[0]
  const repository = segments[1]?.replace(/\.git$/iu, "")
  if (!owner || !repository) {
    throw new Error("The GitHub URL must include an owner and repository.")
  }
  const routeName = segments[2]
  if (!routeName) {
    return {
      owner,
      repository,
      route: "repository",
      routeSegments: [],
    }
  }
  if (routeName !== "tree" && routeName !== "blob") {
    throw new Error(
      "Use a GitHub repository, folder (tree), or Altium file (blob) URL.",
    )
  }
  const routeSegments = segments.slice(3)
  if (routeSegments.length === 0) {
    throw new Error("The GitHub URL is missing a branch or tag name.")
  }
  return { owner, repository, route: routeName, routeSegments }
}

export async function downloadGitHubProjectFiles(
  value: string,
  options: {
    fetcher?: Fetcher
    onProgress?: (message: string) => void
  } = {},
): Promise<BrowserProjectFile[]> {
  const parsed = parseGitHubProjectUrl(value)
  const fetcher = options.fetcher ?? fetch
  options.onProgress?.("Reading the public GitHub project tree…")
  const resolved = await resolveGitHubProject(parsed, fetcher)
  const entries = selectViewerEntries(resolved.entries, resolved.directory)

  if (entries.length === 0) {
    throw new Error(
      "No current .PrjPcb, .SchDoc, .PcbDoc, .OutJob, .DsnWrk, or project ZIP files were found at this GitHub URL.",
    )
  }
  if (entries.length > MAX_GITHUB_FILE_COUNT) {
    throw new Error(
      `This GitHub folder contains ${entries.length} Altium files, exceeding the ${MAX_GITHUB_FILE_COUNT}-file browser limit. Use a URL to a narrower project folder.`,
    )
  }
  const declaredBytes = entries.reduce(
    (total, entry) => total + (entry.size ?? 0),
    0,
  )
  if (declaredBytes > MAX_GITHUB_PROJECT_BYTES) {
    throw new Error(
      `This GitHub project is larger than ${formatMegabytes(MAX_GITHUB_PROJECT_BYTES)} and cannot be opened safely in one browser tab.`,
    )
  }

  const downloaded = new Array<BrowserProjectFile>(entries.length)
  let nextIndex = 0
  let completed = 0
  let downloadedBytes = 0
  await Promise.all(
    Array.from(
      { length: Math.min(MAX_PARALLEL_DOWNLOADS, entries.length) },
      async () => {
        while (nextIndex < entries.length) {
          const index = nextIndex++
          const entry = entries[index]
          if (!entry) continue
          options.onProgress?.(
            `Downloading ${entry.path.split("/").at(-1) ?? entry.path} from GitHub (${completed + 1}/${entries.length})…`,
          )
          const rawUrl = createRawGitHubUrl(resolved, entry.path)
          const response = await fetcher(rawUrl)
          if (!response.ok) {
            throw new Error(
              `GitHub could not download ${entry.path} (${response.status} ${response.statusText || "request failed"}).`,
            )
          }
          const bytes = await response.arrayBuffer()
          if (isGitLargeFilePointer(bytes)) {
            throw new Error(
              `${entry.path} is stored with Git LFS and GitHub returned only its pointer file. Download the project locally and choose the folder instead.`,
            )
          }
          downloadedBytes += bytes.byteLength
          if (downloadedBytes > MAX_GITHUB_PROJECT_BYTES) {
            throw new Error(
              `The downloaded project exceeded the ${formatMegabytes(MAX_GITHUB_PROJECT_BYTES)} browser limit.`,
            )
          }
          downloaded[index] = { bytes, path: entry.path }
          completed += 1
        }
      },
    ),
  )
  options.onProgress?.(
    `Downloaded ${entries.length} Altium ${entries.length === 1 ? "file" : "files"}. Parsing locally…`,
  )
  return downloaded
}

async function resolveGitHubProject(
  parsed: ParsedGitHubProjectUrl,
  fetcher: Fetcher,
): Promise<ResolvedGitHubProject> {
  if (parsed.route === "repository") {
    const repository = await requestGitHubJson<GitHubRepositoryResponse>(
      `${GITHUB_API_ORIGIN}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repository)}`,
      fetcher,
    )
    return resolveGitHubRef(parsed, repository.default_branch, "", fetcher)
  }

  for (
    let splitIndex = 1;
    splitIndex <= parsed.routeSegments.length;
    splitIndex += 1
  ) {
    const ref = parsed.routeSegments.slice(0, splitIndex).join("/")
    const selectedPath = parsed.routeSegments.slice(splitIndex).join("/")
    const treeResponse = await fetchGitHubTree(parsed, ref, fetcher)
    if (!treeResponse) continue
    if (treeResponse.truncated) {
      throw new Error(
        "GitHub truncated this repository tree. Use a URL to a narrower project folder.",
      )
    }
    const pathExists =
      selectedPath.length === 0 ||
      treeResponse.tree.some(
        ({ path }) =>
          path === selectedPath || path.startsWith(`${selectedPath}/`),
      )
    if (!pathExists) continue
    if (
      parsed.route === "blob" &&
      !treeResponse.tree.some(
        ({ path, type }) => path === selectedPath && type === "blob",
      )
    ) {
      continue
    }
    return completeResolvedProject(
      parsed,
      ref,
      parsed.route === "blob" ? selectedPath : selectedPath,
      treeResponse,
      fetcher,
    )
  }

  throw new Error(
    "GitHub could not find that public branch, folder, or file. Check the URL and repository visibility.",
  )
}

async function resolveGitHubRef(
  parsed: ParsedGitHubProjectUrl,
  ref: string,
  directory: string,
  fetcher: Fetcher,
): Promise<ResolvedGitHubProject> {
  const tree = await fetchGitHubTree(parsed, ref, fetcher)
  if (!tree) {
    throw new Error(`GitHub could not find the repository's ${ref} branch.`)
  }
  if (tree.truncated) {
    throw new Error(
      "GitHub truncated this repository tree. Use a URL to a narrower project folder.",
    )
  }
  return completeResolvedProject(parsed, ref, directory, tree, fetcher)
}

async function completeResolvedProject(
  parsed: ParsedGitHubProjectUrl,
  ref: string,
  directory: string,
  tree: GitHubTreeResponse,
  fetcher: Fetcher,
): Promise<ResolvedGitHubProject> {
  const commit = await requestGitHubJson<GitHubCommitResponse>(
    `${GITHUB_API_ORIGIN}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repository)}/commits/${encodeURIComponent(ref)}`,
    fetcher,
  )
  return {
    commitSha: commit.sha,
    directory,
    entries: tree.tree,
    owner: parsed.owner,
    repository: parsed.repository,
  }
}

async function fetchGitHubTree(
  parsed: ParsedGitHubProjectUrl,
  ref: string,
  fetcher: Fetcher,
): Promise<GitHubTreeResponse | undefined> {
  const url = `${GITHUB_API_ORIGIN}/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repository)}/git/trees/${encodeURIComponent(ref)}?recursive=1`
  const response = await fetcher(url, {
    headers: { Accept: "application/vnd.github+json" },
  })
  if (response.status === 404) return undefined
  if (!response.ok) throwGitHubResponseError(response)
  return (await response.json()) as GitHubTreeResponse
}

async function requestGitHubJson<T>(url: string, fetcher: Fetcher): Promise<T> {
  const response = await fetcher(url, {
    headers: { Accept: "application/vnd.github+json" },
  })
  if (!response.ok) throwGitHubResponseError(response)
  return (await response.json()) as T
}

function throwGitHubResponseError(response: Response): never {
  if (
    response.status === 403 &&
    response.headers.get("x-ratelimit-remaining") === "0"
  ) {
    throw new Error(
      "GitHub's public API rate limit has been reached in this browser. Try again later or download the project and choose its folder.",
    )
  }
  throw new Error(
    `GitHub returned ${response.status} ${response.statusText || "request failed"}. Confirm the repository is public and try again.`,
  )
}

function selectViewerEntries(
  entries: GitHubTreeEntry[],
  selectedPath: string,
): GitHubTreeEntry[] {
  const exactFile = entries.find(
    ({ path, type }) => path === selectedPath && type === "blob",
  )
  if (exactFile)
    return VIEWER_SOURCE_PATTERN.test(exactFile.path) ? [exactFile] : []

  const prefix = selectedPath ? `${selectedPath}/` : ""
  return entries
    .filter(({ path, type }) => {
      if (type !== "blob" || !path.startsWith(prefix)) return false
      const relativePath = path.slice(prefix.length)
      if (isGeneratedAltiumPath(relativePath)) return false
      if (VIEWER_SOURCE_PATTERN.test(relativePath)) return true
      return (
        !relativePath.includes("/") &&
        relativePath.toLowerCase().endsWith(".zip")
      )
    })
    .sort((left, right) => left.path.localeCompare(right.path))
}

function isGeneratedAltiumPath(path: string): boolean {
  return path.split("/").some((segment) => {
    const normalized = segment.toLowerCase()
    return (
      normalized === "history" ||
      normalized === "__previews" ||
      normalized.startsWith("project logs for ") ||
      normalized.startsWith("project outputs for ")
    )
  })
}

function createRawGitHubUrl(
  project: ResolvedGitHubProject,
  path: string,
): string {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/")
  return `${GITHUB_RAW_ORIGIN}/${encodeURIComponent(project.owner)}/${encodeURIComponent(project.repository)}/${project.commitSha}/${encodedPath}`
}

function decodePathSegments(pathname: string): string[] {
  try {
    return pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
  } catch {
    throw new Error("The GitHub URL contains invalid path encoding.")
  }
}

function isGitLargeFilePointer(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength > 512) return false
  return new TextDecoder()
    .decode(bytes)
    .startsWith("version https://git-lfs.github.com/spec/v1")
}

function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`
}
