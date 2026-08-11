/**
 * Garnet execution comment — reference renderer for contract v6.8.0.
 *
 * Vendored from the locked reference renderer in
 * garnet-org/runtime-review-testbed (cmd/garnet-runtime-review/review.mjs at
 * commit 814d4d328f679f40b4546918a1c3bf347101413f, then aligned to the
 * v6.7.0 contract at commit be91e8a0752e6e44759ae93b2b7db7710f3e428e —
 * contract/vocab.json + docs/ux-contract.md; the testbed's v6.7.0 renderer
 * had not landed at vendoring time, so this implementation follows the
 * contract directly) with two mechanical changes: the CLI plumbing section
 * is dropped (the action drives the renderer from src/post.js and
 * src/profile-comment.js) and CONTRACT_VOCAB is imported from the vendored
 * ./runtime-review-vocab.js instead of a filesystem read.
 *
 * Three projections of the same selected record set: the GitHub PR comment,
 * the GitHub job Step Summary, and the public Run Profile (HTML/JSON —
 * contract carried here as machine-readable policy data; the page itself is
 * served by the Garnet app).
 *
 * v6.5.0 record model:
 *   - One destination association = one `network.egress.peers[]` item × one
 *     `proc_trees[]` item. A peer with no proc_trees emits one association
 *     with lineage `unknown (not recorded)`.
 *   - The record is egress-centric — it is NOT a process inventory; a
 *     process that made no recorded egress may not appear.
 *   - The evidence model is lossless; the comment projection deduplicates
 *     destination identities so capture multiplicity never becomes comparison
 *     churn.
 *   - `arguments`/argv and `executable` paths are embargoed: never captured
 *     into the render model, never emitted on any surface.
 *   - Typography is attribution, not trust: a lineage recorded under a
 *     GitHub step below `Runner.Worker` is bold; runner scaffolding is italic.
 *     A recorded detection always overrides de-emphasis.
 *   - Deterministic factual notes only: `(dns resolver)`, `(instance
 *     metadata)`, and record-backed `detection: <kind>` values other than
 *     `flow`.
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
import { PUBLIC_SUFFIX_RULES } from "./public-suffix-rules.js"

export { CONTRACT_VOCAB }

// ---------------------------------------------------------------------------
// Model typedefs (checkJs) — the v6.6.1 record/review model.
// ---------------------------------------------------------------------------

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
 *   name: string
 *   workflow: string
 *   job_index: string
 *   edges: ReviewEdge[]
 * }} PreviousJob
 */

/**
 * @typedef {{ previousSha: string, previousJobs: PreviousJob[] }} ReviewComparison
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
 *   comparison: ReviewComparison | null
 *   counts: { jobs: number, associations: number, destinations: number }
 * }} RunReview
 */

/**
 * Per-job comparison delta over comment-visible chains.
 * @typedef {{
 *   addedIds: Set<string>
 *   removedIds: Set<string>
 *   added: Set<string>
 *   removed: ReviewEdge[]
 *   addedCount: number
 *   removedCount: number
 * }} EdgeDelta
 */

/**
 * @typedef {EdgeDelta & {
 *   names: Map<string, string>
 * }} JobDelta
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

/** Canonical sticky marker. */
export const RUNTIME_REVIEW_MARKER = "<!-- garnet-runtime-review -->"

/** Self-marker: identifies THIS renderer's own comments for update/delete. */
export const COMMENT_MARKER = "<!-- garnet-run-profile -->"

/**
 * Stable marker for the testbed-only "after" projection. It deliberately
 * shares no exact marker with the App or Action fallback, so each owner can
 * update only its own PR comment.
 */
export const REFERENCE_MOCKUP_MARKER = "<!-- garnet-reference-renderer-mockup -->"

/**
 * Markers emitted by the control-plane GitHub App comment (the AUTHORITATIVE
 * "Garnet Runtime Review"). When the App has commented, this standalone
 * Action fallback is suppressed.
 */
export const CONTROL_PLANE_MARKERS = [
  "garnet-control-plane-pr-comment:v1",
  "garnet-control-plane-pending-pr-comment:v1",
]

/** Exact emitted vocabulary — byte-locked by contract/vocab.json. */
export const VOCAB = {
  headlineLead: CONTRACT_VOCAB.copy.headlineLead,
  stepSummaryHeading: CONTRACT_VOCAB.copy.stepSummaryHeading,
  artifact: CONTRACT_VOCAB.copy.artifact,
  permalinkLabel: CONTRACT_VOCAB.copy.permalinkLabel,
  emptyPeers: CONTRACT_VOCAB.copy.emptyPeers,
  noRunProfile: CONTRACT_VOCAB.copy.noRunProfile,
  unknownLineage: CONTRACT_VOCAB.copy.unknownLineage,
  noChange: CONTRACT_VOCAB.copy.noChange,
  terminalNetwork: CONTRACT_VOCAB.copy.terminalNetwork,
  sinceWord: CONTRACT_VOCAB.copy.sinceWord,
  vanishedJobsLabel: CONTRACT_VOCAB.copy.vanishedJobsLabel,
  jobsLineChanged: CONTRACT_VOCAB.copy.jobsLineChanged,
  jobsLineUnchanged: CONTRACT_VOCAB.copy.jobsLineUnchanged,
  jobsLineNoOutbound: CONTRACT_VOCAB.copy.jobsLineNoOutbound,
  jobsLineVanished: CONTRACT_VOCAB.copy.jobsLineVanished,
  machineSummaryMarker: CONTRACT_VOCAB.copy.machineSummaryMarker,
  explainerLabel: CONTRACT_VOCAB.copy.explainerLabel,
  explainerReadingLine: CONTRACT_VOCAB.copy.explainerReadingLine,
  explainerComparisonLine: CONTRACT_VOCAB.copy.explainerComparisonLine,
  explainerLegendLine: CONTRACT_VOCAB.copy.explainerLegendLine,
  explainerCalloutPath: CONTRACT_VOCAB.copy.explainerCalloutPath,
  explainerCalloutActed: CONTRACT_VOCAB.copy.explainerCalloutActed,
  explainerCalloutAction: CONTRACT_VOCAB.copy.explainerCalloutAction,
  whatIsGarnetLabel: CONTRACT_VOCAB.copy.whatIsGarnetLabel,
  whatIsGarnetUrl: CONTRACT_VOCAB.copy.whatIsGarnetUrl,
}

/** PR comment serialized UTF-8 byte budget (GitHub hard cap is 65,536). */
export const SIZE_BUDGET = CONTRACT_VOCAB.mediumLimits.prCommentBudget

/** Changed folds render open only while at most this many jobs changed. */
export const FOLD_OPEN_BUDGET = CONTRACT_VOCAB.comment.foldOpenBudget

/** Step Summary hard limit (1 MiB). */
export const STEP_SUMMARY_BUDGET = CONTRACT_VOCAB.mediumLimits.stepSummaryHardLimit

/** Loopback matcher for the dns-resolver note (anchored — never a suffix). */
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
 * Strip control characters from any record-sourced string.
 * @param {unknown} value
 */
const stripControl = (value) =>
  String(value ?? "").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")

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
 * Neutralize markdown link vectors in record-sourced text that renders as
 * plain (non-<code>) content: `](` can close a link label and `://` can
 * autolink. HTML entities render identically but never parse as markdown.
 * @param {string} value
 */
export const neutralizeMarkdown = (value) =>
  value.replaceAll("](", "]&#40;").replaceAll("://", "&#58;//")

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
 * Escape a value destined for HTML inside a GFM table cell.
 * @param {unknown} value
 */
const escapeHtmlCell = (value) => escapeHtml(value).replaceAll("|", "\\|")

/**
 * Bound a captured (attacker-controllable) label to `max` chars with a
 * middle ellipsis, preserving head+tail so it stays identifiable while a
 * crafted payload buried mid-string cannot survive or inflate token cost.
 * Full untruncated values remain in the Run Profile / API.
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
  return stripControl(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("`", "\\`")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
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
 *   - `dns resolver` — loopback remote_address AND a remote_ports value with
 *     numeric port 53.
 *   - `cloud metadata` — remote_address is exactly the standardized IMDS
 *     addresses.
 *   - `github infra` — the primary recorded remote name ends with a
 *     contract-locked GitHub infrastructure suffix.
 *   - `garnet sensor` — the primary recorded remote name is `garnet.ai` or
 *     ends with `.garnet.ai`.
 *   - `detection: <kind>` — every non-empty recorded detection except `flow`.
 * @param {ReviewEdge} edge
 * @param {{ detections?: boolean }} [options]
 */
