/**
 * Garnet Step Summary renderer — the job's full receipt. The Action renders
 * only this surface; the Garnet App posts the PR comment, fork PRs included
 * (through the `garnet-run-*` relay artifact, see ./run-artifact.js).
 *
 * Ported from the reference renderer in garnet-org/runtime-review-testbed,
 * whose `main` is the single reference for the renderer, vocabulary and
 * goldens. CONTRACT_VOCAB is imported from the vendored
 * ./runtime-review-vocab.js.
 *
 * v6.5.0 record model:
 *   - One destination association = one `network.egress.peers[]` item × one
 *     `proc_trees[]` item. A peer with no proc_trees emits one association
 *     with lineage `unknown (not recorded)`.
 *   - The record is egress-centric — it is NOT a process inventory; a
 *     process that made no recorded egress may not appear.
 *   - The evidence model is lossless; the chain table collapses repeated
 *     destination names within a chain, the chains fold keeps every one.
 *   - `arguments`/argv and `executable` paths are embargoed: never captured
 *     into the render model, never emitted on any surface.
 *   - Typography is attribution, not trust: a lineage recorded under a
 *     GitHub step below `Runner.Worker` is bold; runner scaffolding is italic.
 *     A recorded detection always overrides de-emphasis.
 *   - Deterministic factual notes only: `(Cloud IMDS)`, `(github infra)`,
 *     and, behind the `show_detections` opt-in, record-backed
 *     `detection: <kind>` values other than `flow`.
 *   - Counts are mechanical and qualified. Sensor telemetry is preserved
 *     verbatim and never aliased to renderer-derived destinations or flows.
 *   - Timestamps come from `profile.timestamp` only, rendered
 *     `YYYY-MM-DD HH:MM:SS UTC`; the renderer clock never substitutes.
 *   - Medium truncation is a deterministic fair round-robin across jobs in
 *     canonical order, IMDS-touching lineages retained first, with an explicit
 *     `rendered X of Y process lineages` line — never silent.
 *
 * Deterministic by construction: same profile payload in → byte-identical
 * output out.
 */

import { isIP } from "node:net"

import { CONTRACT_VOCAB } from "./runtime-review-vocab.js"

export { CONTRACT_VOCAB }
/**
 * One destination association: one recorded egress peer × one proc_tree.
 * @typedef {{
 *   flow_id: number
 *   tree_index: number
 *   remote_address: string
 *   remote_names: string[]
 *   remote_ports: string[]
 *   protocol: string
 *   result: string
 *   detections: string[]
 *   lineage_recorded: boolean
 *   pid: string
 *   process: string
 *   ancestry: string[]
 *   github_step: string
 *   executable: string
 * }} ReviewEdge
 */
/**
 * @typedef {{
 *   timestamp: string
 *   event: string
 *   remote_peer: string
 *   protocol: string
 *   ports: string
 *   result: string
 * }} AssertionEvidence
 */
/**
 * @typedef {{
 *   class_id: string
 *   id: string
 *   description: string
 *   result: string
 *   evidence: AssertionEvidence[]
 * }} JobAssertion
 */
/**
 * @typedef {{
 *   total_domains: number | null
 *   total_connections: number | null
 * }} JobTelemetry
 */
/**
 * @typedef {{
 *   associations: number
 *   processes: number
 *   destinations: number
 *   primary_names: number
 *   domains: number
 *   flows: number
 * }} EdgeCounts
 */
/**
 * One job's summarized record (the output of `summarizeProfile`).
 * @typedef {{
 *   name: string
 *   workflow: string
 *   repository: string
 *   sha: string
 *   run_id: string
 *   run_url: string
 *   job_url?: string
 *   profile_id: string
 *   uuid: string
 *   timestamp: string
 *   ref: string
 *   pr_url: string
 *   actor: string
 *   run_attempt: string
 *   event_name: string
 *   runner_os: string
 *   runner_arch: string
 *   job_index: string
 *   flow_count: number
 *   telemetry: JobTelemetry
 *   assertions: JobAssertion[]
 *   edges: ReviewEdge[]
 *   counts: EdgeCounts
 * }} JobSummary
 */
/**
 * @typedef {JobSummary & { id: number, job_url: string }} ReviewJob
 */
/**
 * @typedef {{
 *   repo: string
 *   sha: string
 *   commitUrl: string
 *   appUrl: string
 *   appMode: boolean
 *   recordedThrough: string
 *   jobs: ReviewJob[]
 *   counts: { jobs: number, associations: number, destinations: number }
 * }} RunReview
 */
/**
 * Shared-prefix lineage tree node for the comment tree.
 * @typedef {{
 *   name: string
 *   children: TreeNode[]
 *   childByKey: Map<string, TreeNode>
 *   associations: ReviewEdge[]
 *   pids: Set<string>
 *   processes: Set<string>
 *   steps: Set<string>
 *   executables: Set<string>
 * }} TreeNode
 */
/**
 * One lineage-first Step Summary row.
 * @typedef {{ edge: ReviewEdge, associations: ReviewEdge[] }} LineageRow
 */

/** Exact emitted vocabulary — byte-locked by contract/vocab.json. */
export const VOCAB = {
  stepSummaryHeading: CONTRACT_VOCAB.copy.stepSummaryHeading,
  permalinkLabel: CONTRACT_VOCAB.copy.permalinkLabel,
  emptyPeers: CONTRACT_VOCAB.copy.emptyPeers,
  unknownLineage: CONTRACT_VOCAB.copy.unknownLineage,
  terminalNetwork: CONTRACT_VOCAB.copy.terminalNetwork,
}

/** Step Summary hard limit (1 MiB). */
export const STEP_SUMMARY_BUDGET = CONTRACT_VOCAB.mediumLimits.stepSummaryHardLimit

/** Loopback matcher for resolver exclusion (anchored — never a suffix). */
const LOOPBACK_RE = new RegExp(CONTRACT_VOCAB.notes.dnsResolver.loopbackPattern)

/** The standardized cloud IMDS constant — never vendor-specific addresses. */
const IMDS_ADDRESSES = new Set(CONTRACT_VOCAB.notes.instanceMetadata.addresses)

/** Contract-locked GitHub-infrastructure name suffixes — never extended here. */
const GITHUB_INFRA_SUFFIXES = CONTRACT_VOCAB.notes.githubInfrastructure.nameSuffixes

/** Truncated infrastructure suffixes — match only a single label before the suffix. */
const GITHUB_INFRA_TRUNCATED_SUFFIXES = CONTRACT_VOCAB.notes.githubInfrastructure.truncatedSuffixes

/**
 * A recorded name is GitHub infrastructure when it ends with a locked domain
 * suffix, or with a truncated suffix carrying exactly one label before it — a
 * truncated direct child of githubapp.com. Recorded names are
 * workload-influenceable, so deeper names under the non-public truncated
 * suffix never earn the trust cue.
 * @param {string} name
 * @returns {boolean}
 */
export function isGithubInfraName(name) {
  if (GITHUB_INFRA_SUFFIXES.some((/** @type {string} */ suffix) => name.endsWith(suffix))) {
    return true
  }
  return GITHUB_INFRA_TRUNCATED_SUFFIXES.some(
    (/** @type {string} */ suffix) =>
      name.endsWith(suffix) &&
      name.length > suffix.length &&
      !name.slice(0, -suffix.length).includes("."),
  )
}

/** Contract-locked Garnet sensor name suffixes. */
const GARNET_SENSOR_SUFFIXES = CONTRACT_VOCAB.notes.garnetSensor.nameSuffixes

// ---------------------------------------------------------------------------
// Escaping — every record-sourced string is attacker-controlled.
// ---------------------------------------------------------------------------

/**
 * Strip control characters from any record-sourced string: C0/C1 controls,
 * bidi embeddings, overrides and isolates, zero-width characters, the BOM
 * and line/paragraph separators. Each can make a rendered name read as
 * something other than what was recorded.
 * @param {unknown} value
 */
const stripControl = (value) =>
  String(value ?? "").replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]/g, "")

