/**
 * Garnet Runtime Review — observation-only renderer (contract v6.1).
 *
 * Vendored from the locked reference renderer in
 * garnet-org/runtime-review-testbed (`cmd/garnet-runtime-review/review.mjs`,
 * tag `v6.1.0`) — the executable form of `docs/ux-contract.md` v6.1 (v6.0 +
 * amendments A7 job-name-carries-the-Actions-run-link and A8
 * zero-counted-egress quiet line). This copy follows the repo's AGENTS.md
 * explicit-check rule throughout; every such rewrite is byte-neutral and
 * verified by the fixture byte-compare tests, so the rendered markdown stays
 * faithful to the reference.
 *
 * One deliberate delta from the reference (ENG-1355): the standalone (Action)
 * comment links the RUN-LEVEL public Run Profile — no `?job=` selector.
 * Per-job `?job=` permalinks are the control-plane GitHub App comment's job.
 * See `jobRunProfileUrl`.
 *
 * Frame: the comment answers exactly one question — "what happened on this
 * commit?". It is runtime evidence for code review, never an evaluation. No
 * statuses, no icons, no badges, no verdict vocabulary. Deterministic by
 * construction: same profile payload (and render clock) in → byte-identical
 * markdown out.
 *
 * Two surfaces, one renderer (contract §9):
 *   - PR comment (`Garnet Runtime Review`) — the cross-job conversation
 *     surface: quoted preamble, one first-class fold per job with the
 *     canonical HTML process tree, zero-egress quiet lines, gap-only footer.
 *   - Step Summary (`Garnet Runtime Summary`) — the per-run full-detail
 *     record: tabular workload / network egress / assertions report, one per
 *     raw profile. Status markers appear ONLY inside the Assertions fold.
 */

import { GITHUB_CIDRS_SNAPSHOT } from "./github-cidrs.js"

/**
 * Canonical sticky marker. `<!-- garnet-run-profile -->` is retained only
 * through the Action→App takeover window for self-identification and sunsets
 * at M1.
 */
export const RUNTIME_REVIEW_MARKER = "<!-- garnet-runtime-review -->"

/** Self-marker: identifies this renderer's own comments for update/delete. */
export const COMMENT_MARKER = "<!-- garnet-run-profile -->"

/**
 * Markers emitted by the control-plane GitHub App comment (the AUTHORITATIVE
 * "Garnet Runtime Review"). When the App has commented, this fallback defers.
 */
export const CONTROL_PLANE_MARKERS = [
  "garnet-control-plane-pr-comment:v1",
  "garnet-control-plane-pending-pr-comment:v1",
]

/** Rendering phases (pure rollout switches; the profile schema is untouched). */
export const RENDER_PHASES = {
  lineage: true,
  egress: true,
  files: false,
  assertions: false,
}

/**
 * VOCAB LOCK (contract §1.1) — the canonical vocabulary shared by every
 * Garnet interface that renders runtime telemetry (PR comment, Step Summary,
 * dashboard, public reports). Interfaces must import or mirror these strings
 * verbatim; the spec gates in the test suite are coupled to this object.
 */
export const VOCAB = {
  /** PR comment heading — standalone mode ONLY (the App-mode actor row
   * `garnet-runtime-review[bot]` carries the brand, so App comments render
   * headerless — v6.2 actor-conditional heading rule). */
  prCommentHeading: "Garnet Runtime Review",
  /** v6.2 headline — the invariant ritual phrase, byte-locked. */
  prHeadline:
    "**See what ran** — every process your jobs executed, and where they connected",
  /** Step Summary heading — the per-run record surface. */
  stepSummaryHeading: "Garnet Runtime Summary",
  /** The one artifact name, everywhere. */
  artifact: "Run Profile",
  /** The ONLY label for a garnet permalink — one per job/run. */
  permalinkLabel: "View Run Profile in Garnet ↗",
}

/** Hard size ceiling for the PR comment body (§1.8). GitHub caps at 65,536. */
export const SIZE_BUDGET = 60_000

/** Network tools whose presence in a lineage tail is structurally salient. */
const NETWORK_TOOLS = [/^curl\b/, /^wget\b/, /^sh -c\b/]

/** How many trailing ancestry entries count as the "lineage tail". */
const TAIL_DEPTH = 3

/**
 * The exact known GitHub-hosted runner ancestry set (§1.6). Membership is
 * exact-match after A5 normalization (`provjobd128…` ≡ `provjobd*`).
 */
export const RUNNER_CHAIN = new Set([
  "systemd",
  "hosted-compute-agent",
  "Runner.Listener",
  "Runner.Worker",
  "sudo",
  "provjobd*",
])

/**
 * The loopback resolver stub, anchored — `localhost.attacker.com` never
 * matches (dns classification + evidence exclusion, §3).
 */
const LOOPBACK_RE = /^(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|::1)$/

/** GitHub-published destination names (github infra classification, §3). */
const GITHUB_OWNED_RE =
  /(^|\.)github\.com$|(^|\.)githubusercontent\.com$|(^|\.)githubapp\.com$|(^|\.)actions\.githubusercontent\.com$/

/**
 * Vendored, PINNED snapshot of GitHub's published IP ranges
 * (api.github.com/meta) — no runtime fetch, so classification stays
 * deterministic; updating the snapshot is a deliberate, reviewed change.
 */
const GITHUB_CIDRS = GITHUB_CIDRS_SNAPSHOT.cidrs

/**
 * Parse an IPv4 literal into a 32-bit integer, or null.
 * @param {unknown} value
 * @returns {number | null}
 */
function ipv4ToInt(value) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(value))
  if (m === null) return null
  let n = 0
  for (let i = 1; i <= 4; i += 1) {
    const octet = Number(m[i])
    if (octet > 255) return null
    n = n * 256 + octet
  }
  return n
}

/** @type {{ base: number, mask: number }[]} */
const GITHUB_CIDR_V4 = []
/** @type {{ base: string, bits: number }[]} */
const GITHUB_CIDR_V6_PREFIXES = []
for (const list of Object.values(GITHUB_CIDRS)) {
  for (const cidr of list) {
    const [base, bitsRaw] = String(cidr).split("/")
    const bits = Number(bitsRaw)
    const v4 = ipv4ToInt(base)
    if (v4 !== null && bits >= 0 && bits <= 32) {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
      GITHUB_CIDR_V4.push({ base: (v4 & mask) >>> 0, mask })
    } else if (base !== undefined && base !== "" && base.includes(":")) {
      GITHUB_CIDR_V6_PREFIXES.push({ base: base.toLowerCase(), bits })
    }
  }
}

/**
 * Expand an IPv6 literal into 8 hextets (handles `::`), or null.
 * @param {unknown} value
 * @returns {number[] | null}
 */
function ipv6ToHextets(value) {
  const v = String(value).toLowerCase()
  if (!v.includes(":") || v.includes(".")) return null
  const halves = v.split("::")
  if (halves.length > 2) return null
  const head = halves[0] !== undefined && halves[0] !== "" ? halves[0].split(":") : []
  const tail = halves.length === 2 && halves[1] !== undefined && halves[1] !== "" ? halves[1].split(":") : []
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0
  if (halves.length === 1 && head.length !== 8) return null
  if (fill < 0) return null
  const parts = [...head, ...Array(fill).fill("0"), ...tail]
  if (parts.length !== 8) return null
  /** @type {number[]} */
  const hextets = []
  for (const part of parts) {
    if (!/^[0-9a-f]{1,4}$/.test(part)) return null
    hextets.push(parseInt(part, 16))
  }
  return hextets
}

/**
 * Is this IP literal inside GitHub's published ranges (vendored snapshot)?
 * @param {unknown} ip
 * @returns {boolean}
 */
export function isGithubOwnedIp(ip) {
  const v4 = ipv4ToInt(ip)
  if (v4 !== null) {
    return GITHUB_CIDR_V4.some(({ base, mask }) => ((v4 & mask) >>> 0) === base)
  }
  const hextets = ipv6ToHextets(ip)
  if (hextets === null) return false
  return GITHUB_CIDR_V6_PREFIXES.some(({ base, bits }) => {
    const baseHex = ipv6ToHextets(base)
    if (baseHex === null) return false
    let remaining = bits
    for (let i = 0; i < 8 && remaining > 0; i += 1) {
      const take = Math.min(16, remaining)
      const mask = take === 16 ? 0xffff : (0xffff << (16 - take)) & 0xffff
      if (((hextets[i] ?? 0) & mask) !== ((baseHex[i] ?? 0) & mask)) return false
      remaining -= take
    }
    return true
  })
}

/**
 * @typedef {{ ancestry: string[], domain: string, ip: string }} RawConnection
 */

/**
 * @typedef {RawConnection & { count: number, class: string }} ReviewConnection
 */

/**
 * @typedef {{ domains: number | null, connections: number | null }} JobTelemetry
 */

/**
 * @typedef {{
 *   name: string
 *   workflow: string
 *   sha: string
 *   run_id: string
 *   run_number: string
 *   run_url: string
 *   telemetry: JobTelemetry
 *   connections: RawConnection[]
 * }} JobRecord
 */

/**
 * @typedef {{
 *   id: number
 *   name: string
 *   workflow: string
 *   run_id: string
 *   run_number: string
 *   run_url: string
 *   telemetry: JobTelemetry
 *   connections: ReviewConnection[]
 * }} ReviewJob
 */

/**
 * @typedef {{
 *   rule: string
 *   jobRungs: Map<number, number>
 *   salientJobs: number[]
 *   salientKey: string
 *   headline: string
 * }} Salience
 */

/**
 * @typedef {{
 *   repo: string
 *   sha: string
 *   permalink: string
 *   appUrl: string
 *   docsUrl: string
 *   renderedAt: Date | null
 *   commitUrl: string
 *   firstRun: boolean
 *   appMode: boolean
 *   jobs: ReviewJob[]
 *   notableJobs: Set<number>
 *   uniqueDests: Set<string>
 *   lineageAbsent: boolean
 *   salience: Salience
 *   counts: {
 *     jobs: number
 *     expectedJobs: number
 *     workflows: number
 *     domains: number
 *     connections: number
 *   }
 * }} RunReview
 */