export function edgeNotes(edge, { detections = true } = {}) {
  /** @type {string[]} */
  const notes = []
  if (
    LOOPBACK_RE.test(edge.remote_address) &&
    edge.remote_ports.some((p) => numericPort(p) === 53)
  ) {
    notes.push(CONTRACT_VOCAB.notes.dnsResolver.text)
  }
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
  const repository = String(github.repository || "")
  if (match === null || repository === "") return ""
  const server = String(github.server_url || "https://github.com").replace(/\/+$/, "")
  return `${server}/${repository}/pull/${match[1]}`
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
    repository: String(github.repository || ""),
    sha: String(github.sha || ""),
    run_id: String(github.run_id || ""),
    run_url:
      github.run_id && github.repository
        ? `${github.server_url || "https://github.com"}/${github.repository}/actions/runs/${github.run_id}`
        : "",
    profile_id: String(envelope.id || envelope.profile_id || ""),
    uuid: String(p?.uuid || ""),
    timestamp: String(p?.timestamp || ""),
    ref: String(github.ref || ""),
    pr_url: pullRequestURL(github),
    actor: String(github.triggering_actor || github.actor || ""),
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
 * Runtime telemetry comparison. This never throws: historical records may
 * legitimately disagree with the projection. CI separately hard-fails Gate T
 * for the pinned fixtures expected to satisfy the invariant.
 * @param {ReviewJob | JobSummary} job
 * @returns {{ metric: string, sensor: number, derived: number, derivedLabel: string }[]}
 */
export function telemetryDiscrepancies(job) {
  /** @type {{ metric: string, sensor: number, derived: number, derivedLabel: string }[]} */
  const discrepancies = []
  if (
    job.telemetry.total_connections !== null &&
    job.telemetry.total_connections !== job.counts.flows
  ) {
    discrepancies.push({
      metric: "Connections",
      sensor: job.telemetry.total_connections,
      derived: job.counts.flows,
      derivedLabel: "recorded flows",
    })
  }
  if (
    job.telemetry.total_domains !== null &&
    job.telemetry.total_domains !== job.counts.primary_names
  ) {
    discrepancies.push({
      metric: "Unique domains",
      sensor: job.telemetry.total_domains,
      derived: job.counts.primary_names,
      derivedLabel: "distinct primary remote names",
    })
  }
  return discrepancies
}

/**
 * A loosely-typed incoming job record accepted by `buildRunReview`.
 * @typedef {Record<string, any>} JobRecordInput
 */

/**
 * Build the review model from job records.
 * @param {{repo?: string, sha?: string, commitUrl?: string, appUrl?: string,
 *          appMode?: boolean, jobs: (JobRecordInput | null | undefined)[],
 *          previousSha?: string, previousJobs?: (JobRecordInput | null | undefined)[] | null}} input
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
      run_url: String(j.run_url || ""),
      job_url: String(j.job_url || ""),
      profile_id: String(j.profile_id || ""),
      uuid: String(j.uuid || ""),
      timestamp: String(j.timestamp || ""),
      repository: String(j.repository || ""),
      sha: String(j.sha || ""),
      ref: String(j.ref || ""),
      pr_url: String(j.pr_url || ""),
      actor: String(j.actor || ""),
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
      edges: (j.edges || []).slice().sort(edgeComparator),
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

  // Optional execution comparison: the previous profiled commit's job
  // records (Phase-1 wiring supplies them; without them every fold renders
  // the snapshot tree). Comparison is computed over comment-visible chains.
  const previousSha = String(input.previousSha || "")
  /** @type {PreviousJob[] | null} */
  const previousJobs = Array.isArray(input.previousJobs)
    ? input.previousJobs
        .filter((j) => j !== null && j !== undefined)
        .map((j) => ({
          name: String(j.name || ""),
          workflow: String(j.workflow || ""),
          job_index: j.job_index === undefined || j.job_index === null ? "" : String(j.job_index),
          edges: (j.edges || []).slice().sort(edgeComparator),
        }))
    : null
  const comparison =
    previousSha !== "" && previousJobs !== null
      ? { previousSha, previousJobs }
      : null

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
    comparison,
    counts: {
      jobs: jobs.length,
      associations: jobs.reduce((n, j) => n + j.counts.associations, 0),
      destinations: destinationUnion.size,
    },
  }

  // Comparison reviews order jobs by decision relevance: destination
  // change, no change, then jobs with no outbound
  // destinations. Canonical alphabetic order holds within each tier;
  // snapshot reviews keep it outright.
  if (review.comparison !== null) {
    const { tiers } = changeAccounting(review)
    const canonicalIndex = new Map(review.jobs.map((j, i) => [j.id, i]))
    review.jobs = [...review.jobs].sort(
      (a, b) =>
        (tiers.get(a.id) ?? 0) - (tiers.get(b.id) ?? 0) ||
        (canonicalIndex.get(a.id) ?? 0) - (canonicalIndex.get(b.id) ?? 0),
    )
  }
  return review
}

/**
 * Stable JSON-serializable review model (the review-model golden surface).
 * @param {RunReview} review
 */
export function exportReviewModel(review) {
  return {
    contractVersion: CONTRACT_VOCAB.version,
    repo: review.repo,
    sha: review.sha,
    commitUrl: review.commitUrl,
    appUrl: review.appUrl,
    appMode: review.appMode,
    recordedThrough: review.recordedThrough,
    counts: review.counts,
    jobs: review.jobs.map((j) => ({
      name: j.name,
      workflow: j.workflow,
      run_id: j.run_id,
      run_url: j.run_url,
      job_url: j.job_url,
      profile_id: j.profile_id,
      uuid: j.uuid,
      timestamp: j.timestamp,
      repository: j.repository,
      sha: j.sha,
      ref: j.ref,
      actor: j.actor,
      job_index: j.job_index,
      flow_count: j.flow_count,
      telemetry: j.telemetry,
      telemetryDiscrepancies: telemetryDiscrepancies(j),
      assertions: j.assertions,
      counts: j.counts,
      edges: j.edges.map((e) => ({
        remote_address: e.remote_address,
        remote_names: e.remote_names,
        remote_ports: e.remote_ports,
        protocol: e.protocol,
        result: e.result,
        detections: e.detections,
        lineage_recorded: e.lineage_recorded,
        pid: e.pid,
        process: e.process,
        ancestry: e.ancestry,
        github_step: e.github_step,
        notes: edgeNotes(e),
      })),
    })),
  }
}

// ---------------------------------------------------------------------------
// Public Run Profile — selector and publication policy (contract data; the
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
 * Fail-closed publication decision, rechecked at request time. Default deny.
 * Renders only when backend-truth visibility is exactly "public" AND explicit
 * consent exists AND consent is not revoked AND an exact envelope Profile.ID
 * selector resolves. Missing, empty, wrong, or job-only selectors return 404
 * and never fall back to a run index/job/first profile. Every denied case
 * returns the same non-oracular 404 for HTML and JSON.
 * @param {{visibility?: string, consent?: boolean, revoked?: boolean,
 *          profileRequested?: boolean, selectorResolves?: boolean}} state
 * @returns {{status: 200|404, body: "render"|"not found"}}
 */
export function publicationDecision(state = {}) {
  const base =
    state.visibility === "public" && state.consent === true && state.revoked !== true
  const allowed =
    base && state.profileRequested === true && state.selectorResolves === true
  return allowed ? { status: 200, body: "render" } : { status: 404, body: "not found" }
}

// ---------------------------------------------------------------------------
// PR comment.
// ---------------------------------------------------------------------------

/**
 * A non-flow detection overrides runner-scaffolding de-emphasis.
 * @param {ReviewEdge} edge
 */
export function hasRecordedDetection(edge) {
  return (edge.detections || []).some(
    (value) => value !== "" && value.toLowerCase() !== "flow",
  )
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
  if (v === "" || isAddressLike(v) || !v.includes(".")) return v
  return v.replace(/\.(?=[^.]*$)/, "[.]")
}

/**
 * PR-comment destination display: domain-first — the canonical recorded
 * name is the identity, a bare IP only when no name is recorded. Hostnames
 * are defanged on this surface. No ports, no protocol, address annotation,
 * or secondary-name annotation on the comment.
 * @param {ReviewEdge} edge
 * @param {(value: unknown) => string} escape
 */