/**
 * Escape a value destined for INSIDE an HTML element. Three-plus backtick
 * runs are neutralized so hostile names can never open a fence even if the
 * surrounding HTML block is interrupted.
 * @param {unknown} value
 */
export const escapeHtml = (value) =>
  stripControl(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/`{3,}/g, (m) => "ʼ".repeat(m.length))
    .replace(/[\r\n]+/g, " ")
    .trim()

/**
 * Escape a value destined for INSIDE an HTML attribute.
 * @param {unknown} value
 */
const escapeHtmlAttr = (value) =>
  stripControl(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/[\r\n]+/g, " ")
    .trim()

/**
 * Escape a value destined for INSIDE a `code span`.
 * @param {unknown} value
 */
const escapeCode = (value) =>
  stripControl(value)
    .replace(/`/g, "ʼ")
    .replace(/[\r\n]+/g, " ")
    .trim()

/**
 * Escape a value destined for INSIDE a `code span` that sits in a table
 * cell: code spans neutralize HTML/Markdown, but `|` still splits cells and
 * must be backslash-escaped at the GFM table layer.
 * @param {unknown} value
 */
const escapeCodeCell = (value) => escapeCode(value).replaceAll("|", "\\|")

/**
 * Escape a value destined for HTML inside a GFM table cell. GitHub still parses
 * Markdown inside inline HTML such as `<code>`, so recorded names would
 * otherwise render links, emphasis, autolinks, and @mentions.
 * @param {unknown} value
 */
const escapeHtmlCell = (value) => neutralizeInlineMarkdown(escapeHtml(value)).replaceAll("|", "\\|")

/**
 * Replaces Markdown-active punctuation with numeric entities. Run it after HTML
 * escaping so the entities are not themselves escaped.
 * @param {string} value
 */