/**
 * @typedef {{
 *   children: Map<string, TreeNode>
 *   leaves: ReviewConnection[]
 *   onPath?: boolean
 * }} TreeNode
 */

/**
 * Strip control characters from any evidence string (§9).
 * @param {unknown} value
 * @returns {string}
 */
const stripControl = value => String(value ?? "").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")

/** @param {unknown} value @returns {value is string} */
const isNonEmptyString = value => typeof value === "string" && value !== ""

/** @param {...unknown} values @returns {string} */
const firstNonEmptyString = (...values) => {
  for (const value of values) {
    if (isNonEmptyString(value)) return value
  }
  return ""
}

/**
 * Escape a value destined for INSIDE a `code span`: a stray backtick would
 * break out of the span, so neutralize it (and collapse newlines).
 * @param {unknown} value
 * @returns {string}
 */
export const escapeCode = value =>
  stripControl(value)
    .replace(/`/g, "ʼ")
    .replace(/[\r\n]+/g, " ")
    .trim()

/**
 * Escape a value destined for INSIDE an HTML element (§9). Three-plus
 * backtick runs are neutralized so hostile names can never open a fence
 * even if the surrounding HTML block is interrupted.
 * @param {unknown} value
 * @returns {string}
 */
const escapeHtml = value =>
  stripControl(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/`{3,}/g, m => "ʼ".repeat(m.length))
    .replace(/[\r\n]+/g, " ")
    .trim()

/**
 * Escape a value destined for INSIDE an HTML attribute (§9).
 * @param {unknown} value
 * @returns {string}
 */
const escapeHtmlAttr = value =>
  stripControl(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/[\r\n]+/g, " ")
    .trim()

/**
 * Sanitize a value rendered inside a four-backtick ````text fence (§9): no
 * three-plus backtick runs, one line, control characters stripped.
 * @param {unknown} value
 * @returns {string}
 */
