import { isIP } from "node:net"
import CONTRACT_VOCAB from "./contract/vocab.json" with { type: "json" }

/**
 * Garnet execution comment — the action's standalone fallback renderer,
 * vendored from the locked reference renderer for contract v6.6.1
 * (garnet-org/runtime-review-testbed, `cmd/garnet-runtime-review/review.mjs`).
 * The contract vocabulary is byte-locked by `src/contract/vocab.json`, a
 * verbatim copy of the testbed's `contract/vocab.json`.
 *
 * Three projections of the same record set exist in the contract: the GitHub
 * PR comment, the GitHub job Step Summary, and the public Execution Profile
 * (served by the Garnet app). This action renders the first two.
 *
 * Record model (v6.5.0):
 *   - One destination association = one `network.egress.peers[]` item × one
 *     `proc_trees[]` item. A peer with no proc_trees emits one association
 *     with lineage `unknown (not recorded)`.
 *   - The record is egress-centric — it is NOT a process inventory; a
 *     process that made no recorded egress may not appear.
 *   - The evidence model is lossless; the comment projection deduplicates
 *     destination identities so capture multiplicity never becomes churn.
 *   - `arguments`/argv and `executable` paths are embargoed: never captured
 *     into the render model, never emitted on any surface.
 *   - Typography is attribution, not trust: a lineage recorded under a
 *     GitHub step below `Runner.Worker` is bold; runner scaffolding is
 *     italic. A recorded detection always overrides de-emphasis.
 *   - Counts are mechanical and qualified. Sensor telemetry is preserved
 *     verbatim and never aliased to renderer-derived destinations or flows.
 *   - Timestamps come from `profile.timestamp` only, rendered
 *     `YYYY-MM-DD HH:MM:SS UTC`; the renderer clock never substitutes.
 *   - Medium truncation is a deterministic fair round-robin across jobs in
 *     canonical order, IMDS-touching lineages retained first, with an
 *     explicit rendered-X-of-Y line — never silent.
 *
 * Action-local deviations from the reference renderer (both documented in
 * the README):
 *   - Execution comparison ("since <sha>") requires the previous profiled
 *     commit's records, which only the control-plane App holds. This
 *     fallback renders snapshot reviews only; the comparison-only fields of
 *     the machine summary marker stay null.
 *   - The exact `?profile=` selector requires the control-plane envelope
 *     Profile.ID, which the sensor upload response never reaches this
 *     action. When a job record carries no envelope ID the permalink falls
 *     back to `/dashboard/runs/<run-id>` (the app resolves it server-side).
 *
 * Deterministic by construction: same profile payload in → byte-identical
 * output out.
 */

/** Canonical sticky marker. */
export const RUNTIME_REVIEW_MARKER = "<!-- garnet-runtime-review -->"

/** Self-marker: identifies this renderer's own comments for update/delete. */
export const COMMENT_MARKER = "<!-- garnet-run-profile -->"

/**
 * Markers emitted by the control-plane GitHub App comment (the AUTHORITATIVE
 * execution comment). When the App has commented, this fallback defers.
 */
export const CONTROL_PLANE_MARKERS = [
    "garnet-control-plane-pr-comment:v1",
    "garnet-control-plane-pending-pr-comment:v1",
]

/** Exact emitted vocabulary — byte-locked by src/contract/vocab.json. */
export const VOCAB = {
    headlineLead: CONTRACT_VOCAB.copy.headlineLead,
    stepSummaryHeading: CONTRACT_VOCAB.copy.stepSummaryHeading,
    artifact: CONTRACT_VOCAB.copy.artifact,
    permalinkLabel: CONTRACT_VOCAB.copy.permalinkLabel,
    emptyPeers: CONTRACT_VOCAB.copy.emptyPeers,
    noRunProfile: CONTRACT_VOCAB.copy.noRunProfile,
    unknownLineage: CONTRACT_VOCAB.copy.unknownLineage,
    machineSummaryMarker: CONTRACT_VOCAB.copy.machineSummaryMarker,
    substrateFoldLabel: CONTRACT_VOCAB.copy.substrateFoldLabel,
    explainerLabel: CONTRACT_VOCAB.copy.explainerLabel,
    kernelProvenance: CONTRACT_VOCAB.copy.kernelProvenance,
}

/** PR comment serialized UTF-8 byte budget (GitHub hard cap is 65,536). */
export const SIZE_BUDGET = CONTRACT_VOCAB.mediumLimits.prCommentBudget

/** Step Summary hard limit (1 MiB). */
export const STEP_SUMMARY_BUDGET = CONTRACT_VOCAB.mediumLimits.stepSummaryHardLimit

/** Loopback matcher for the dns-resolver note (anchored — never a suffix). */
const LOOPBACK_RE = new RegExp(CONTRACT_VOCAB.notes.dnsResolver.loopbackPattern)

/** The three exact instance-metadata addresses. */
const IMDS_ADDRESSES = new Set(CONTRACT_VOCAB.notes.instanceMetadata.addresses)

// ---------------------------------------------------------------------------
// Typedefs.
// ---------------------------------------------------------------------------

/**
 * One destination association: one recorded egress peer × one recorded
 * process tree.
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
 * }} Edge
 */

/**
 * Sensor-reported egress telemetry, preserved verbatim (null = not recorded).
 * @typedef {{
 *   total_domains: number | null
 *   total_connections: number | null
 * }} JobTelemetry
 */

/**
 * One recorded assertion-evidence item (record-backed projection).
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
 * One recorded assertion.
 * @typedef {{
 *   class_id: string
 *   id: string
 *   description: string
 *   result: string
 *   evidence: AssertionEvidence[]
 * }} AssertionRecord
 */

/**
 * Mechanical structural counts over destination associations.
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
 * One job's collapsed record: identity, associations, and counts.
 * @typedef {{
 *   name: string
 *   workflow: string
 *   repository: string
 *   sha: string
 *   run_id: string
 *   run_url: string
 *   job_url: string
 *   profile_id: string
 *   uuid: string
 *   timestamp: string
 *   ref: string
 *   actor: string
 *   job_index: string
 *   flow_count: number
 *   telemetry: JobTelemetry
 *   assertions: AssertionRecord[]
 *   edges: Edge[]
 * }} JobRecord
 */

/**
 * A job inside a built review (JobRecord plus review id and counts).
 * @typedef {JobRecord & { id: number, counts: EdgeCounts }} ReviewJob
 */

/**
 * Input for {@link buildRunReview}.
 * @typedef {{
 *   repo?: string
 *   sha?: string
 *   commitURL?: string
 *   appURL?: string
 *   jobs: JobRecord[]
 * }} RunReviewInput
 */

/**
 * The built review model.
 * @typedef {{
 *   repo: string
 *   sha: string
 *   commitURL: string
 *   appURL: string
 *   recordedThrough: string
 *   jobs: ReviewJob[]
 *   counts: { jobs: number, associations: number, destinations: number }
 * }} RunReview
 */

/**
 * A node of the shared-prefix lineage tree.
 * @typedef {{
 *   name: string
 *   children: TreeNode[]
 *   childByKey: Map<string, TreeNode>
 *   associations: Edge[]
 *   pids: Set<string>
 *   processes: Set<string>
 *   steps: Set<string>
 *   emphasized: boolean
 * }} TreeNode
 */

/**
 * One lineage-first Step Summary row.
 * @typedef {{ edge: Edge, associations: Edge[] }} LineageRow
 */

// ---------------------------------------------------------------------------
// Escaping — every record-sourced string is attacker-controlled.
// ---------------------------------------------------------------------------

/**
 * Strip control characters from any record-sourced string.
 * @param {unknown} value
 * @returns {string}
 */
function stripControl(value) {
    return String(value ?? "").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "")
}

/**
 * Escape a value destined for INSIDE an HTML element. Three-plus backtick
 * runs are neutralized so hostile names can never open a fence even if the
 * surrounding HTML block is interrupted.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
    return stripControl(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/`{3,}/g, match => "ʼ".repeat(match.length))
        .replace(/[\r\n]+/g, " ")
        .trim()
}

/**
 * Neutralize markdown link vectors in record-sourced text that renders as
 * plain (non-<code>) content: `](` can close a link label and `://` can
 * autolink. HTML entities render identically but never parse as markdown.
 * @param {string} value
 * @returns {string}
 */
export function neutralizeMarkdown(value) {
    return value.replaceAll("](", "]&#40;").replaceAll("://", "&#58;//")
}

/**
 * Escape a value destined for INSIDE an HTML attribute.
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtmlAttr(value) {
    return stripControl(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/[\r\n]+/g, " ")
        .trim()
}

/**
 * Escape a value destined for INSIDE a `code span`.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeCode(value) {
    return stripControl(value)
        .replace(/`/g, "ʼ")
        .replace(/[\r\n]+/g, " ")
        .trim()
}

/**
 * Escape a value destined for INSIDE a `code span` that sits in a table
 * cell: code spans neutralize HTML/Markdown, but `|` still splits cells and
 * must be backslash-escaped at the GFM table layer.
 * @param {unknown} value
 * @returns {string}
 */