function neutralizeInlineMarkdown(value) {
  return value
    .replace(/[\\`*_~\[\]:@]/g, (character) => `&#${character.charCodeAt(0)};`)
    .replaceAll("www.", "www&#46;")
}

/**
 * Bound a captured (attacker-controllable) label to `max` chars with a
 * middle ellipsis, preserving head+tail so it stays identifiable while a
 * crafted payload buried mid-string cannot survive or inflate token cost.
 * Full untruncated values remain in the Execution Profile / API.
 * @param {unknown} value
 * @param {number} [max]
 */
export const truncateMiddle = (value, max = 64) => {
  const v = String(value ?? "")
  if (v.length <= max) return v
  const head = Math.ceil((max - 1) / 2)
  const tail = Math.floor((max - 1) / 2)
  return `${v.slice(0, head)}…${v.slice(v.length - tail)}`
}

/**
 * Escape a value destined for a markdown table cell.
 * @param {unknown} value
 */
export function escapeMarkdownCell(value) {
  const html = stripControl(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  return neutralizeInlineMarkdown(html)
    .replaceAll("|", "\\|")
    .replace(/[\r\n]+/g, " ")
}

// ---------------------------------------------------------------------------
// Record model.
// ---------------------------------------------------------------------------

/**
 * True for IPv4/IPv6/address literals — an address-like name is not a domain.
 * @param {unknown} value
 */
export function isAddressLike(value) {
  const v = String(value).trim().replace(/^\[|\]$/g, "")
  return isIP(v.split("%", 1)[0] ?? "") !== 0
}

/**
 * Deterministic timestamp formatting: `YYYY-MM-DD HH:MM:SS UTC` from
 * `profile.timestamp` only. Invalid/missing input → "" (never the renderer
 * clock).
 * @param {unknown} value
 */
export function formatTimestamp(value) {
  const raw = String(value ?? "").trim()
  if (raw === "") return ""
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (/** @type {number} */ n) => String(n).padStart(2, "0")
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`
}

/**
 * Numeric port from a recorded remote_ports value (handles `53 (dns)`).
 * @param {unknown} value
 */
const numericPort = (value) => {
  const m = /^\s*(\d+)/.exec(String(value))
  return m ? Number(m[1]) : null
}

/**
 * Deterministic factual notes for one association:
 *   - dns-resolver note — retired by the contract (empty text); loopback
 *     remote_address AND a remote_ports value with numeric port 53.
 *   - `Cloud IMDS` — remote_address is exactly the standardized IMDS
 *     addresses.
 *   - `github infra` — the primary recorded remote name ends with a
 *     contract-locked GitHub infrastructure suffix.
 *   - `garnet sensor` — the primary recorded remote name is `garnet.ai` or
 *     ends with `.garnet.ai`.
 *   - `detection: <kind>` — every non-empty recorded detection except `flow`,
 *     only when the caller opts in (the `show_detections` input).
 * @param {ReviewEdge} edge
 * @param {{ detections?: boolean }} [options]
 */
export function edgeNotes(edge, { detections = false } = {}) {
  /** @type {string[]} */
  const notes = []
  if (IMDS_ADDRESSES.has(edge.remote_address)) {
    notes.push(CONTRACT_VOCAB.notes.instanceMetadata.text)
  }
  const primaryName = canonicalRecordedName(edge.remote_names ?? [])
  if (isGithubInfraName(primaryName)) {
    notes.push(CONTRACT_VOCAB.notes.githubInfrastructure.text)
  }
  if (
    primaryName === "garnet.ai" ||
    GARNET_SENSOR_SUFFIXES.some((/** @type {string} */ s) => primaryName.endsWith(s))
  ) {
    notes.push(CONTRACT_VOCAB.notes.garnetSensor.text)
  }
  if (!detections) return notes
  for (const detection of (edge.detections || [])
    .filter((value) => value !== "" && value.toLowerCase() !== "flow")
    .sort()) {
    notes.push(`detection: ${detection}`)
  }
  return notes
}

/**
 * Expand one recorded peer into its edges (one per proc_tree; a peer with no
 * proc_trees emits one edge with unrecorded lineage). Preserves every
 * contract field verbatim; never captures `arguments`. The recorded
 * `executable` path is kept for the ran-from provenance note only — its
 * directory may render, the full path never does.
 * @param {Record<string, any>} peer
 * @param {number} flowID
 * @returns {ReviewEdge[]}
 */
function peerEdges(peer, flowID) {
  // Record-faithful: recorded empty strings are preserved, never silently
  // filtered (projections skip empties at render time; counts exclude them).
  const remote_names = (Array.isArray(peer?.remote_names) ? peer.remote_names : []).map((n) =>
    String(n ?? ""),
  )
  const remote_address = String(peer?.remote_address ?? "")
  const remote_ports = (
    Array.isArray(peer?.remote_ports) ? peer.remote_ports : []
  ).map(String)
  const protocol = String(peer?.protocol ?? "")
  const result = String(peer?.result ?? "")
  const rawDetections = Array.isArray(peer?.detections)
    ? peer.detections
    : Array.isArray(peer?.Detections)
      ? peer.Detections
      : []
  const detections = rawDetections.map((value) => String(value ?? ""))
  const trees = Array.isArray(peer?.proc_trees) && peer.proc_trees.length > 0
    ? peer.proc_trees
    : [null]
  return trees.map((/** @type {Record<string, any> | null} */ tree, treeIndex) => ({
    flow_id: flowID,
    tree_index: treeIndex,
    remote_address,
    remote_names,
    remote_ports,
    protocol,
    result,
    detections,
    lineage_recorded: tree !== null,
    pid: tree && tree.pid !== undefined && tree.pid !== null ? String(tree.pid) : "",
    process: tree ? String(tree.process ?? "") : "",
    ancestry: tree ? (Array.isArray(tree.ancestry) ? tree.ancestry : []).map((/** @type {unknown} */ a) => String(a ?? "")) : [],
    github_step: tree ? String(tree.github_step ?? "") : "",
    executable: tree ? String(tree.executable ?? "") : "",
  }))
}

/**
 * Display lineage for one edge (raw, unescaped).
 * @param {ReviewEdge} edge
 */
export function edgeLineage(edge) {
  if (!edge.lineage_recorded) return VOCAB.unknownLineage
  if (edge.ancestry.length > 0) return edge.ancestry.join(" › ")
  return edge.process || VOCAB.unknownLineage
}

/**
 * Canonical deterministic edge order: lineage, remote address,
 * ports/protocol, PID.
 * @param {ReviewEdge} a
 * @param {ReviewEdge} b
 */
export function edgeComparator(a, b) {
  const keyA = [
    edgeLineage(a),
    a.remote_address,
    a.remote_ports.join(","),
    a.protocol,
    a.pid,
    a.flow_id,
    a.tree_index,
  ]
  const keyB = [
    edgeLineage(b),
    b.remote_address,
    b.remote_ports.join(","),
    b.protocol,
    b.pid,
    b.flow_id,
    b.tree_index,
  ]
  for (let i = 0; i < keyA.length; i += 1) {
    const va = keyA[i] ?? ""
    const vb = keyB[i] ?? ""
    if (va < vb) return -1
    if (va > vb) return 1
  }
  return 0
}

/**
 * The pull request a recorded run is associated with, derived from the
 * recorded ref (`refs/pull/<N>/...`). Push and other non-PR runs return ""
 * — fail-closed, nothing fabricated.
 * @param {Record<string, any>} github
 */
export function pullRequestURL(github) {
  const match = /^refs\/pull\/(\d+)\//.exec(String(github.ref || ""))
  const repository = safeRepositorySlug(github.repository)
  if (match === null || repository === "") return ""
  const server = safeServerURL(github.server_url)
  if (server === "") return ""
  return `${server}/${repository}/pull/${match[1]}`
}

// Record-derived values that land in Markdown/HTML link targets are
// untrusted input: a forged profile could carry markup-breaking or
// javascript: values. These normalizers fail closed to "" (the renderers
// already degrade to unlinked text on empty URLs).

/**
 * A GitHub `owner/name` slug restricted to the characters GitHub allows;
 * anything else returns "".
 * @param {unknown} value
 * @returns {string}
 */
export function safeRepositorySlug(value) {
  const repository = String(value || "")
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) ? repository : ""
}

/**
 * A server base URL that parses as http(s) with no path, query, fragment,
 * or credentials; anything else falls back to "".
 * @param {unknown} value
 * @returns {string}
 */
export function safeServerURL(value) {
  const raw = String(value || "https://github.com").replace(/\/+$/, "")
  let parsed
  try {
    parsed = new URL(raw)
  } catch (_) {
    return ""
  }
  const isHTTP = parsed.protocol === "https:" || parsed.protocol === "http:"
  const isBare =
    parsed.pathname === "/" &&
    parsed.search === "" &&
    parsed.hash === "" &&
    parsed.username === "" &&
    parsed.password === ""
  return isHTTP && isBare ? raw : ""
}

/**
 * The run URL derived from validated record fields; "" when any part is
 * untrusted or missing.
 * @param {Record<string, any>} github
 * @returns {string}
 */
function buildRunURL(github) {
  const repository = safeRepositorySlug(github.repository)
  const server = safeServerURL(github.server_url)
  const runID = String(github.run_id || "")
  if (repository === "" || server === "" || !/^\d+$/.test(runID)) return ""
  return `${server}/${repository}/actions/runs/${runID}`
}

/**
 * An absolute http(s) URL for use as a link target; anything else
 * (including javascript: and data: schemes) returns "".
 * @param {unknown} value
 * @returns {string}
 */
export function safeHTTPURL(value) {
  const raw = String(value || "")
  if (raw === "") return ""
  let parsed
  try {
    parsed = new URL(raw)
  } catch (_) {
    return ""
  }
  return parsed.protocol === "https:" || parsed.protocol === "http:" ? raw : ""
}

/**
 * Collapse one raw Jibril profile (format 0.2.0) into a job record with its
 * destination associations and mechanical counts.
 * @param {unknown} profile
 * @returns {JobSummary | null}
 */
export function summarizeProfile(profile) {
  if (!profile || typeof profile !== "object") return null
  const envelope = /** @type {Record<string, any>} */ (profile)
  const p =
    envelope.data && typeof envelope.data === "object"
      ? /** @type {Record<string, any>} */ (envelope.data)
      : envelope
  const github = p?.scenarios?.github || p?.github || {}

  /** @type {Record<string, any>[]} */
  const peers = Array.isArray(p?.network?.egress?.peers) ? p.network.egress.peers : []
  const edges = peers.flatMap((peer, index) => peerEdges(peer, index)).sort(edgeComparator)
  const egressTelemetry = p?.telemetry?.network?.egress || {}
  /** @type {JobAssertion[]} */
  const assertions = (Array.isArray(p?.assertions) ? p.assertions : []).map((/** @type {Record<string, any>} */ assertion) => ({
    class_id: String(assertion?.class_id || assertion?.ClassId || ""),
    id: String(assertion?.assertion_id || assertion?.id || ""),
    description: String(assertion?.description || ""),
    result: String(assertion?.result || ""),
    evidence: (Array.isArray(assertion?.evidence) ? assertion.evidence : []).map(
      (/** @type {Record<string, unknown>} */ evidence) => ({
        timestamp: evidenceValue(evidence, ["timestamp", "time", "created_at"]),
        event: evidenceValue(evidence, ["event", "event_type", "kind", "detection"]),
        remote_peer: evidenceValue(evidence, [
          "remote_peer",
          "remote_name",
          "remote_address",
          "peer",
        ]),
        protocol: evidenceValue(evidence, ["protocol"]),
        ports: evidenceValue(evidence, ["ports", "remote_ports", "port"]),
        result: evidenceValue(evidence, ["result"]),
      }),
    ),
  }))

  return {
    name: String(github.job || ""),
    workflow: String(github.workflow || ""),
    repository: safeRepositorySlug(github.repository),
    sha: String(github.sha || ""),
    run_id: String(github.run_id || ""),
    run_url: buildRunURL(github),
    profile_id: String(envelope.id || envelope.profile_id || ""),
    uuid: String(p?.uuid || ""),
    timestamp: String(p?.timestamp || ""),
    ref: String(github.ref || ""),
    pr_url: pullRequestURL(github),
    actor: String(github.triggering_actor || github.actor || ""),
    run_attempt: String(github.run_attempt || ""),
    event_name: String(github.event_name || ""),
    runner_os: String(github.runner_os || ""),
    runner_arch: String(github.runner_arch || ""),
    job_index:
      github.job_index !== undefined && github.job_index !== null
        ? String(github.job_index)
        : "",
    flow_count: peers.length,
    telemetry: {
      total_domains:
        typeof egressTelemetry.total_domains === "number"
          ? egressTelemetry.total_domains
          : null,
      total_connections:
        typeof egressTelemetry.total_connections === "number"
          ? egressTelemetry.total_connections
          : null,
    },
    assertions,
    edges,
    counts: edgeCounts(edges, peers.length),
  }
}

/**
 * Mechanical v6.4 structural counts over destination associations:
 *   - associations = Σ peers max(1, len(proc_trees));
 *   - recorded processes = distinct recorded lineage + PID identities;
 *   - destinations = distinct non-empty remote_address values;
 *   - observed domain names = distinct non-address-like first remote_names;
 *   - flows = raw peers length.
 * Secondary names are annotations, never extra identities.
 * @param {ReviewEdge[]} edges
 * @param {number} [flowCount]
 * @returns {EdgeCounts}
 */
export function edgeCounts(edges, flowCount) {
  const processes = new Set()
  const destinations = new Set()
  const primaryNames = new Set()
  const domains = new Set()
  const flowIds = new Set()
  for (const e of edges) {
    if (e.lineage_recorded) {
      processes.add(
        JSON.stringify([e.pid, e.process, e.ancestry]),
      )
    }
    if (e.remote_address !== "") destinations.add(e.remote_address)
    const primaryName = canonicalRecordedName(e.remote_names)
    if (primaryName !== "") primaryNames.add(primaryName)
    if (primaryName !== "" && !isAddressLike(primaryName)) domains.add(primaryName)
    if (e.flow_id !== undefined && e.flow_id !== null) flowIds.add(e.flow_id)
  }
  return {
    associations: edges.length,
    processes: processes.size,
    destinations: destinations.size,
    primary_names: primaryNames.size,
    domains: domains.size,
    flows: flowCount !== undefined && Number.isInteger(flowCount) ? flowCount : flowIds.size || edges.length,
  }
}

/**
 * A loosely-typed incoming job record accepted by `buildRunReview`.
 * @typedef {Record<string, any>} JobRecordInput
 */

/**
 * Build the review model from job records.
 * @param {{repo?: string, sha?: string, commitUrl?: string, appUrl?: string,
 *          appMode?: boolean, jobs: (JobRecordInput | null | undefined)[]}} input
 * @returns {RunReview}
 */
export function buildRunReview(input) {
  /** @type {ReviewJob[]} */
  const jobs = (input.jobs || [])
    .filter((j) => j !== null && j !== undefined)
    .map((j, i) => ({
      id: i,
      name: String(j.name || ""),
      workflow: String(j.workflow || ""),
      run_id: String(j.run_id || ""),
      run_url: safeHTTPURL(j.run_url),
      job_url: safeHTTPURL(j.job_url),
      profile_id: String(j.profile_id || ""),
      uuid: String(j.uuid || ""),
      timestamp: String(j.timestamp || ""),
      repository: String(j.repository || ""),
      sha: String(j.sha || ""),
      ref: String(j.ref || ""),
      pr_url: String(j.pr_url || ""),
      actor: String(j.actor || ""),
      run_attempt: String(j.run_attempt || ""),
      event_name: String(j.event_name || ""),
      runner_os: String(j.runner_os || ""),
      runner_arch: String(j.runner_arch || ""),
      job_index: String(j.job_index || ""),
      flow_count: Number(j.flow_count || 0),
      telemetry: {
        total_domains:
          typeof j.telemetry?.total_domains === "number"
            ? j.telemetry.total_domains
            : null,
        total_connections:
          typeof j.telemetry?.total_connections === "number"
            ? j.telemetry.total_connections
            : null,
      },
      assertions: Array.isArray(j.assertions) ? j.assertions : [],
      edges: (j.edges || []).filter((/** @type {ReviewEdge} */ edge) => !isLoopbackResolver(edge)).sort(edgeComparator),
    }))
    .map((j) => ({ ...j, counts: edgeCounts(j.edges, j.flow_count) }))
    // Canonical job order: alphabetic by `workflow / job`.
    .sort((a, b) => {
      const ka = [
        a.workflow,
        a.name,
        a.run_id,
        a.job_index,
        a.profile_id,
        a.uuid,
        a.timestamp,
      ].join("\u0000")
      const kb = [
        b.workflow,
        b.name,
        b.run_id,
        b.job_index,
        b.profile_id,
        b.uuid,
        b.timestamp,
      ].join("\u0000")
      return ka < kb ? -1 : ka > kb ? 1 : 0
    })

  // `recorded through <max valid profile.timestamp>` — sensor time only.
  const stamps = jobs.map((j) => formatTimestamp(j.timestamp)).filter((s) => s !== "")
  const recordedThrough = stamps.length > 0 ? (stamps.sort()[stamps.length - 1] ?? "") : ""

  const destinationUnion = new Set()
  for (const j of jobs) {
    for (const e of j.edges) {
      if (e.remote_address !== "") destinationUnion.add(e.remote_address)
    }
  }

  const review = {
    repo: String(input.repo || ""),
    sha: String(input.sha || ""),
    commitUrl: String(input.commitUrl || ""),
    appUrl: String(input.appUrl || "https://app.garnet.ai").replace(/\/+$/, ""),
    appMode: input.appMode !== false,
    recordedThrough,
    jobs,
    counts: {
      jobs: jobs.length,
      associations: jobs.reduce((n, j) => n + j.counts.associations, 0),
      destinations: destinationUnion.size,
    },
  }

  return review
}

// ---------------------------------------------------------------------------
// Public Execution Profile — selector and publication policy (contract data; the
// page is served by the Garnet app, this repo locks the policy + URLs).
// ---------------------------------------------------------------------------

/**
 * Exact profile selector URL: `/public/runs/{run_id}?profile=<profile_id>`.
 * `profile_id` is the control-plane envelope ID, not the raw record UUID.
 * @param {{run_id?: string, profile_id?: string}} job
 * @param {string} appUrl
 * @param {string} utmMedium
 */
export function profilePermalink(job, appUrl, utmMedium) {
  if (!job.run_id || !job.profile_id || !appUrl) return ""
  return `${appUrl}/public/runs/${encodeURIComponent(String(job.run_id))}?profile=${encodeURIComponent(String(job.profile_id))}&utm_source=github&utm_medium=${utmMedium}`
}

/**
 * Format one note: structural notes are parenthetical; detections are not.
 * @param {string} note
 */
const renderNote = (note) =>
  note.startsWith("detection: ") ? escapeHtml(note) : `<em>(${escapeHtml(note)})</em>`

/**
 * Defang a hostname for the PR-comment surface: bracket the final dot
 * (`example[.]com`) so an untrusted recorded destination can never autolink
 * in GitHub comments or the emails/Slack mirrors that relay them. Address
 * literals are left verbatim (they do not autolink); the Step Summary,
 * review model, and public report keep the canonical value.
 * @param {unknown} value
 */
export function defangHostname(value) {
  const v = String(value ?? "")
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v)) return v.replace(/\.(?=[^.]*$)/, "[.]")
  if (v === "" || isAddressLike(v) || !v.includes(".")) return v
  return v.replace(/\.(?=[^.]*$)/, "[.]")
}

/**
 * Preview-only destination display: canonical name, address, ports/protocol,
 * and secondary-name annotations from the record (sorted — capture order of
 * `remote_names` never changes bytes).
 * @param {ReviewEdge} edge
 * @param {(value: unknown) => string} escape
 */
function destinationDisplay(edge, escape) {
  const primary = edgePrimaryDestination(edge)
  const parts = [escape(primary)]
  if (
    edge.remote_address !== "" &&
    edge.remote_address !== primary
  ) {
    parts.push(`[${escape(edge.remote_address)}]`)
  }
  if (edge.remote_ports.length > 0) {
    parts.push(`:${edge.remote_ports.map(escape).join(", ")}`)
  }
  if (edge.protocol !== "") parts.push(escape(edge.protocol))
  const secondaryNames = [
    ...new Set(
      edge.remote_names.filter(
        (name) => name !== "" && name !== primary && name !== edge.remote_address,
      ),
    ),
  ].sort()
  if (secondaryNames.length > 0) {
    parts.push(`· also recorded: ${secondaryNames.map(escape).join(", ")}`)
  }
  return parts.join(" ")
}

/**
 * Recorded ancestry path as process nodes; empty rungs do not render.
 * @param {ReviewEdge} edge
 * @returns {string[]}
 */
function edgeProcessPath(edge) {
  if (!edge.lineage_recorded) return [VOCAB.unknownLineage]
  const ancestry = (edge.ancestry || []).filter((part) => part !== "")
  if (ancestry.length > 0) return ancestry
  return [edge.process || VOCAB.unknownLineage]
}

/**
 * The canonical recorded name for a set of `remote_names`: the first
 * non-empty non-address-like value in record order (the record lists the
 * queried hostname first; an address-like name never outranks a real
 * hostname), else the first non-empty value.
 * @param {string[]} names
 */
function canonicalRecordedName(names) {
  let fallback = ""
  for (const value of names) {
    if (value === "") continue
    if (!isAddressLike(value)) return value
    if (fallback === "") fallback = value
  }
  return fallback
}

/**
 * The canonical destination identity for one edge (undefanged).
 * @param {ReviewEdge} edge
 */
function edgePrimaryDestination(edge) {
  return (
    canonicalRecordedName(edge.remote_names) ||
    edge.remote_address ||
    "(no destination recorded)"
  )
}

/**
 * Normalize a destination identity with names learned from both sides of a
 * comparison. A bare address therefore joins the named identity recorded by
 * its counterpart.
 * @param {ReviewEdge} edge
 * @param {Map<string, string>} [addressNames]
 */
export function destinationIdentity(edge, addressNames = new Map()) {
  const primary = edgePrimaryDestination(edge)
  if (edge.remote_names.some((name) => name !== "")) return primary
  return addressNames.get(edge.remote_address) || primary
}

/**
 * Address→name map learned across one or more edge sets.
 * @param {...ReviewEdge[]} edgeSets
 * @returns {Map<string, string>}
 */
export function addressNameMap(...edgeSets) {
  /** @type {Map<string, string>} */
  const names = new Map()
  for (const edges of edgeSets) {
    for (const edge of edges) {
      if (edge.remote_address === "") continue
      const name = canonicalRecordedName(edge.remote_names)
      if (name === "") continue
      const current = names.get(edge.remote_address)
      if (current === undefined || (isAddressLike(current) && !isAddressLike(name))) {
        names.set(edge.remote_address, name)
      }
    }
  }
  return names
}

/**
 * Compare normalized destination identities.
 * @param {ReviewEdge} a
 * @param {ReviewEdge} b
 * @param {Map<string, string>} names
 */
function compareDestinationIdentities(a, b, names) {
  const identityA = destinationIdentity(a, names)
  const identityB = destinationIdentity(b, names)
  if (identityA < identityB) return -1
  if (identityA > identityB) return 1
  return 0
}

/**
 * Deterministic executable-location provenance: when a recorded executable
 * path sits under a user-writable temp directory, the process line carries
 * `(ran from <dir>/…)` — the recorded directory only, never the full path.
 * @param {Set<string>} executables
 */
export function ranFromNote(executables) {
  const provenance = CONTRACT_VOCAB.notes.executableProvenance
  for (const executable of [...executables].sort()) {
    if (!provenance.tempDirPrefixes.some((/** @type {string} */ prefix) => executable.startsWith(prefix))) continue
    const dir = executable.slice(0, executable.lastIndexOf("/"))
    if (dir === "") continue
    return `${provenance.text} ${dir}/…`
  }
  return ""
}
/**
 * One parsed published block: its text, family, and the shift/value pair the
 * prefix match compares.
 * @typedef {{ cidr: string, v6: boolean, shift: bigint, value: bigint }} MetaBlock
 */

/**
 * A count with its inflected unit, glued with `&nbsp;` so `11 chains` never
 * wraps between the number and the word on narrow screens.
 * @param {number} n
 * @param {string} unit
 */
function countPhrase(n, unit) {
  return `${n}&nbsp;${unit}${n === 1 ? "" : "s"}`
}

/**
 * The step annotation renders only the part of a recorded step name that
 * reliably means something to a reader: the step's own text, quoted. The
 * runner's ordinal prefix is presentation noise, an unexpanded workflow
 * expression (`${{ matrix.job_name }}`) is template syntax rather than a
 * name, and the `NN. Runner Processes` sentinel is not a workflow step at
 * all. When nothing reliable survives, no annotation renders — the record,
 * model, and Step Summary keep the raw name either way, and the annotation
 * is decoration, so dropping it changes no structure, count, or comparison.
 * @param {string} name
 */
export function stepAnnotationName(name) {
  if (isSentinelStep(name)) return ""
  const stripped = name
    .replace(/^\d+\.\s+/, "")
    .replace(/\s*\(\s*\$\{\{[^}]*\}\}\s*\)/g, "")
    .replace(/\$\{\{[^}]*\}\}/g, "")
    .replace(/\(\s*\)/g, "")
    .trim()
  return /\$\{\{/.test(stripped) ? "" : stripped
}

/** Recorded step names carry the runner's ordinal prefix (`4. Run workload`);
 * the ordinal is presentation noise — stripped for display only, like
 * displayProcessName. The record, model, and Step Summary keep the raw name.
 * @param {string} name */
function displayStepName(name) {
  // Unexpanded workflow expressions (`${{ matrix.job_name }}`) are recorded
  // verbatim in unnamed steps — template syntax, not a name; display drops
  // them (with an empty enclosing `()`), the record and model keep the raw.
  const stripped = name
    .replace(/^\d+\.\s+/, "")
    .replace(/\s*\(\s*\$\{\{[^}]*\}\}\s*\)/g, "")
    .replace(/\$\{\{[^}]*\}\}/g, "")
    .trim()
  return stripped === "" ? name : stripped
}

/**
 * Jibril attributes runner-infrastructure chains to a sentinel step named
 * `NN. Runner Processes`. It is not a workflow step, so no surface may
 * present it as step attribution.
 * @param {string} name
 */
export function isSentinelStep(name) {
  return displayStepName(name) === "Runner Processes"
}
/**
 * @typedef {{
 *   explainerOpen?: boolean
 *   budget?: number
 * }} RenderRunReviewOptions
 */
/**
 * One destination-first Step Summary row (one source peer).
 * @typedef {{
 *   flow_id: number
 *   remote_address: string
 *   remote_names: string[]
 *   associations: ReviewEdge[]
 * }} DestinationRow
 */

/**
 * Screenshot-style compact ancestry: first node, ellipsis, final three nodes.
 * @param {ReviewEdge} edge
 * @returns {string[]}
 */
function compactStepSummaryAncestry(edge) {
  if (!edge.lineage_recorded) return [VOCAB.unknownLineage]
  const names = (edge.ancestry || []).filter((name) => name !== "")
  const chain = names.length > 0 ? names.slice() : []
  if (edge.process !== "" && chain[chain.length - 1] !== edge.process) {
    chain.push(edge.process)
  }
  if (chain.length === 0) chain.push(VOCAB.unknownLineage)
  if (chain.length <= 4) return chain
  return [chain[0] ?? "", "…", ...chain.slice(-3)]
}

/**
 * Renders one recorded chain as a `→`-joined run of code spans. With
 * `pidAsFootnote`, the leaf's PID renders as a small `<sub>` note in the
 * same cell instead of an inline `(pid …)` suffix; every recorded PID
 * stays visible in its own row.
 * @param {ReviewEdge} edge
 * @param {boolean} [pidAsFootnote]
 */
function processTreeCell(edge, pidAsFootnote) {
  const names = compactStepSummaryAncestry(edge)
  const chain = names
    .map((name, index) => {
      const leaf = index === names.length - 1
      if (leaf && edge.pid !== "" && pidAsFootnote !== true) {
        return `<code>${escapeHtmlCell(`${truncateMiddle(name)} (pid ${edge.pid})`)}</code>`
      }
      return `<code>${escapeHtmlCell(truncateMiddle(name))}</code>`
    })
    .join(" → ")
  if (pidAsFootnote === true && edge.pid !== "") {
    return `${chain} <sub>pid&nbsp;${escapeHtmlCell(edge.pid)}</sub>`
  }
  return chain
}

/**
 * Lineage-first Step Summary projection: one row per recorded process lineage,
 * deduped by lineage + PID + process + ancestry, with every recorded
 * destination for that lineage nested and identical destinations collapsed.
 * Telemetry counts are unaffected — they pass through from the sensor/profile,
 * not from these rows (see `buildDestinationRows` for the lossless peer view).
 * @param {ReviewEdge[]} edges
 * @returns {LineageRow[]}
 */
export function buildLineageRows(edges) {
  /** @type {LineageRow[]} */
  const rows = []
  /** @type {Map<string, LineageRow>} */
  const byKey = new Map()
  for (const edge of edges) {
    const key = JSON.stringify([
      edge.lineage_recorded,
      edge.pid,
      edge.process,
      edge.ancestry,
    ])
    let row = byKey.get(key)
    if (!row) {
      row = { edge, associations: [] }
      byKey.set(key, row)
      rows.push(row)
    }
    row.associations.push(edge)
  }
  return rows
}

/**
 * @param {ReviewEdge} edge
 */
function edgeDestinationLabel(edge) {
  const primary = edge.remote_names.find((name) => name !== "")
  return primary || edge.remote_address || "(no destination recorded)"
}

/**
 * Destinations cell: one deduped domain-first line per recorded destination.
 * @param {LineageRow} row
 */
function lineageDestinationsCell(row) {
  const seen = new Set()
  /** @type {string[]} */
  const labels = []
  for (const edge of row.associations) {
    const label = edgeDestinationLabel(edge)
    if (seen.has(label)) continue
    seen.add(label)
    labels.push(label)
  }
  // Stacked destinations each start with a marker glued to the label by a
  // non-breaking space: it anchors every item without implying an order the
  // record never captured (ordinals would), and the glue keeps the glyph
  // from orphaning onto its own line at phone width. A single destination
  // renders bare — a marker of one is noise.
  if (labels.length === 1) return `<code>${escapeHtmlCell(truncateMiddle(defangHostname(labels[0])))}</code>`
  return labels
    .map((label) => `· <code>${escapeHtmlCell(truncateMiddle(defangHostname(label)))}</code>`)
    .join("<br>")
}

/**
 * GitHub-native lineage-first table: one recorded process lineage per row with
 * its deduped destinations nested. The row's PID renders as a small footnote
 * in the same cell, so the tree reads names-only while every recorded PID
 * stays visible next to its own chain.
 * @param {LineageRow[]} rows
 */
function renderLineageTable(rows) {
  const lines = ["| Execution chain | Destinations |", "| --- | --- |"]
  for (const row of rows) {
    const step = stepAnnotationName(row.edge.github_step)
    const context = step === "" ? "" : `<br><sub>step: <code>${escapeHtmlCell(truncateMiddle(step))}</code></sub>`
    lines.push(`| ${processTreeCell(row.edge, true)}${context} | ${lineageDestinationsCell(row)} |`)
  }
  return lines.join("\n")
}

/**
 * Lineage-row retention: rows touching IMDS are kept first, then the rest.
 * @param {LineageRow[]} rows
 */
function lineageRetentionOrder(rows) {
  /** @type {LineageRow[]} */
  const imds = []
  /** @type {LineageRow[]} */
  const rest = []
  for (const row of rows) {
    const isImds = row.associations.some((edge) =>
      IMDS_ADDRESSES.has(edge.remote_address),
    )
    ;(isImds ? imds : rest).push(row)
  }
  return [...imds, ...rest]
}

/**
 * @param {ReviewEdge[]} edges
 * @param {boolean} detections
 */
function renderRecordedContextPreview(edges, detections) {
  if (edges.length === 0) return ""
  const lines = [
    "<details><summary><strong>Recorded context preview</strong></summary>",
    "",
    "| Destination | Process Tree | Context |",
    "| --- | --- | --- |",
  ]
  for (const edge of edges) {
    /** @type {string[]} */
    const context = []
    if (edge.github_step !== "") context.push(`step: ${escapeMarkdownCell(edge.github_step)}`)
    context.push(
      ...edgeNotes(edge, { detections }).map((note) =>
        note.startsWith("detection: ")
          ? `\`${escapeCodeCell(note)}\``
          : `(${escapeMarkdownCell(note)})`,
      ),
    )
    if (edge.result.toLowerCase() === "attention") context.push("attention")
    lines.push(
      `| <code>${destinationDisplay(edge, escapeHtmlCell)}</code> | ${processTreeCell(edge)} | ${context.join(" · ") || "—"} |`,
    )
  }
  lines.push("", "</details>")
  return lines.join("\n")
}

