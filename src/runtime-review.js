/**
 * Garnet Runtime Review — observation-only PR comment renderer (Comment v5.2).
 *
 * Vendored from the locked reference renderer in
 * garnet-labs/runtime-review-testbed (`cmd/garnet-runtime-review/review.mjs`,
 * merged in PR #30). This copy follows the repo's AGENTS.md explicit-check
 * rule throughout; every such rewrite is byte-neutral and verified by the
 * fixture byte-compare tests, so the rendered markdown stays faithful to the
 * reference.
 *
 * Frame: the comment answers exactly one question — "what happened in this
 * PR?". It is runtime evidence for code review, never an evaluation. No
 * statuses, no icons, no badges. Deterministic by construction: same profile
 * payload (and render clock) in → byte-identical markdown out.
 *
 * v5.1 amendments implemented here:
 *   A1 — structural classification: every connection gets exactly one class
 *        (`dns`, `garnet upload`, `github infra`, or unclassified), derived
 *        from what the connection IS, never whether it is fine. Classes render
 *        as inline annotations in the tree, never as icons.
 *   A2 — classification filters salience, never counts: classified
 *        connections are excluded from headline candidacy and the three named
 *        enumeration slots; they remain in every count and every tree.
 *   A3 — selection order is salience order everywhere: within-run uniqueness,
 *        then spawn-chain depth, then connection count, then lexical.
 *        First-seen/temporal order is dead as a selection key.
 *   A4 — runner-chain elision: the exact GitHub-hosted ancestry set compresses
 *        to one line with aggregate counts; any non-member in the subtree or
 *        member reaching a non-GitHub-owned destination cancels elision for
 *        that branch. Elide processes, never counts.
 *   A5 — identifier normalization: behavior signatures normalize
 *        trailing-digit suffixes; display always shows the raw name.
 *   A6 — link policy: one label ↔ one destination class. `job log ↗` per job
 *        line; `Run Profile ↗` (footer) is ONLY the capability link — when no
 *        capability link exists the footer omits it rather than mislabel;
 *        `add the step ↗` only when coverage k < n.
 *   A7 — meta line: [`{sha}`](commit) · {k} of {n} jobs recorded (only when a
 *        total n > k is known; otherwise `{k} job(s) recorded`) · updated
 *        {HH:MM} UTC · {Mon D}. Absolute UTC, never relative.
 *   A8 — hardening: evidence strings are escaped, control characters
 *        stripped, tree fences use four backticks. Canonical sticky marker is
 *        `<!-- garnet-runtime-review -->`.
 *   A9 — size budget: 60,000-char ceiling; overflow collapses trees
 *        lowest-salience-first with explicit markers; nothing disappears
 *        silently.
 *
 * Progressive disclosure across surfaces:
 *   - PR comment  — headline, one job line per job, per-job <details> fold
 *     (open iff the winning rung beats plain counts).
 *   - Step summary — the FULL-detail snapshot: every tree inline, no elision,
 *     nothing folded.
 */

/**
 * Canonical sticky marker (A8). `<!-- garnet-run-profile -->` is retained only
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

/** Hard size ceiling for the PR comment body (A9). GitHub caps at 65,536. */
export const SIZE_BUDGET = 60_000

/** Network tools whose presence in a lineage tail is structurally salient. */
const NETWORK_TOOLS = [/^curl\b/, /^wget\b/, /^sh -c\b/]

/** How many trailing ancestry entries count as the "lineage tail". */
const TAIL_DEPTH = 3

/**
 * The exact known GitHub-hosted runner ancestry set (A4). Membership is
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

/** GitHub-published destination names (github infra classification, A1). */
const GITHUB_OWNED_RE =
  /(^|\.)github\.com$|(^|\.)githubusercontent\.com$|(^|\.)githubapp\.com$|(^|\.)actions\.githubusercontent\.com$/

/**
 * @typedef {{ ancestry: string[], domain: string, ip: string }} RawConnection
 */

/**
 * @typedef {RawConnection & { count: number, class: string }} ReviewConnection
 */

/**
 * @typedef {{
 *   name: string
 *   workflow: string
 *   sha: string
 *   run_id: string
 *   run_url: string
 *   connections: RawConnection[]
 * }} JobRecord
 */