function escapeCodeCell(value) {
    return escapeCode(value).replaceAll("|", "\\|")
}

/**
 * Escape a value destined for HTML inside a GFM table cell.
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtmlCell(value) {
    return escapeHtml(value).replaceAll("|", "\\|")
}

/**
 * Bound a captured (attacker-controllable) label to `max` chars with a
 * middle ellipsis, preserving head+tail so it stays identifiable while a
 * crafted payload buried mid-string cannot survive or inflate token cost.
 * Full untruncated values remain in the Execution Profile / API.
 * @param {unknown} value
 * @param {number} [max]
 * @returns {string}
 */
export function truncateMiddle(value, max = 64) {
    const v = String(value ?? "")
    if (v.length <= max) return v
    const head = Math.ceil((max - 1) / 2)
    const tail = Math.floor((max - 1) / 2)
    return `${v.slice(0, head)}…${v.slice(v.length - tail)}`
}

/**
 * Escape a value destined for a markdown table cell.
 * @param {unknown} value
 * @returns {string}
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
 * True for IPv4/IPv6/address literals — an address-like name is not a
 * domain.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isAddressLike(value) {
    const v = String(value).trim().replace(/^\[|\]$/g, "")
    const host = v.split("%", 1)[0]
    return isIP(host ?? "") !== 0
}

/**
 * Deterministic timestamp formatting: `YYYY-MM-DD HH:MM:SS UTC` from
 * `profile.timestamp` only. Invalid/missing input → "" (never the renderer
 * clock).
 * @param {unknown} value
 * @returns {string}
 */