/**
 * Flexible record-backed evidence projection; never synthesizes evidence.
 * @param {Record<string, unknown> | null | undefined} evidence
 * @param {string[]} keys
 * @returns {string}
 */
function evidenceValue(evidence, keys) {
  for (const key of keys) {
    if (evidence?.[key] !== undefined && evidence?.[key] !== null) {
      const value = evidence[key]
      return Array.isArray(value) ? value.map(String).join(", ") : String(value)
    }
  }
  return ""
}

/**
 * @param {JobAssertion[]} assertions
 */
function renderAssertionPreview(assertions) {
  if (assertions.length === 0) {
    return [
      "<details><summary><strong>Assertions</strong></summary>",
      "",
      "No assertions recorded.",
      "",
      "</details>",
    ].join("\n")
  }

  const lines = [
    "<details><summary><strong>Assertions</strong></summary>",
    "",
    "| Check | Result | Context |",
    "| --- | --- | --- |",
  ]
  for (const assertion of assertions) {
    const check = assertion.description || assertion.id || "—"
    const context = [assertion.class_id, assertion.id].filter(Boolean).join(" · ") || "—"
    lines.push(
      `| ${escapeMarkdownCell(check)} | \`${escapeCodeCell(assertion.result || "unknown")}\` | ${escapeMarkdownCell(context)} |`,
    )
  }

  const evidenceRows = assertions.flatMap((assertion) =>
    assertion.evidence.map((evidence) => [
      assertion.id || assertion.description || "—",
      evidenceValue(evidence, ["timestamp", "time", "created_at"]) || "—",
      evidenceValue(evidence, ["event", "event_type", "kind", "detection"]) || "—",
      evidenceValue(evidence, ["remote_peer", "remote_name", "remote_address", "peer"]) || "—",
      evidenceValue(evidence, ["protocol"]) || "—",
      evidenceValue(evidence, ["ports", "remote_ports", "port"]) || "—",
      evidenceValue(evidence, ["result"]) || assertion.result || "—",
    ]),
  )
  if (evidenceRows.length > 0) {
    lines.push("")
    lines.push("| Assertion | Timestamp | Event | Remote Peer | Protocol | Ports | Result |")
    lines.push("| --- | --- | --- | --- | --- | --- | --- |")
    for (const row of evidenceRows) {
      lines.push(`| ${row.map(escapeMarkdownCell).join(" | ")} |`)
    }
  }
  lines.push("", "</details>")
  return lines.join("\n")
}