/**
 * @typedef {{
 *   id: number
 *   name: string
 *   workflow: string
 *   run_url: string
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
 *   docsUrl: string
 *   renderedAt: Date | null
 *   commitUrl: string
 *   jobs: ReviewJob[]
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
 * Strip control characters from any evidence string (A8).
 * @param {unknown} value
 * @returns {string}
 */
const stripControl = value => String(value ?? "").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")

/** @param {unknown} value @returns {value is string} */
const isNonEmptyString = value => value !== undefined && value !== null && value !== ""

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
 * Escape a value destined for INSIDE an HTML element (A8).
 * @param {unknown} value
 * @returns {string}
 */
const escapeHtml = value =>
  stripControl(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\r\n]+/g, " ")
    .trim()

/**
 * Sanitize a value rendered inside a four-backtick ````text fence (A8): no
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
 * Is this process name a member of the GitHub runner chain (A4)?
 * @param {string} name
 * @returns {boolean}
 */
const isRunnerChainProcess = name => RUNNER_CHAIN.has(normalizeIdentifier(String(name)))

/**
 * A1 — structural classification. Exactly one class per connection, typed on
 * identity and provenance, never acceptability:
 *   `dns`           — resolver stub (systemd-resolved loopback).
 *   `garnet upload` — the sensor's own upload path.
 *   `github infra`  — destination inside GitHub's published ranges AND origin
 *                     inside the runner chain (both: ownership + provenance).
 *   ""              — unclassified (everything else — including GitHub-owned
 *                     destinations reached from user code, which stay
 *                     enumerable evidence).
 * @param {{ ancestry: string[], domain: string, ip: string }} c
 * @returns {string}
 */
export function classifyConnection(c) {
  const domain = String(firstNonEmptyString(c.domain))
  const ip = String(firstNonEmptyString(c.ip))
  if (/^(localhost|127\.|::1)/.test(domain) || /^(127\.|::1)/.test(ip)) return "dns"
  if (/^(?:[a-z0-9-]+-)?api\.garnet\.ai$/.test(domain)) return "garnet upload"
  const ancestry = (c.ancestry ?? []).filter(isNonEmptyString)
  const fromRunnerChain = ancestry.length > 0 && ancestry.every(isRunnerChainProcess)
  if (fromRunnerChain && (GITHUB_OWNED_RE.test(domain) || domain === "")) return "github infra"
  return ""
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
  /** @type {RawConnection[]} */
  const connections = []
  for (const peer of egressPeers) {
    const domain = String(firstNonEmptyString(...(peer?.remote_names ?? peer?.RemoteNames ?? [])))
    const ip = String(firstNonEmptyString(peer?.remote_address, peer?.RemoteAddress))
    const trees = peer?.proc_trees ?? peer?.ProcTrees ?? []
    const ancestries = trees.length > 0
      ? trees.map((/** @type {any} */ t) => {
          const ancestry = t?.ancestry ?? t?.Ancestry ?? []
          return ancestry.filter(isNonEmptyString)
        })
      : [[]]
    for (const ancestry of ancestries) {
      connections.push({ ancestry, domain, ip })
    }
  }

  return {
    name: firstNonEmptyString(github.job),
    workflow: firstNonEmptyString(github.workflow),
    sha: firstNonEmptyString(github.sha),
    run_id: firstNonEmptyString(github.run_id),
    run_url:
      isNonEmptyString(github.run_id) && isNonEmptyString(github.repository)
        ? `${isNonEmptyString(github.server_url) ? github.server_url : "https://github.com"}/${github.repository}/actions/runs/${github.run_id}`
        : "",
    connections,
  }
}

/**
 * A6 — the Run Profile permalink: an explicit permalink wins; otherwise
 * derive the Garnet app run URL from the profile's own run_id.
 * Never a github.com/actions URL.
 * @param {string} explicit
 * @param {{ run_id?: string }[]} jobRecords
 * @param {string} appUrl
 * @returns {string}
 */
export function derivePermalink(explicit, jobRecords, appUrl) {
  if (explicit !== "") return explicit
  const runId = (jobRecords ?? []).map(j => j?.run_id).find(isNonEmptyString)
  if (runId === undefined || runId === "" || appUrl === "") return ""
  return `${appUrl}/dashboard/runs/${encodeURIComponent(String(runId))}?utm_source=github&utm_medium=pr_comment`
}

/**
 * Stable key for deduplicating one (lineage, destination) behavior.
 * @param {{ ancestry: string[], domain: string, ip: string }} c
 * @returns {string}
 */