function commentDestinationDisplay(edge, escape) {
  return escape(defangHostname(truncateMiddle(edgePrimaryDestination(edge))))
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
 * Comment-tree path: recorded ancestry rooted at `Runner.Worker` when the
 * lineage descends from it (the scaffolding prefix above the worker is
 * attribution-noise on the comment; the full path stays in the Step Summary
 * and the Execution Profile).
 * @param {ReviewEdge} edge
 */
function commentTreePath(edge) {
  const path = edgeProcessPath(edge)
  const workerIndex = path.indexOf("Runner.Worker")
  return workerIndex > 0 ? path.slice(workerIndex) : path
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
 * One representative edge per destination identity, named edges preferred.
 * @param {ReviewEdge[]} edges
 * @param {Map<string, string>} [names]
 * @returns {ReviewEdge[]}
 */
function dedupeDestinationEdges(edges, names = addressNameMap(edges)) {
  /** @type {Map<string, ReviewEdge>} */
  const representatives = new Map()
  for (const edge of [...edges].sort(edgeComparator)) {
    const key = destinationIdentity(edge, names)
    const current = representatives.get(key)
    const named = edge.remote_names.some((name) => name !== "")
    const currentNamed = current?.remote_names.some((name) => name !== "")
    if (!current || (named && !currentNamed)) representatives.set(key, edge)
  }
  return [...representatives.values()].sort((a, b) => {
    const ka = destinationIdentity(a, names)
    const kb = destinationIdentity(b, names)
    return ka < kb ? -1 : ka > kb ? 1 : edgeComparator(a, b)
  })
}

/**
 * A job's comment-visible destination projection: every recorded chain —
 * no attribution partition — rendered one row per destination identity;
 * capture multiplicity (distinct chains to the same identity) stays in the
 * evidence register. A bare-address representative whose address is named
 * elsewhere in the same record renders under that name — the identity's
 * name is captured evidence, not an invention.
 * @param {ReviewEdge[]} edges
 * @returns {ReviewEdge[]}
 */
export function commentEdges(edges) {
  const names = addressNameMap(edges)
  const unify = (/** @type {ReviewEdge} */ edge) => {
    if (edge.remote_names.some((name) => name !== "")) return edge
    const name = names.get(edge.remote_address)
    return name ? { ...edge, remote_names: [name] } : edge
  }
  return dedupeDestinationEdges(edges, names).map(unify)
}

/**
 * @param {string} [name]
 * @returns {TreeNode}
 */
function makeTreeNode(name = "") {
  return {
    name,
    children: [],
    childByKey: new Map(),
    associations: [],
    pids: new Set(),
    processes: new Set(),
    steps: new Set(),
    executables: new Set(),
  }
}

/**
 * Add one destination association to a shared-prefix lineage tree. Nodes
 * are keyed by recorded process name along the lineage path; PID-distinct
 * capture stays in the evidence register (the comment tree renders one row
 * per destination identity).
 * @param {TreeNode} root
 * @param {ReviewEdge} edge
 */
function addAssociationToTree(root, edge) {
  const path = commentTreePath(edge)
  let node = root
  path.forEach((name, index) => {
    const terminal = index === path.length - 1
    const key = JSON.stringify([name])
    let child = node.childByKey.get(key)
    if (!child) {
      child = makeTreeNode(name)
      node.childByKey.set(key, child)
      node.children.push(child)
    }
    node = child
    if (terminal) {
      node.associations.push(edge)
      if (edge.pid !== "") node.pids.add(edge.pid)
      if (edge.process !== "") node.processes.add(edge.process)
      if (edge.github_step !== "") node.steps.add(edge.github_step)
      if (edge.executable !== "") node.executables.add(edge.executable)
    }
  })
}

/**
 * @param {ReviewEdge[]} edges
 * @returns {TreeNode}
 */
function treeForAssociations(edges) {
  const root = makeTreeNode()
  for (const edge of dedupeDestinationEdges(edges)) addAssociationToTree(root, edge)
  coalescePrefixTerminalNodes(root)
  return root
}

/**
 * @param {TreeNode} target
 * @param {TreeNode} source
 */
function mergeTreeNode(target, source) {
  target.associations.push(...source.associations)
  for (const pid of source.pids) target.pids.add(pid)
  for (const process of source.processes) target.processes.add(process)
  for (const step of source.steps) target.steps.add(step)
  for (const executable of source.executables) target.executables.add(executable)
}

/**
 * If a process both has its own egress and appears as the prefix of deeper
 * lineage, render it once with destination leaves and child processes.
 * @param {TreeNode} node
 */
function coalescePrefixTerminalNodes(node) {
  for (const child of node.children) coalescePrefixTerminalNodes(child)
  /** @type {Map<string, TreeNode[]>} */
  const grouped = new Map()
  for (const child of node.children) {
    const group = grouped.get(child.name) || []
    group.push(child)
    grouped.set(child.name, group)
  }
  for (const group of grouped.values()) {
    const branch = group.find((child) => child.children.length > 0)
    if (!branch) continue
    for (const child of group) {
      if (child !== branch && child.children.length === 0) mergeTreeNode(branch, child)
    }
  }
  node.children = node.children.filter((child) => {
    const group = grouped.get(child.name) || []
    const branch = group.find((candidate) => candidate.children.length > 0)
    return !branch || child === branch || child.children.length > 0
  })
}

/**
 * Display-only process name: a trailing run of 4+ digits is provisioning
 * noise (provjobd1326539233 → provjobd) and strips from the comment tree;
 * the record, Step Summary, model JSON, and chain identity keep the raw name.
 * @param {unknown} name
 */
export function displayProcessName(name) {
  const stripped = String(name ?? "").replace(/\d{4,}$/, "")
  return stripped === "" ? String(name ?? "") : stripped
}

/**
 * @param {TreeNode} node
 * @param {{ steps?: boolean, inheritedSteps?: Set<string> }} [options]
 */
function processNodeLine(node, { steps = true, inheritedSteps = new Set() } = {}) {
  const escaped = escapeHtml(truncateMiddle(displayProcessName(completedNodeName(node))))
  // Bold marks the process that acted: an observed action sits directly
  // beneath it. Decoration only; the terminal itself carries the fact.
  const body = node.associations.length > 0 ? `<strong>${escaped}</strong>` : escaped
  // PID + command identity is Step Summary-only; the comment tree shows
  // process names alone. A real recorded step renders as a bracket
  // annotation — additive context that never determines structure.
  const step = steps
    ? annotatedStepNames(node, inheritedSteps)
        .map((name) => ` <em>(step: &quot;${escapeHtml(truncateMiddle(name))}&quot;)</em>`)
        .join("")
    : ""
  const provenance = ranFromNote(node.executables)
  const ranFrom = provenance !== "" ? ` ${renderNote(provenance)}` : ""
  return `${body}${step}${ranFrom}`
}

/**
 * Recorded step names on a node, sentinel excluded, deterministically
 * ordered. Steps are additive decoration: a tree rendered with and without
 * them has identical structure, counts, ordering, and comparison.
 * @param {TreeNode} node
 */
function recordedStepNames(node) {
  return [...new Set([...node.steps].map(stepAnnotationName))].filter((name) => name !== "").sort()
}

/**
 * A step annotation renders once per path, on the shallowest process line
 * where that recorded step applies: descendants with the same recorded step
 * inherit it silently, and a descendant whose recorded step differs renders
 * its own.
 * @param {TreeNode} node
 * @param {Set<string>} inherited
 */
function annotatedStepNames(node, inherited) {
  return recordedStepNames(node).filter((name) => !inherited.has(name))
}

/**
 * @param {TreeNode} node
 * @param {Set<string>} inherited
 */
function inheritSteps(node, inherited) {
  const names = recordedStepNames(node)
  if (names.length === 0) return inherited
  return new Set([...inherited, ...names])
}

/**
 * Display-only completion of a kernel-comm-truncated recorded name (exactly
 * 15 bytes): completed only when the record itself carries the full string —
 * the node's recorded executable basenames extend the truncated name to one
 * unique longer name. The raw recorded name stays in the model, marker, and
 * Step Summary; no completion ever comes from outside the profile.
 * @param {TreeNode} node
 */
function completedNodeName(node) {
  const name = String(node.name ?? "")
  if (Buffer.byteLength(name, "utf8") !== 15) return name
  const candidates = new Set(
    [...node.executables]
      .map((path) => path.slice(path.lastIndexOf("/") + 1))
      .filter((base) => base.length > name.length && base.startsWith(name)),
  )
  return candidates.size === 1 ? [...candidates][0] : name
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
 * @param {ReviewEdge} edge
 * @param {boolean} detections
 * @param {boolean} [defang]
 */
function destinationLeafLine(edge, detections, defang = true) {
  // Observed actions render as shaped terminals — `○ <destination>` for
  // network; box-drawing characters carry structure, geometric terminals
  // carry evidence.
  const display = defang
    ? commentDestinationDisplay(edge, escapeHtml)
    : escapeHtml(truncateMiddle(edgePrimaryDestination(edge)))
  const parts = [VOCAB.terminalNetwork, display]
  for (const note of edgeNotes(edge, { detections })) parts.push(renderNote(note))
  return parts.join(" ")
}

/**
 * @param {TreeNode} node
 * @param {string} prefix
 * @param {string[]} lines
 * @param {{ destinations: boolean, steps?: boolean, detections?: boolean, defang?: boolean, inheritedSteps?: Set<string> }} options
 */
function renderTreeChildren(node, prefix, lines, { destinations, steps = true, detections = false, defang = true, inheritedSteps = new Set() }) {
  /** @type {({ kind: "process", child: TreeNode } | { kind: "destination", edge: ReviewEdge })[]} */
  const entries = [
    ...node.children.map((child) => ({ kind: /** @type {"process"} */ ("process"), child })),
    ...(destinations
      ? node.associations.map((edge) => ({ kind: /** @type {"destination"} */ ("destination"), edge }))
      : []),
  ]
  entries.forEach((entry, index) => {
    const last = index === entries.length - 1
    const branch = last ? "└─ " : "├─ "
    const childPrefix = `${prefix}${last ? "   " : "│  "}`
    if (entry.kind === "process") {
      lines.push(`${prefix}${branch}${processNodeLine(entry.child, { steps, inheritedSteps })}`)
      renderTreeChildren(entry.child, childPrefix, lines, {
        destinations,
        steps,
        detections,
        defang,
        inheritedSteps: inheritSteps(entry.child, inheritedSteps),
      })
    } else {
      lines.push(`${prefix}${branch}${destinationLeafLine(entry.edge, detections, defang)}`)
    }
  })
}

/**
 * Render a job's lossless shared-prefix lineage tree. Destination leaves stay
 * attached to the terminal recorded process; no ×N grouping or trust labels.
 * @param {ReviewJob} job
 * @param {ReviewEdge[]} [edges]
 * @param {{ defang?: boolean }} [opts]
 */
export function renderJobTree(job, edges = job.edges, opts = {}) {
  /** @type {string[]} */
  const lines = []
  const root = treeForAssociations(edges)
  // One block holds every recorded root; independent recorded ancestry
  // roots are separated by one blank line — whitespace means independent
  // recorded roots in the same job, never another category.
  root.children.forEach((child, index) => {
    if (index > 0) lines.push("")
    lines.push(processNodeLine(child, { steps: true }))
    renderTreeChildren(child, "", lines, {
      destinations: true,
      steps: true,
      defang: opts.defang !== false,
      inheritedSteps: inheritSteps(child, new Set()),
    })
  })
  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Execution comparison — in-fold marked tree. The tree walk is the same
// as the snapshot tree; a line is marked `+` iff it was not present in the
// previous record and `−` iff absent from the current one — a new chain
// marks its whole branch from the divergence point, a new destination under
// existing lineage marks only the leaf. Rendered inside a ```diff fence with
// one `@@ <previous> (previous) vs <head> (current) @@` header.
// ---------------------------------------------------------------------------

/**
 * Plain-text (fence-safe) node/leaf text — no HTML, backticks neutralized.
 * @param {unknown} value
 */
const fenceText = (value) =>
  stripControl(value).replace(/`/g, "ʼ").replace(/[\r\n]+/g, " ").trim()

/**
 * Per-job comparison against the same job in the previous profiled commit:
 * one identity-set diff over the whole job's destination projection — no
 * partition, no equivalence heuristics, no quieting layer.
 * @param {ReviewEdge[]} headEdges
 * @param {ReviewEdge[]} previousEdges
 * @returns {EdgeDelta}
 */
export function compareJobEdges(headEdges, previousEdges) {
  const names = addressNameMap(headEdges, previousEdges)
  const headIds = new Set(headEdges.map((edge) => destinationIdentity(edge, names)))
  const prevIds = new Set(previousEdges.map((edge) => destinationIdentity(edge, names)))
  const addedIds = new Set([...headIds].filter((id) => !prevIds.has(id)))
  const removedIds = new Set([...prevIds].filter((id) => !headIds.has(id)))
  /** @type {Map<string, ReviewEdge>} */
  const removedByID = new Map()
  for (const edge of [...previousEdges].sort(edgeComparator)) {
    const id = destinationIdentity(edge, names)
    if (removedIds.has(id) && !removedByID.has(id)) removedByID.set(id, edge)
  }
  return {
    addedIds,
    removedIds,
    added: addedIds,
    removed: [...removedByID.values()],
    addedCount: addedIds.size,
    removedCount: removedIds.size,
  }
}

/**
 * The registrable domain (eTLD+1) of a recorded hostname, computed from the
 * versioned public-suffix table — data, not heuristics. Empty for address
 * literals, single labels, and unknown inputs.
 * @param {string} name
 */
export function registrableDomain(name) {
  const host = name.toLowerCase().replace(/\.$/, "")
  if (host === "" || isAddressLike(host) || !host.includes(".")) return ""
  const labels = host.split(".")
  let suffixLen = 1
  for (let i = 0; i < labels.length; i += 1) {
    const candidate = labels.slice(i).join(".")
    const kind = PUBLIC_SUFFIX_RULES.get(candidate)
    if (kind === "exception") {
      suffixLen = labels.length - i - 1
      break
    }
    const wildcardParent =
      i + 1 < labels.length &&
      PUBLIC_SUFFIX_RULES.get(labels.slice(i + 1).join(".")) === "wildcard"
    if (kind === "rule" || wildcardParent) {
      suffixLen = labels.length - i
      break
    }
  }
  if (labels.length <= suffixLen) return ""
  return labels.slice(labels.length - suffixLen - 1).join(".")
}

/**
 * @param {TreeNode} node
 * @param {{ steps?: boolean, inheritedSteps?: Set<string> }} [options]
 */
function diffNodeLine(node, { steps = true, inheritedSteps = new Set() } = {}) {
  const step = steps
    ? annotatedStepNames(node, inheritedSteps)
        .map((name) => ` (step: "${fenceText(truncateMiddle(name))}")`)
        .join("")
    : ""
  const provenance = ranFromNote(node.executables)
  const ranFrom = provenance !== "" ? ` (${fenceText(provenance)})` : ""
  return `${fenceText(truncateMiddle(displayProcessName(completedNodeName(node))))}${step}${ranFrom}`
}

/**
 * @param {ReviewEdge} edge
 * @param {boolean} [annotateAddress]
 */
function diffLeafLine(edge, annotateAddress = false) {
  const identity = edgePrimaryDestination(edge)
  const parts = [VOCAB.terminalNetwork, fenceText(defangHostname(truncateMiddle(identity)))]
  // A marked (+/−) leaf carries the recorded address as one trailing bracket
  // annotation only when an oppositely-marked line in the same fence shares
  // its registrable domain; context lines carry none, and a bare-address
  // identity never repeats its own address.
  if (annotateAddress && edge.remote_address !== "" && edge.remote_address !== identity) {
    parts.push(`(${fenceText(edge.remote_address)})`)
  }
  for (const note of edgeNotes(edge, { detections: false })) parts.push(`(${fenceText(note)})`)
  return parts.join(" ")
}

/**
 * Git-shaped branch mark for a process node: `+` when every destination
 * leaf beneath it is added (the whole branch is new from its divergence
 * point), `−` when every leaf beneath it left the record; mixed subtrees
 * stay context. Marked lineage lines never count — fold-row `+A −R` stays
 * destination-anchored.
 * @param {TreeNode} node
 * @param {Map<ReviewEdge, string>} marks
 * @returns {string}
 */
function diffBranchMark(node, marks) {
  /** @type {Set<string>} */
  const leafMarks = new Set()
  const visit = (/** @type {TreeNode} */ current) => {
    for (const edge of current.associations) {
      leafMarks.add(marks.get(edge) ?? " ")
    }
    for (const child of current.children) visit(child)
  }
  visit(node)
  if (leafMarks.size === 1) {
    const only = [...leafMarks][0]
    if (only === "+" || only === "-") return only
  }
  return " "
}

/**
 * @param {TreeNode} node
 * @param {string} prefix
 * @param {string[]} lines
 * @param {Map<ReviewEdge, string>} marks
 * @param {Set<ReviewEdge>} annotated
 * @param {Set<string>} [inheritedSteps]
 */
function renderDiffChildren(node, prefix, lines, marks, annotated, inheritedSteps = new Set()) {
  /** @type {({ kind: "process", child: TreeNode } | { kind: "destination", edge: ReviewEdge })[]} */
  const entries = [
    ...node.children.map((child) => ({ kind: /** @type {"process"} */ ("process"), child })),
    ...node.associations.map((edge) => ({ kind: /** @type {"destination"} */ ("destination"), edge })),
  ]
  entries.forEach((entry, index) => {
    const last = index === entries.length - 1
    const branch = last ? "└─ " : "├─ "
    const childPrefix = `${prefix}${last ? "   " : "│  "}`
    if (entry.kind === "process") {
      const mark = diffBranchMark(entry.child, marks)
      lines.push(`${mark} ${prefix}${branch}${diffNodeLine(entry.child, { inheritedSteps })}`)
      renderDiffChildren(
        entry.child,
        childPrefix,
        lines,
        marks,
        annotated,
        inheritSteps(entry.child, inheritedSteps),
      )
    } else {
      const mark = marks.get(entry.edge) ?? " "
      lines.push(
        `${mark} ${prefix}${branch}${diffLeafLine(entry.edge, annotated.has(entry.edge))}`,
      )
    }
  })
}

/**
 * Render one changed job's marked tree as the body of a `diff` fence: the
 * union of the head tree and the no-longer-recorded chains, one `@@` header
 * carrying the head-vs-previous attribution and the exact delta.
 * @param {ReviewJob} job
 * @param {EdgeDelta} delta
 * @param {string} headSha
 * @param {string} previousSha
 */
export function renderJobDiffTree(job, delta, headSha, previousSha) {
  /** @type {Map<ReviewEdge, string>} */
  const marks = new Map()
  const names = addressNameMap(job.edges, delta.removed)
  /** @type {Map<string, ReviewEdge>} */
  const representatives = new Map()
  for (const edge of [...job.edges, ...delta.removed].sort(edgeComparator)) {
    const id = destinationIdentity(edge, names)
    const current = representatives.get(id)
    const named = edge.remote_names.some((name) => name !== "")
    const currentNamed = current?.remote_names.some((name) => name !== "")
    if (!current || (named && !currentNamed)) representatives.set(id, edge)
  }
  const unionEdges = [...representatives.entries()].map(([id, edge]) => {
    marks.set(edge, delta.addedIds.has(id) ? "+" : delta.removedIds.has(id) ? "-" : " ")
    return edge
  })
  unionEdges.sort((a, b) => {
    const ka = destinationIdentity(a, names)
    const kb = destinationIdentity(b, names)
    return ka < kb ? -1 : ka > kb ? 1 : edgeComparator(a, b)
  })
  // Same-domain pair annotation: a marked line carries its recorded address
  // only when an oppositely-marked line in this fence shares its eTLD+1.
  /** @type {Set<string>} */
  const addedDomains = new Set()
  /** @type {Set<string>} */
  const removedDomains = new Set()
  for (const edge of unionEdges) {
    const domain = registrableDomain(destinationIdentity(edge, names))
    if (domain === "") continue
    if (marks.get(edge) === "+") addedDomains.add(domain)
    if (marks.get(edge) === "-") removedDomains.add(domain)
  }
  const annotated = new Set(
    unionEdges.filter((edge) => {
      const mark = marks.get(edge)
      if (mark !== "+" && mark !== "-") return false
      const domain = registrableDomain(destinationIdentity(edge, names))
      return domain !== "" && (mark === "+" ? removedDomains : addedDomains).has(domain)
    }),
  )
  // Previous SHA first, roles named: the reader scans old → new like a diff.
  const lines = [
    `@@ ${fenceText(previousSha.slice(0, 7) || "unknown")} (previous) vs ${fenceText(headSha.slice(0, 7) || "unknown")} (current) @@`,
  ]
  const root = treeForAssociations(unionEdges)
  root.children.forEach((child, index) => {
    // Independent recorded roots separate with one fence-safe " " line.
    if (index > 0) lines.push(" ")
    const mark = diffBranchMark(child, marks)
    lines.push(`${mark} ${diffNodeLine(child)}`)
    renderDiffChildren(child, "", lines, marks, annotated, inheritSteps(child, new Set()))
  })
  return lines.join("\n")
}

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
 * Named workload delta — `+A −R destination(s)` — numbers bold, unit
 * named, zero sides dropped (`−1 destination`, never `+0 −1`). The unit
 * inflects on the total moved identities.
 * @param {number} added
 * @param {number} removed
 * @param {{ bold?: boolean }} [options]
 */
function deltaPhrase(added, removed, { bold = true } = {}) {
  const sides = []
  if (added > 0) sides.push(`+${added}`)
  if (removed > 0) sides.push(`−${removed}`)
  const unit = added + removed === 1 ? "destination" : "destinations"
  const numbers = sides.join("&nbsp;")
  return `${bold ? `<b>${numbers}</b>` : numbers}&nbsp;${unit}`
}

/**
 * The fold identity line: `workflow / job ↗` — the job-id text is the
 * hyperlink. Target: the specific Actions job URL when recorded, else the
 * run URL. Matrix cells are distinct jobs; the cell identity lives in the
 * job-id slot.
 * @param {{ name: string, workflow: string, job_url?: string, run_url?: string }} job
 */
function jobIdentity(job) {
  const wf = `<code>${escapeHtml(job.workflow)}</code>`
  const url = job.job_url || job.run_url
  const name = url
    ? `<a href="${escapeHtmlAttr(url)}"><code>${escapeHtml(job.name)}</code>&nbsp;↗</a>`
    : `<code>${escapeHtml(job.name)}</code>`
  return job.workflow !== "" ? `${wf} / ${name}` : name
}

/**
 * Explicit medium-forced omission line.
 * @param {number} x
 * @param {number} y
 */
const truncationLine = (x, y) =>
  CONTRACT_VOCAB.copy.truncationTemplate
    .replace("X", String(x))
    .replace("Y", String(y))

/**
 * Concise orientation fold with a lineage-exact mini tree. Open while
 * pending and on the first recorded result; collapsed on later updates.
 * @param {{ open?: boolean, comparison?: boolean }} [options]
 */
export function renderExplainer({ open = false, comparison = false } = {}) {
  // One mini tree of exactly the constructs the real renderer emits, with
  // ← arrow callouts aligned in one italic column at visible offset 23 —
  // every callout line fits ~44 monospace columns, so the tree teaches
  // without horizontal scroll at 390px. One reading sentence and one legend
  // line follow as proportional <sub> lines that wrap instead of scrolling.
  const callout = (/** @type {string} */ label) => `<em>← ${label}</em>`
  const lines = [
    `<details${open ? " open" : ""}><summary><sub>${VOCAB.explainerLabel}</sub></summary>`,
    "",
    "<pre>",
    `Runner.Worker          ${callout(VOCAB.explainerCalloutPath)}`,
    "└─ npm",
    `   └─ <strong>node</strong>             ${callout(VOCAB.explainerCalloutActed)}`,
    `      └─ ${VOCAB.terminalNetwork} npmjs[.]org ${callout(VOCAB.explainerCalloutAction)}`,
    "</pre>",
    "",
    `<sub><i>${VOCAB.explainerReadingLine}</i></sub>`,
    "",
    `<sub><i>${VOCAB.explainerLegendLine}</i></sub>`,
  ]
  if (comparison) {
    lines.push("", `<sub><i>${VOCAB.explainerComparisonLine}</i></sub>`)
  }
  lines.push("", "</details>")
  return lines.join("\n")
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
 * Fold summary row — the row's facts are the identity and the destination
 * count; no step-name sentence, no chain counts. Changed rows lead with
 * the bold delta as their only destination fact; unchanged comparison rows
 * read `· N destinations · unchanged` — adjacency scopes the claim to the
 * destination projection.
 * @param {ReviewJob} job
 * @param {{ delta?: JobDelta | null, treeEdges?: ReviewEdge[] | null }} [options]
 */
function jobSummaryLine(job, { delta = null, treeEdges = null } = {}) {
  const tree = treeEdges ?? job.edges
  const displayEdges = dedupeDestinationEdges(tree)
  const names = addressNameMap(tree)
  const treeCounts = new Set(displayEdges.map((edge) => destinationIdentity(edge, names))).size
  const parts = []
  // Changed rows lead with the bold delta: the left edge is the scan column,
  // so what moved reads top-to-bottom without reading a single job name.
  // The comparison base commit renders once at run scope (metadata line) and
  // inside the diff's @@ header — the fold row carries only its own delta.
  const changed = delta !== null && delta.addedCount + delta.removedCount > 0
  if (changed) parts.push(`${deltaPhrase(delta.addedCount, delta.removedCount)} ·`)
  parts.push(jobIdentity(job))
  if (!changed) {
    parts.push(`· ${countPhrase(treeCounts, "destination")}`)
    if (delta !== null) parts.push(`· ${VOCAB.noChange}`)
  }
  return parts.join(" ")
}

/**
 * Per-job edge retention order under medium truncation: IMDS edges first
 * (never evicted while any non-IMDS edge renders), then canonical order.
 * @param {ReviewEdge[]} edges
 */
function retentionOrder(edges) {
  /** @type {ReviewEdge[]} */
  const imds = []
  /** @type {ReviewEdge[]} */
  const rest = []
  for (const e of edges) (IMDS_ADDRESSES.has(e.remote_address) ? imds : rest).push(e)
  return [...imds, ...rest]
}

/**
 * Render the PR comment body with `kept` edges per job (kept = Map job.id →
 * count from the job's retention order; display stays canonical order).
 */
/**
 * Markdown commit reference: linked short sha when the commit URL is known.
 * @param {string} sha
 * @param {string} commitUrl
 */
function commitRef(sha, commitUrl) {
  const sha7 = escapeCode(sha.slice(0, 7) || "unknown")
  return commitUrl ? `[\`${sha7}\`](${commitUrl})` : `\`${sha7}\``
}

/**
 * The previous profiled commit's reference, linked when derivable.
 * @param {RunReview & { comparison: ReviewComparison }} review
 */
function previousCommitRef(review) {
  const prev = review.comparison.previousSha
  const url =
    review.commitUrl !== "" && review.sha !== "" && review.commitUrl.endsWith(review.sha)
      ? review.commitUrl.slice(0, review.commitUrl.length - review.sha.length) + prev
      : ""
  return commitRef(prev, url)
}

/**
 * The category heading — the core primitive stated as the high-level
 * summary: Execution Profiles belong to jobs; the commit is the trigger.
 * All counts and change facts live in the metadata line and job folds.
 * @param {RunReview} review
 */
function headlineSentence(review) {
  const k = review.counts.jobs
  const jobsNoun = `${k} job${k === 1 ? "" : "s"}`
  // Bold body line, not a `#` heading — a recurring bot comment speaks at
  // body register; the primitive is the emphasis, not the type size.
  return `**${VOCAB.headlineLead} ${jobsNoun}, triggered by ${commitRef(review.sha, review.commitUrl)}**`
}

/**
 * Comment-register counts: `destinations` totals the job folds' trees
 * exactly — each job's distinct destination identities, summed, so the
 * metadata count equals the fold rows' counts by inspection. `chains` is
 * the machine-register chain aggregate (every recorded destination
 * association) — it never renders on the human surface. Capture
 * multiplicity stays in the Step Summary and the review model.
 * @param {ReviewJob[]} jobs
 */
function commentRegisterCounts(jobs) {
  let chains = 0
  let destinations = 0
  for (const job of jobs) {
    const names = addressNameMap(job.edges)
    const shown = commentEdges(job.edges)
    chains += job.edges.length
    destinations += new Set(shown.map((edge) => destinationIdentity(edge, names))).size
  }
  return { chains, destinations }
}

/**
 * The human-line timestamp at minute precision; the machine marker keeps
 * the record's full-precision stamp.
 * @param {string} stamp
 */
function minuteStamp(stamp) {
  return stamp.replace(/(\d{2}:\d{2}):\d{2}/, "$1")
}

/**
 * Meta block — two blockquote lines in every state. The first line is the
 * finding: on a zero-delta comparison the verdict (`No changes since
 * <prev7>`); on comparison comments with movement the job segments (changed
 * with its +A −R delta, unchanged, no-outbound, no-longer-recorded — each
 * counting the folds/entries rendered beneath it) plus the comparison
 * pointer; on snapshot comments the destination total across the job folds.
 * The second line is one quiet `<sub>` provenance line: kernel provenance
 * and the record's timestamp at minute precision. Chain counts never render
 * here.
 * @param {RunReview} review
 * @param {ReturnType<typeof changeAccounting>} accounting
 */
function metaBlock(review, accounting) {
  /** @type {string[]} */
  const findings = []
  if (review.comparison !== null) {
    const comparisonReview =
      /** @type {RunReview & { comparison: ReviewComparison }} */ (review)
    const zeroDelta =
      accounting.changedJobs === 0 &&
      accounting.vanishedJobCount === 0 &&
      accounting.added === 0 &&
      accounting.removed === 0
    if (zeroDelta) {
      // Zero-delta comparison: the verdict is the finding.
      findings.push(`No changes ${VOCAB.sinceWord} ${previousCommitRef(comparisonReview)}`)
    } else {
      if (accounting.changedJobs > 0) {
        findings.push(
          `${countPhrase(accounting.changedJobs, "job")} ${VOCAB.jobsLineChanged} ${deltaPhrase(accounting.added, accounting.removed, { bold: false })}`,
        )
      }
      if (accounting.unchangedJobs > 0) {
        findings.push(`${countPhrase(accounting.unchangedJobs, "job")} ${VOCAB.jobsLineUnchanged}`)
      }
      if (accounting.noOutboundJobs > 0) {
        findings.push(`${countPhrase(accounting.noOutboundJobs, "job")} ${VOCAB.jobsLineNoOutbound}`)
      }
      if (accounting.vanishedJobCount > 0) {
        findings.push(`${countPhrase(accounting.vanishedJobCount, "job")} ${VOCAB.jobsLineVanished}`)
      }
      findings.push(`compared with ${previousCommitRef(comparisonReview)}`)
    }
  } else {
    // Snapshot: the destination total is the finding — the visible sum of
    // the fold rows beneath it (dns-resolver leaves included, every root).
    const { destinations } = commentRegisterCounts(review.jobs)
    let total = countPhrase(destinations, "destination")
    if (review.jobs.length > 1) {
      total += ` across ${countPhrase(review.jobs.length, "job")}`
    }
    findings.push(total)
  }
  const provenance = [CONTRACT_VOCAB.copy.kernelProvenance]
  if (review.recordedThrough !== "") provenance.push(minuteStamp(review.recordedThrough))
  return [`> *${findings.join(" · ")}*`, `> <sub>${provenance.join(" · ")}</sub>`]
}

/**
 * Comparison identity of a job: matrix cells are distinct jobs, so the cell
 * discriminator belongs in the key — otherwise every cell of a matrix would
 * diff against one arbitrary earlier cell.
 * @param {{ workflow: string, name: string, job_index?: string }} job
 */
const comparisonIdentity = (job) =>
  `${job.workflow}\u0000${job.name}\u0000${job.job_index ?? ""}`

/**
 * @param {{ workflow: string, name: string }} job
 */
const jobNameKey = (job) => `${job.workflow}\u0000${job.name}`

/**
 * @template T
 * @param {T[]} jobs
 * @param {(job: T) => string} key
 */
const countByKey = (jobs, key) => {
  /** @type {Map<string, number>} */
  const counts = new Map()
  for (const job of jobs) counts.set(key(job), (counts.get(key(job)) ?? 0) + 1)
  return counts
}

/**
 * Pair each recorded job with its counterpart on the previous profiled commit.
 * Matching is exact on workflow + job + matrix cell, so matrix cells never
 * diff against each other. When a record carries no cell index at all, the
 * name alone identifies the job — but only while it is unique on both sides.
 * @param {ReviewJob[]} headJobs
 * @param {PreviousJob[]} previousJobs
 * @returns {{ pairs: Map<number, PreviousJob | null>, matched: Set<PreviousJob> }}
 */
function pairWithPreviousJobs(headJobs, previousJobs) {
  const prevByIdentity = new Map(previousJobs.map((j) => [comparisonIdentity(j), j]))
  const prevByName = new Map(previousJobs.map((j) => [jobNameKey(j), j]))
  const headNameCounts = countByKey(headJobs, jobNameKey)
  const prevNameCounts = countByKey(previousJobs, jobNameKey)

  /** @type {Map<number, PreviousJob | null>} */
  const pairs = new Map()
  /** @type {Set<PreviousJob>} */
  const matched = new Set()
  for (const job of headJobs) {
    let prev = prevByIdentity.get(comparisonIdentity(job))
    if (
      prev === undefined &&
      headNameCounts.get(jobNameKey(job)) === 1 &&
      prevNameCounts.get(jobNameKey(job)) === 1
    ) {
      prev = prevByName.get(jobNameKey(job))
    }
    pairs.set(job.id, prev ?? null)
    if (prev !== undefined && prev !== null) matched.add(prev)
  }
  return { pairs, matched }
}

/**
 * Per-job comparison deltas over comment-visible chains, keyed by job id.
 * Returns null when the review carries no comparison.
 * @param {RunReview} review
 * @returns {Map<number, JobDelta> | null}
 */
function reviewDeltas(review) {
  if (review.comparison === null) return null
  const { pairs } = pairWithPreviousJobs(review.jobs, review.comparison.previousJobs)
  /** @type {Map<number, JobDelta>} */
  const deltas = new Map()
  for (const job of review.jobs) {
    const prev = pairs.get(job.id)
    const prevEdges = prev ? prev.edges : []
    // One identity-set diff per job over every recorded chain — whole-job
    // destination identity, no partition, no quieting layer.
    const names = addressNameMap(job.edges, prevEdges)
    deltas.set(job.id, {
      ...compareJobEdges(job.edges, prevEdges),
      names,
    })
  }
  return deltas
}

/**
 * Jobs recorded on the previous profiled commit with no counterpart on this
 * one. Their destinations left the record, so they carry their own removal
 * count instead of disappearing from the comparison — destination counts
 * are the same pointable unit as everywhere else.
 * @param {RunReview} review
 * @returns {{ job: PreviousJob, destinations: number }[]}
 */
function vanishedJobs(review) {
  if (review.comparison === null) return []
  const { matched } = pairWithPreviousJobs(review.jobs, review.comparison.previousJobs)
  return review.comparison.previousJobs
    .filter((job) => !matched.has(job))
    .map((job) => {
      const names = addressNameMap(job.edges)
      const shown = commentEdges(job.edges)
      const destinations = new Set(
        shown.map((edge) => destinationIdentity(edge, names)),
      ).size
      return { job, destinations }
    })
    .filter((entry) => entry.destinations > 0)
}

/**
 * Change accounting for a review: per-job ordering tier plus the run-scope
 * job totals the jobs line and machine summary speak. Tier 0 is a
 * destination change, 1 no change, 2 no outbound destinations.
 * @param {RunReview} review
 */
function changeAccounting(review) {
  const deltas = reviewDeltas(review)
  /** @type {Map<number, number>} */
  const tiers = new Map()
  const totals = {
    changedJobs: 0,
    unchangedJobs: 0,
    noOutboundJobs: 0,
    added: 0,
    removed: 0,
  }
  for (const job of review.jobs) {
    let tier
    const delta = deltas ? deltas.get(job.id) : null
    // A destination delta outranks an empty head record: a job whose whole
    // record left is a changed job, never "no outbound destinations".
    if (delta !== null && delta !== undefined && delta.addedCount + delta.removedCount > 0) {
      tier = 0
      totals.changedJobs += 1
      totals.added += delta.addedCount
      totals.removed += delta.removedCount
    } else if (job.edges.length === 0) {
      tier = 2
      totals.noOutboundJobs += 1
    } else {
      tier = 1
      totals.unchangedJobs += 1
    }
    tiers.set(job.id, tier)
  }
  const vanished = vanishedJobs(review)
  return {
    deltas,
    tiers,
    ...totals,
    vanishedJobCount: vanished.length,
    vanishedDestinations: vanished.reduce((n, entry) => n + entry.destinations, 0),
  }
}

/**
 * The machine summary marker: one HTML comment carrying the run-scope
 * counts as JSON so agents read structure instead of parsing the human
 * surface. Every number equals the corresponding rendered count;
 * comparison-only fields are null on snapshot comments.
 * @param {RunReview} review
 * @param {ReturnType<typeof changeAccounting>} accounting
 */
function machineSummaryMarker(review, accounting) {
  const { chains, destinations } = commentRegisterCounts(review.jobs)
  const comparing = review.comparison !== null
  const summary = {
    contract: CONTRACT_VOCAB.version,
    commit: review.sha,
    previous: review.comparison !== null ? review.comparison.previousSha : null,
    jobs: review.jobs.length,
    changed: comparing ? accounting.changedJobs : null,
    unchanged: comparing ? accounting.unchangedJobs : null,
    noOutbound: comparing ? accounting.noOutboundJobs : null,
    vanished: comparing ? accounting.vanishedJobCount : null,
    added: comparing ? accounting.added : null,
    removed: comparing ? accounting.removed : null,
    vanishedDestinations: comparing ? accounting.vanishedDestinations : null,
    chains,
    destinations,
    kinds: ["network"],
  }
  // `--` is escaped inside JSON strings so a hostile record-sourced value
  // can never terminate the HTML comment; JSON.parse restores the bytes.
  const json = JSON.stringify(summary).replace(/--/g, "-\\u002d")
  return `<!-- ${VOCAB.machineSummaryMarker} ${json} -->`
}

/**
 * @param {RunReview} review
 * @param {Map<number, number>} kept
 * @param {{ explainerOpen?: boolean }} [options]
 */
function renderCommentBody(review, kept, { explainerOpen = false } = {}) {
  const lines = [RUNTIME_REVIEW_MARKER, COMMENT_MARKER]
  if (review.sha !== "") lines.push(`<!-- garnet:commit ${review.sha} -->`)
  const accounting = changeAccounting(review)
  const deltas = accounting.deltas
  lines.push(machineSummaryMarker(review, accounting))
  lines.push(headlineSentence(review))
  lines.push("")
  lines.push(...metaBlock(review, accounting))
  lines.push("")

  const previousSha = review.comparison ? review.comparison.previousSha : ""

  for (const job of review.jobs) {
    const delta = deltas ? deltas.get(job.id) : null
    const changed =
      delta !== null && delta !== undefined && delta.addedCount + delta.removedCount > 0
    const keptCount = kept.get(job.id) ?? job.edges.length
    const retained = new Set(retentionOrder(job.edges).slice(0, keptCount))
    const shownRaw = job.edges.filter((e) => retained.has(e))
    // One block per job: every recorded root of the job's projection — no
    // attribution partition, no category labels.
    const shown = commentEdges(shownRaw)
    // An empty projection renders a plain row that keeps the job's
    // Execution Profile link when known — an empty egress projection never
    // implies Garnet observed nothing.
    if (job.edges.length === 0 && !changed) {
      const link = profilePermalink(job, review.appUrl, "pr_comment")
      const profilePart =
        link !== ""
          ? ` · <a href="${escapeHtmlAttr(link)}">${VOCAB.artifact}</a>`
          : ""
      lines.push(`<sub>${jobIdentity(job)} — ${VOCAB.emptyPeers}${profilePart}</sub>`)
      lines.push("")
      continue
    }
    // Quiet by default: the only folds that ever open are changed folds
    // within the budget. Snapshot, first-profile, and unchanged folds stay
    // collapsed — their rows carry the counts.
    const open = changed && accounting.changedJobs <= FOLD_OPEN_BUDGET
    lines.push(
      `<details${open ? " open" : ""}><summary>${jobSummaryLine(job, { delta: delta ?? null, treeEdges: shown })}</summary>`,
    )
    lines.push("")
    if (changed) {
      lines.push("```diff")
      lines.push(renderJobDiffTree({ ...job, edges: shown }, delta, review.sha, previousSha))
      lines.push("```")
      lines.push("")
    } else if (shown.length > 0) {
      lines.push("<pre>")
      lines.push(renderJobTree(job, shown))
      lines.push("</pre>")
      lines.push("")
    }
    if (shownRaw.length < job.edges.length) {
      lines.push(`<sub>${truncationLine(shownRaw.length, job.edges.length)}</sub>`)
      lines.push("")
    }
    const link = profilePermalink(job, review.appUrl, "pr_comment")
    if (link !== "") {
      lines.push(
        `<p align="right"><sub><a href="${escapeHtmlAttr(link)}">${VOCAB.permalinkLabel}</a></sub></p>`,
      )
      lines.push("")
    }
    lines.push("</details>")
    lines.push("")
  }

  // Jobs that left the record sit below this commit's behavior, in one
  // collapsed self-counting fold — destination counts, the same pointable
  // unit as everywhere else.
  const vanished = vanishedJobs(review)
  if (vanished.length > 0) {
    lines.push(
      `<details><summary><sub>${VOCAB.vanishedJobsLabel} · ${countPhrase(vanished.length, "job")} · ${countPhrase(accounting.vanishedDestinations, "destination")}</sub></summary>`,
    )
    lines.push("")
    lines.push(
      vanished
        .map(
          ({ job, destinations }) =>
            `<sub>${jobIdentity(job)} · ${countPhrase(destinations, "destination")}</sub>`,
        )
        .join("<br>\n"),
    )
    lines.push("")
    lines.push("</details>")
    lines.push("")
  }

  // The explainer sits at the bottom under a divider; open only on a
  // first-profile comment.
  lines.push("---")
  lines.push("")
  lines.push(renderExplainer({ open: explainerOpen, comparison: review.comparison !== null }))

  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()
  return lines.join("\n")
}

/**
 * Deterministic explicit minimal fallback for the pathological case where
 * even zero kept edges (the fixed per-job fold overhead) exceeds the medium
 * budget: markers, heading, headline, coverage count, the exact truncation
 * line, and — when they still fit — the run-index link(s).
 * @param {RunReview} review
 */
function renderMinimalComment(review) {
  const head = [RUNTIME_REVIEW_MARKER, COMMENT_MARKER]
  if (review.sha !== "") head.push(`<!-- garnet:commit ${review.sha} -->`)
  head.push(headlineSentence(review))
  head.push("")
  head.push(`<sub>${truncationLine(0, review.counts.associations)}</sub>`)
  return head.join("\n")
}

/**
 * Render the Garnet Runtime Review PR comment. Jobs in review order
 * (change tiers on comparison comments, else alphabetic by
 * `workflow / job`); edges in canonical deterministic order.
 * Truncation (only because of the medium budget, never silently) drops edges
 * via a deterministic fair round-robin across jobs in canonical order — IMDS
 * associations retained first — and emits an explicit destination-association
 * line per truncated fold.
 * @param {RunReview} review
 * @param {RenderRunReviewOptions} [opts] explainer opens on the first
 * recorded result and collapses on later updates; `budget` lowers the
 * serialized byte budget below the contract default when the caller wraps
 * the review with additional payload (never raises it)
 */
export function renderRunReview(review, opts = {}) {
  const explainerOpen = opts.explainerOpen === true
  const budget =
    typeof opts.budget === "number" && Number.isSafeInteger(opts.budget) && opts.budget < SIZE_BUDGET
      ? opts.budget
      : SIZE_BUDGET
  const full = renderCommentBody(review, new Map(), { explainerOpen })
  if (Buffer.byteLength(full, "utf8") <= budget) return full

  // Global round-robin retention order: round r keeps the r-th edge of each
  // job's retention queue, jobs visited in canonical order.
  const queues = review.jobs.map((j) => ({ id: j.id, total: j.edges.length }))
  /** @type {{id: number}[]} */
  const order = []
  for (let round = 0; order.length < review.counts.associations; round += 1) {
    for (const q of queues) {
      if (round < q.total) order.push({ id: q.id })
    }
  }

  const bodyFor = (/** @type {number} */ keepTotal) => {
    /** @type {Map<number, number>} */
    const kept = new Map(review.jobs.map((j) => [j.id, 0]))
    for (let i = 0; i < keepTotal; i += 1) {
      const entry = order[i]
      if (entry === undefined) break
      kept.set(entry.id, (kept.get(entry.id) ?? 0) + 1)
    }
    return renderCommentBody(review, kept, { explainerOpen })
  }

  // Largest edge total whose serialized body fits the budget (binary search
  // — rendering is deterministic, so this is reproducible).
  let lo = 0
  let hi = review.counts.associations - 1
  let best = bodyFor(0)
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const body = bodyFor(mid)
    if (Buffer.byteLength(body, "utf8") <= budget) {
      best = body
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  // True final cap: when even the zero-edge body's fixed overhead exceeds
  // the budget, fall back to the deterministic minimal comment.
  if (Buffer.byteLength(best, "utf8") > budget) return renderMinimalComment(review)
  return best
}

/**
 * @typedef {{
 *   explainerOpen?: boolean
 *   budget?: number
 * }} RenderRunReviewOptions
 */

/**
 * The waiting/pending comment: open explainer + hourglass, but no timestamp,
 * renderer clock, count, expected denominator, or permalink.
 * @param {{sha?: string, commitUrl?: string, appMode?: boolean}} input
 */
export function renderPendingReview(input = {}) {
  const sha = String(input.sha || "")
  const lines = [RUNTIME_REVIEW_MARKER, COMMENT_MARKER]
  if (sha !== "") lines.push(`<!-- garnet:commit ${sha} -->`)
  lines.push(
    `**${CONTRACT_VOCAB.copy.headlinePendingLead} ${commitRef(sha, String(input.commitUrl || ""))}**`,
  )
  lines.push("")
  lines.push(CONTRACT_VOCAB.copy.pendingStatus)
  lines.push("")
  lines.push("---")
  lines.push("")
  lines.push(renderExplainer({ open: true }))
  return lines.join("\n")
}

/**
 * Wrap an exact renderer body as the testbed-only "after" comment while
 * replacing ownership markers that the App and Action fallback use.
 * Visible renderer copy and layout remain unchanged.
 * @param {string} body
 */
export function renderReferenceMockup(body, stepSummary = "") {
  const projectedBody = String(body)
    .replaceAll(RUNTIME_REVIEW_MARKER, "<!-- garnet-reference-renderer-body -->")
    .replaceAll(COMMENT_MARKER, "<!-- garnet-reference-renderer-owner:none -->")
    .replace(
      /<!-- garnet:commit ([0-9a-f]+) -->/gi,
      "<!-- garnet-reference-renderer-commit $1 -->",
    )

  const lines = [
    REFERENCE_MOCKUP_MARKER,
    `<!-- garnet-reference-renderer-contract:v${CONTRACT_VOCAB.version} -->`,
    `> **After — v${CONTRACT_VOCAB.version} reference renderer.** Generated from this PR's captured profiles by the contract active in this branch. Compare it with the installed GitHub App's live **Before** comment on this PR. This preview updates in place; neither the App nor the Action fallback owns it.`,
    "",
    projectedBody,
  ]

  // Second surface: the exact job Step Summary (lineage-keyed egress table)
  // as it renders in the Actions run Summary tab — embedded here so this one
  // isolated comment shows BOTH shipped surfaces for review in one place.
  if (String(stepSummary).trim()) {
    lines.push(
      "",
      "<!-- garnet-reference-renderer-step-summary -->",
      "<details><summary><strong>Step Summary</strong> — as rendered in the Actions run Summary tab</summary>",
      "",
      String(stepSummary).trim(),
      "",
      "</details>",
    )
  }

  return lines.join("\n")
}

// ---------------------------------------------------------------------------
// Step Summary.
// ---------------------------------------------------------------------------

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
 * Destination-first Step Summary projection: one row per source peer in the
 * profile's recorded order, with every process tree retained in source order.
 * @param {ReviewEdge[]} edges
 * @returns {DestinationRow[]}
 */
export function buildDestinationRows(edges) {
  /** @type {DestinationRow[]} */
  const rows = []
  /** @type {Map<number, DestinationRow>} */
  const byKey = new Map()
  for (const edge of edges) {
    const key = edge.flow_id
    let row = byKey.get(key)
    if (!row) {
      row = {
        flow_id: edge.flow_id,
        remote_address: edge.remote_address,
        remote_names: edge.remote_names,
        associations: [],
      }
      byKey.set(key, row)
      rows.push(row)
    }
    row.associations.push(edge)
  }
  return rows
    .sort((a, b) => a.flow_id - b.flow_id)
    .map((row) => ({
      ...row,
      associations: row.associations
        .slice()
        .sort((a, b) => a.tree_index - b.tree_index),
    }))
}

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
  if (labels.length === 1) return `<code>${escapeHtmlCell(truncateMiddle(labels[0]))}</code>`
  return labels
    .map((label) => `· <code>${escapeHtmlCell(truncateMiddle(label))}</code>`)
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
  const lines = ["| Process Tree | Destinations |", "| --- | --- |"]
  for (const row of rows) {
    lines.push(`| ${processTreeCell(row.edge, true)} | ${lineageDestinationsCell(row)} |`)
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
 * @param {ReviewJob} job
 */
function hasExplainableTelemetry(job) {
  if (
    job.telemetry.total_domains === null ||
    job.telemetry.total_connections === null ||
    telemetryDiscrepancies(job).length > 0
  ) {
    return false
  }
  return true
}

/**
 * Djalal's sensor + derived telemetry semantics in the approved prose shape.
 * @param {ReviewJob} job
 */
function renderTelemetry(job) {
  if (!hasExplainableTelemetry(job)) return ""
  const domains = `${job.telemetry.total_domains} unique domain${job.telemetry.total_domains === 1 ? "" : "s"}`
  const connections = `${job.telemetry.total_connections} connection${job.telemetry.total_connections === 1 ? "" : "s"}`
  return `Network telemetry observed ${domains}, ${job.counts.destinations} destination${job.counts.destinations === 1 ? "" : "s"}, ${connections}, and ${job.counts.flows} flow${job.counts.flows === 1 ? "" : "s"}.`
}

/**
 * @param {ReviewEdge[]} edges
 */
function renderRecordedContextPreview(edges) {
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
      ...edgeNotes(edge, { detections: true }).map((note) =>
        note.startsWith("detection: ")
          ? `\`${escapeCodeCell(note)}\``
          : `(${escapeMarkdownCell(note)})`,
      ),
    )
    if (edge.result.toLowerCase() === "attention") context.push("⚠ attention")
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
  // Workflow, run, and job identity live in the Workload table; the footer
  // adds only the recording timestamp and the product path.
  const stamp = formatTimestamp(job.timestamp)
  const lines = ['<div align="right">']
  if (stamp !== "") lines.push(`<sub>${stamp}</sub><br>`)
  const link = profilePermalink(job, appUrl, "step_summary")
  const cta =
    link === ""
      ? "<strong>Powered by Garnet</strong>"
      : `<a href="${escapeHtmlAttr(link)}">${VOCAB.permalinkLabel}</a>`
  lines.push(cta, "</div>")
  if (job.run_url !== "") {
    lines.push(
      "",
      `<sub><a href="${escapeHtmlAttr(job.run_url)}">Job summary generated at run-time</a></sub>`,
    )
  } else {
    lines.push("", "<sub>Job summary generated at run-time</sub>")
  }
  return lines.join("\n")
}

/**
 * @param {ReviewJob} job
 * @param {string} appUrl
 * @param {number} keptDestinations
 * @param {boolean} previewAssertions
 */
function renderProfileSummary(job, appUrl, keptDestinations, previewAssertions) {
  const lines = [`## ${VOCAB.stepSummaryHeading}`, ""]

  lines.push("### Workload Summary", "")
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
  if (job.workflow !== "") rows.push(["Workflow", escapeMarkdownCell(job.workflow)])
  if (job.repository !== "") rows.push(["Repository", escapeMarkdownCell(job.repository)])
  if (job.ref !== "") rows.push(["Branch", escapeMarkdownCell(job.ref)])
  if (job.pr_url !== "") {
    const prNumber = job.pr_url.split("/").pop()
    rows.push(["Pull request", `[#${escapeMarkdownCell(prNumber ?? "")}](${job.pr_url})`])
  }
  if (job.sha !== "") rows.push(["Commit", escapeMarkdownCell(job.sha)])
  if (job.actor !== "") rows.push(["Triggered by", escapeMarkdownCell(job.actor)])
  if (job.run_id !== "" || job.name !== "") {
    rows.push(["Run ID / Job", escapeMarkdownCell([job.run_id, job.name].filter(Boolean).join(" / "))])
  }
  if (job.job_index !== "") rows.push(["Matrix job index", escapeMarkdownCell(job.job_index)])
  lines.push("| Field | Value |")
  lines.push("| --- | --- |")
  for (const [key, value] of rows) {
    lines.push(`| ${escapeMarkdownCell(key)} | ${value} |`)
  }
  lines.push("")

  lines.push("### Network Egress Summary", "")
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
      lines.push(
        `<sub>rendered ${shown.length} of ${lineageRows.length} execution chains</sub>`,
      )
      lines.push("")
    }
  }

  // Absolute recorded tree in the PR-comment grammar; no comparison material.
  if (job.edges.length > 0) {
    lines.push("<details><summary><sub>Full recorded tree</sub></summary>")
    lines.push("")
    lines.push("<pre>")
    lines.push(renderJobTree(job, job.edges, { defang: false }))
    lines.push("</pre>")
    lines.push("</details>")
    lines.push("")
  }

  const telemetry = renderTelemetry(job)
  if (telemetry !== "") {
    lines.push(telemetry)
    lines.push("")
  }

  if (previewAssertions) {
    lines.push(renderRecordedContextPreview(job.edges))
    lines.push("")
    lines.push(renderAssertionPreview(job.assertions))
    lines.push("")
  }

  lines.push(renderStepSummaryFooter(job, appUrl))
  return lines.join("\n")
}

/**
 * Render the GitHub Step Summary: heading `## Garnet Runtime Summary`,
 * Workload first, then the lineage-first network-egress table, source-
 * backed telemetry, optional preview-only assertions, and the aligned footer.
 * The 1 MiB budget uses deterministic fair-round-robin retention.
 * @param {unknown[]} profiles raw parsed Jibril profiles
 * @param {{appUrl?: string, preview?: boolean}} [opts]
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
        renderProfileSummary(j, appUrl, kept.get(i) ?? Infinity, opts.preview === true),
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

/**
 * Semantic surface linter — guards the whole class of "same fact rendered
 * twice in one visual block" regressions (e.g. telemetry counts printed in
 * both the prose line and the footer). Byte-goldens cannot catch this because
 * they lock whatever the renderer emits, duplication included. The Step
 * Summary is split into per-job sections; the PR comment is checked whole.
 * Returns a list of human-readable violations; an empty array means clean.
 * @param {string} surface rendered markdown/HTML for one run
 * @param {"pr"|"step-summary"} kind
 * @returns {string[]}
 */
export function lintRenderedSurface(surface, kind) {
  /** @type {string[]} */
  const violations = []
  const count = (/** @type {string} */ text, /** @type {RegExp} */ re) => (text.match(re) || []).length
  if (kind === "step-summary") {
    const sections = surface.split(/\n\n---\n\n/)
    sections.forEach((section, i) => {
      /** @type {[string, RegExp][]} */
      const families = [
        ["telemetry unique-domain count", /\bunique domain/gi],
        ["telemetry connection count", /\d+ connections?\b/gi],
        ["Powered by Garnet footer", /Powered by Garnet/gi],
        // The exact profile selector renders in exactly two designated
        // places: the Workload table's Profile row and the footer CTA.
        ["profile permalink (Profile row)", /\| Profile \| \[/g],
        ["profile permalink (footer CTA)", new RegExp(`>${VOCAB.permalinkLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<`, "g")],
      ]
      for (const [name, re] of families) {
        const n = count(section, re)
        if (n > 1) {
          violations.push(
            `step-summary job section ${i}: "${name}" appears ${n}× (expected \u2264 1)`,
          )
        }
      }
    })
  } else {
    // The PR comment carries no telemetry counts at all; any occurrence means
    // a fact family leaked into the wrong surface.
    /** @type {[string, RegExp][]} */
    const forbidden = [
      ["telemetry prose", /Network telemetry observed/gi],
      ["telemetry unique-domain count", /\bunique domain/gi],
    ]
    for (const [name, re] of forbidden) {
      const n = count(surface, re)
      if (n > 0) {
        violations.push(`pr comment: "${name}" must not appear (found ${n}\u00d7)`)
      }
    }
  }
  return violations
}