/**
 * Render one profile's Runtime Summary section with `keptEdges` retained
 * (Infinity = all).
 * @param {ReviewJob} job
 * @param {string} appUrl
 */
function renderStepSummaryFooter(job, appUrl) {
  // Identity and the recording timestamp live in the workload context; the
  // footer carries only the product path.
  const lines = ['<div align="right">']
  const link = profilePermalink(job, appUrl, "step_summary")
  const cta =
    link === ""
      ? "<strong>Powered by Garnet</strong>"
      : `<a href="${escapeHtmlAttr(link)}">${VOCAB.permalinkLabel}</a>`
  // The CTA is the last element: GitHub prints its own "Job summary generated
  // at run-time" line under every job summary.
  lines.push(cta, "</div>")
  return lines.join("\n")
}

/**
 * Post-step facts about the recording that the profile itself does not
 * carry, already phrased for display. An empty field renders no row.
 * @typedef {{
 *   sensor: string
 *   capture: string
 *   sensorIntegrity: string
 *   sensorAuthenticity: string
 *   steps: string
 *   jobTotal?: string
 * }} StepSummaryContext
 */

/**
 * @typedef {{
 *   previewAssertions: boolean
 *   detections: boolean
 *   context: StepSummaryContext | null
 * }} ProfileSummaryOptions
 */