const connectionKey = c => `${(c.ancestry ?? []).join("\u0000")}\u0001${c.domain}\u0001${c.ip}`

/**
 * A5 — behavior signature for R0 comparison across pushes: normalized
 * ancestry + destination. Computed on the raw profile; elision (A4) has no
 * effect on signatures.
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
 * Display label for a destination under A1 (`dns` replaces the stub name).
 * @param {ReviewConnection} c
 * @returns {string}
 */
const destLabel = c => (c.class === "dns" ? "dns" : destName(c))

/**
 * @param {string[]} ancestry
 * @returns {boolean}
 */
const tailHasNetworkTool = ancestry =>
  ancestry.slice(-TAIL_DEPTH).some(step => NETWORK_TOOLS.some(re => re.test(String(step))))

/**
 * A3 — the total selection order (salience order), applied to headline
 * destination, enumeration slots, job ordering, and pruning order:
 * within-run uniqueness → spawn-chain depth → connection count → lexical.
 * Returns a comparator; smaller sorts first (more salient).
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
 *   docsUrl?: string
 *   expectedJobs?: number
 *   renderedAt?: string | Date
 *   jobs: Partial<JobRecord>[]
 * }} input
 * @returns {RunReview}
 */
export function buildRunReview(input) {
  /** @type {ReviewJob[]} */
  let jobs = (input.jobs ?? []).filter(job => job !== undefined && job !== null).map((j, i) => ({
    id: i,
    name: firstNonEmptyString(j.name, `job-${i + 1}`),
    workflow: firstNonEmptyString(j.workflow),
    run_url: firstNonEmptyString(j.run_url),
    connections: dedupeConnections(j.connections ?? []),
  }))

  const workflows = [...new Set(jobs.map(j => j.workflow).filter(isNonEmptyString))]
  const domains = [...new Set(jobs.flatMap(j => j.connections.map(destName)).filter(isNonEmptyString))]
  const totalConnections = jobs.reduce(
    (n, j) => n + j.connections.reduce((m, c) => m + c.count, 0),
    0,
  )

  // Within-run uniqueness (A3's first key): destinations reached by exactly
  // one job. Only meaningful when more than one job is recorded.
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

  // A3 — job ordering: headline-picked jobs first, then rung ascending;
  // ties by name (total order). Keeps the salient job out of the group fold.
  /** @param {ReviewJob} job */
  const salientRank = job => (salience.salientJobs.includes(job.id) ? 0 : 1)
  /** @param {ReviewJob} job */
  const rungRank = job => salience.jobRungs.get(job.id) ?? 3
  jobs = [...jobs].sort(
    (a, b) =>
      salientRank(a) - salientRank(b) || rungRank(a) - rungRank(b) || (a.name < b.name ? -1 : 1),
  )

  const recorded = jobs.length
  const expected = Math.max(input.expectedJobs ?? 0, recorded)

  return {
    repo: firstNonEmptyString(input.repo),
    sha: firstNonEmptyString(input.sha),
    permalink: firstNonEmptyString(input.permalink),
    docsUrl: firstNonEmptyString(input.docsUrl),
    renderedAt: input.renderedAt !== undefined && input.renderedAt !== null ? new Date(input.renderedAt) : null,
    commitUrl: firstNonEmptyString(input.commitUrl),
    jobs,
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
 * The structural-salience headline. Rungs (top wins):
 *   uniqueness — a destination reached by exactly one job (multi-job only)
 *   spawn      — a network tool in a lineage tail
 *   counts     — the pure inventory sentence (S4)
 * A2: classified connections never headline. A3: within a rung, candidates
 * are ordered by the salience comparator, never first-seen.
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
    const proc = isNonEmptyString(ancestry[ancestry.length - 1]) ? ancestry[ancestry.length - 1] : "a process"
    action = `\`${escapeCode(proc)}\` reached \`${escapeCode(dest)}\``
  }
  const tailPart = suffix !== "" ? ` — ${suffix}` : ""
  return `In \`${escapeCode(job.name)}\`, ${action}${tailPart}.`
}

/**
 * A4 — split a job's connections into the elidable runner-chain set and the
 * visible set. A connection is elidable iff its entire ancestry is inside the
 * runner chain AND its destination is GitHub-owned infrastructure (`github
 * infra`) or the resolver stub (`dns`). Any member-only lineage reaching an
 * unclassified or non-GitHub destination cancels elision for that branch and
 * renders in full.
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
 * the first non-member (A4: elision cancels from there down).
 * @param {string[]} ancestry
 * @returns {{ prefix: string[], rest: string[] }}
 */