const fenceSafe = value =>
  stripControl(value)
    .replace(/`{3,}/g, m => "ʼ".repeat(m.length))
    .replace(/[\r\n]+/g, " ")
    .trim()

/**
 * A5 — identifier normalization: trailing-digit suffixes are ephemeral
 * (e.g. `provjobd128037216` ≡ `provjobd*`). Signatures compare normalized
 * names; display always shows the raw recorded name.
 * @param {string} name
 * @returns {string}
 */
export const normalizeIdentifier = name => String(name ?? "").replace(/\d+$/, "*")

/**
 * Is this process name a member of the GitHub runner chain (§1.6)?
 * @param {string} name
 * @returns {boolean}
 */
const isRunnerChainProcess = name => RUNNER_CHAIN.has(normalizeIdentifier(String(name)))

/**
 * §3 — structural classification. Exactly one class per connection, typed on
 * identity and provenance, never acceptability:
 *   `dns`           — resolver stub (systemd-resolved loopback), anchored.
 *   `garnet upload` — the sensor's own upload path.
 *   `github infra`  — ownership AND provenance, both required: a
 *                     GitHub-published destination (name, or — for domainless
 *                     records — an IP in the vendored CIDR snapshot) reached
 *                     from the runner chain.
 *   ""              — unclassified (everything else — including GitHub-owned
 *                     destinations reached from user code, which stay
 *                     enumerable evidence).
 * @param {{ ancestry: string[], domain: string, ip: string }} c
 * @returns {string}
 */
export function classifyConnection(c) {
  const domain = String(firstNonEmptyString(c.domain))
  const ip = String(firstNonEmptyString(c.ip))
  if (LOOPBACK_RE.test(domain) || LOOPBACK_RE.test(ip)) return "dns"
  if (/^(?:[a-z0-9-]+-)?api\.garnet\.ai$/.test(domain)) return "garnet upload"
  const ancestry = (c.ancestry ?? []).filter(isNonEmptyString)
  // Ownership AND provenance, both required: a runner-chain-named process
  // reaching a domainless destination stays unclassified (provenance alone is
  // spoofable — a process named `Runner.Worker` must not earn de-emphasis).
  const fromRunnerChain = ancestry.length > 0 && ancestry.every(isRunnerChainProcess)
  if (fromRunnerChain && GITHUB_OWNED_RE.test(domain)) return "github infra"
  // A domainless destination whose address sits inside GitHub's published
  // ranges (vendored snapshot of api.github.com/meta) is the same closed-set
  // fact: ownership (published range) + provenance (runner chain), both
  // required — the same IP reached from user code stays unclassified.
  if (fromRunnerChain && domain === "" && ip !== "" && isGithubOwnedIp(ip)) return "github infra"
  return ""
}

/**
 * True for IPv4/IPv6 literals — used to tell resolved addresses from domains.
 * @param {string} value
 * @returns {boolean}
 */
export function isAddressLike(value) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value) || value.includes(":")
}

/**
 * Collapse one raw Jibril profile into a job record.
 * @param {unknown} profile
 * @returns {JobRecord | null}
 */
export function summarizeProfile(profile) {
  if (profile === null || profile === undefined || typeof profile !== "object") return null
  const p = /** @type {Record<string, any>} */ (profile)
  const github = p?.scenarios?.github ?? p?.github ?? {}

  const egressPeers = Array.isArray(p?.network?.egress?.peers) ? p.network.egress.peers : []
  // The sensor's own recorded egress telemetry (the canonical counts shown in
  // the Step Summary); the summarized `connections` below dedupe per lineage,
  // so these totals are the true recorded figures for the per-job line.
  const egressTelemetry = p?.telemetry?.network?.egress ?? {}
  /** @type {RawConnection[]} */
  const connections = []
  for (const peer of egressPeers) {
    // A recorded remote_names entry can be the peer's bare address (the
    // sensor records what it saw, named or not) — an address-like "name" is
    // NOT a domain, or the heading noun rule would say `domains` over a tree
    // of IPs. The connection's domain is the first NAMED identity, if any.
    const names = /** @type {unknown[]} */ (peer?.remote_names ?? peer?.RemoteNames ?? []).filter(isNonEmptyString)
    const domain = names.find(n => !isAddressLike(String(n))) ?? ""
    const ip = String(firstNonEmptyString(peer?.remote_address, peer?.RemoteAddress))
    const trees = /** @type {any[]} */ (peer?.proc_trees ?? peer?.ProcTrees ?? [])
    const ancestries =
      trees.length > 0
        ? trees.map(t => /** @type {unknown[]} */ (t?.ancestry ?? t?.Ancestry ?? []).filter(isNonEmptyString))
        : [[]]
    for (const ancestry of ancestries) {
      connections.push({ ancestry: ancestry.map(String), domain: String(domain), ip })
    }
  }

  return {
    name: firstNonEmptyString(github.job),
    workflow: firstNonEmptyString(github.workflow),
    sha: firstNonEmptyString(github.sha),
    run_id: firstNonEmptyString(github.run_id),
    run_number: firstNonEmptyString(github.run_number),
    run_url:
      isNonEmptyString(github.run_id) && isNonEmptyString(github.repository)
        ? `${isNonEmptyString(github.server_url) ? github.server_url : "https://github.com"}/${github.repository}/actions/runs/${github.run_id}`
        : "",
    telemetry: {
      domains: typeof egressTelemetry.total_domains === "number" ? egressTelemetry.total_domains : null,
      connections: typeof egressTelemetry.total_connections === "number" ? egressTelemetry.total_connections : null,
    },
    connections,
  }
}

/**
 * §1.1 — the Run Profile permalink: an explicit permalink wins; otherwise
 * derive the Garnet app PUBLIC report URL from the profile's own run_id
 * (`/public/runs/…` — the tokenless route; `/dashboard/runs/…` is authed and
 * would wall cold PR traffic behind a login). Never a github.com/actions URL.
 * @param {string} explicit
 * @param {{ run_id?: string }[]} jobRecords
 * @param {string} appUrl
 * @returns {string}
 */
export function derivePermalink(explicit, jobRecords, appUrl) {
  if (explicit !== "") return explicit
  const runId = (jobRecords ?? []).map(j => j?.run_id).find(isNonEmptyString)
  if (runId === undefined || runId === "" || appUrl === "") return ""
  return `${appUrl}/public/runs/${encodeURIComponent(String(runId))}?utm_source=github&utm_medium=pr_comment`
}

/**
 * Stable key for deduplicating one (lineage, destination) behavior.
 * @param {{ ancestry: string[], domain: string, ip: string }} c
 * @returns {string}
 */
const connectionKey = c => `${(c.ancestry ?? []).join("\u0000")}\u0001${c.domain}\u0001${c.ip}`

/**
 * A5 — behavior signature for R0 comparison across pushes: normalized
 * ancestry + destination.
 * @param {{ ancestry?: string[], domain?: string, ip?: string }} c
 * @returns {string}
 */
export const behaviorSignature = c =>
  `${(c.ancestry ?? []).map(normalizeIdentifier).join("\u0000")}\u0001${firstNonEmptyString(c.domain, c.ip)}`

/**
 * A destination's display identity (domain when named, else address).
 * @param {{ domain: string, ip: string }} c
 * @returns {string}
 */
const destName = c => firstNonEmptyString(c.domain, c.ip)

/**
 * Display label for a destination (the `dns` class replaces the stub name in
 * salience contexts only — the canonical tree keeps the recorded name).
 * @param {ReviewConnection} c
 * @returns {string}
 */
const destLabel = c => (c.class === "dns" ? "dns" : destName(c))

/**
 * §1.6/§3 — human descriptor per connection class. Classified leaves keep
 * their recorded name and gain a self-describing parenthetical descriptor
 * (`localhost (dns resolver)`, never a bare `dns`).
 * @type {Record<string, string>}
 */
const CLASS_DESCRIPTORS = {
  dns: "dns resolver",
  "garnet upload": "garnet sensor upload",
  "github infra": "github infra",
}

/**
 * @param {string[]} ancestry
 * @returns {boolean}
 */
const tailHasNetworkTool = ancestry =>
  ancestry.slice(-TAIL_DEPTH).some(step => NETWORK_TOOLS.some(re => re.test(String(step))))

/**
 * A3 — the total selection order (salience order): within-run uniqueness →
 * spawn-chain depth → connection count → lexical. Returns a comparator;
 * smaller sorts first (more salient).
 * @param {Set<string>} uniqueDests
 * @returns {(a: ReviewConnection, b: ReviewConnection) => number}
 */
function salienceComparator(uniqueDests) {
  return (a, b) => {
    const uniqA = uniqueDests.has(destName(a)) ? 0 : 1
    const uniqB = uniqueDests.has(destName(b)) ? 0 : 1
    if (uniqA !== uniqB) return uniqA - uniqB
    const depthA = (a.ancestry || []).length
    const depthB = (b.ancestry || []).length
    if (depthA !== depthB) return depthB - depthA
    if (a.count !== b.count) return b.count - a.count
    return destName(a) < destName(b) ? -1 : destName(a) > destName(b) ? 1 : 0
  }
}

/**
 * Build the review object from job records.
 * @param {{
 *   repo?: string
 *   sha?: string
 *   commitUrl?: string
 *   permalink?: string
 *   appUrl?: string
 *   docsUrl?: string
 *   expectedJobs?: number
 *   firstRun?: boolean
 *   appMode?: boolean
 *   renderedAt?: string | Date
 *   jobs: Partial<JobRecord>[]
 * }} input
 * @returns {RunReview}
 */
export function buildRunReview(input) {
  /** @type {ReviewJob[]} */
  let jobs = (input.jobs ?? [])
    .filter(job => job !== undefined && job !== null)
    .map((j, i) => ({
      id: i,
      name: firstNonEmptyString(j.name, `job-${i + 1}`),
      workflow: firstNonEmptyString(j.workflow),
      run_id: firstNonEmptyString(j.run_id),
      run_number: firstNonEmptyString(j.run_number),
      run_url: firstNonEmptyString(j.run_url),
      telemetry: j.telemetry ?? { domains: null, connections: null },
      connections: dedupeConnections(j.connections ?? []),
    }))

  const workflows = [...new Set(jobs.map(j => j.workflow).filter(isNonEmptyString))]
  const domains = [...new Set(jobs.flatMap(j => j.connections.map(destName)).filter(isNonEmptyString))]
  const totalConnections = jobs.reduce((n, j) => n + j.connections.reduce((m, c) => m + c.count, 0), 0)

  // Within-run uniqueness (A3's first key): destinations reached by exactly
  // one job. Only meaningful as a SALIENCE key when more than one job is
  // recorded — the notable rule below handles the single-job case itself.
  /** @type {Set<string>} */
  const uniqueDests = new Set()
  if (jobs.length > 1) {
    /** @type {Map<string, Set<number>>} */
    const destJobs = new Map()
    for (const job of jobs) {
      for (const c of job.connections) {
        const d = destName(c)
        if (d === "") continue
        const owners = destJobs.get(d) ?? new Set()
        owners.add(job.id)
        destJobs.set(d, owners)
      }
    }
    for (const [d, owners] of destJobs) if (owners.size === 1) uniqueDests.add(d)
  }

  // S7 — lineage-absent degradation: trees and spawn rungs disabled.
  const lineageAbsent = jobs.every(j => j.connections.every(c => c.ancestry.length === 0))

  const salience = computeSalience(jobs, {
    domains,
    totalConnections,
    uniqueDests,
    lineageAbsent,
  })

  // Presentation order is deterministic and reproducible by hand (§4):
  // notable jobs first — a job is notable when it reached a destination no
  // other job in this commit reached (a set fact, not a ranking) — then
  // workflow, then name, then id (total order).
  // When exactly one job is recorded, "a destination no other job reached"
  // is vacuously true for every destination it reached — the same set fact
  // — so a lone recorded job with unclassified egress is notable and its
  // fold opens instead of burying the comment's only evidence.
  /** @param {ReviewJob} job */
  const isNotable = job =>
    job.connections.some(c => c.class === "" && (jobs.length === 1 || uniqueDests.has(destName(c))))
  jobs = [...jobs].sort(
    (a, b) =>
      (isNotable(a) ? 0 : 1) - (isNotable(b) ? 0 : 1) ||
      String(a.workflow).localeCompare(String(b.workflow)) ||
      String(a.name).localeCompare(String(b.name)) ||
      String(a.id).localeCompare(String(b.id)),
  )
  const notableJobs = new Set(jobs.filter(isNotable).map(j => j.id))

  const recorded = jobs.length
  const expected = Math.max(input.expectedJobs ?? 0, recorded)

  return {
    repo: firstNonEmptyString(input.repo),
    sha: String(input.sha ?? ""),
    permalink: firstNonEmptyString(input.permalink),
    appUrl: firstNonEmptyString(input.appUrl),
    docsUrl: firstNonEmptyString(input.docsUrl),
    renderedAt: input.renderedAt !== undefined && input.renderedAt !== null && input.renderedAt !== "" ? new Date(input.renderedAt) : null,
    commitUrl: firstNonEmptyString(input.commitUrl),
    firstRun: input.firstRun === true,
    // v6.2 actor-conditional heading: App mode (garnet-runtime-review[bot])
    // renders headerless — the actor row is the brand; standalone
    // (github-actions[bot]) keeps the h3 title.
    appMode: input.appMode === true,
    jobs,
    notableJobs,
    uniqueDests,
    lineageAbsent,
    salience,
    counts: {
      jobs: recorded,
      expectedJobs: expected,
      workflows: workflows.length,
      domains: domains.length,
      connections: totalConnections,
    },
  }
}

/**
 * Merge duplicate (lineage, destination) pairs into one classified entry.
 * @param {RawConnection[]} connections
 * @returns {ReviewConnection[]}
 */
function dedupeConnections(connections) {
  /** @type {Map<string, ReviewConnection>} */
  const byKey = new Map()
  for (const raw of connections) {
    const c = {
      ancestry: (raw.ancestry ?? []).map(s => String(s)),
      domain: String(firstNonEmptyString(raw.domain)),
      ip: String(firstNonEmptyString(raw.ip)),
    }
    const key = connectionKey(c)
    const seen = byKey.get(key)
    if (seen !== undefined) seen.count += 1
    else byKey.set(key, { ...c, count: 1, class: classifyConnection(c) })
  }
  return [...byKey.values()]
}

/**
 * The structural-salience headline. Rungs (top wins): uniqueness → spawn →
 * counts. A2: classified connections never headline. The headline never
 * renders in the comment (v6.0) — it remains the spec'd ordering input.
 * @param {ReviewJob[]} jobs
 * @param {{
 *   domains: string[]
 *   totalConnections: number
 *   uniqueDests: Set<string>
 *   lineageAbsent: boolean
 * }} totals
 * @returns {Salience}
 */
function computeSalience(jobs, totals) {
  const cmp = salienceComparator(totals.uniqueDests)
  /** @type {Map<number, number>} */
  const jobRungs = new Map()
  /** @type {{ job: ReviewJob, c: ReviewConnection }[]} */
  const candidates = []
  for (const job of jobs) {
    for (const c of job.connections) {
      if (c.class !== "") continue // A2 — classified connections are excluded from candidacy
      candidates.push({ job, c })
    }
  }
  candidates.sort((a, b) => cmp(a.c, b.c))

  for (const job of jobs) {
    const unclassified = job.connections.filter(c => c.class === "")
    const hasUnique = unclassified.some(c => totals.uniqueDests.has(destName(c)))
    const hasSpawn = !totals.lineageAbsent && unclassified.some(c => tailHasNetworkTool(c.ancestry))
    jobRungs.set(job.id, hasUnique ? 1 : hasSpawn ? 2 : 3)
  }

  if (totals.uniqueDests.size > 0) {
    const pick = candidates.find(({ c }) => totals.uniqueDests.has(destName(c)))
    if (pick !== undefined) {
      return {
        rule: "R1",
        jobRungs,
        salientJobs: [pick.job.id],
        salientKey: connectionKey(pick.c),
        headline: totals.lineageAbsent
          ? `In \`${escapeCode(pick.job.name)}\`, \`${escapeCode(destName(pick.c))}\` was reached — a destination no other job in this run reached.`
          : describeConnection(pick.job, pick.c, "a destination no other job in this run reached"),
      }
    }
  }

  if (!totals.lineageAbsent) {
    const pick = candidates.find(({ c }) => tailHasNetworkTool(c.ancestry))
    if (pick !== undefined) {
      return {
        rule: "R2",
        jobRungs,
        salientJobs: [pick.job.id],
        salientKey: connectionKey(pick.c),
        headline: describeConnection(pick.job, pick.c, ""),
      }
    }
  }

  // S4 / S7 — the pure inventory sentence: when no structure stands out, the
  // totals are the fact.
  let headline
  const firstJob = jobs[0]
  if (totals.domains.length === 0) {
    const jobWord = jobs.length === 1 ? "job" : "jobs"
    headline = `${jobs.length} ${jobWord} ran; none made outbound connections.`
  } else if (jobs.length === 1 && firstJob !== undefined) {
    const processes = new Set(firstJob.connections.flatMap(c => c.ancestry)).size
    const procPart = processes > 0 ? `${processes} process${processes === 1 ? "" : "es"}` : "processes"
    headline = `In \`${escapeCode(firstJob.name)}\`, ${procPart} reached ${totals.domains.length} domain${totals.domains.length === 1 ? "" : "s"} over ${totals.totalConnections} connection${totals.totalConnections === 1 ? "" : "s"}.`
  } else {
    headline = `${jobs.length} jobs reached ${totals.domains.length} domain${totals.domains.length === 1 ? "" : "s"} over ${totals.totalConnections} connection${totals.totalConnections === 1 ? "" : "s"}.`
  }
  return { rule: "R3", jobRungs, salientJobs: [], salientKey: "", headline }
}