export function formatTimestamp(value) {
    const raw = String(value ?? "").trim()
    if (raw === "") return ""
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) return ""
    /** @param {number} n */
    const pad = n => String(n).padStart(2, "0")
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`
}

/**
 * Numeric port from a recorded remote_ports value (handles `53 (dns)`).
 * @param {unknown} value
 * @returns {number | null}
 */
function numericPort(value) {
    const match = /^\s*(\d+)/.exec(String(value))
    return match !== null ? Number(match[1]) : null
}

/**
 * Deterministic factual notes for one association:
 *   - `dns resolver` — loopback remote_address AND a remote_ports value with
 *     numeric port 53.
 *   - `instance metadata` — remote_address is one of the three exact IMDS
 *     addresses.
 *   - `detection: <kind>` — every non-empty recorded detection except
 *     `flow`.
 * @param {Edge} edge
 * @param {{ detections?: boolean }} [options]
 * @returns {string[]}
 */
export function edgeNotes(edge, { detections = true } = {}) {
    const notes = []
    if (LOOPBACK_RE.test(edge.remote_address) && edge.remote_ports.some(port => numericPort(port) === 53)) {
        notes.push(CONTRACT_VOCAB.notes.dnsResolver.text)
    }
    if (IMDS_ADDRESSES.has(edge.remote_address)) {
        notes.push(CONTRACT_VOCAB.notes.instanceMetadata.text)
    }
    if (!detections) return notes
    const recordedDetections = edge.detections
        .filter(value => value !== "" && value.toLowerCase() !== "flow")
        .sort()
    for (const detection of recordedDetections) {
        notes.push(`detection: ${detection}`)
    }
    return notes
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function toStringArray(value) {
    if (!Array.isArray(value)) return []
    return value.map(entry => String(entry ?? ""))
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown> | null}
 */
function asRecord(value) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        return /** @type {Record<string, unknown>} */ (value)
    }
    return null
}

/**
 * Expand one recorded peer into its edges (one per proc_tree; a peer with no
 * proc_trees emits one edge with unrecorded lineage). Preserves every
 * contract field verbatim; never captures `arguments` or `executable`.
 * @param {Record<string, unknown>} peer
 * @param {number} flowID
 * @returns {Edge[]}
 */
function peerEdges(peer, flowID) {
    // Record-faithful: recorded empty strings are preserved, never silently
    // filtered (projections skip empties at render time; counts exclude
    // them).
    const remoteNames = toStringArray(peer["remote_names"])
    const remoteAddress = String(peer["remote_address"] ?? "")
    const remotePorts = toStringArray(peer["remote_ports"])
    const protocol = String(peer["protocol"] ?? "")
    const result = String(peer["result"] ?? "")
    const rawDetections = Array.isArray(peer["detections"])
        ? peer["detections"]
        : Array.isArray(peer["Detections"])
          ? peer["Detections"]
          : []
    const detections = rawDetections.map(value => String(value ?? ""))
    const rawTrees = Array.isArray(peer["proc_trees"]) && peer["proc_trees"].length > 0 ? peer["proc_trees"] : [null]
    return rawTrees.map((rawTree, treeIndex) => {
        const tree = asRecord(rawTree)
        const pidValue = tree !== null ? tree["pid"] : undefined
        return {
            flow_id: flowID,
            tree_index: treeIndex,
            remote_address: remoteAddress,
            remote_names: remoteNames,
            remote_ports: remotePorts,
            protocol,
            result,
            detections,
            lineage_recorded: tree !== null,
            pid: pidValue !== undefined && pidValue !== null ? String(pidValue) : "",
            process: tree !== null ? String(tree["process"] ?? "") : "",
            ancestry: tree !== null ? toStringArray(tree["ancestry"]) : [],
            github_step: tree !== null ? String(tree["github_step"] ?? "") : "",
        }
    })
}

/**
 * Display lineage for one edge (raw, unescaped).
 * @param {Edge} edge
 * @returns {string}
 */
export function edgeLineage(edge) {
    if (!edge.lineage_recorded) return VOCAB.unknownLineage
    if (edge.ancestry.length > 0) return edge.ancestry.join(" › ")
    return edge.process !== "" ? edge.process : VOCAB.unknownLineage
}

/**
 * Canonical deterministic edge order: lineage, remote address,
 * ports/protocol, PID.
 * @param {Edge} a
 * @param {Edge} b
 * @returns {number}
 */
export function edgeComparator(a, b) {
    /** @param {Edge} edge */
    function key(edge) {
        return [
            edgeLineage(edge),
            edge.remote_address,
            edge.remote_ports.join(","),
            edge.protocol,
            edge.pid,
            String(edge.flow_id),
            String(edge.tree_index),
        ]
    }
    const keyA = key(a)
    const keyB = key(b)
    for (let i = 0; i < keyA.length; i += 1) {
        const left = keyA[i] ?? ""
        const right = keyB[i] ?? ""
        if (left < right) return -1
        if (left > right) return 1
    }
    return 0
}

/**
 * Flexible record-backed evidence projection; never synthesizes evidence.
 * @param {Record<string, unknown> | null} evidence
 * @param {string[]} keys
 * @returns {string}
 */
function evidenceValue(evidence, keys) {
    if (evidence === null) return ""
    for (const key of keys) {
        const value = evidence[key]
        if (value !== undefined && value !== null) {
            return Array.isArray(value) ? value.map(String).join(", ") : String(value)
        }
    }
    return ""
}

/**
 * Collapse one raw Jibril profile (format 0.2.0) into a job record with its
 * destination associations. An envelope wrapper (`{ id, data }`) carries the
 * control-plane Profile.ID; a raw record has none.
 * @param {unknown} profile
 * @returns {JobRecord | null}
 */
export function summarizeProfile(profile) {
    const envelope = asRecord(profile)
    if (envelope === null) return null
    const data = asRecord(envelope["data"])
    const p = data !== null ? data : envelope
    const scenarios = asRecord(p["scenarios"])
    const githubRecord = asRecord(scenarios !== null ? scenarios["github"] : p["github"])
    const github = githubRecord !== null ? githubRecord : {}

    const network = asRecord(p["network"])
    const egress = asRecord(network !== null ? network["egress"] : null)
    const rawPeers = egress !== null && Array.isArray(egress["peers"]) ? egress["peers"] : []
    const peers = rawPeers.map(rawPeer => asRecord(rawPeer)).filter(peer => peer !== null)
    const edges = peers.flatMap((peer, index) => peerEdges(peer, index)).sort(edgeComparator)

    const telemetryRecord = asRecord(p["telemetry"])
    const telemetryNetwork = asRecord(telemetryRecord !== null ? telemetryRecord["network"] : null)
    const egressTelemetry = asRecord(telemetryNetwork !== null ? telemetryNetwork["egress"] : null)
    const totalDomains = egressTelemetry !== null ? egressTelemetry["total_domains"] : null
    const totalConnections = egressTelemetry !== null ? egressTelemetry["total_connections"] : null

    const rawAssertions = Array.isArray(p["assertions"]) ? p["assertions"] : []
    /** @type {AssertionRecord[]} */
    const assertions = []
    for (const rawAssertion of rawAssertions) {
        const assertion = asRecord(rawAssertion)
        if (assertion === null) continue
        const rawEvidence = Array.isArray(assertion["evidence"]) ? assertion["evidence"] : []
        assertions.push({
            class_id: String(assertion["class_id"] ?? assertion["ClassId"] ?? ""),
            id: String(assertion["assertion_id"] ?? assertion["id"] ?? ""),
            description: String(assertion["description"] ?? ""),
            result: String(assertion["result"] ?? ""),
            evidence: rawEvidence.map(entry => {
                const evidence = asRecord(entry)
                return {
                    timestamp: evidenceValue(evidence, ["timestamp", "time", "created_at"]),
                    event: evidenceValue(evidence, ["event", "event_type", "kind", "detection"]),
                    remote_peer: evidenceValue(evidence, ["remote_peer", "remote_name", "remote_address", "peer"]),
                    protocol: evidenceValue(evidence, ["protocol"]),
                    ports: evidenceValue(evidence, ["ports", "remote_ports", "port"]),
                    result: evidenceValue(evidence, ["result"]),
                }
            }),
        })
    }

    const runID = String(github["run_id"] ?? "")
    const repository = String(github["repository"] ?? "")
    const serverURL = String(github["server_url"] ?? "")
    const jobIndexValue = github["job_index"]

    return {
        name: String(github["job"] ?? ""),
        workflow: String(github["workflow"] ?? ""),
        repository,
        sha: String(github["sha"] ?? ""),
        run_id: runID,
        run_url:
            runID !== "" && repository !== ""
                ? `${serverURL !== "" ? serverURL : "https://github.com"}/${repository}/actions/runs/${runID}`
                : "",
        job_url: "",
        profile_id: String(envelope["id"] ?? envelope["profile_id"] ?? ""),
        uuid: String(p["uuid"] ?? ""),
        timestamp: String(p["timestamp"] ?? ""),
        ref: String(github["ref"] ?? ""),
        actor: String(github["triggering_actor"] ?? github["actor"] ?? ""),
        job_index: jobIndexValue !== undefined && jobIndexValue !== null ? String(jobIndexValue) : "",
        flow_count: peers.length,
        telemetry: {
            total_domains: typeof totalDomains === "number" ? totalDomains : null,
            total_connections: typeof totalConnections === "number" ? totalConnections : null,
        },
        assertions,
        edges,
    }
}

/**
 * Mechanical structural counts over destination associations:
 *   - associations = Σ peers max(1, len(proc_trees));
 *   - recorded processes = distinct recorded lineage + PID identities;
 *   - destinations = distinct non-empty remote_address values;
 *   - observed domain names = distinct non-address-like first remote_names;
 *   - flows = raw peers length.
 * Secondary names are annotations, never extra identities.
 * @param {Edge[]} edges
 * @param {number} [flowCount]
 * @returns {EdgeCounts}
 */
export function edgeCounts(edges, flowCount) {
    const processes = new Set()
    const destinations = new Set()
    const primaryNames = new Set()
    const domains = new Set()
    const flowIDs = new Set()
    for (const edge of edges) {
        if (edge.lineage_recorded) {
            processes.add(JSON.stringify([edge.pid, edge.process, edge.ancestry]))
        }
        if (edge.remote_address !== "") destinations.add(edge.remote_address)
        const primaryName = canonicalRecordedName(edge.remote_names)
        if (primaryName !== "") primaryNames.add(primaryName)
        if (primaryName !== "" && !isAddressLike(primaryName)) domains.add(primaryName)
        flowIDs.add(edge.flow_id)
    }
    return {
        associations: edges.length,
        processes: processes.size,
        destinations: destinations.size,
        primary_names: primaryNames.size,
        domains: domains.size,
        flows: flowCount !== undefined && Number.isInteger(flowCount) ? flowCount : flowIDs.size,
    }
}

/**
 * Runtime telemetry comparison. This never throws: historical records may
 * legitimately disagree with the projection.
 * @param {ReviewJob} job
 * @returns {{ metric: string, sensor: number, derived: number, derivedLabel: string }[]}
 */
export function telemetryDiscrepancies(job) {
    const discrepancies = []
    if (job.telemetry.total_connections !== null && job.telemetry.total_connections !== job.counts.flows) {
        discrepancies.push({
            metric: "Connections",
            sensor: job.telemetry.total_connections,
            derived: job.counts.flows,
            derivedLabel: "recorded flows",
        })
    }
    if (job.telemetry.total_domains !== null && job.telemetry.total_domains !== job.counts.primary_names) {
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
 * Build the review model from job records. Canonical job order: alphabetic
 * by `workflow / job`.
 * @param {RunReviewInput} input
 * @returns {RunReview}
 */
export function buildRunReview(input) {
    /** @param {JobRecord} job */
    function jobSortKey(job) {
        return [job.workflow, job.name, job.run_id, job.job_index, job.profile_id, job.uuid, job.timestamp].join(
            "\u0000",
        )
    }

    const jobs = input.jobs
        .map((job, index) => {
            const edges = [...job.edges].sort(edgeComparator)
            return {
                ...job,
                id: index,
                edges,
                counts: edgeCounts(edges, job.flow_count),
            }
        })
        .sort((a, b) => {
            const ka = jobSortKey(a)
            const kb = jobSortKey(b)
            return ka < kb ? -1 : ka > kb ? 1 : 0
        })

    // `recorded through <max valid profile.timestamp>` — sensor time only.
    const stamps = jobs.map(job => formatTimestamp(job.timestamp)).filter(stamp => stamp !== "")
    stamps.sort()
    const recordedThrough = stamps.length > 0 ? (stamps[stamps.length - 1] ?? "") : ""

    const destinationUnion = new Set()
    for (const job of jobs) {
        for (const edge of job.edges) {
            if (edge.remote_address !== "") destinationUnion.add(edge.remote_address)
        }
    }

    return {
        repo: String(input.repo ?? ""),
        sha: String(input.sha ?? ""),
        commitURL: String(input.commitURL ?? ""),
        appURL: String(input.appURL ?? "https://app.garnet.ai").replace(/\/+$/, ""),
        recordedThrough,
        jobs,
        counts: {
            jobs: jobs.length,
            associations: jobs.reduce((total, job) => total + job.counts.associations, 0),
            destinations: destinationUnion.size,
        },
    }
}

// ---------------------------------------------------------------------------
// Permalinks.
// ---------------------------------------------------------------------------

/**
 * Exact profile selector URL: `/public/runs/{run_id}?profile=<profile_id>`.
 * `profile_id` is the control-plane envelope ID, not the raw record UUID.
 * @param {{ run_id: string, profile_id: string }} job
 * @param {string} appURL
 * @param {string} utmMedium
 * @returns {string}
 */
export function profilePermalink(job, appURL, utmMedium) {
    if (job.run_id === "" || job.profile_id === "" || appURL === "") return ""
    return `${appURL}/public/runs/${encodeURIComponent(job.run_id)}?profile=${encodeURIComponent(job.profile_id)}&utm_source=github&utm_medium=${utmMedium}`
}

/**
 * Action-local permalink: the exact `?profile=` selector when the envelope
 * Profile.ID is known, else the `/dashboard/runs/<run-id>` fallback (the
 * Garnet app resolves it server-side; a logged-out visitor is redirected to
 * the public run route).
 * @param {{ run_id: string, profile_id: string }} job
 * @param {string} appURL
 * @param {string} utmMedium
 * @returns {string}
 */
export function jobPermalink(job, appURL, utmMedium) {
    const exact = profilePermalink(job, appURL, utmMedium)
    if (exact !== "") return exact
    if (job.run_id === "" || appURL === "") return ""
    return `${appURL}/dashboard/runs/${encodeURIComponent(job.run_id)}?utm_source=github&utm_medium=${utmMedium}`
}

// ---------------------------------------------------------------------------
// PR comment.
// ---------------------------------------------------------------------------

/**
 * A recorded workload lineage is attributed by step metadata + descent.
 * @param {Edge} edge
 * @returns {boolean}
 */
export function isAttributedWorkload(edge) {
    return edge.github_step !== "" && edge.ancestry.includes("Runner.Worker")
}

/**
 * A non-flow detection overrides runner-scaffolding de-emphasis.
 * @param {Edge} edge
 * @returns {boolean}
 */
export function hasRecordedDetection(edge) {
    return edge.detections.some(value => value !== "" && value.toLowerCase() !== "flow")
}

/**
 * Format one note: structural notes are parenthetical; detections are not.
 * @param {string} note
 * @returns {string}
 */
function renderNote(note) {
    return note.startsWith("detection: ") ? escapeHtml(note) : `(${escapeHtml(note)})`
}

/**
 * Defang a hostname for the PR-comment surface: bracket the final dot
 * (`example[.]com`) so an untrusted recorded destination can never autolink
 * in GitHub comments or the emails/Slack mirrors that relay them. Address
 * literals are left verbatim (they do not autolink); the Step Summary and
 * the public report keep the canonical value.
 * @param {unknown} value
 * @returns {string}
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
 * @param {Edge} edge
 * @returns {string}
 */
function commentDestinationDisplay(edge) {
    return escapeHtml(defangHostname(truncateMiddle(edgePrimaryDestination(edge))))
}

/**
 * Preview-only destination display: canonical name, address, ports/protocol,
 * and secondary-name annotations from the record (sorted — capture order of
 * `remote_names` never changes bytes).
 * @param {Edge} edge
 * @param {(value: unknown) => string} escape
 * @returns {string}
 */
function destinationDisplay(edge, escape) {
    const primary = edgePrimaryDestination(edge)
    const parts = [escape(primary)]
    if (edge.remote_address !== "" && edge.remote_address !== primary) {
        parts.push(`[${escape(edge.remote_address)}]`)
    }
    if (edge.remote_ports.length > 0) {
        parts.push(`:${edge.remote_ports.map(escape).join(", ")}`)
    }
    if (edge.protocol !== "") parts.push(escape(edge.protocol))
    const secondaryNames = [
        ...new Set(edge.remote_names.filter(name => name !== "" && name !== primary && name !== edge.remote_address)),
    ].sort()
    if (secondaryNames.length > 0) {
        parts.push(`· also recorded: ${secondaryNames.map(escape).join(", ")}`)
    }
    return parts.join(" ")
}

/**
 * One association's typography state: attribution or detection emphasizes
 * it.
 * @param {Edge} edge
 * @returns {boolean}
 */
function edgeIsEmphasized(edge) {
    return hasRecordedDetection(edge) || isAttributedWorkload(edge)
}

/**
 * Render one association as one line inside a job fold's `<pre>` block.
 * @param {Edge} edge
 * @param {{ detections?: boolean }} [options]
 * @returns {string}
 */
export function renderEdgeLine(edge, { detections = false } = {}) {
    const parts = []
    const lineage = escapeHtml(edgeLineage(edge))
    parts.push(edgeIsEmphasized(edge) ? `<strong>${lineage}</strong>` : `<em>${lineage}</em>`)
    parts.push("→")
    parts.push(commentDestinationDisplay(edge))
    for (const note of edgeNotes(edge, { detections })) parts.push(renderNote(note))
    if (edge.github_step !== "") parts.push(`· step: ${escapeHtml(edge.github_step)}`)
    return parts.join(" ")
}

/**
 * Recorded ancestry path as process nodes; empty rungs do not render.
 * @param {Edge} edge
 * @returns {string[]}
 */
function edgeProcessPath(edge) {
    if (!edge.lineage_recorded) return [VOCAB.unknownLineage]
    const ancestry = edge.ancestry.filter(part => part !== "")
    if (ancestry.length > 0) return ancestry
    return [edge.process !== "" ? edge.process : VOCAB.unknownLineage]
}

/**
 * Comment-tree path: recorded ancestry rooted at `Runner.Worker` when the
 * lineage descends from it (the scaffolding prefix above the worker is
 * attribution-noise on the comment; the full path stays in the Step Summary
 * and the Execution Profile).
 * @param {Edge} edge
 * @returns {string[]}
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
 * @returns {string}
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
 * @param {Edge} edge
 * @returns {string}
 */
function edgePrimaryDestination(edge) {
    const name = canonicalRecordedName(edge.remote_names)
    if (name !== "") return name
    if (edge.remote_address !== "") return edge.remote_address
    return "(no destination recorded)"
}

/**
 * Normalize a destination identity with names learned from the whole
 * record. A bare address therefore joins the named identity recorded by a
 * sibling edge.
 * @param {Edge} edge
 * @param {Map<string, string>} [addressNames]
 * @returns {string}
 */
export function destinationIdentity(edge, addressNames = new Map()) {
    const primary = edgePrimaryDestination(edge)
    if (edge.remote_names.some(name => name !== "")) return primary
    const learned = addressNames.get(edge.remote_address)
    return learned !== undefined ? learned : primary
}

/**
 * One address→name map over every supplied edge set: the identity's name is
 * captured evidence, not an invention.
 * @param {...Edge[]} edgeSets
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
 * One representative edge per destination identity, named representatives
 * preferred, sorted by identity.
 * @param {Edge[]} edges
 * @param {Map<string, string>} [names]
 * @returns {Edge[]}
 */
function dedupeDestinationEdges(edges, names = addressNameMap(edges)) {
    /** @type {Map<string, Edge>} */
    const representatives = new Map()
    for (const edge of [...edges].sort(edgeComparator)) {
        const key = destinationIdentity(edge, names)
        const current = representatives.get(key)
        const named = edge.remote_names.some(name => name !== "")
        const currentNamed = current !== undefined && current.remote_names.some(name => name !== "")
        if (current === undefined || (named && !currentNamed)) representatives.set(key, edge)
    }
    return [...representatives.values()].sort((a, b) => {
        const ka = destinationIdentity(a, names)
        const kb = destinationIdentity(b, names)
        return ka < kb ? -1 : ka > kb ? 1 : edgeComparator(a, b)
    })
}

/**
 * Partition a job's edges for the comment fold — nothing subtracts:
 * attributed workload chains render in the main tree; dns-resolver chatter
 * and unattributed runner infrastructure render inside a nested collapsed
 * `dns + runner substrate` fold in the same job fold. When a job has no
 * attributed chains, the substrate fold carries the full record. Identity
 * keys come from one job-wide address→name map, so a name recorded on
 * either side of the partition unifies the same address everywhere and a
 * captured identity never disappears between the two partitions. Each
 * partition renders one row per destination identity — capture multiplicity
 * (distinct chains to the same identity) stays in the evidence register.
 * @param {Edge[]} edges
 * @returns {{ shown: Edge[], substrate: Edge[] }}
 */
export function partitionCommentEdges(edges) {
    /** @type {Edge[]} */
    const workload = []
    for (const edge of edges) {
        const notes = edgeNotes(edge, { detections: false })
        // Attribution alone decides the partition: a recorded detection
        // emphasizes a chain wherever it renders but never re-classes
        // unattributed runner infrastructure as workload.
        if (!notes.includes(CONTRACT_VOCAB.notes.dnsResolver.text) && isAttributedWorkload(edge)) {
            workload.push(edge)
        }
    }
    const names = addressNameMap(edges)
    // A bare-address representative whose address is named elsewhere in the
    // same record renders under that name — the identity's name is captured
    // evidence, not an invention.
    /** @param {Edge} edge */
    function unify(edge) {
        if (edge.remote_names.some(name => name !== "")) return edge
        const name = names.get(edge.remote_address)
        return name !== undefined ? { ...edge, remote_names: [name] } : edge
    }
    const shown = dedupeDestinationEdges(workload, names).map(unify)
    const shownIDs = new Set(shown.map(edge => destinationIdentity(edge, names)))
    const substrate = dedupeDestinationEdges(
        edges.filter(edge => !workload.includes(edge)),
        names,
    )
        .filter(edge => !shownIDs.has(destinationIdentity(edge, names)))
        .map(unify)
    return { shown, substrate }
}

/**
 * The nested collapsed substrate fold inside a job fold: this record's
 * dns/runner-infrastructure identities rendered one row each — visible on
 * one click, never counted-but-hidden. The label counts the rendered head
 * rows only.
 * @param {ReviewJob} job
 * @param {Edge[]} substrate
 * @returns {string[]}
 */
function renderSubstrateFold(job, substrate) {
    if (substrate.length === 0) return []
    const displayEdges = dedupeDestinationEdges(substrate)
    return [
        `<details><summary><sub>${VOCAB.substrateFoldLabel} · ${countPhrase(displayEdges.length, "chain")}</sub></summary>`,
        "",
        "<pre>",
        renderJobTree(job, displayEdges),
        "</pre>",
        "",
        "</details>",
    ]
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
        emphasized: false,
    }
}

/**
 * Add one destination association to a shared-prefix lineage tree. Nodes
 * are keyed by recorded process name along the lineage path; PID-distinct
 * capture stays in the evidence register (the comment tree renders one row
 * per destination identity).
 * @param {TreeNode} root
 * @param {Edge} edge
 * @returns {void}
 */
function addAssociationToTree(root, edge) {
    const path = commentTreePath(edge)
    const attributed = isAttributedWorkload(edge)
    const detected = hasRecordedDetection(edge)
    const workerIndex = path.indexOf("Runner.Worker")
    let node = root
    path.forEach((name, index) => {
        const terminal = index === path.length - 1
        // Emphasis is per-node, never inherited from descendants: a process
        // is bold only when it is itself attributed workload (below
        // `Runner.Worker` in a step-attributed lineage) or the terminal
        // process carries a recorded detection that overrides scaffolding
        // de-emphasis. Runner scaffolding at or above `Runner.Worker` stays
        // italic.
        const belowWorker = workerIndex !== -1 && index > workerIndex
        const nodeEmphasized = (attributed && belowWorker) || (terminal && detected)
        const key = JSON.stringify([name])
        let child = node.childByKey.get(key)
        if (child === undefined) {
            child = makeTreeNode(name)
            node.childByKey.set(key, child)
            node.children.push(child)
        }
        child.emphasized = child.emphasized || nodeEmphasized
        node = child
        if (terminal) {
            node.associations.push(edge)
            if (edge.pid !== "") node.pids.add(edge.pid)
            if (edge.process !== "") node.processes.add(edge.process)
            if (edge.github_step !== "") node.steps.add(edge.github_step)
        }
    })
}

/**
 * @param {Edge[]} edges
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
 * @returns {void}
 */
function mergeTreeNode(target, source) {
    target.associations.push(...source.associations)
    for (const pid of source.pids) target.pids.add(pid)
    for (const process of source.processes) target.processes.add(process)
    for (const step of source.steps) target.steps.add(step)
    target.emphasized = target.emphasized || source.emphasized
}

/**
 * If a process both has its own egress and appears as the prefix of deeper
 * lineage, render it once with destination leaves and child processes.
 * @param {TreeNode} node
 * @returns {void}
 */
function coalescePrefixTerminalNodes(node) {
    for (const child of node.children) coalescePrefixTerminalNodes(child)
    /** @type {Map<string, TreeNode[]>} */
    const grouped = new Map()
    for (const child of node.children) {
        const group = grouped.get(child.name) ?? []
        group.push(child)
        grouped.set(child.name, group)
    }
    for (const group of grouped.values()) {
        const branch = group.find(child => child.children.length > 0)
        if (branch === undefined) continue
        for (const child of group) {
            if (child !== branch && child.children.length === 0) mergeTreeNode(branch, child)
        }
    }
    node.children = node.children.filter(child => {
        const group = grouped.get(child.name) ?? []
        const branch = group.find(candidate => candidate.children.length > 0)
        return branch === undefined || child === branch || child.children.length > 0
    })
}

/**
 * Display-only process name: a trailing run of 4+ digits is provisioning
 * noise (provjobd1326539233 → provjobd) and strips from the comment tree;
 * the record, Step Summary, and chain identity keep the raw name.
 * @param {unknown} name
 * @returns {string}
 */
export function displayProcessName(name) {
    const raw = String(name ?? "")
    const stripped = raw.replace(/\d{4,}$/, "")
    return stripped === "" ? raw : stripped
}

/**
 * @param {TreeNode} node
 * @param {{ steps?: boolean }} [options]
 * @returns {string}
 */
function processNodeLine(node, { steps = true } = {}) {
    const escaped = escapeHtml(truncateMiddle(displayProcessName(node.name)))
    const body = node.emphasized ? `<strong>${escaped}</strong>` : `<em>${escaped}</em>`
    // PID + command identity is Step Summary-only; the comment tree shows
    // process names alone.
    const recordedSteps = [...node.steps].filter(name => !isSentinelStep(name)).sort()
    const step = steps && recordedSteps.length > 0 ? ` · step: ${recordedSteps.map(escapeHtml).join(" · ")}` : ""
    return `${body}${step}`
}

/**
 * @param {Edge} edge
 * @param {boolean} detections
 * @returns {string}
 */
function destinationLeafLine(edge, detections) {
    const parts = ["→", commentDestinationDisplay(edge)]
    for (const note of edgeNotes(edge, { detections })) parts.push(renderNote(note))
    return parts.join(" ")
}

/**
 * @param {TreeNode} node
 * @param {string} prefix
 * @param {string[]} lines
 * @param {{ destinations: boolean, steps?: boolean, detections?: boolean }} options
 * @returns {void}
 */
function renderTreeChildren(node, prefix, lines, options) {
    const { destinations, steps = true, detections = false } = options
    /** @type {({ kind: "process", child: TreeNode } | { kind: "destination", edge: Edge })[]} */
    const entries = [
        ...node.children.map(child => ({ kind: /** @type {const} */ ("process"), child })),
        ...(destinations ? node.associations.map(edge => ({ kind: /** @type {const} */ ("destination"), edge })) : []),
    ]
    entries.forEach((entry, index) => {
        const last = index === entries.length - 1
        const branch = last ? "└─ " : "├─ "
        const childPrefix = `${prefix}${last ? "   " : "│  "}`
        if (entry.kind === "process") {
            lines.push(`${prefix}${branch}${processNodeLine(entry.child, { steps })}`)
            renderTreeChildren(entry.child, childPrefix, lines, { destinations, steps, detections })
        } else {
            lines.push(`${prefix}${branch}${destinationLeafLine(entry.edge, detections)}`)
        }
    })
}

/**
 * Render a job's lossless shared-prefix lineage tree. Destination leaves
 * stay attached to the terminal recorded process; no ×N grouping or trust
 * labels.
 * @param {ReviewJob} job
 * @param {Edge[]} [edges]
 * @returns {string}
 */
export function renderJobTree(job, edges = job.edges) {
    const lines = []
    const root = treeForAssociations(edges)
    for (const child of root.children) {
        lines.push(processNodeLine(child, { steps: false }))
        renderTreeChildren(child, "", lines, { destinations: true, steps: false })
    }
    for (const edge of root.associations) {
        lines.push(destinationLeafLine(edge, false))
    }
    return lines.join("\n")
}

/**
 * A count with its inflected unit, glued with `&nbsp;` so `11 chains` never
 * wraps between the number and the word on narrow screens.
 * @param {number} n
 * @param {string} unit
 * @returns {string}
 */
function countPhrase(n, unit) {
    return `${n}&nbsp;${unit}${n === 1 ? "" : "s"}`
}

/**
 * The fold identity line: `workflow / job ↗` — the job-id text is the
 * hyperlink. Target: the specific Actions job URL when recorded, else the
 * run URL. Matrix cells are distinct jobs; the cell identity lives in the
 * job-id slot.
 * @param {ReviewJob} job
 * @returns {string}
 */
function jobIdentity(job) {
    const wf = `<code>${escapeHtml(job.workflow)}</code>`
    const url = job.job_url !== "" ? job.job_url : job.run_url
    const name =
        url !== ""
            ? `<a href="${escapeHtmlAttr(url)}"><code>${escapeHtml(job.name)}</code>&nbsp;↗</a>`
            : `<code>${escapeHtml(job.name)}</code>`
    return job.workflow !== "" ? `${wf} / ${name}` : name
}

/**
 * Explicit medium-forced omission line.
 * @param {number} x
 * @param {number} y
 * @returns {string}
 */
function truncationLine(x, y) {
    return CONTRACT_VOCAB.copy.truncationTemplate.replace("X", String(x)).replace("Y", String(y))
}

/**
 * Concise orientation fold with a lineage-exact mini tree. Open while
 * pending and on the first recorded result; collapsed on later updates.
 * @param {{ open?: boolean }} [options]
 * @returns {string}
 */
export function renderExplainer({ open = false } = {}) {
    return [
        `<details${open ? " open" : ""}><summary><sub>${VOCAB.explainerLabel}</sub></summary>`,
        "",
        "<pre>",
        "<em>Runner.Worker</em>                ← runner (italic)",
        "└─ <strong>npm install</strong>               ← your workflow step (bold)",
        "   └─ → registry.npmjs[.]org  ← outbound connection, defanged",
        "</pre>",
        "",
        "</details>",
    ].join("\n")
}

/**
 * Deterministic fold sentence — a bounded factual projection of the fold's
 * own tree, never an interpretation. Chains group by recorded step
 * attribution; each group counts its distinct destinations with the tree's
 * own identity; groups sort destination count descending, then name; at
 * most two groups are named and the remainder collapses to `and K more`.
 * @param {Edge[]} edges
 * @returns {string}
 */
export function jobSummarySentence(edges) {
    if (edges.length === 0) return ""
    const names = addressNameMap(edges)
    // The sentence speaks only from recorded step attribution — workload
    // facts. Process-name fallbacks (runner machinery like provjobd) are
    // evidence for the tree, not a headline: promoting them reads as the
    // job's summary and repeats infrastructure noise across rows. No
    // attributed steps → no sentence; the row falls back to plain counts.
    const attributed = edges.filter(edge => edge.github_step !== "" && !isSentinelStep(edge.github_step))
    if (attributed.length === 0) return ""
    /** @type {Map<string, { key: string, destinations: Set<string> }>} */
    const groups = new Map()
    for (const edge of attributed) {
        const key = groupKeyForEdge(edge)
        let group = groups.get(key)
        if (group === undefined) {
            group = { key, destinations: new Set() }
            groups.set(key, group)
        }
        group.destinations.add(destinationIdentity(edge, names))
    }
    const ordered = [...groups.values()].sort((a, b) => {
        if (a.destinations.size !== b.destinations.size) return b.destinations.size - a.destinations.size
        return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
    })
    const named = ordered.slice(0, 2).map(group => {
        const n = group.destinations.size
        return `${neutralizeMarkdown(escapeHtml(truncateMiddle(group.key)))} reached ${n}\u00a0destination${n === 1 ? "" : "s"}`
    })
    const rest = ordered.length - named.length
    return rest > 0 ? `${named.join(", ")}, and ${rest} more` : named.join(", ")
}

/**
 * Recorded step names carry the runner's ordinal prefix (`4. Run
 * workload`); the ordinal is presentation noise — stripped for display
 * only, like displayProcessName. The record and Step Summary keep the raw
 * name. Unexpanded workflow expressions (`${{ matrix.job_name }}`) are
 * recorded verbatim in unnamed steps — template syntax, not a name; display
 * drops them.
 * @param {unknown} name
 * @returns {string}
 */
function displayStepName(name) {
    const raw = String(name ?? "")
    const stripped = raw
        .replace(/^\d+\.\s+/, "")
        .replace(/\s*\(\s*\$\{\{[^}]*\}\}\s*\)/g, "")
        .replace(/\$\{\{[^}]*\}\}/g, "")
        .trim()
    return stripped === "" ? raw : stripped
}

/**
 * Jibril attributes runner-infrastructure chains to a sentinel step named
 * `NN. Runner Processes`. It is not a workflow step, so no surface may
 * present it as step attribution.
 * @param {string} name
 * @returns {boolean}
 */
export function isSentinelStep(name) {
    return displayStepName(name) === "Runner Processes"
}

/**
 * Grouping identity for the fold sentence: step attribution, else deepest
 * recorded process. Keyed on the display name, not the raw record: the
 * runner ordinal-prefixes repeated steps (`4. Run build`, `9. Run build`),
 * which display identically — raw keys would render duplicate names with
 * split counts.
 * @param {Edge} edge
 * @returns {string}
 */
function groupKeyForEdge(edge) {
    if (edge.github_step !== "" && !isSentinelStep(edge.github_step)) return displayStepName(edge.github_step)
    const path = edgeProcessPath(edge).filter(part => part !== "")
    return displayProcessName(path[path.length - 1] ?? VOCAB.unknownLineage)
}

/**
 * Fold summary row — count-dedup rules: single-job comments carry counts in
 * the metadata line only; multi-job comments demote per-job counts into
 * `<sub>` on the fold row, and only when the sentence does not fully cover
 * the tree.
 * @param {ReviewJob} job
 * @param {{ multiJob?: boolean, treeEdges?: Edge[] | null }} [options]
 * @returns {string}
 */
export function jobSummaryLine(job, { multiJob = false, treeEdges = null } = {}) {
    const tree = treeEdges ?? job.edges
    const displayEdges = dedupeDestinationEdges(tree)
    const names = addressNameMap(tree)
    const treeCounts = new Set(displayEdges.map(edge => destinationIdentity(edge, names))).size
    const sentence = jobSummarySentence(tree)
    const parts = [jobIdentity(job)]
    if (sentence !== "") parts.push(`· ${sentence}`)
    // Fold-row counts render whenever the sentence does not fully cover the
    // tree: capped (`and K more`), absent, or partial (chains without step
    // attribution exist beneath it). A complete sentence already covers
    // every group, and the chain count is countable in the tree itself.
    const sentenceCapped = /, and \d+ more$/.test(sentence)
    const sentencePartial =
        sentence !== "" && displayEdges.some(edge => edge.github_step === "" || isSentinelStep(edge.github_step))
    if (multiJob && displayEdges.length > 0 && (sentenceCapped || sentencePartial || sentence === "")) {
        parts.push(`<sub>· ${countPhrase(displayEdges.length, "chain")} · ${countPhrase(treeCounts, "destination")}</sub>`)
    }
    return parts.join(" ")
}

/**
 * Per-job edge retention order under medium truncation: IMDS edges first
 * (never evicted while any non-IMDS edge renders), then canonical order.
 * @param {Edge[]} edges
 * @returns {Edge[]}
 */
function retentionOrder(edges) {
    const imds = []
    const rest = []
    for (const edge of edges) {
        if (IMDS_ADDRESSES.has(edge.remote_address)) {
            imds.push(edge)
        } else {
            rest.push(edge)
        }
    }
    return [...imds, ...rest]
}

/**
 * Markdown commit reference: linked short sha when the commit URL is known.
 * @param {string} sha
 * @param {string} commitURL
 * @returns {string}
 */
function commitRef(sha, commitURL) {
    const shaPrefix = sha.slice(0, 7)
    const sha7 = escapeCode(shaPrefix !== "" ? shaPrefix : "unknown")
    return commitURL !== "" ? `[\`${sha7}\`](${commitURL})` : `\`${sha7}\``
}