function stripRunnerPrefix(ancestry) {
  let i = 0
  while (i < ancestry.length && isRunnerChainProcess(ancestry[i] ?? "")) i += 1
  // Cancellation (A4): a member-only lineage that survived splitRunnerChain
  // reached a non-GitHub-owned destination — render that branch in full.
  if (i === ancestry.length && ancestry.length > 0) return { prefix: [], rest: ancestry }
  return { prefix: ancestry.slice(0, i), rest: ancestry.slice(i) }
}

/**
 * Shared-prefix-merge a job's connections into one lineage tree rooted at the
 * job name (A4 elision applied when `elide` is set), leaves annotated
 * `→ domain · ip` with A1 class annotations. Four-backtick fences are the
 * caller's responsibility. When `focus` names a connection, only branches on
 * the path to that leaf expand; sibling subtrees compress to one `┄` line
 * per level (the Step Summary always renders the full tree).
 * @param {{ name: string, connections: ReviewConnection[] }} job
 * @param {{ elide?: boolean, focus?: string }} [opts]
 * @returns {string}
 */
export function renderJobTree(job, opts = {}) {
  const elide = opts.elide !== false
  const focus = firstNonEmptyString(opts.focus)
  const lines = [fenceSafe(job.name)]

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
    const connPart = elidedConnections > 0
      ? ` · ${elidedConnections} connection${elidedConnections === 1 ? "" : "s"} → GitHub-owned addresses`
      : ""
    lines.push(`└─ GitHub runner ┄ ${runnerProcs.size} process${runnerProcs.size === 1 ? "" : "es"}${connPart}`)
    renderNodeChildren(root, "   ", lines, focus !== "" && root.onPath === true)
  } else {
    renderNodeChildren(root, "", lines, focus !== "" && root.onPath === true)
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
 * @param {TreeNode} node
 * @param {string} prefix
 * @param {string[]} lines
 * @param {boolean} [focusMode]
 * @returns {void}
 */
function renderNodeChildren(node, prefix, lines, focusMode = false) {
  let procs = [...node.children.entries()].map(([name, child]) => ({ name, child }))
  let collapsedNote = ""
  if (focusMode) {
    const offPath = procs.filter(p => p.child.onPath !== true)
    if (offPath.length > 0) {
      /** @type {Set<string>} */
      const dests = new Set()
      const totals = { connections: 0 }
      for (const p of offPath) subtreeCounts(p.child, dests, totals)
      collapsedNote = `┄ ${dests.size} more destination${dests.size === 1 ? "" : "s"} · ${totals.connections} connection${totals.connections === 1 ? "" : "s"} — full tree in the Step Summary ↗`
      procs = procs.filter(p => p.child.onPath === true)
    }
  }
  /** @type {(
   *   { kind: "proc", name: string, child: TreeNode } |
   *   { kind: "leaf", leaf: ReviewConnection } |
   *   { kind: "note", note: string }
   * )[]} */
  const entries = [
    ...procs.map(p => /** @type {{ kind: "proc", name: string, child: TreeNode }} */ ({ kind: "proc", ...p })),
    ...node.leaves.map(leaf => /** @type {{ kind: "leaf", leaf: ReviewConnection }} */ ({ kind: "leaf", leaf })),
    ...(collapsedNote !== "" ? [/** @type {{ kind: "note", note: string }} */ ({ kind: "note", note: collapsedNote })] : []),
  ]
  entries.forEach((entry, i) => {
    const last = i === entries.length - 1
    const branch = last ? "└─ " : "├─ "
    const childPrefix = prefix + (last ? "   " : "│  ")
    if (entry.kind === "proc") {
      lines.push(`${prefix}${branch}${fenceSafe(entry.name)}`)
      renderNodeChildren(entry.child, childPrefix, lines, focusMode && entry.child.onPath === true)
    } else if (entry.kind === "note") {
      lines.push(`${prefix}${branch}${entry.note}`)
    } else {
      const { leaf } = entry
      const name = leaf.class === "dns" ? "dns" : ""
      const label =
        [...new Set([firstNonEmptyString(name, leaf.domain), leaf.ip].filter(isNonEmptyString))].map(fenceSafe).join(" · ") ||
        "(unnamed peer)"
      const annotation = isNonEmptyString(leaf.class) && leaf.class !== "dns" ? ` — ${leaf.class}` : ""
      const times = leaf.count > 1 ? ` ×${leaf.count}` : ""
      lines.push(`${prefix}${branch}→ ${label}${annotation}${times}`)
    }
  })
}

/**
 * One job line (S1/S8): named enumeration slots hold the ≤3 most salient
 * UNCLASSIFIED destinations (A2/A3); classified and overflow entries fold
 * into "and {n} more". Slots prefer named domains — a bare address takes a
 * slot only when no named domain is left. Raw totals stay true.
 * @param {{ name: string, run_url?: string, connections: ReviewConnection[] }} job
 * @param {Set<string>} [uniqueDests]
 * @param {{ link?: boolean, html?: boolean }} [opts] link=false omits the
 *   job-log link (the line becomes a fold `<summary>`; the link moves into
 *   the fold). html=true emits HTML inline markup — GitHub does not render
 *   markdown inside `<summary>`, so fold rows need `<b><code>` instead.
 * @returns {string}
 */
export function jobSummaryLine(job, uniqueDests = new Set(), opts = {}) {
  /** @type {(v: string) => string} */
  const code = opts.html ? v => `<code>${escapeHtml(v)}</code>` : v => `\`${escapeCode(v)}\``
  const ident = opts.html ? `<b>${code(job.name)}</b>` : `**${code(job.name)}**`
  const logLink =
    isNonEmptyString(job.run_url) && opts.link !== false ? ` · [job log ↗](${job.run_url})` : ""
  if (job.connections.length === 0) {
    return `${ident} — made no outbound connections.${logLink}`
  }
  const cmp = salienceComparator(uniqueDests)
  /** @type {string[]} */
  const named = []
  /** @type {Set<string>} */
  const seen = new Set()
  const ordered = [...job.connections].sort(
    (a, b) => (isNonEmptyString(a.domain) ? 0 : 1) - (isNonEmptyString(b.domain) ? 0 : 1) || cmp(a, b),
  )
  for (const c of ordered) {
    if (c.class !== "") continue
    const d = destName(c)
    if (d === "" || seen.has(d)) continue
    seen.add(d)
    named.push(d)
    if (named.length === 3) break
  }
  const allDests = new Set(job.connections.map(destName).filter(isNonEmptyString))
  const remainder = allDests.size - named.length
  const total = job.connections.reduce((n, c) => n + c.count, 0)
  const shown = named.map(code).join(", ")
  const more = remainder > 0 ? ` and ${remainder} more` : ""
  const reach = named.length > 0
    ? `reached ${shown}${more}`
    : `reached ${allDests.size} destination${allDests.size === 1 ? "" : "s"}`
  return `${ident} — ${reach} · ${total} connection${total === 1 ? "" : "s"}${logLink}`
}

/**
 * Per-job counts used in fold summaries (raw-true, A2).
 * @param {ReviewJob} job
 * @returns {{ domains: number, connections: number }}
 */
function jobCounts(job) {
  const domains = new Set(job.connections.map(destName).filter(isNonEmptyString)).size
  const connections = job.connections.reduce((n, c) => n + c.count, 0)
  return { domains, connections }
}

/**
 * A7 — absolute-UTC freshness stamp: `updated 14:02 UTC · Jul 3`.
 * @param {Date} date
 * @returns {string}
 */
export function freshnessStamp(date) {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const hh = String(date.getUTCHours()).padStart(2, "0")
  const mm = String(date.getUTCMinutes()).padStart(2, "0")
  return `updated ${hh}:${mm} UTC · ${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`
}

/**
 * A7 — canonical meta line:
 * [`{sha}`](commit-url) · {k} of {n} jobs recorded · updated {HH:MM} UTC · {Mon D}
 * The coverage clause is conditional: `{k} of {n} jobs recorded` only when a
 * total n greater than the recorded k is known; otherwise `{k} job(s) recorded`.
 * Repo name dropped (the comment lives in the repo); `{w} workflows` only
 * when w > 1; timestamps absolute UTC, never relative.
 * @param {RunReview} review
 * @returns {string}
 */
function metaLine(review) {
  const shaPrefix = review.sha.slice(0, 7)
  const sha7 = escapeCode(isNonEmptyString(shaPrefix) ? shaPrefix : "unknown")
  const shaPart = isNonEmptyString(review.commitUrl) ? `[\`${sha7}\`](${review.commitUrl})` : `\`${sha7}\``
  const coverage =
    review.counts.expectedJobs > review.counts.jobs
      ? `${review.counts.jobs} of ${review.counts.expectedJobs} job${review.counts.expectedJobs === 1 ? "" : "s"} recorded`
      : `${review.counts.jobs} job${review.counts.jobs === 1 ? "" : "s"} recorded`
  const parts = [shaPart, coverage]
  if (review.counts.workflows > 1) parts.push(`${review.counts.workflows} workflows`)
  if (review.renderedAt !== null) parts.push(freshnessStamp(review.renderedAt))
  return parts.join(" · ")
}

/**
 * Shared header lines: markers (optional), title, meta line, headline.
 * @param {RunReview} review
 * @param {{ markers: boolean }} opts
 * @returns {string[]}
 */
function renderHeader(review, { markers }) {
  const lines = markers ? [RUNTIME_REVIEW_MARKER, COMMENT_MARKER] : []
  lines.push("## Garnet Runtime Review")
  lines.push(metaLine(review))
  lines.push("")
  lines.push(review.salience.headline)
  lines.push("")
  return lines
}

/**
 * A6 — footer: the one-question frame; `Run Profile ↗` ONLY when a capability
 * link exists (never a github.com/actions URL — omitted rather than
 * mislabeled); `add the step ↗` only when coverage k < n.
 * @param {RunReview} review
 * @param {string[]} lines
 * @returns {void}
 */
function renderFooter(review, lines) {
  lines.push("---")
  const capability =
    isNonEmptyString(review.permalink) && !/github\.com\/[^ ]*\/actions\//.test(review.permalink)
      ? ` · [Run Profile ↗](${review.permalink})`
      : ""
  const missing = review.counts.expectedJobs - review.counts.jobs
  const growth =
    missing > 0 && isNonEmptyString(review.docsUrl)
      ? ` · ${missing} job${missing === 1 ? "" : "s"} not yet recorded — [add the step ↗](${review.docsUrl})`
      : ""
  lines.push(
    `<sub>What happened in this PR — each job's processes and where they reached.${capability}${growth}</sub>`,
  )
}

/**
 * Render one job as ONE row (S1/S8): quiet jobs are a single plain line;
 * jobs with egress fold their lineage under the summary line itself — the
 * job line IS the `<summary>`, so the list scans as one row per job and the
 * tree always sits indented inside its job. Open iff the job's rung beats
 * plain counts.
 * @param {RunReview} review
 * @param {ReviewJob} job
 * @param {string[]} lines
 * @param {{ collapsed: boolean }} opts
 * @returns {void}
 */
function renderJobSection(review, job, lines, { collapsed }) {
  if (job.connections.length === 0 || review.lineageAbsent) {
    lines.push(jobSummaryLine(job, review.uniqueDests))
    lines.push("")
    return
  }
  const { connections } = jobCounts(job)
  const rung = review.salience.jobRungs.get(job.id) ?? 3
  const salient = review.salience.salientJobs.includes(job.id)
  const open = rung < 3 ? " open" : ""
  lines.push(
    `<details${open}><summary>${jobSummaryLine(job, review.uniqueDests, { link: false, html: true })}</summary>`,
  )
  lines.push("")
  const logLink = isNonEmptyString(job.run_url) ? ` · [job log ↗](${job.run_url})` : ""
  if (collapsed) {
    const procs = new Set(job.connections.flatMap(c => c.ancestry)).size
    lines.push(`┄ ${procs} process${procs === 1 ? "" : "es"} · ${connections} connection${connections === 1 ? "" : "s"} — full tree in the Step Summary ↗`)
    lines.push("")
    if (logLink !== "") {
      lines.push(`<sub>Full detail in the Step Summary${logLink}</sub>`)
      lines.push("")
    }
  } else {
    lines.push("````text")
    lines.push(renderJobTree(job, { focus: salient ? review.salience.salientKey : "" }))
    lines.push("````")
    lines.push("")
    lines.push(
      `<sub>Paste the tree into your review agent · full detail in the Step Summary${logLink}</sub>`,
    )
    lines.push("")
  }
  lines.push("</details>")
  lines.push("")
}

/**
 * Render the Garnet Runtime Review PR comment. A9: if the body exceeds the
 * size budget, trees collapse lowest-salience-first into explicit markers;
 * headline and job lines are never dropped.
 * @param {RunReview} review
 * @returns {string}
 */
export function renderRunReview(review) {
  // A3 (ascending salience = pruning order): collapse R3-rung jobs first.
  const pruneOrder = [...review.jobs]
    .sort(
      (a, b) =>
        (review.salience.jobRungs.get(b.id) ?? 3) - (review.salience.jobRungs.get(a.id) ?? 3) ||
        (a.name < b.name ? 1 : -1),
    )
    .map(j => j.id)

  // Readability tier: after the top salient jobs, remaining jobs group into
  // one fold so the comment's height is O(1) in the size of the job matrix.
  const GROUP_AFTER = 3
  const grouped = review.jobs.length > GROUP_AFTER + 1 ? review.jobs.slice(GROUP_AFTER) : []
  const ungrouped = grouped.length > 0 ? review.jobs.slice(0, GROUP_AFTER) : review.jobs

  /** @type {Set<number>} */
  const collapsedIds = new Set()
  for (let attempts = 0; attempts <= review.jobs.length; attempts += 1) {
    const lines = renderHeader(review, { markers: true })
    for (const job of ungrouped) {
      renderJobSection(review, job, lines, { collapsed: collapsedIds.has(job.id) })
    }
    if (grouped.length > 0) {
      const domains = new Set(grouped.flatMap(j => j.connections.map(destName)).filter(isNonEmptyString)).size
      const connections = grouped.reduce((n, j) => n + j.connections.reduce((m, c) => m + c.count, 0), 0)
      lines.push(
        `<details><summary>${grouped.length} more jobs · ${domains} domain${domains === 1 ? "" : "s"} · ${connections} connection${connections === 1 ? "" : "s"}</summary>`,
      )
      lines.push("")
      for (const job of grouped) {
        renderJobSection(review, job, lines, { collapsed: collapsedIds.has(job.id) })
      }
      lines.push("</details>")
      lines.push("")
    }
    renderFooter(review, lines)
    const body = lines.join("\n")
    if (body.length <= SIZE_BUDGET || collapsedIds.size === review.jobs.length) return body
    const pruneId = pruneOrder[collapsedIds.size]
    if (pruneId === undefined) return body
    collapsedIds.add(pruneId)
  }
  throw new Error("unreachable")
}

/**
 * Render the FULL-detail snapshot for the GitHub Step Summary: every job's
 * complete lineage tree inline — no elision, no folds, no markers, no budget.
 * @param {RunReview} review
 * @returns {string}
 */
export function renderStepSummary(review) {
  const lines = renderHeader(review, { markers: false })

  review.jobs.forEach(job => {
    lines.push(jobSummaryLine(job, review.uniqueDests))
    lines.push("")
    if (job.connections.length === 0 || review.lineageAbsent) return
    lines.push("````text")
    lines.push(renderJobTree(job, { elide: false }))
    lines.push("````")
    lines.push("")
  })

  renderFooter(review, lines)
  return lines.join("\n")
}

/**
 * The no-record body: Jibril produced no profile (sensor failed to start or
 * the workload never ran). Says so plainly — no verdict, no glyph; the footer
 * carries the one growth CTA (A6). Markerless; callers prepend markers for
 * the PR-comment surface.
 * @param {{
 *   sha: string
 *   commitUrl: string
 *   expectedJobs: number
 *   docsUrl: string
 *   renderedAt: string | Date
 * }} input
 * @returns {string}
 */
export function renderNoRecord(input) {
  const expected = Math.max(input.expectedJobs ?? 0, 1)
  const shaSource = isNonEmptyString(input.sha) ? input.sha : "unknown"
  const sha7 = escapeCode(String(shaSource).slice(0, 7))
  const stamp = freshnessStamp(new Date(input.renderedAt))
  return [
    "## Garnet Runtime Review",
    `${isNonEmptyString(input.commitUrl) ? `[\`${sha7}\`](${input.commitUrl})` : `\`${sha7}\``} · 0 of ${expected} job${expected === 1 ? "" : "s"} recorded · ${stamp}`,
    "",
    "No Run Profile was produced for this run.",
    "",
    "Confirm the Garnet action started Jibril successfully and that the workload ran before this step.",
    "",
    "---",
    `<sub>What happened in this PR — each job's processes and where they reached. · ${expected} job${expected === 1 ? "" : "s"} not yet recorded — [add the step ↗](${input.docsUrl})</sub>`,
  ].join("\n")
}