/**
 * A chain belongs to the workload when it descends through `Runner.Worker`,
 * carries a real recorded step, or has no recorded lineage (an unprovable
 * chain is never quieted into the runner); everything else is the runner.
 * @param {ReviewEdge} edge
 */
function isWorkloadEdge(edge) {
  if (!edge.lineage_recorded) return true
  if (edgeProcessPath(edge).includes("Runner.Worker")) return true
  return stepAnnotationName(edge.github_step) !== ""
}

/**
 * `3 execution chains · 5 destinations · 7 destination associations`
 * for one side of the workload/runner split.
 * @param {ReviewEdge[]} edges
 */
function activityCell(edges) {
  if (edges.length === 0) return "none recorded"
  return [
    countPhrase(buildLineageRows(edges).length, "execution chain"),
    countPhrase(edgeCounts(edges).destinations, "destination"),
    countPhrase(edges.length, "destination association"),
  ].join(" · ")
}

/**
 * @param {ReviewJob} job
 */
function sensorTotalsCell(job) {
  /** @type {string[]} */
  const parts = []
  if (job.telemetry.total_domains !== null) parts.push(countPhrase(job.telemetry.total_domains, "unique domain"))
  if (job.telemetry.total_connections !== null) parts.push(countPhrase(job.telemetry.total_connections, "connection"))
  return parts.length === 0 ? "network totals not recorded" : parts.join(" · ")
}