/**
 * One natural-language sentence describing a single connection's lineage:
 * "In `e2e`, `npm install` spawned `sh -c → curl`, which reached `dest`."
 * @param {ReviewJob} job
 * @param {ReviewConnection} c
 * @param {string} suffix
 * @returns {string}
 */
function describeConnection(job, c, suffix) {
  const ancestry = c.ancestry.filter(isNonEmptyString)
  const dest = destLabel(c)
  const tail = ancestry.slice(-TAIL_DEPTH)
  const toolIdx = tail.findIndex(step => NETWORK_TOOLS.some(re => re.test(String(step))))
  let action
  const chainStart = ancestry.length - tail.length + toolIdx
  if (toolIdx !== -1 && chainStart > 0) {
    const parent = ancestry[chainStart - 1]
    const chain = ancestry.slice(chainStart).map(escapeCode).join(" → ")
    action = `\`${escapeCode(parent)}\` spawned \`${chain}\`, which reached \`${escapeCode(dest)}\``
  } else {
    const last = ancestry[ancestry.length - 1]
    const proc = isNonEmptyString(last) ? last : "a process"
    action = `\`${escapeCode(proc)}\` reached \`${escapeCode(dest)}\``
  }
  const tailPart = suffix !== "" ? ` — ${suffix}` : ""
  return `In \`${escapeCode(job.name)}\`, ${action}${tailPart}.`
}

/**
 * §1.6 — split a job's connections into the elidable runner-chain set and
 * the visible set. Elision applies only to non-canonical surfaces; the
 * comment always renders the full tree (`elide: false`).
 * @param {{ connections: ReviewConnection[] }} job
 * @returns {{
 *   elided: ReviewConnection[]
 *   visible: ReviewConnection[]
 *   elidedProcs: Set<string>
 *   elidedConnections: number
 * }}
 */
function splitRunnerChain(job) {
  /** @type {ReviewConnection[]} */
  const elided = []
  /** @type {ReviewConnection[]} */
  const visible = []
  for (const c of job.connections) {
    const ancestry = c.ancestry.filter(isNonEmptyString)
    const allMembers = ancestry.length > 0 && ancestry.every(isRunnerChainProcess)
    if (allMembers && (c.class === "github infra" || c.class === "dns")) elided.push(c)
    else visible.push(c)
  }
  const elidedProcs = new Set(elided.flatMap(c => c.ancestry))
  const elidedConnections = elided.reduce((n, c) => n + c.count, 0)
  return { elided, visible, elidedProcs, elidedConnections }
}

/**
 * Strip the leading run of runner-chain members from a visible connection's
 * ancestry (they are represented by the elision line); membership stops at
 * the first non-member.
 * @param {string[]} ancestry
 * @returns {{ prefix: string[], rest: string[] }}
 */
function stripRunnerPrefix(ancestry) {
  let i = 0
  while (i < ancestry.length && isRunnerChainProcess(ancestry[i] ?? "")) i += 1
  // Cancellation: a member-only lineage that survived splitRunnerChain
  // reached a non-GitHub-owned destination — render that branch in full.
  if (i === ancestry.length && ancestry.length > 0) return { prefix: [], rest: ancestry }
  return { prefix: ancestry.slice(0, i), rest: ancestry.slice(i) }
}

/**
 * Shared-prefix-merge a job's connections into one lineage tree rooted at
 * the job (§1.6). html=true emits the canonical `<pre>`-ready tree: job root
 * annotated plain italic, workload processes bold, runner scaffolding
 * italic, destinations plain — no IP suffixes; classified leaves carry their
 * self-describing italic descriptor.
 * @param {{ name: string, connections: ReviewConnection[] }} job
 * @param {{ elide?: boolean, focus?: string, html?: boolean }} [opts]
 * @returns {string}
 */
export function renderJobTree(job, opts = {}) {
  const elide = opts.elide !== false
  const focus = firstNonEmptyString(opts.focus)
  const html = opts.html === true
  // HTML (canonical) mode: the root is the JOB, not a process — annotate it
  // so it cannot be read as a parent process.
  const lines = [html ? `<i>${escapeHtml(job.name)} · job</i>` : fenceSafe(job.name)]

  const { visible, elidedProcs, elidedConnections } = elide
    ? splitRunnerChain(job)
    : { visible: job.connections, elidedProcs: new Set(), elidedConnections: 0 }

  /** @type {TreeNode} */
  const root = { children: new Map(), leaves: [] }
  /** @type {Set<string>} */
  const prefixProcs = new Set()
  for (const c of visible) {
    const ancestry = c.ancestry.filter(isNonEmptyString)
    const { prefix, rest } = elide ? stripRunnerPrefix(ancestry) : { prefix: [], rest: ancestry }
    for (const p of prefix) prefixProcs.add(p)
    const focused = focus !== "" && connectionKey(c) === focus
    let node = root
    if (focused) root.onPath = true
    for (const step of rest) {
      const key = String(step)
      const child = node.children.get(key) ?? { children: new Map(), leaves: [] }
      node.children.set(key, child)
      node = child
      if (focused) node.onPath = true
    }
    node.leaves.push(c)
  }

  const runnerProcs = new Set([...elidedProcs, ...prefixProcs])
  if (elide && runnerProcs.size > 0) {
    const connPart =
      elidedConnections > 0
        ? ` · ${elidedConnections} connection${elidedConnections === 1 ? "" : "s"} → GitHub-owned addresses`
        : ""
    lines.push(`└─ GitHub runner ┄ ${runnerProcs.size} process${runnerProcs.size === 1 ? "" : "es"}${connPart}`)
    renderNodeChildren(root, "   ", lines, focus !== "" && root.onPath === true, html)
  } else {
    renderNodeChildren(root, "", lines, focus !== "" && root.onPath === true, html)
  }
  return lines.join("\n")
}

/**
 * Distinct destinations and total connections in a subtree.
 * @param {TreeNode} node
 * @param {Set<string>} [dests]
 * @param {{ connections: number }} [totals]
 * @returns {{ dests: number, connections: number }}
 */
function subtreeCounts(node, dests = new Set(), totals = { connections: 0 }) {
  for (const leaf of node.leaves) {
    dests.add(destLabel(leaf))
    totals.connections += leaf.count
  }
  for (const child of node.children.values()) subtreeCounts(child, dests, totals)
  return { dests: dests.size, connections: totals.connections }
}

/**
 * @typedef {{ name: string, ips: string[], count: number, class: string }} LeafGroup
 */

/**
 * Deterministic same-destination grouping (§1.6): sibling leaves that reach
 * the same destination label merge into ONE line — first-seen order,
 * first-seen address shown (non-HTML mode), the rest fold to `+N addresses`,
 * `×N` keeps the true connection count. No data is dropped: counts and the
 * address set stay exact; only repetition collapses.
 * @param {ReviewConnection[]} leaves
 * @returns {LeafGroup[]}
 */
function groupLeaves(leaves) {
  /** @type {Map<string, LeafGroup>} */
  const groups = new Map()
  for (const leaf of leaves) {
    const name = destName(leaf)
    let group = groups.get(name)
    if (group === undefined) {
      group = { name, ips: [], count: 0, class: leaf.class }
      groups.set(name, group)
    }
    if (leaf.ip !== "" && !group.ips.includes(leaf.ip)) group.ips.push(leaf.ip)
    group.count += leaf.count
  }
  return [...groups.values()]
}

/**
 * @param {TreeNode} node
 * @param {string} prefix
 * @param {string[]} lines
 * @param {boolean} [focusMode]
 * @param {boolean} [html]
 * @returns {void}
 */
function renderNodeChildren(node, prefix, lines, focusMode = false, html = false) {
  let procs = [...node.children.entries()].map(([name, child]) => ({ name, child }))
  let collapsedNote = ""
  if (focusMode) {
    const offPath = procs.filter(p => p.child.onPath !== true)
    if (offPath.length > 0) {
      /** @type {Set<string>} */
      const dests = new Set()
      const totals = { connections: 0 }
      for (const p of offPath) subtreeCounts(p.child, dests, totals)
      collapsedNote = `┄ ${dests.size} more destination${dests.size === 1 ? "" : "s"} · ${totals.connections} connection${totals.connections === 1 ? "" : "s"}`
      procs = procs.filter(p => p.child.onPath === true)
    }
  }
  /** @type {(
   *   { kind: "proc", name: string, child: TreeNode } |
   *   { kind: "leaf", group: LeafGroup } |
   *   { kind: "note", note: string }
   * )[]} */
  const entries = [
    ...procs.map(p => /** @type {{ kind: "proc", name: string, child: TreeNode }} */ ({ kind: "proc", ...p })),
    ...groupLeaves(node.leaves).map(group => /** @type {{ kind: "leaf", group: LeafGroup }} */ ({ kind: "leaf", group })),
    ...(collapsedNote !== "" ? [/** @type {{ kind: "note", note: string }} */ ({ kind: "note", note: collapsedNote })] : []),
  ]
  entries.forEach((entry, i) => {
    const last = i === entries.length - 1
    const branch = last ? "└─ " : "├─ "
    const childPrefix = prefix + (last ? "   " : "│  ")
    if (entry.kind === "proc") {
      // Workload processes render bold in canonical HTML mode; runner
      // scaffolding (the exact known runner-chain set) renders italic so the
      // job's own processes carry the visual weight; destinations stay
      // plain. Italic vs bold is PURE typographic de-emphasis — it never
      // changes counts, ordering, or notability (§1.6).
      const procTag = isRunnerChainProcess(entry.name) ? "i" : "b"
      lines.push(
        `${prefix}${branch}${html ? `<${procTag}>${escapeHtml(entry.name)}</${procTag}>` : fenceSafe(entry.name)}`,
      )
      renderNodeChildren(entry.child, childPrefix, lines, focusMode && entry.child.onPath === true, html)
    } else if (entry.kind === "note") {
      lines.push(`${prefix}${branch}${entry.note}`)
    } else {
      const { group } = entry
      const times = group.count > 1 ? ` ×${group.count}` : ""
      const descriptor = CLASS_DESCRIPTORS[group.class] ?? ""
      if (html) {
        // Canonical truth: the recorded destination name (domain when named,
        // else its address) — no IP suffix, no substitutions. A classified
        // leaf carries its self-describing descriptor in italics.
        const label = group.name !== "" ? escapeHtml(group.name) : group.class === "dns" ? "localhost" : "(unnamed peer)"
        lines.push(`${prefix}${branch}→ ${label}${descriptor !== "" ? ` <i>(${descriptor})</i>` : ""}${times}`)
        return
      }
      const shownIps = group.name === group.ips[0] ? group.ips.slice(1) : group.ips
      const firstIp = shownIps[0]
      const ipPart =
        firstIp !== undefined
          ? ` · ${fenceSafe(firstIp)}${shownIps.length > 1 ? ` +${shownIps.length - 1} address${shownIps.length === 2 ? "" : "es"}` : ""}`
          : ""
      const label =
        group.name !== "" ? `${fenceSafe(group.name)}${ipPart}` : group.class === "dns" ? "localhost" : "(unnamed peer)"
      const annotation = descriptor !== "" ? ` (${descriptor})` : ""
      lines.push(`${prefix}${branch}→ ${label}${annotation}${times}`)
    }
  })
}