/**
 * The category heading — the core primitive stated as the high-level
 * summary: Execution Profiles belong to jobs; the commit is the trigger.
 * All counts live in the metadata line and job folds.
 * @param {RunReview} review
 * @returns {string}
 */
function headlineSentence(review) {
    const k = review.counts.jobs
    const jobsNoun = `${k} job${k === 1 ? "" : "s"}`
    // Bold body line, not a `#` heading — a recurring bot comment speaks at
    // body register; the primitive is the emphasis, not the type size.
    return `**${VOCAB.headlineLead} ${jobsNoun}, triggered by ${commitRef(review.sha, review.commitURL)}**`
}

/**
 * Comment-register counts: the run-scope numbers count what the comment
 * renders for this record — chains is the total of rendered chain rows
 * across job folds (workload and substrate alike), destinations the union
 * of their destination identities. Capture multiplicity stays in the Step
 * Summary (the evidence register).
 * @param {ReviewJob[]} jobs
 * @returns {{ chains: number, destinations: number }}
 */
function commentRegisterCounts(jobs) {
    let chains = 0
    const identities = new Set()
    for (const job of jobs) {
        const names = addressNameMap(job.edges)
        const { shown, substrate } = partitionCommentEdges(job.edges)
        chains += shown.length + substrate.length
        for (const edge of [...shown, ...substrate]) {
            identities.add(destinationIdentity(edge, names))
        }
    }
    return { chains, destinations: identities.size }
}