/**
 * A record-sourced table cell, escaped and wrapped in <code>.
 * @param {unknown} value
 */
function recordCell(value) {
  return `<code>${escapeHtmlCell(value)}</code>`
}

/**
 * A matrix leg reads `<job> (i of N)`, the label the App uses, with `i`
 * one-based from the recorded `job_index`. N comes from the `job_total`
 * input; without it the leg keeps the bare job name.
 * @param {ReviewJob} job
 * @param {StepSummaryContext | null} context
 */
function matrixJobLabel(job, context) {
  const index = Number(job.job_index)
  const total = Number(context?.jobTotal ?? "")
  if (job.job_index === "" || !Number.isInteger(index) || !Number.isInteger(total) || total < index + 1) {
    return job.name
  }
  return `${job.name} (${index + 1} of ${total})`
}

/**
 * A loopback DNS resolver is the runner talking to itself, not a destination:
 * it is neither rendered nor counted.
 * @param {ReviewEdge} edge
 */
function isLoopbackResolver(edge) {
  return LOOPBACK_RE.test(edge.remote_address) && edge.remote_ports.some((port) => numericPort(port) === 53)
}

/**
 * The always-visible head of a job's receipt: every identity, coverage and
 * capture fact the record (and the post step) carries, one row each. A
 * field the record does not carry renders no row rather than a guess.
 * @param {ReviewJob} job
 * @param {string} appUrl
 * @param {StepSummaryContext | null} context
 * @returns {[string, string][]}
 */
function workloadContextRows(job, appUrl, context) {
  /** @type {[string, string][]} */
  const rows = []
  if (job.profile_id !== "") {
    const profileLink = profilePermalink(job, appUrl, "step_summary")
    const profileCell =
      profileLink === ""
        ? escapeMarkdownCell(job.profile_id)
        : `[${escapeMarkdownCell(job.profile_id)}](${profileLink})`
    rows.push(["Profile", profileCell])
  }
  // Record-sourced text renders inside <code>: GitHub's mention and issue
  // reference filters skip code, while entity-encoding alone is decoded
  // before they run.
  if (job.workflow !== "") rows.push(["Workflow", recordCell(job.workflow)])
  if (job.name !== "") rows.push(["Job", recordCell(matrixJobLabel(job, context))])
  if (job.job_index !== "") rows.push(["Matrix job index", recordCell(job.job_index)])
  if (job.repository !== "") rows.push(["Repository", recordCell(job.repository)])
  if (job.ref !== "") rows.push(["Branch", recordCell(job.ref)])
  if (job.pr_url !== "") {
    const prNumber = job.pr_url.split("/").pop()
    rows.push(["Pull request", `[#${escapeMarkdownCell(prNumber ?? "")}](${job.pr_url})`])
  }
  if (job.sha !== "") rows.push(["Commit", recordCell(job.sha)])
  if (job.event_name !== "") rows.push(["Event", recordCell(job.event_name)])
  if (job.actor !== "") rows.push(["Triggered by", recordCell(job.actor)])
  if (job.run_id !== "") {
    const attempt = job.run_attempt === "" ? "" : ` · attempt ${recordCell(job.run_attempt)}`
    const run = job.run_url === "" ? escapeMarkdownCell(job.run_id) : `[${escapeMarkdownCell(job.run_id)}](${job.run_url})`
    rows.push(["Run", `${run}${attempt}`])
  }
  const runner = [job.runner_os, job.runner_arch].filter((value) => value !== "").join(" ")
  const provenance =
    runner === ""
      ? CONTRACT_VOCAB.copy.kernelProvenance
      : CONTRACT_VOCAB.copy.kernelProvenance.replace("at the kernel", `at the kernel (${recordCell(runner)})`)
  rows.push(["Coverage", `${provenance}. ${CONTRACT_VOCAB.copy.captureBestEffort}`])
  if (context !== null) {
    if (context.capture !== "") rows.push(["Capture", recordCell(context.capture)])
    if (context.sensor !== "") rows.push(["Sensor", escapeMarkdownCell(context.sensor)])
    if (context.sensorIntegrity !== "") rows.push(["Sensor integrity", escapeMarkdownCell(context.sensorIntegrity)])
    if (context.sensorAuthenticity !== "") {
      rows.push(["Sensor authenticity", escapeMarkdownCell(context.sensorAuthenticity)])
    }
    if (context.steps !== "") rows.push(["Workflow steps", escapeMarkdownCell(context.steps)])
  }
  rows.push(["Workload activity", activityCell(job.edges.filter(isWorkloadEdge))])
  rows.push(["Runner activity", activityCell(job.edges.filter((edge) => !isWorkloadEdge(edge)))])
  rows.push(["Sensor network totals", sensorTotalsCell(job)])
  const stamp = formatTimestamp(job.timestamp)
  // formatTimestamp emits a fixed `YYYY-MM-DD HH:MM:SS UTC` shape built from
  // a parsed Date, never raw record text.
  if (stamp !== "") rows.push(["Recorded at", stamp])
  return rows
}

/**
 * Text inside the `<pre>` fold: HTML-escaped, with brackets entity-encoded
 * so a recorded value can never read as a link reference.
 * @param {unknown} value
 */
function escapeChainText(value) {
  return escapeHtml(value).replaceAll("[", "&#91;").replaceAll("]", "&#93;")
}

/**
 * One group of chains that share the exact same recorded ancestry above
 * their acting process. The shared names render once; each acting process
 * (its own PID) is a separate leaf with every destination association it
 * owns beneath it. Nothing is merged on a partial prefix.
 * @param {LineageRow[]} group
 * @param {boolean} detections
 */
function renderChainGroup(group, detections) {
  const first = group[0]
  if (first === undefined) return ""
  const parents = edgeProcessPath(first.edge).slice(0, -1)
  const lines = parents.map((name, index) =>
    index === 0 ? escapeChainText(name) : `${"   ".repeat(index - 1)}└─ ${escapeChainText(name)}`,
  )
  const leafIndent = parents.length === 0 ? "" : "   ".repeat(parents.length - 1)
  group.forEach((row, rowIndex) => {
    const path = edgeProcessPath(row.edge)
    const leafName = path[path.length - 1] ?? VOCAB.unknownLineage
    const pid = row.edge.pid === "" ? "" : ` <em>(pid ${escapeChainText(row.edge.pid)})</em>`
    const step = stepAnnotationName(row.edge.github_step)
    const stepNote = step === "" ? "" : ` <em>(step: &quot;${escapeChainText(step)}&quot;)</em>`
    const ranFrom = row.edge.executable === "" ? "" : ranFromNote(new Set([row.edge.executable]))
    const ranFromText = ranFrom === "" ? "" : ` ${renderNote(ranFrom)}`
    const leaf = `<strong>${escapeChainText(leafName)}</strong>${pid}${stepNote}${ranFromText}`
    let childPrefix = ""
    if (parents.length === 0) {
      lines.push(leaf)
    } else {
      const last = rowIndex === group.length - 1
      lines.push(`${leafIndent}${last ? "└─ " : "├─ "}${leaf}`)
      childPrefix = `${leafIndent}${last ? "   " : "│  "}`
    }
    row.associations.forEach((edge, index) => {
      const branch = index === row.associations.length - 1 ? "└─ " : "├─ "
      const destination = destinationDisplay(edge, (value) => escapeChainText(defangHostname(value)))
      const notes = edgeNotes(edge, { detections }).map(renderNote)
      const suffix = notes.length === 0 ? "" : ` ${notes.join(" ")}`
      lines.push(`${childPrefix}${branch}${VOCAB.terminalNetwork} ${destination}${suffix}`)
    })
  })
  return lines.join("\n")
}