/**
 * Heading counts for one job — the finger-count invariant (§1.5): every
 * figure is derivable by counting the job's own canonical tree. Processes
 * are the distinct process NODES of the merged ancestry (unique lineage
 * prefixes — the bold + italic lines a reader can count); domains /
 * destinations are the distinct leaf identities.
 * @param {ReviewJob} job
 * @returns {{ processes: number, domains: number, destinations: number, allNamed: boolean, connections: number }}
 */
function jobTrueCounts(job) {
  /** @type {Set<string>} */
  const nodes = new Set()
  for (const c of job.connections) {
    const ancestry = c.ancestry.filter(isNonEmptyString)
    for (let i = 1; i <= ancestry.length; i += 1) nodes.add(ancestry.slice(0, i).join("\u0000"))
  }
  const processes = nodes.size
  // A destination is the recorded domain when one exists, else its address.
  // `allNamed` decides the heading noun: "domains" only when every
  // destination is named — never "0 domains" over a tree full of IPs.
  // The local resolver stub (class "dns") is infrastructure, not a
  // destination the workload chose — it never shifts the heading noun.
  const external = job.connections.filter(c => c.class !== "dns")
  const named = new Set(external.map(c => c.domain).filter(isNonEmptyString)).size
  // A record with neither domain nor address still counts as one (unnamed)
  // destination, so a job with real egress can never read as zero-egress.
  const destinations = new Set(external.map(destName)).size
  const domains = named
  const connections = job.connections.reduce((n, c) => n + c.count, 0)
  const allNamed = destinations === 0 || named === destinations
  return { processes, domains, destinations, allNamed, connections }
}

/**
 * One job line (§1.5): the provenance breadcrumb as the fold identity,
 * ordered by GitHub's own containment model — workflow / job. The JOB NAME
 * carries the link to its GitHub Actions run (the page holding this job's
 * log and Step Summary), ` ↗` affordance inside the link. No standalone
 * run-number element or separate run-link label ever renders — the run's
 * identity lives in the href, never in a visible label (A7: the job name IS
 * the label for the Actions-run destination class). The href derives from
 * run_url — built from run_id + repository in summarizeProfile — never from
 * run_number. GitHub renders <a>/<b>/<code> but not markdown inside
 * <summary>, hence HTML mode inline markup; plain mode (lineage-absent rows)
 * keeps a markdown link.
 * @param {{ name: string, workflow?: string, run_id?: string, run_url?: string, connections: ReviewConnection[] }} job
 * @param {Set<string>} [uniqueDests]
 * @param {{ link?: boolean, html?: boolean }} [opts]
 * @returns {string}
 */
export function jobSummaryLine(job, uniqueDests = new Set(), opts = {}) {
  /** @type {(v: string) => string} */
  const code = opts.html === true ? v => `<code>${escapeHtml(v)}</code>` : v => `\`${escapeCode(v)}\``
  /** @type {(v: string) => string} */
  const seg = v => (opts.html === true ? `<b>${code(v)}</b>` : `**${code(v)}**`)
  /** @type {string[]} */
  const pieces = []
  if (isNonEmptyString(job.workflow)) pieces.push(seg(job.workflow))
  if (isNonEmptyString(job.run_url) && isNonEmptyString(job.run_id)) {
    pieces.push(
      opts.html === true
        ? `<a href="${escapeHtmlAttr(job.run_url)}">${seg(job.name)} ↗</a>`
        : `[${seg(job.name)} ↗](${job.run_url})`,
    )
  } else {
    pieces.push(seg(job.name))
  }
  const ident = pieces.join(" / ")
  if (job.connections.length === 0) {
    return `${ident} — no outbound connections.`
  }
  const reviewJob = /** @type {ReviewJob} */ (job)
  const { processes, domains, destinations, allNamed } = jobTrueCounts(reviewJob)
  if (destinations === 0) {
    // Resolver-stub-only traffic (§1.5/A8): the dns leaf is uncounted, so
    // the row states the fact — never "reached 0 domains".
    return `${ident} — no outbound connections.`
  }
  /** @type {string[]} */
  const parts = []
  if (processes > 0) parts.push(`${processes} process${processes === 1 ? "" : "es"}`)
  parts.push(
    allNamed
      ? `reached ${domains} domain${domains === 1 ? "" : "s"}`
      : `reached ${destinations} destination${destinations === 1 ? "" : "s"}`,
  )
  const counts = parts.join(" · ")
  const telemetry = opts.html === true ? `<i>${counts}</i>` : `*${counts}*`
  return `${ident} — ${telemetry}`
}

/**
 * The fold subtext (§1.7): only the single garnet permalink — pinned right
 * so the fold's one action detaches visually from the tree and heading text
 * above it. Never a github.com/actions URL — omitted rather than mislabeled.
 * @param {ReviewJob} job
 * @param {RunReview} review
 * @returns {string}
 */