/**
 * Metadata blockquote — noun facts only, each `·` segment one fact: counts
 * (first mention spells `execution chains`), kernel/eBPF provenance, and
 * the record's timestamp. Single-job comments carry counts here ONLY.
 * @param {RunReview} review
 * @returns {string}
 */
function metadataLine(review) {
    const { chains, destinations } = commentRegisterCounts(review.jobs)
    const parts = [
        `${chains}&nbsp;execution chain${chains === 1 ? "" : "s"}`,
        `${destinations}&nbsp;destination${destinations === 1 ? "" : "s"}`,
    ]
    parts.push(VOCAB.kernelProvenance)
    if (review.recordedThrough !== "") parts.push(review.recordedThrough)
    // Italic blockquote only — never <sub>: GitHub mobile collapses <sub>
    // line-height, so a wrapped metadata line overprints itself on phones.
    return `> *${parts.join(" · ")}*`
}

/**
 * The machine summary marker: one HTML comment carrying the run-scope
 * counts as JSON so agents read structure instead of parsing the human
 * surface. Every number equals the corresponding rendered count;
 * comparison-only fields are null on snapshot comments (this fallback
 * renders snapshot comments only).
 * @param {RunReview} review
 * @returns {string}
 */
function machineSummaryMarker(review) {
    const { chains, destinations } = commentRegisterCounts(review.jobs)
    const summary = {
        contract: CONTRACT_VOCAB.version,
        commit: review.sha,
        previous: null,
        jobs: review.jobs.length,
        changed: null,
        unchanged: null,
        noOutbound: null,
        vanished: null,
        added: null,
        removed: null,
        vanishedChains: null,
        chains,
        destinations,
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
 * @returns {string}
 */
function renderCommentBody(review, kept, { explainerOpen = false } = {}) {
    const lines = [RUNTIME_REVIEW_MARKER, COMMENT_MARKER]
    if (review.sha !== "") lines.push(`<!-- garnet:commit ${review.sha} -->`)
    lines.push(machineSummaryMarker(review))
    lines.push(headlineSentence(review))
    lines.push("")
    lines.push(metadataLine(review))
    lines.push("")

    const multiJob = review.jobs.length > 1

    for (const job of review.jobs) {
        if (job.edges.length === 0) {
            lines.push(`<sub>${jobIdentity(job)} — ${VOCAB.emptyPeers}</sub>`)
            lines.push("")
            continue
        }
        const keptCount = kept.get(job.id) ?? job.edges.length
        const retained = new Set(retentionOrder(job.edges).slice(0, keptCount))
        const shown = job.edges.filter(edge => retained.has(edge))
        const { shown: workload, substrate } = partitionCommentEdges(shown)
        // Folds render open on the first recorded result.
        lines.push(
            `<details${explainerOpen ? " open" : ""}><summary>${jobSummaryLine(job, { multiJob, treeEdges: workload })}</summary>`,
        )
        lines.push("")
        if (workload.length > 0) {
            lines.push("<pre>")
            lines.push(renderJobTree(job, workload))
            lines.push("</pre>")
            lines.push("")
        }
        const substrateFold = renderSubstrateFold(job, substrate)
        if (substrateFold.length > 0) {
            lines.push(...substrateFold)
            lines.push("")
        }
        if (shown.length < job.edges.length) {
            lines.push(`<sub>${truncationLine(shown.length, job.edges.length)}</sub>`)
            lines.push("")
        }
        const link = jobPermalink(job, review.appURL, "pr_comment")
        if (link !== "") {
            lines.push(`<p align="right"><sub><a href="${escapeHtmlAttr(link)}">${VOCAB.permalinkLabel}</a></sub></p>`)
            lines.push("")
        }
        lines.push("</details>")
        lines.push("")
    }

    // The explainer sits at the bottom under a divider; open only on a
    // first-profile comment.
    lines.push("---")
    lines.push("")
    lines.push(renderExplainer({ open: explainerOpen }))

    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()
    return lines.join("\n")
}

/**
 * Deterministic explicit minimal fallback for the pathological case where
 * even zero kept edges (the fixed per-job fold overhead) exceeds the medium
 * budget: markers, headline, and the exact truncation line.
 * @param {RunReview} review
 * @returns {string}
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
 * Render the Garnet execution PR comment. Jobs in canonical order
 * (alphabetic by `workflow / job`); edges in canonical deterministic order.
 * Truncation (only because of the medium budget, never silently) drops
 * edges via a deterministic fair round-robin across jobs in canonical order
 * — IMDS associations retained first — and emits an explicit
 * destination-association line per truncated fold.
 * @param {RunReview} review
 * @param {{ explainerOpen?: boolean }} [opts] the explainer and job folds
 * open on the first recorded result and collapse on later updates
 * @returns {string}
 */
export function renderRunReview(review, opts = {}) {
    const explainerOpen = opts.explainerOpen === true
    const full = renderCommentBody(review, new Map(), { explainerOpen })
    if (Buffer.byteLength(full, "utf8") <= SIZE_BUDGET) return full

    // Global round-robin retention order: round r keeps the r-th edge of
    // each job's retention queue, jobs visited in canonical order.
    const queues = review.jobs.map(job => ({ id: job.id, total: job.edges.length }))
    /** @type {{ id: number }[]} */
    const order = []
    for (let round = 0; order.length < review.counts.associations; round += 1) {
        for (const queue of queues) {
            if (round < queue.total) order.push({ id: queue.id })
        }
    }

    /** @param {number} keepTotal */
    function bodyFor(keepTotal) {
        /** @type {Map<number, number>} */
        const kept = new Map(review.jobs.map(job => [job.id, 0]))
        for (let i = 0; i < keepTotal; i += 1) {
            const entry = order[i]
            if (entry === undefined) break
            kept.set(entry.id, (kept.get(entry.id) ?? 0) + 1)
        }
        return renderCommentBody(review, kept, { explainerOpen })
    }

    // Largest edge total whose serialized body fits the budget (binary
    // search — rendering is deterministic, so this is reproducible).
    let lo = 0
    let hi = review.counts.associations - 1
    let best = bodyFor(0)
    while (lo <= hi) {
        const mid = (lo + hi) >> 1
        const body = bodyFor(mid)
        if (Buffer.byteLength(body, "utf8") <= SIZE_BUDGET) {
            best = body
            lo = mid + 1
        } else {
            hi = mid - 1
        }
    }
    // True final cap: when even the zero-edge body's fixed overhead exceeds
    // the budget, fall back to the deterministic minimal comment.
    if (Buffer.byteLength(best, "utf8") > SIZE_BUDGET) return renderMinimalComment(review)
    return best
}

// ---------------------------------------------------------------------------
// Step Summary.
// ---------------------------------------------------------------------------

/**
 * Screenshot-style compact ancestry: first node, ellipsis, final three
 * nodes.
 * @param {Edge} edge
 * @returns {string[]}
 */
function compactStepSummaryAncestry(edge) {
    if (!edge.lineage_recorded) return [VOCAB.unknownLineage]
    const names = edge.ancestry.filter(name => name !== "")
    const chain = names.length > 0 ? [...names] : []
    if (edge.process !== "" && chain[chain.length - 1] !== edge.process) {
        chain.push(edge.process)
    }
    if (chain.length === 0) chain.push(VOCAB.unknownLineage)
    if (chain.length <= 4) return chain
    const first = chain[0] ?? ""
    return [first, "…", ...chain.slice(-3)]
}

/**
 * @param {Edge} edge
 * @returns {string}
 */
function processTreeCell(edge) {
    const names = compactStepSummaryAncestry(edge)
    return names
        .map((name, index) => {
            const leaf = index === names.length - 1
            const value = leaf && edge.pid !== "" ? `${truncateMiddle(name)} (pid ${edge.pid})` : truncateMiddle(name)
            return `<code>${escapeHtmlCell(value)}</code>`
        })
        .join(" → ")
}

/**
 * Lineage-first Step Summary projection: one row per recorded process
 * lineage, deduped by lineage + PID + process + ancestry, with every
 * recorded destination for that lineage nested and identical destinations
 * collapsed. Telemetry counts are unaffected — they pass through from the
 * sensor/profile, not from these rows.
 * @param {Edge[]} edges
 * @returns {LineageRow[]}
 */
export function buildLineageRows(edges) {
    /** @type {LineageRow[]} */
    const rows = []
    /** @type {Map<string, LineageRow>} */
    const byKey = new Map()
    for (const edge of edges) {
        const key = JSON.stringify([edge.lineage_recorded, edge.pid, edge.process, edge.ancestry])
        let row = byKey.get(key)
        if (row === undefined) {
            row = { edge, associations: [] }
            byKey.set(key, row)
            rows.push(row)
        }
        row.associations.push(edge)
    }
    return rows
}

/**
 * @param {Edge} edge
 * @returns {string}
 */
function edgeDestinationLabel(edge) {
    const primary = edge.remote_names.find(name => name !== "")
    if (primary !== undefined) return primary
    if (edge.remote_address !== "") return edge.remote_address
    return "(no destination recorded)"
}

/**
 * Destinations cell: one deduped domain-first line per recorded
 * destination. Stacked destinations each start with a marker glued to the
 * label by a non-breaking space; a single destination renders bare.
 * @param {LineageRow} row
 * @returns {string}
 */
function lineageDestinationsCell(row) {
    const seen = new Set()
    const labels = []
    for (const edge of row.associations) {
        const label = edgeDestinationLabel(edge)
        if (seen.has(label)) continue
        seen.add(label)
        labels.push(label)
    }
    if (labels.length === 1) return `<code>${escapeHtmlCell(truncateMiddle(labels[0]))}</code>`
    return labels.map(label => `·\u00a0<code>${escapeHtmlCell(truncateMiddle(label))}</code>`).join("<br>")
}

/**
 * GitHub-native lineage-first table: one recorded process lineage per row
 * with its deduped destinations nested.
 * @param {LineageRow[]} rows
 * @returns {string}
 */
function renderLineageTable(rows) {
    const lines = ["| Process Tree | Destinations |", "| --- | --- |"]
    for (const row of rows) {
        lines.push(`| ${processTreeCell(row.edge)} | ${lineageDestinationsCell(row)} |`)
    }
    return lines.join("\n")
}

/**
 * Lineage-row retention: rows touching IMDS are kept first, then the rest.
 * @param {LineageRow[]} rows
 * @returns {LineageRow[]}
 */
function lineageRetentionOrder(rows) {
    const imds = []
    const rest = []
    for (const row of rows) {
        const isIMDS = row.associations.some(edge => IMDS_ADDRESSES.has(edge.remote_address))
        if (isIMDS) {
            imds.push(row)
        } else {
            rest.push(row)
        }
    }
    return [...imds, ...rest]
}

/**
 * @param {ReviewJob} job
 * @returns {boolean}
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
 * Sensor + derived telemetry semantics in the approved prose shape.
 * @param {ReviewJob} job
 * @returns {string}
 */
function renderTelemetry(job) {
    if (!hasExplainableTelemetry(job)) return ""
    const domains = `${job.telemetry.total_domains} unique domain${job.telemetry.total_domains === 1 ? "" : "s"}`
    const connections = `${job.telemetry.total_connections} connection${job.telemetry.total_connections === 1 ? "" : "s"}`
    return `Network telemetry observed ${domains}, ${job.counts.destinations} destination${job.counts.destinations === 1 ? "" : "s"}, ${connections}, and ${job.counts.flows} flow${job.counts.flows === 1 ? "" : "s"}.`
}

/**
 * @param {Edge[]} edges
 * @returns {string}
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
        const context = []
        if (edge.github_step !== "") context.push(`step: ${escapeMarkdownCell(edge.github_step)}`)
        context.push(
            ...edgeNotes(edge, { detections: true }).map(note =>
                note.startsWith("detection: ") ? `\`${escapeCodeCell(note)}\`` : `(${escapeMarkdownCell(note)})`,
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
 * @param {AssertionRecord[]} assertions
 * @returns {string}
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
        const check = assertion.description !== "" ? assertion.description : assertion.id !== "" ? assertion.id : "—"
        const contextParts = [assertion.class_id, assertion.id].filter(part => part !== "")
        const context = contextParts.length > 0 ? contextParts.join(" · ") : "—"
        lines.push(
            `| ${escapeMarkdownCell(check)} | \`${escapeCodeCell(assertion.result !== "" ? assertion.result : "unknown")}\` | ${escapeMarkdownCell(context)} |`,
        )
    }

    const evidenceRows = assertions.flatMap(assertion =>
        assertion.evidence.map(evidence => [
            assertion.id !== "" ? assertion.id : assertion.description !== "" ? assertion.description : "—",
            evidence.timestamp !== "" ? evidence.timestamp : "—",
            evidence.event !== "" ? evidence.event : "—",
            evidence.remote_peer !== "" ? evidence.remote_peer : "—",
            evidence.protocol !== "" ? evidence.protocol : "—",
            evidence.ports !== "" ? evidence.ports : "—",
            evidence.result !== "" ? evidence.result : assertion.result !== "" ? assertion.result : "—",
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
 * The right-aligned Step Summary footer: the recording timestamp and the
 * product path. Workflow, run, and job identity live in the Workload table.
 * @param {ReviewJob} job
 * @param {string} appURL
 * @returns {string}
 */
function renderStepSummaryFooter(job, appURL) {
    const stamp = formatTimestamp(job.timestamp)
    const lines = ['<div align="right">']
    if (stamp !== "") lines.push(`<sub>${stamp}</sub><br>`)
    const link = jobPermalink(job, appURL, "step_summary")
    const cta =
        link === ""
            ? "<strong>Powered by Garnet</strong>"
            : `<a href="${escapeHtmlAttr(link)}">${VOCAB.permalinkLabel}</a>`
    lines.push(cta, "</div>")
    if (job.run_url !== "") {
        lines.push("", `<sub><a href="${escapeHtmlAttr(job.run_url)}">Job summary generated at run-time</a></sub>`)
    } else {
        lines.push("", "<sub>Job summary generated at run-time</sub>")
    }
    return lines.join("\n")
}

/**
 * @param {ReviewJob} job
 * @param {string} appURL
 * @param {number} keptDestinations
 * @param {boolean} previewAssertions
 * @returns {string}
 */
function renderProfileSummary(job, appURL, keptDestinations, previewAssertions) {
    const lines = [`## ${VOCAB.stepSummaryHeading}`, ""]

    lines.push("### Workload Summary", "")
    const rows = []
    if (job.profile_id !== "") rows.push(["Profile UUID", job.profile_id])
    if (job.workflow !== "") rows.push(["Workflow", job.workflow])
    if (job.repository !== "") rows.push(["Repository", job.repository])
    if (job.ref !== "") rows.push(["Branch", job.ref])
    if (job.sha !== "") rows.push(["Commit", job.sha])
    if (job.actor !== "") rows.push(["Triggered by", job.actor])
    if (job.run_id !== "" || job.name !== "") {
        rows.push(["Run ID / Job", [job.run_id, job.name].filter(value => value !== "").join(" / ")])
    }
    if (job.job_index !== "") rows.push(["Matrix job index", job.job_index])
    lines.push("| Field | Value |")
    lines.push("| --- | --- |")
    for (const [key, value] of rows) {
        lines.push(`| ${escapeMarkdownCell(key)} | ${escapeMarkdownCell(value)} |`)
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
        const shown = lineageRows.filter(row => retained.has(row))
        lines.push("Keyed by execution chain; repeated destination names within a chain are collapsed.", "")
        lines.push(renderLineageTable(shown))
        lines.push("")
        if (shown.length < lineageRows.length) {
            lines.push(`<sub>rendered ${shown.length} of ${lineageRows.length} execution chains</sub>`)
            lines.push("")
        }
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

    lines.push(renderStepSummaryFooter(job, appURL))
    return lines.join("\n")
}

/**
 * Render the GitHub Step Summary: heading `## Garnet Execution Summary`,
 * Workload first, then the lineage-first network-egress table, source-
 * backed telemetry, optional preview-only assertions, and the aligned
 * footer. The 1 MiB budget uses deterministic fair-round-robin retention.
 * @param {JobRecord[]} jobRecords collapsed job records
 * @param {{ appURL?: string, preview?: boolean }} [opts]
 * @returns {string}
 */
export function renderStepSummary(jobRecords, opts = {}) {
    const appURL = String(opts.appURL ?? "https://app.garnet.ai").replace(/\/+$/, "")
    const jobs = buildRunReview({ appURL, jobs: jobRecords }).jobs
    /** @param {Map<number, number>} kept */
    function render(kept) {
        return jobs
            .map((job, index) => renderProfileSummary(job, appURL, kept.get(index) ?? Infinity, opts.preview === true))
            .join("\n\n---\n\n")
    }

    const full = render(new Map())
    if (Buffer.byteLength(full, "utf8") <= STEP_SUMMARY_BUDGET) return full

    const rowCounts = jobs.map(job => buildLineageRows(job.edges).length)
    const totalLineages = rowCounts.reduce((sum, count) => sum + count, 0)
    /** @type {number[]} */
    const order = []
    for (let round = 0; order.length < totalLineages; round += 1) {
        jobs.forEach((_, index) => {
            const rowCount = rowCounts[index] ?? 0
            if (round < rowCount) order.push(index)
        })
    }
    /** @param {number} keepTotal */
    function bodyFor(keepTotal) {
        /** @type {Map<number, number>} */
        const kept = new Map(jobs.map((_, index) => [index, 0]))
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
    // True final cap: when even the zero-edge summary's fixed overhead
    // exceeds the budget, fall back to the deterministic minimal summary.
    if (Buffer.byteLength(best, "utf8") > STEP_SUMMARY_BUDGET) {
        return renderMinimalStepSummary(jobs)
    }
    return best
}

/**
 * Deterministic explicit minimal fallback for the Step Summary.
 * @param {ReviewJob[]} jobs
 * @returns {string}
 */
function renderMinimalStepSummary(jobs) {
    const lineages = jobs.reduce((sum, job) => sum + buildLineageRows(job.edges).length, 0)
    return [
        `## ${VOCAB.stepSummaryHeading}`,
        "",
        `${jobs.length} job${jobs.length === 1 ? "" : "s"} recorded`,
        "",
        `<sub>rendered 0 of ${lineages} execution chains</sub>`,
    ].join("\n")
}

/**
 * The Step Summary body when Jibril produced no profile (the sensor failed
 * to start or the workload never ran). Says so plainly — no verdict, no
 * substitute clock.
 * @returns {string}
 */
export function renderNoRecordSummary() {
    return [
        `## ${VOCAB.stepSummaryHeading}`,
        "",
        VOCAB.noRunProfile,
        "",
        "Confirm the Garnet action started Jibril successfully and that the workload ran before this step.",
    ].join("\n")
}

// ---------------------------------------------------------------------------
// Surface linter.
// ---------------------------------------------------------------------------

/**
 * Semantic surface linter — guards the whole class of "same fact rendered
 * twice in one visual block" regressions (e.g. telemetry counts printed in
 * both the prose line and the footer). Byte-goldens cannot catch this
 * because they lock whatever the renderer emits, duplication included. The
 * Step Summary is split into per-job sections; the PR comment is checked
 * whole. Returns a list of human-readable violations; an empty array means
 * clean.
 * @param {string} surface rendered markdown/HTML for one run
 * @param {"pr" | "step-summary"} kind
 * @returns {string[]}
 */
export function lintRenderedSurface(surface, kind) {
    const violations = []
    /**
     * @param {string} text
     * @param {RegExp} re
     */
    function count(text, re) {
        return (text.match(re) ?? []).length
    }
    if (kind === "step-summary") {
        const sections = surface.split(/\n\n---\n\n/)
        sections.forEach((section, index) => {
            /** @type {[string, RegExp][]} */
            const families = [
                ["telemetry unique-domain count", /\bunique domain/gi],
                ["telemetry connection count", /\d+ connections?\b/gi],
                ["Powered by Garnet footer", /Powered by Garnet/gi],
                ["profile permalink", /\?profile=/gi],
            ]
            for (const [name, re] of families) {
                const n = count(section, re)
                if (n > 1) {
                    violations.push(`step-summary job section ${index}: "${name}" appears ${n}× (expected \u2264 1)`)
                }
            }
        })
    } else {
        // The PR comment carries no telemetry counts at all; any occurrence
        // means a fact family leaked into the wrong surface.
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