/**
 * Every destination association as root-to-action chains. The record
 * carries ancestry names and the acting process's PID only, so two
 * processes with the same name cannot be proven to be one node: chains are
 * grouped only when their full recorded ancestry above the acting process
 * matches exactly, and two PIDs never share a node. Destinations, chains
 * and groups are ordered by destination identity; workload groups render
 * before runner groups.
 * @param {LineageRow[]} rows
 * @param {boolean} [detections]
 */
export function renderExecutionChains(rows, detections = false) {
  const names = addressNameMap(rows.flatMap((row) => row.associations))
  const compareEdges = (/** @type {ReviewEdge} */ a, /** @type {ReviewEdge} */ b) =>
    compareDestinationIdentities(a, b, names) || edgeComparator(a, b)
  const firstEdge = (/** @type {LineageRow} */ row) => row.associations[0] ?? row.edge
  const compareRows = (/** @type {LineageRow} */ a, /** @type {LineageRow} */ b) => {
    const identityOrder = compareDestinationIdentities(firstEdge(a), firstEdge(b), names)
    if (identityOrder !== 0) return identityOrder
    const difference = Number(a.edge.pid) - Number(b.edge.pid)
    if (Number.isFinite(difference) && difference !== 0) return difference
    return compareEdges(firstEdge(a), firstEdge(b))
  }
  const orderedRows = rows
    .map((row) => ({ edge: row.edge, associations: [...row.associations].sort(compareEdges) }))
    .sort(compareRows)
  /** @type {Map<string, LineageRow[]>} */
  const groups = new Map()
  for (const row of orderedRows) {
    const parents = edgeProcessPath(row.edge).slice(0, -1)
    const key =
      !row.edge.lineage_recorded || parents.length === 0 ? `root:${groups.size}` : JSON.stringify(parents)
    const group = groups.get(key)
    if (group === undefined) {
      groups.set(key, [row])
    } else {
      group.push(row)
    }
  }
  const ordered = [...groups.values()]
  const isWorkloadGroup = (/** @type {LineageRow[]} */ group) => group.some((row) => isWorkloadEdge(row.edge))
  return [...ordered.filter(isWorkloadGroup), ...ordered.filter((group) => !isWorkloadGroup(group))]
    .map((group) => renderChainGroup(group, detections))
    .join("\n\n")
}

/**
 * One job's receipt: workload context (always visible), the execution
 * chain table, the collapsed chains fold, preview-only material, then the
 * Execution Profile CTA.
 * @param {ReviewJob} job
 * @param {string} appUrl
 * @param {number} keptDestinations
 * @param {ProfileSummaryOptions} options
 */
function renderProfileSummary(job, appUrl, keptDestinations, options) {
  const lines = [`## ${VOCAB.stepSummaryHeading}`, ""]

  lines.push("### Workload context", "")
  lines.push("| Field | Value |")
  lines.push("| --- | --- |")
  for (const [key, value] of workloadContextRows(job, appUrl, options.context)) {
    lines.push(`| ${escapeMarkdownCell(key)} | ${value} |`)
  }
  lines.push("")

  lines.push("### Network egress", "")
  const lineageRows = buildLineageRows(job.edges)
  if (lineageRows.length === 0) {
    lines.push(VOCAB.emptyPeers)
    lines.push("")
  } else {
    const keep = keptDestinations === Infinity ? lineageRows.length : keptDestinations
    const retained = new Set(lineageRetentionOrder(lineageRows).slice(0, keep))
    const shown = lineageRows.filter((row) => retained.has(row))
    lines.push("Keyed by execution chain; repeated destination names within a chain are collapsed.", "")
    lines.push(renderLineageTable(shown))
    lines.push("")
    if (shown.length < lineageRows.length) {
      lines.push(`<sub>rendered ${shown.length} of ${lineageRows.length} execution chains</sub>`)
      lines.push("")
    }
    lines.push(
      `<details><summary><sub>Execution chains · ${countPhrase(job.edges.length, "destination association")}</sub></summary>`,
    )
    lines.push("")
    lines.push("<pre>")
    lines.push(renderExecutionChains(lineageRows, options.detections))
    lines.push("</pre>")
    lines.push("</details>")
    lines.push("")
  }

  if (options.previewAssertions) {
    lines.push(renderRecordedContextPreview(job.edges, options.detections))
    lines.push("")
    lines.push(renderAssertionPreview(job.assertions))
    lines.push("")
  }

  lines.push(renderStepSummaryFooter(job, appUrl))
  return lines.join("\n")
}

/**
 * Render the GitHub Step Summary, the job's full receipt: workload context
 * first, then the execution chain table, the collapsed chains fold,
 * optional preview-only material, and the Execution Profile CTA.
 * The 1 MiB budget uses deterministic fair-round-robin retention.
 * @param {unknown[]} profiles raw parsed Jibril profiles
 * @param {{appUrl?: string, preview?: boolean, detections?: boolean, context?: StepSummaryContext | null}} [opts]
 */
export function renderStepSummary(profiles, opts = {}) {
  const appUrl = String(opts.appUrl || "https://app.garnet.ai").replace(/\/+$/, "")
  const jobs = buildRunReview({
    appUrl,
    jobs: profiles.map(summarizeProfile).filter(Boolean),
  }).jobs
  const render = (/** @type {Map<number, number>} */ kept) =>
    jobs
      .map((j, i) =>
        renderProfileSummary(j, appUrl, kept.get(i) ?? Infinity, {
          previewAssertions: opts.preview === true,
          detections: opts.detections === true,
          context: opts.context ?? null,
        }),
      )
      .join("\n\n---\n\n")

  const full = render(new Map())
  if (Buffer.byteLength(full, "utf8") <= STEP_SUMMARY_BUDGET) return full

  const rowCounts = jobs.map((job) => buildLineageRows(job.edges).length)
  const totalLineages = rowCounts.reduce((sum, count) => sum + count, 0)
  /** @type {number[]} */
  const order = []
  for (let round = 0; order.length < totalLineages; round += 1) {
    jobs.forEach((_, i) => {
      if (round < (rowCounts[i] ?? 0)) order.push(i)
    })
  }
  const bodyFor = (/** @type {number} */ keepTotal) => {
    /** @type {Map<number, number>} */
    const kept = new Map(jobs.map((_, i) => [i, 0]))
    for (let i = 0; i < keepTotal; i += 1) {
      const jobIndex = order[i]
      if (jobIndex === undefined) break
      kept.set(jobIndex, (kept.get(jobIndex) ?? 0) + 1)
    }
    return render(kept)
  }
  let lo = 0
  let hi = totalLineages - 1
  let best = bodyFor(0)
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const body = bodyFor(mid)
    if (Buffer.byteLength(body, "utf8") <= STEP_SUMMARY_BUDGET) {
      best = body
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  // True final cap: when even the zero-edge summary's fixed overhead exceeds
  // the budget, fall back to the deterministic minimal summary.
  if (Buffer.byteLength(best, "utf8") > STEP_SUMMARY_BUDGET) {
    return renderMinimalStepSummary(jobs)
  }
  return best
}

/**
 * Deterministic explicit minimal fallback for the Step Summary.
 * @param {ReviewJob[]} jobs
 */
function renderMinimalStepSummary(jobs) {
  const lineages = jobs.reduce(
    (sum, job) => sum + buildLineageRows(job.edges).length,
    0,
  )
  return [
    `## ${VOCAB.stepSummaryHeading}`,
    "",
    `${jobs.length} job${jobs.length === 1 ? "" : "s"} recorded`,
    "",
    `<sub>rendered 0 of ${lineages} execution chains</sub>`,
  ].join("\n")
}