function renderFoldSubtext(job, review) {
  const runProfileUrl = jobRunProfileUrl(job, review.appUrl, { utm: true })
  if (runProfileUrl === "" || /github\.com\/[^ ]*\/actions\//.test(runProfileUrl)) return ""
  return `<p align="right"><sub><a href="${escapeHtmlAttr(runProfileUrl)}">${VOCAB.permalinkLabel}</a></sub></p>`
}

/**
 * The per-job PUBLIC Run Profile URL, derived from the job's own run_id.
 * ENG-1355 delta from the reference renderer: the standalone (Action)
 * comment links the RUN-LEVEL public report — no `?job=` selector; per-job
 * `?job=` permalinks are the control-plane GitHub App comment's job. Same
 * tokenless public route, same locked label (§1.1). Never a
 * github.com/actions URL.
 * @param {{ run_id?: string, name?: string }} job
 * @param {string} appUrl
 * @param {{ utm?: boolean }} [opts]
 * @returns {string}
 */
function jobRunProfileUrl(job, appUrl, opts = {}) {
  if (!isNonEmptyString(job.run_id) || appUrl === "") return ""
  const base = `${appUrl}/public/runs/${encodeURIComponent(String(job.run_id))}`
  return opts.utm === true ? `${base}?utm_source=github&utm_medium=pr_comment` : base
}

/**
 * §1.2 — absolute-UTC freshness stamp date with the year (comments outlive
 * their year): `Jul 8 2026, 5:36 AM UTC`.
 * @param {Date} date
 * @returns {string}
 */
export function freshnessStamp(date) {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const h12 = date.getUTCHours() % 12 === 0 ? 12 : date.getUTCHours() % 12
  const ampm = date.getUTCHours() >= 12 ? "PM" : "AM"
  const mm = String(date.getUTCMinutes()).padStart(2, "0")
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()} ${date.getUTCFullYear()}, ${h12}:${mm} ${ampm} UTC`
}

/**
 * §1.2 — canonical provenance line (v6.2), a `<sub>` coordinates stamp:
 * *commit [`{sha}`](commit-url) · recorded at the kernel · as of {Mon D
 * YYYY}, {h:MM} {AM|PM} UTC*. The sha is a pure reference (the trigger),
 * "recorded at the kernel" names the vantage point, "as of" carries the
 * update-in-place freshness semantics. Waiting state (jobs = 0) swaps the
 * middle segment for the fact: *no jobs recorded yet as of …*. Coverage
 * fraction and the workflows qualifier live in the jobs-count line (§1.5a),
 * never here.
 * @param {RunReview} review
 * @returns {string}
 */
function provenanceLine(review) {
  const sha7 = escapeCode(firstNonEmptyString(review.sha.slice(0, 7), "unknown"))
  const shaPart = isNonEmptyString(review.commitUrl)
    ? `commit [\`${sha7}\`](${review.commitUrl})`
    : `commit \`${sha7}\``
  const parts = [shaPart]
  if (review.counts.jobs === 0) {
    parts.push(
      review.renderedAt !== null ? `no jobs recorded yet as of ${freshnessStamp(review.renderedAt)}` : "no jobs recorded yet",
    )
  } else {
    parts.push("recorded at the kernel")
    if (review.renderedAt !== null) parts.push(`as of ${freshnessStamp(review.renderedAt)}`)
  }
  return `<sub>*${parts.join(" · ")}*</sub>`
}

/**
 * Shared header lines (v6.2): markers (optional), the standalone-only h3
 * title (App mode is headerless — the `garnet-runtime-review[bot]` actor row
 * carries the brand), the full-contrast headline, then the quoted provenance
 * line. The explainer (rendered by callers) continues the quote block with
 * no blank line between, so provenance + 💡 fold read as ONE railed block.
 * @param {RunReview} review
 * @param {{ markers: boolean }} opts
 * @returns {string[]}
 */
function renderHeader(review, { markers }) {
  const lines = markers ? [RUNTIME_REVIEW_MARKER, COMMENT_MARKER] : []
  if (markers && isNonEmptyString(review.sha)) lines.push(`<!-- garnet:commit ${review.sha} -->`)
  if (!review.appMode) lines.push(`### ${VOCAB.prCommentHeading}`)
  lines.push(VOCAB.prHeadline)
  lines.push("")
  lines.push(`> ${provenanceLine(review)}`)
  return lines
}

/**
 * §1.3/§1.4 — the first-time-reader explainer: the thesis sentence doubles
 * as the fold's visible summary, continuing the header's quote block so the
 * meta line, framing, and learn-more toggle read as ONE preamble. Open
 * through the entire first-commit lifecycle (`firstRun`), collapsed on every
 * update after that.
 * @param {{ firstRun?: boolean }} review
 * @returns {string}
 */
export function renderExplainer(review) {
  return [
    `> <details${review.firstRun === true ? " open" : ""}><summary><sub>💡 how to read this</sub></summary>`,
    ">",
    "> <sub><b>Each fold below is one CI job.</b> Its heading is <b>workflow / job ↗</b> — the job name links to its GitHub Actions run — followed by what Garnet's kernel-level sensor counted.</sub>",
    ">",
    "> <sub>Open a fold and read the tree top-down — exactly as it renders below:</sub>",
    "> <pre>",
    "> <i>Runner.Worker</i>                     ← italic = runner scaffolding",
    ">    └─ <b>bash</b>",
    ">       └─ <b>curl</b>                     ← bold = a process the job ran",
    ">          ├─ → httpbin.org         ← a place it reached",
    ">          └─ → localhost <i>(dns resolver)</i>  ← a note = expected plumbing",
    "> </pre>",
    "> <sub><i>Italics</i> are the runner's own scaffolding, not your code · a bare IP means no domain was observed for it · ×N = the same connection, N times · localhost lookups render in the tree but aren't counted as destinations · a job that reached a destination no other job reached starts open — a glance, not a verdict. For the full record, open <b>View Run Profile in Garnet ↗</b>.</sub>",
    ">",
    "> </details>",
  ].join("\n")
}

/**
 * §1.5a — the jobs-count line: one thin `<sub>` line between the railed
 * preamble and the first job fold. It is the list opener (the visual
 * boundary two adjacent <details> toggles need) AND the coverage surface:
 * `{k} of {n}` only when there is a gap, `across {w} workflows` only when
 * w > 1. Never renders in the waiting state (no list to open).
 * @param {RunReview} review
 * @returns {string}
 */
function jobsCountLine(review) {
  const { jobs, expectedJobs, workflows } = review.counts
  if (jobs === 0) return ""
  const gap = expectedJobs > jobs
  const n = gap ? expectedJobs : jobs
  const count = gap ? `${jobs} of ${expectedJobs}` : `${jobs}`
  const wf = workflows > 1 ? ` across ${workflows} workflows` : ""
  return `<sub><i>${count} job${n === 1 ? "" : "s"}${wf} recorded on this commit</i></sub>`
}

/**
 * §1.8 — footer: only the actionable coverage-gap line (`add the step ↗`),
 * only when coverage k < n — the thesis framing lives in the header's
 * explainer summary, so a complete run has no footer at all.
 * @param {RunReview} review
 * @param {string[]} lines
 * @returns {void}
 */
function renderFooter(review, lines) {
  const missing = review.counts.expectedJobs - review.counts.jobs
  if (missing <= 0 || !isNonEmptyString(review.docsUrl)) return
  lines.push("---")
  // Quote + <sub> is subordinate but readable — adding italic on top made
  // the one actionable line in the comment close to illegible on GitHub.
  lines.push(
    `> <sub>${missing} job${missing === 1 ? "" : "s"} not yet recorded — [add the step ↗](${review.docsUrl})</sub>`,
  )
}

/**
 * Render one job as ONE row (§1.8): zero-counted-egress jobs are a single
 * quiet subordinate line (A8) — never a fold; jobs with egress fold their
 * canonical tree under the summary line itself.
 * @param {RunReview} review
 * @param {ReviewJob} job
 * @param {string[]} lines
 * @param {{ collapsed: boolean, open?: boolean }} opts
 * @returns {void}
 */
function renderJobSection(review, job, lines, { collapsed, open = false }) {
  // Zero workload egress — no connections at all, or only the uncounted
  // resolver stub — renders as the quiet subordinate line, never a fold: a
  // heading that says "no outbound connections" must not sit atop a tree.
  const quiet = job.connections.length === 0 || jobTrueCounts(job).destinations === 0
  if (quiet || review.lineageAbsent) {
    if (quiet) {
      // Quiet rows stay visually subordinate to the folds around them.
      lines.push(`<sub>${jobSummaryLine(job, review.uniqueDests, { html: true })}</sub>`)
    } else {
      lines.push(jobSummaryLine(job, review.uniqueDests))
    }
    lines.push("")
    return
  }
  lines.push(
    `<details${open ? " open" : ""}><summary>${jobSummaryLine(job, review.uniqueDests, { link: false, html: true })}</summary>`,
  )
  lines.push("")
  if (collapsed) {
    // Same true recorded counts as the fold heading, so the collapsed
    // marker never contradicts it.
    const { processes: procs, connections } = jobTrueCounts(job)
    lines.push(`┄ ${procs} process${procs === 1 ? "" : "es"} · ${connections} connection${connections === 1 ? "" : "s"}`)
    lines.push("")
    const subtext = renderFoldSubtext(job, review)
    if (subtext !== "") {
      lines.push(subtext)
      lines.push("")
    }
  } else {
    // The expanded tree is the canonical truth: full real ancestry, no
    // focus collapsing, rendered as <pre> so processes can be bold.
    // GitHub strips <pre>'s top margin inside <details>, so an explicit <br>
    // keeps the tree from colliding with the summary row.
    lines.push("<br>")
    lines.push("")
    lines.push("<pre>")
    lines.push(renderJobTree(job, { elide: false, html: true }))
    lines.push("</pre>")
    lines.push("")
    const subtext = renderFoldSubtext(job, review)
    if (subtext !== "") {
      lines.push(subtext)
      lines.push("")
    }
  }
  lines.push("</details>")
  lines.push("")
}

/**
 * Render the Garnet Runtime Review PR comment. Every job renders as an
 * identical first-class fold — nothing is grouped, demoted, or hidden by a
 * heuristic (§1.8). A notable job (one that reached a destination no other
 * job in this commit reached) opens by default (§4). If the body exceeds
 * the size budget, trees collapse mechanically — largest tree (most
 * recorded connections) first — into explicit markers; then whole job
 * sections omit into one explicit aggregate line. Nothing ever disappears
 * silently.
 * @param {RunReview} review
 * @returns {string}
 */
export function renderRunReview(review) {
  const pruneOrder = [...review.jobs]
    .sort((a, b) => b.connections.length - a.connections.length || String(a.name).localeCompare(String(b.name)))
    .map(j => j.id)

  /** @type {Set<number>} */
  const collapsedIds = new Set()
  /** @type {Set<number>} */
  const omittedIds = new Set()
  // Two mechanical phases keep the body under the hard cap: first collapse
  // trees (largest first), then — if every tree is collapsed and the body is
  // still over budget — omit whole job sections (largest first) into one
  // explicit aggregate line. Nothing ever disappears silently.
  const steps = review.jobs.length * 2
  for (let attempts = 0; attempts <= steps; attempts += 1) {
    const lines = renderHeader(review, { markers: true })
    lines.push(renderExplainer(review))
    lines.push("")
    lines.push(jobsCountLine(review))
    lines.push("")
    for (const job of review.jobs) {
      if (omittedIds.has(job.id)) continue
      renderJobSection(review, job, lines, {
        collapsed: collapsedIds.has(job.id),
        open: review.notableJobs.has(job.id) && !collapsedIds.has(job.id),
      })
    }
    if (omittedIds.size > 0) {
      lines.push(
        `<sub>┄ ${omittedIds.size} job${omittedIds.size === 1 ? "" : "s"} over the comment size budget — full detail in each run's Step Summary</sub>`,
      )
      lines.push("")
    }
    renderFooter(review, lines)
    const body = lines.join("\n")
    if (body.length <= SIZE_BUDGET || omittedIds.size === review.jobs.length) return body
    if (collapsedIds.size < review.jobs.length) {
      const pruneId = pruneOrder[collapsedIds.size]
      if (pruneId === undefined) return body
      collapsedIds.add(pruneId)
    } else {
      const omitId = pruneOrder[omittedIds.size]
      if (omitId === undefined) return body
      omittedIds.add(omitId)
    }
  }
  throw new Error("unreachable")
}

/**
 * §2 — the waiting-state body: before any job's profile lands. Markerless;
 * callers prepend markers for the PR-comment surface. The meta line reads
 * `no jobs recorded yet as of {stamp}` — never a 0-of-n fraction. The
 * explainer renders open (first-commit lifecycle).
 * @param {{
 *   sha: string
 *   commitUrl: string
 *   expectedJobs: number
 *   docsUrl: string
 *   renderedAt: string | Date
 *   firstRun?: boolean
 * }} input
 * @returns {string}
 */
export function renderNoRecord(input) {
  const expected = Math.max(input.expectedJobs ?? 0, 1)
  /** @type {RunReview} */
  const noRecord = {
    repo: "",
    sha: String(isNonEmptyString(input.sha) ? input.sha : ""),
    permalink: "",
    appUrl: "",
    docsUrl: firstNonEmptyString(input.docsUrl),
    renderedAt: new Date(input.renderedAt),
    commitUrl: firstNonEmptyString(input.commitUrl),
    firstRun: input.firstRun !== false,
    appMode: false,
    jobs: [],
    notableJobs: new Set(),
    uniqueDests: new Set(),
    lineageAbsent: true,
    salience: { rule: "R3", jobRungs: new Map(), salientJobs: [], salientKey: "", headline: "" },
    counts: { jobs: 0, expectedJobs: expected, workflows: 0, domains: 0, connections: 0 },
  }
  const lines = renderHeader(noRecord, { markers: false })
  lines.push(renderExplainer(noRecord))
  lines.push("")
  lines.push("⏳ Run Profiles for this commit are still being recorded — this comment updates in place as jobs finish.")
  lines.push("")
  lines.push(
    "<sub>Run already finished? Look in the job log for the Garnet step — the sensor must start before the workload runs.</sub>",
  )
  lines.push("")
  renderFooter(noRecord, lines)
  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Step Summary (§8) — the per-run full-detail tabular record, one report per
// raw profile. No verdict headline, no markers, no size budget. Status
// markers appear ONLY inside the Assertions fold, as marker + verbatim enum.
// ---------------------------------------------------------------------------

/**
 * Render the GitHub Step Summary (`Garnet Runtime Summary`): the full-detail
 * tabular report, one per raw parsed Jibril profile.
 * @param {unknown[]} profiles raw parsed Jibril profiles
 * @param {{ appUrl?: string, preview?: boolean }} [opts] appUrl backs the
 *   permalink fallback when a profile carries no report_link; preview gates
 *   the assertions record (§8.5)
 * @returns {string}
 */
export function renderStepSummary(profiles, opts = {}) {
  return profiles.map(profile => renderProfileReport(profile, opts)).join("\n\n---\n\n")
}

/**
 * @param {unknown} profile
 * @param {{ appUrl?: string, preview?: boolean }} [opts]
 * @returns {string}
 */
function renderProfileReport(profile, opts = {}) {
  const p = normalizeProfileForReport(profile)
  const sections = [
    `### ${VOCAB.stepSummaryHeading}`,
    "",
    renderWorkloadSection(p),
    "",
    renderNetworkSection(p),
  ]
  // Assertions (and their evidence) are preview-gated: the prod default is
  // the observation-only record — no status vocabulary anywhere.
  if (opts.preview === true) {
    sections.push("", renderAssertionSection(p))
  }
  sections.push("", renderReportFooter(p, opts))
  return sections.join("\n")
}

/**
 * @typedef {{ process: string, command: string, pid: string, step: string, ancestry: string[] }} ReportProcTree
 * @typedef {{
 *   result: string,
 *   detections: string[],
 *   remote_names: string[],
 *   remote_address: string,
 *   remote_port: string,
 *   proc_trees: ReportProcTree[],
 * }} ReportPeer
 * @typedef {{
 *   uuid: string,
 *   github: { workflow: string, repository: string, ref: string, sha: string,
 *             actor: string, run_id: string, job: string },
 *   egress_peers: ReportPeer[],
 *   telemetry: { total_domains: number, total_connections: number },
 *   assertions: { class_id: string, id: string, result: string }[],
 *   timestamp: string,
 *   report_link: string,
 * }} ReportProfile
 */

/**
 * Raw Jibril JSON → ReportProfile. Accepts both snake_case and PascalCase
 * field names (`remote_names` / `RemoteNames`, …).
 * @param {unknown} profile
 * @returns {ReportProfile}
 */
function normalizeProfileForReport(profile) {
  const p = /** @type {Record<string, any>} */ (profile !== null && typeof profile === "object" ? profile : {})
  const github = p?.scenarios?.github ?? p?.github ?? {}

  const rawPeers = Array.isArray(p?.network?.egress?.peers) ? p.network.egress.peers : []
  const egressPeers = rawPeers.map((/** @type {any} */ peer) => ({
    result: String(peer?.result ?? ""),
    detections: /** @type {unknown[]} */ (peer?.detections ?? peer?.Detections ?? []).filter(isNonEmptyString).map(String),
    remote_names: /** @type {unknown[]} */ (peer?.remote_names ?? peer?.RemoteNames ?? []).filter(isNonEmptyString).map(String),
    remote_address: String(firstNonEmptyString(peer?.remote_address, peer?.RemoteAddress)),
    remote_port: toPortString(peer?.remote_ports ?? peer?.RemotePorts),
    proc_trees: /** @type {any[]} */ (peer?.proc_trees ?? peer?.ProcTrees ?? []).map(tree => ({
      process: String(firstNonEmptyString(tree?.process, tree?.Process)),
      command: String(firstNonEmptyString(tree?.arguments, tree?.Arguments)),
      pid: toPidString(tree?.pid, tree?.Pid),
      step: String(firstNonEmptyString(tree?.github_step, tree?.GithubStep)),
      ancestry: /** @type {unknown[]} */ (tree?.ancestry ?? tree?.Ancestry ?? []).filter(isNonEmptyString).map(String),
    })),
  }))

  const egress = p?.telemetry?.network?.egress ?? {}
  const rawAssertions = Array.isArray(p?.assertions) ? p.assertions : []
  const assertions = rawAssertions.map((/** @type {any} */ assertion) => ({
    class_id: String(firstNonEmptyString(assertion?.class_id, assertion?.ClassId)),
    id: String(firstNonEmptyString(assertion?.assertion_id, assertion?.id)),
    result: String(firstNonEmptyString(assertion?.result, "unknown")),
  }))

  return {
    uuid: String(p?.uuid ?? ""),
    github: {
      workflow: String(github.workflow ?? ""),
      repository: String(github.repository ?? ""),
      ref: String(github.ref ?? ""),
      sha: String(github.sha ?? ""),
      actor: String(github.actor ?? ""),
      run_id: String(github.run_id ?? ""),
      job: String(github.job ?? ""),
    },
    egress_peers: egressPeers,
    telemetry: {
      total_domains: typeof egress.total_domains === "number" ? egress.total_domains : 0,
      total_connections: typeof egress.total_connections === "number" ? egress.total_connections : 0,
    },
    assertions,
    timestamp: String(p?.timestamp ?? ""),
    report_link: String(p?.report_link ?? ""),
  }
}

/**
 * A recorded pid can arrive as a number or string; zero/empty means absent
 * (mirrors the reference renderer's truthiness rule).
 * @param {unknown} pid
 * @param {unknown} pidAlt
 * @returns {string}
 */
function toPidString(pid, pidAlt) {
  const isPresent = (/** @type {unknown} */ v) => (typeof v === "number" && v !== 0) || isNonEmptyString(v)
  const value = isPresent(pid) ? pid : isPresent(pidAlt) ? pidAlt : undefined
  return value === undefined ? "" : String(value)
}

/**
 * First recorded remote port, as a string; empty when absent (mirrors the
 * reference renderer's `(peer?.remote_ports || [])[0]` rule).
 * @param {unknown} ports
 * @returns {string}
 */
function toPortString(ports) {
  if (!Array.isArray(ports) || ports.length === 0) return ""
  const first = ports[0]
  if (first === null || first === undefined || first === "") return ""
  return String(first)
}

/**
 * @param {ReportProfile} p
 * @returns {string}
 */
function renderWorkloadSection(p) {
  const github = p.github
  const empty = p.uuid === "" && Object.values(github).every(value => value === "")
  if (empty) {
    return ["#### Workload Summary", "", "No workload information available."].join("\n")
  }

  /** @type {[string, string][]} */
  const entries = []
  if (p.uuid !== "") {
    entries.push(["Garnet Profile UUID", p.uuid])
  }
  entries.push(
    ["Workflow", github.workflow],
    ["Repository", github.repository],
    ["Branch", github.ref],
    ["Commit", github.sha],
    ["Triggered by", github.actor],
    ["Run ID / Job", formatRunJob(github.run_id, github.job)],
  )
  const table = renderKeyValueTable(entries)

  return ["#### Workload Summary", "", table].join("\n")
}

/**
 * @param {ReportProfile} p
 * @returns {string}
 */
function renderNetworkSection(p) {
  const totalDestinations = p.egress_peers.reduce(
    (n, peer) => n + peer.remote_names.filter(name => name !== "" && !isAddressLike(name)).length,
    0,
  )
  const flows = p.egress_peers.length
  const telemetrySentence = `Network telemetry observed ${p.telemetry.total_domains} unique domain${
    p.telemetry.total_domains === 1 ? "" : "s"
  }, ${totalDestinations} destination${totalDestinations === 1 ? "" : "s"}, ${
    p.telemetry.total_connections
  } connection${p.telemetry.total_connections === 1 ? "" : "s"}, and ${flows} flow${flows === 1 ? "" : "s"}.`

  const hasNetworkData =
    p.egress_peers.length > 0 || p.telemetry.total_domains > 0 || p.telemetry.total_connections > 0
  if (!hasNetworkData) {
    return ["#### Network Egress Summary", "", "No network information available."].join("\n")
  }

  // Destination-first, faithful to the profile (§8.3): one row per recorded
  // destination, in the profile's own `network.egress.peers[]` order — no
  // re-sort, no dedupe-and-omit. Jibril bundles the resolved address into
  // `remote_names`; drop address-shaped entries so a destination reads as its
  // domain; an address-only peer (no DNS name) falls back to the recorded
  // address. A peer with several recorded process trees keeps them all,
  // <br>-stacked in the one row; a recorded PID renders code-styled next to
  // its own tree.
  /** @type {string[][]} */
  const rows = []
  for (const peer of p.egress_peers) {
    const namedDests = peer.remote_names.filter(name => name !== "" && !isAddressLike(name))
    const dests = namedDests.length > 0 ? namedDests : peer.remote_address !== "" ? [peer.remote_address] : []
    const treeCells = peer.proc_trees
      .map(t => {
        const tree = renderReportProcessTree(t)
        if (tree.length === 0) {
          return ""
        }
        return t.pid !== "" ? `${tree} \`(pid ${escapeMarkdownCell(String(t.pid))})\`` : tree
      })
      .filter(cell => cell.length > 0)
    const treeCell = treeCells.length > 0 ? treeCells.join("<br>") : "-"
    for (const dest of dests) {
      rows.push([`\`${escapeMarkdownCell(dest)}\``, treeCell])
    }
  }

  const egressTable =
    rows.length > 0
      ? renderTable(["Destination", "Process Tree"], rows)
      : "No egress peers information available."

  return [
    "#### Network Egress Summary",
    "",
    "One row per recorded destination, in the profile's own order.",
    "",
    egressTable,
    "",
    telemetrySentence,
  ].join("\n")
}

/**
 * Human-readable check text keyed by assertion id (review-oriented wording).
 * @type {Record<string, string>}
 */
const ASSERTION_CHECKS = {
  no_bad_egress_domain: "A process contacted an unexpected network domain.",
  no_binary_execution_and_deletion: "A program was executed, and then its file was deleted.",
  no_code_injection_via_proc_memory: "A process initiated code injection via `/proc/{pid}/mem` access.",
}

/**
 * Marker + machine-readable enum for an assertion result, preserving the
 * value emitted by the Run Profile (§8.5: WARN/SKIP/UNKNOWN and future
 * strings are kept verbatim, never coerced into pass/fail).
 * @param {string} result
 * @returns {string}
 */
function assertionResultCell(result) {
  const enumValue = result.toUpperCase()
  /** @type {Record<string, string>} */
  const markers = { PASS: "✅", FAIL: "🔴", ATTENTION: "🟡", WARN: "🟡", SKIP: "⚪", UNKNOWN: "⚪" }
  const marker = markers[enumValue] ?? "⚪"
  return `${marker} \`${escapeMarkdownCell(firstNonEmptyString(enumValue, "UNKNOWN"))}\``
}

/**
 * True when a recorded assertion result denotes a passing/clean check.
 * @param {string} result
 * @returns {boolean}
 */
const assertionPassed = result => result.toLowerCase() === "pass"

/**
 * Evidence rows for a network-egress assertion: one row per (peer,
 * detection) drawn from the recorded peers that did NOT pass — the exact
 * fields Jibril emitted, never synthesized. Loopback peers are excluded
 * (the resolver stub is not an egress domain).
 * @param {ReportProfile} p
 * @returns {string[][]}
 */
function networkEvidenceRows(p) {
  /** @type {string[][]} */
  const rows = []
  for (const peer of p.egress_peers) {
    if (assertionPassed(peer.result)) continue
    const isLoopback = LOOPBACK_RE.test(peer.remote_names[0] ?? "") || LOOPBACK_RE.test(peer.remote_address)
    if (isLoopback) continue
    const dest = firstNonEmptyString(peer.remote_names[0], peer.remote_address, "-")
    const proc = peer.proc_trees[0] ?? { process: "", command: "", pid: "", step: "", ancestry: [] }
    const detections = peer.detections.length > 0 ? peer.detections : ["flow"]
    for (const detection of detections) {
      rows.push([
        `\`${escapeMarkdownCell(detection)}\``,
        `\`${escapeMarkdownCell(dest)}\``,
        `\`${escapeMarkdownCell(firstNonEmptyString(peer.remote_address, "-"))}\``,
        proc.process !== "" ? `\`${escapeMarkdownCell(proc.process)}\`` : "-",
        proc.command !== "" ? `\`${escapeMarkdownCell(proc.command)}\`` : "-",
        proc.step !== "" ? escapeMarkdownCell(proc.step) : "-",
      ])
    }
  }
  return rows
}

/**
 * §8.5 — assertions behind a collapsed-by-default `Assertions` fold —
 * preview mode only (the prod default record carries no assertions,
 * evidence, or status vocabulary): `Class | Assertion | Check | Result |
 * Evidence` with the verbatim assertion_id and marker + verbatim enum cells,
 * plus an `Evidence · {assertion_id}` fold for every assertion carrying
 * events, built from the profile's recorded evidence fields. Status markers
 * appear ONLY here, on either surface.
 * @param {ReportProfile} p
 * @returns {string}
 */
function renderAssertionSection(p) {
  if (p.assertions.length === 0) {
    return "<details><summary><strong>Assertions</strong></summary>\n\nNo assertions information available.\n\n</details>"
  }

  const evidenceRows = networkEvidenceRows(p)
  /** @type {{ id: string, rows: string[][] }[]} */
  const evidenceFolds = []
  const rows = p.assertions.map(assertion => {
    // Curated check text is trusted static markdown (intentional `code`
    // spans), so it is passed through un-escaped; only the dynamic id
    // fallback is escaped.
    const check = ASSERTION_CHECKS[assertion.id] ?? escapeMarkdownCell(displayValue(assertion.id, "-"))
    const isNetwork = assertion.class_id === "Network Egress"
    const count = isNetwork && !assertionPassed(assertion.result) ? evidenceRows.length : 0
    if (count > 0) evidenceFolds.push({ id: assertion.id, rows: evidenceRows })
    return [
      escapeMarkdownCell(displayValue(assertion.class_id, "-")),
      `\`${escapeMarkdownCell(displayValue(assertion.id, "-"))}\``,
      check,
      assertionResultCell(assertion.result),
      `${count} event${count === 1 ? "" : "s"}`,
    ]
  })

  const parts = [
    "<details><summary><strong>Assertions</strong></summary>",
    "",
    renderTable(["Class", "Assertion", "Check", "Result", "Evidence"], rows),
  ]

  for (const fold of evidenceFolds) {
    parts.push(
      "",
      `<details><summary>Evidence · <code>${escapeHtml(fold.id)}</code></summary>`,
      "",
      renderTable(["Event Type", "Destination", "Remote Address", "Process", "Command", "Step"], fold.rows),
      "",
      "</details>",
    )
  }

  parts.push("", "</details>")
  return parts.join("\n")
}

/**
 * §8.6 — footer: right-aligned identity line, then `Powered by Garnet` +
 * the single garnet permalink (the canonical public per-job report URL
 * derived from the run's own id; profile `report_link` only as fallback).
 * @param {ReportProfile} p
 * @param {{ appUrl?: string }} [opts]
 * @returns {string}
 */
function renderReportFooter(p, opts = {}) {
  /** @type {string[]} */
  const parts = []
  const d = p.telemetry.total_domains
  const c = p.telemetry.total_connections
  parts.push(`${d} unique domain${d === 1 ? "" : "s"} · ${c} connection${c === 1 ? "" : "s"}`)
  if (p.github.run_id !== "" || p.github.job !== "") {
    parts.push(
      `workflow ${escapeHtml(displayValue(p.github.workflow, "-"))} · run #${escapeHtml(
        displayValue(p.github.run_id, "-"),
      )} · job ${escapeHtml(displayValue(p.github.job, "-"))}`,
    )
  }
  if (p.timestamp !== "") {
    // Absolute UTC at seconds precision — raw nanosecond timestamps are
    // telemetry plumbing, not a reading aid.
    const trimmed = p.timestamp.replace(/\.\d+Z$/, "Z").replace("T", " ").replace(/Z$/, " UTC")
    parts.push(escapeHtml(trimmed))
  }

  const header = parts.join(" · ")
  // The one garnet permalink for this run: the canonical public per-job
  // report URL (/public/runs/{run_id}?job={job}), derived from the run's own
  // id — report_link is only a fallback when the profile carries no run id
  // (legacy links may point at retired dashboard routes).
  const permalink = stepSummaryPermalink(p, firstNonEmptyString(opts.appUrl, "https://app.garnet.ai"))
  const viewLink =
    permalink !== "" ? ` · <a href="${escapeHtmlAttr(permalink)}">${VOCAB.permalinkLabel}</a>` : ""

  return `<div align="right"><sub>${header}</sub><br><b>Powered by Garnet</b>${viewLink}</div>`
}

/**
 * Canonical Step Summary permalink: the public per-job report URL, matching
 * the PR comment's route family with this surface's own utm_medium.
 * @param {ReportProfile} p
 * @param {string} appUrl
 * @returns {string}
 */
function stepSummaryPermalink(p, appUrl) {
  if (p.github.run_id !== "" && appUrl !== "") {
    const base = `${appUrl}/public/runs/${encodeURIComponent(p.github.run_id)}`
    const job = p.github.job !== "" ? `?job=${encodeURIComponent(p.github.job)}&` : "?"
    return `${base}${job}utm_source=github&utm_medium=action_summary`
  }
  return p.report_link
}

/**
 * §8.3 — the lineage-tree cell: code-span ancestry joined ` → `, compressed
 * to root + `...` + last 3 when ancestry > 4.
 * @param {{ ancestry: string[] }} procTree
 * @returns {string}
 */
function renderReportProcessTree(procTree) {
  if (procTree.ancestry.length === 0) return ""
  const [rootProcess, ...remainingAncestry] = procTree.ancestry
  if (rootProcess === undefined || rootProcess === "") return ""

  const items = [`\`${escapeMarkdownCell(rootProcess)}\``]
  let start = 1
  if (procTree.ancestry.length > 4) {
    start = procTree.ancestry.length - 3
    items.push("`...`")
  }
  for (const processName of remainingAncestry.slice(start - 1)) {
    items.push(`\`${escapeMarkdownCell(processName)}\``)
  }
  return items.join(" → ")
}

/**
 * @param {string} runId
 * @param {string} job
 * @returns {string}
 */
function formatRunJob(runId, job) {
  /** @type {string[]} */
  const parts = []
  if (runId !== "") parts.push(runId)
  if (job !== "") parts.push(job)
  return parts.length > 0 ? parts.join(" / ") : "-"
}

/**
 * @param {string[]} headers
 * @param {string[][]} rows
 * @returns {string}
 */
function renderTable(headers, rows) {
  const headerRow = `| ${headers.map(header => escapeMarkdownCell(header)).join(" | ")} |`
  const separatorRow = `| ${headers.map(() => "---").join(" | ")} |`
  const bodyRows = rows.map(row => `| ${row.join(" | ")} |`)
  return [headerRow, separatorRow, ...bodyRows].join("\n")
}

/**
 * @param {[string, string][]} rows
 * @returns {string}
 */
function renderKeyValueTable(rows) {
  return renderTable(
    ["Field", "Value"],
    rows.map(([key, value]) => [escapeMarkdownCell(key), escapeMarkdownCell(displayValue(value, "-"))]),
  )
}

/**
 * @param {string} value
 * @param {string} fallback
 * @returns {string}
 */
function displayValue(value, fallback) {
  return value !== "" ? value : fallback
}

/**
 * Escape a value destined for a markdown table cell (§9: strips control
 * chars, neutralizes HTML).
 * @param {string} value
 * @returns {string}
 */
function escapeMarkdownCell(value) {
  return stripControl(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("`", "\\`")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replace(/[\r\n]+/g, " ")
}
