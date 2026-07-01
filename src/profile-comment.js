import { z } from "zod"
import { getOptionalRecord } from "./shared.js"

export const ACTION_COMMENT_MARKER = "garnet-action-pr-comment:v1"
export const COMMIT_MARKER_PREFIX = "garnet-pr-commit:"
export const LEGACY_COMMENT_STATE_MARKER = "garnet-runtime-visibility"

const COMMENT_STATE_MARKER_PREFIX = "garnet-action-comment-state:"

/**
 * @typedef {"pass" | "attention" | "fail" | "unknown"} ProfileResult
 */

/**
 * @typedef {{
 *   workflow: string
 *   repository: string
 *   ref: string
 *   sha: string
 *   actor: string
 *   run_id: string
 *   job: string
 * }} GitHubScenario
 */

/**
 * @typedef {{ ancestry: string[] }} ProcTree
 */

/**
 * @typedef {{
 *   remote_names: string[]
 *   remote_address: string
 *   detections: string[]
 *   proc_trees: ProcTree[]
 *   result: ProfileResult
 * }} EgressPeer
 */

/**
 * @typedef {{
 *   total_domains: number
 *   total_connections: number
 * }} NetworkTelemetry
 */

/**
 * @typedef {{
 *   id: string
 *   result: ProfileResult
 * }} AssertionSummary
 */

/**
 * @typedef {{
 *   timestamp: string
 *   github: GitHubScenario
 *   assertions: AssertionSummary[]
 *   egress_peers: EgressPeer[]
 *   telemetry: NetworkTelemetry
 *   report_link: string
 * }} NormalizedProfile
 */

/**
 * @typedef {{
 *   run_id: string
 *   run_attempt: number
 * }} WorkflowRun
 */

/**
 * @typedef {{
 *   version: 1
 *   latest_run: WorkflowRun
 *   profiles: NormalizedProfile[]
 * }} LegacyCommentState
 */

/**
 * @typedef {{
 *   version: 2
 *   workflow_runs: Record<string, WorkflowRun>
 *   profiles: NormalizedProfile[]
 * }} CommentState
 */

const DEFAULT_JSON_PROFILE_FILE = "/var/log/jibril.profile.json"
const DEFAULT_APP_BASE_URL = "https://app.garnet.ai"
const UTM_SOURCE = "github"
const UTM_MEDIUM = "pr_comment"

const PROFILE_RESULT_SCHEMA = z.unknown().transform(value => normalizeResult(value))

const PROC_TREE_SCHEMA = z
    .looseObject({
        ancestry: z.array(z.string()),
    })
    .transform(procTree => ({
        ancestry: procTree.ancestry.filter(entry => entry.length > 0),
    }))

const ASSERTION_SCHEMA = z.looseObject({
    id: z.string(),
    result: PROFILE_RESULT_SCHEMA,
})

const PEER_SCHEMA = z
    .looseObject({
        result: PROFILE_RESULT_SCHEMA,
        remote_names: z.array(z.string()),
        remote_address: z.string().optional(),
        detections: z.array(z.string()).optional(),
        proc_trees: z.array(PROC_TREE_SCHEMA),
    })
    .transform(peer => ({
        remote_names: peer.remote_names.filter(name => name.length > 0),
        remote_address: peer.remote_address ?? "",
        detections: (peer.detections ?? [])
            .map(detection => detection.trim())
            .filter(detection => detection.length > 0),
        proc_trees: peer.proc_trees,
        result: peer.result,
    }))

const GITHUB_SCENARIO_SCHEMA = z.object({
    workflow: z.string(),
    repository: z.string(),
    ref: z.string(),
    sha: z.string(),
    actor: z.string(),
    run_id: z.string(),
    job: z.string(),
})

const PROFILE_NETWORK_SCHEMA = z
    .object({
        egress: z
            .object({
                peers: z.array(PEER_SCHEMA).optional(),
            })
            .optional(),
    })
    .optional()

const PROFILE_NETWORK_TELEMETRY_SCHEMA = z
    .object({
        network: z
            .object({
                egress: z
                    .object({
                        total_domains: z.number().optional(),
                        total_connections: z.number().optional(),
                    })
                    .optional(),
            })
            .optional(),
    })
    .optional()

const NORMALIZED_PROFILE_SCHEMA = z.object({
    timestamp: z.string(),
    github: GITHUB_SCENARIO_SCHEMA,
    assertions: z.array(ASSERTION_SCHEMA),
    egress_peers: z.array(PEER_SCHEMA),
    telemetry: z.object({
        total_domains: z.number(),
        total_connections: z.number(),
    }),
    report_link: z.string(),
})

const LEGACY_COMMENT_STATE_SCHEMA = z.object({
    version: z.literal(1),
    latest_run: z.object({
        run_id: z.string(),
        run_attempt: z.number(),
    }),
    profiles: z.array(NORMALIZED_PROFILE_SCHEMA),
})

const COMMENT_STATE_SCHEMA = z.object({
    version: z.literal(2),
    workflow_runs: z.record(
        z.string(),
        z.object({
            run_id: z.string(),
            run_attempt: z.number(),
        }),
    ),
    profiles: z.array(NORMALIZED_PROFILE_SCHEMA),
})

const PROFILE_JSON_SCHEMA = z
    .looseObject({
        timestamp: z.string(),
        scenarios: z.object({
            github: GITHUB_SCENARIO_SCHEMA,
        }),
        assertions: z.array(ASSERTION_SCHEMA),
        network: PROFILE_NETWORK_SCHEMA,
        telemetry: PROFILE_NETWORK_TELEMETRY_SCHEMA,
    })
    .transform(profile => ({
        timestamp: profile.timestamp,
        github: profile.scenarios.github,
        assertions: profile.assertions,
        egress_peers: getProfileNetworkPeers(profile),
        telemetry: getProfileNetworkTelemetry(profile),
        report_link: buildReportLink({
            repository: profile.scenarios.github.repository,
            run_id: profile.scenarios.github.run_id,
            job: profile.scenarios.github.job,
        }),
    }))

/**
 * @returns {string}
 */
export function getDefaultJsonProfileFile() {
    const configuredFile = process.env.JIBRIL_JSONPROFILER_FILE
    if (typeof configuredFile === "string" && configuredFile !== "") {
        return configuredFile
    }

    return DEFAULT_JSON_PROFILE_FILE
}

/**
 * @param {string} content
 * @returns {NormalizedProfile}
 */
export function parseProfileJson(content) {
    const parsedContent = JSON.parse(content)
    const result = PROFILE_JSON_SCHEMA.safeParse(parsedContent)
    if (result.success) {
        return result.data
    }

    const issues = result.error.issues.map(issue => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "<root>"
        return `${path}: ${issue.message}`
    })
    throw new Error(`Invalid profile JSON: ${issues.join("; ")}`)
}

/**
 * @param {CommentState | null} existingState
 * @param {NormalizedProfile} incomingProfile
 * @param {number} runAttempt
 * @returns {{ kind: "stale" } | { kind: "updated", state: CommentState }}
 */
export function mergeCommentState(existingState, incomingProfile, runAttempt) {
    const incomingRunId = incomingProfile.github.run_id
    const incomingRunAttempt = Number.isSafeInteger(runAttempt) ? runAttempt : 1
    const workflowKey = getWorkflowKey(incomingProfile)

    if (incomingRunId === "") {
        throw new Error("profile JSON is missing the GitHub run id")
    }

    if (existingState === null) {
        return {
            kind: "updated",
            state: {
                version: 2,
                workflow_runs: {
                    [workflowKey]: {
                        run_id: incomingRunId,
                        run_attempt: incomingRunAttempt,
                    },
                },
                profiles: [incomingProfile],
            },
        }
    }

    const latestRun = existingState.workflow_runs[workflowKey] ?? null
    const comparison =
        latestRun === null
            ? -1
            : compareRuns(latestRun, {
                  run_id: incomingRunId,
                  run_attempt: incomingRunAttempt,
              })

    if (comparison > 0) {
        return { kind: "stale" }
    }

    if (comparison < 0) {
        return {
            kind: "updated",
            state: {
                version: 2,
                workflow_runs: {
                    ...existingState.workflow_runs,
                    [workflowKey]: {
                        run_id: incomingRunId,
                        run_attempt: incomingRunAttempt,
                    },
                },
                profiles: [
                    ...existingState.profiles.filter(profile => getWorkflowKey(profile) !== workflowKey),
                    incomingProfile,
                ].sort(compareProfiles),
            },
        }
    }

    const profiles = existingState.profiles.filter(profile => getProfileKey(profile) !== getProfileKey(incomingProfile))
    profiles.push(incomingProfile)
    profiles.sort(compareProfiles)

    return {
        kind: "updated",
        state: {
            version: 2,
            workflow_runs: existingState.workflow_runs,
            profiles,
        },
    }
}

/**
 * @param {CommentState[]} states
 * @returns {CommentState | null}
 */
export function mergeCommentStates(states) {
    if (states.length === 0) {
        return null
    }

    /** @type {Record<string, WorkflowRun>} */
    const workflowRuns = {}

    for (const state of states) {
        for (const [workflowKey, workflowRun] of Object.entries(state.workflow_runs)) {
            const existingRun = workflowRuns[workflowKey] ?? null
            if (existingRun === null || compareRuns(existingRun, workflowRun) < 0) {
                workflowRuns[workflowKey] = workflowRun
            }
        }
    }

    /** @type {Map<string, NormalizedProfile>} */
    const profiles = new Map()

    for (const state of states) {
        for (const profile of state.profiles) {
            const workflowKey = getWorkflowKey(profile)
            const workflowRun = state.workflow_runs[workflowKey] ?? null
            const latestRun = workflowRuns[workflowKey] ?? null
            if (workflowRun === null || latestRun === null || compareRuns(workflowRun, latestRun) !== 0) {
                continue
            }

            profiles.set(getProfileKey(profile), profile)
        }
    }

    return {
        version: 2,
        workflow_runs: workflowRuns,
        profiles: [...profiles.values()].sort(compareProfiles),
    }
}

/**
 * @param {CommentState} state
 * @returns {string}
 */
export function renderCommentBody(state) {
    const metadata = encodeCommentState(state)
    const profiles = [...state.profiles].sort(compareProfiles)
    const summaryLine = renderSummaryLine(profiles)
    const narrative = renderNarrative(profiles)
    const sections = profiles.map(profile => renderProfileSection(profile)).join("\n\n")
    const commitSha = getCommentCommitSha(profiles)

    return [
        `<!-- ${ACTION_COMMENT_MARKER} -->`,
        `<!-- ${COMMIT_MARKER_PREFIX}${commitSha} -->`,
        `<!-- ${COMMENT_STATE_MARKER_PREFIX}${metadata} -->`,
        "## Garnet Runtime Report",
        "",
        summaryLine,
        "",
        narrative,
        "<details>",
        "<summary><strong>Evidence</strong> — full process · destination · activity tables and telemetry</summary>",
        "",
        sections,
        "</details>",
    ].join("\n")
}

/**
 * @param {string} body
 * @returns {CommentState | null}
 */
export function parseCommentState(body) {
    const encoded =
        parseCommentMarkerValue(body, COMMENT_STATE_MARKER_PREFIX) ??
        parseCommentMarkerValue(body, `${LEGACY_COMMENT_STATE_MARKER}:`)
    if (encoded === null) {
        return null
    }

    try {
        const json = Buffer.from(encoded, "base64url").toString("utf8")
        const parsed = JSON.parse(json)
        const result = COMMENT_STATE_SCHEMA.safeParse(parsed)
        if (result.success) {
            return result.data
        }

        const legacyResult = LEGACY_COMMENT_STATE_SCHEMA.safeParse(parsed)
        return legacyResult.success ? upgradeLegacyCommentState(legacyResult.data) : null
    } catch {
        return null
    }
}

// ---------------------------------------------------------------------------
// Narrative-first rendering — mirrors control-plane githubapp/comment.go and the
// testbed Path B renderer so App- and Action-rendered comments match. Describes
// the current run only ("what happened in this PR"), framed factually with no
// risk/threat verdicts.
// ---------------------------------------------------------------------------

const MAX_NARRATIVE_DESTINATIONS = 6

// KNOWN_BAD_DOMAIN_DETECTION is the detection identifier Garnet attaches to a
// peer whose destination matched threat intelligence. Mirrors control-plane.
const KNOWN_BAD_DOMAIN_DETECTION = "known_bad_domain"

/**
 * Plain-English "what it did" phrasing for detection identifiers.
 * @type {Record<string, string>}
 */
const DETECTION_DESCRIPTIONS = {
    credentials_files_access: "Accessed credential file paths on the build machine",
    hidden_elf_exec: "Ran a binary that was deleted from disk after executing",
    interpreter_shell_spawn: "A scripting runtime (Node, Python, etc.) spawned a system shell",
    exec_from_unusual_dir: "Executed a program from a non-standard directory",
    code_modification_through_procfs: "Modified another process's memory via /proc",
    known_bad_domain: "Connected to a domain listed in Garnet threat intelligence",
    crypto_miner_execution: "Ran a process that matched cryptocurrency-mining behavior",
    net_scan_tool_exec: "Ran a network scanning tool",
}

/** @type {Record<string, string>} */
const DESTINATION_ANNOTATIONS = {
    "169.254.169.254": "cloud instance metadata endpoint",
}

/**
 * @param {string} detection
 * @returns {boolean}
 */
function isMeaningfulDetection(detection) {
    const d = (detection || "").trim()
    return d !== "" && d !== "flow" && d !== "none"
}

/**
 * @param {string[]} detections
 * @returns {boolean}
 */
function hasMeaningfulDetection(detections) {
    return detections.some(isMeaningfulDetection)
}

/**
 * @param {string} detection
 * @returns {string}
 */
function humanizeDetection(detection) {
    const d = (detection || "").trim()
    if (d === "" || d === "flow" || d === "none") return "Made a network connection"
    const known = DETECTION_DESCRIPTIONS[d]
    if (known !== undefined) return known
    return d
        .split("_")
        .map(word => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
        .join(" ")
}

/**
 * @param {string} dest
 * @returns {string}
 */
function annotateDestination(dest) {
    let out = `\`${escapeMarkdown(dest)}\``
    const note = DESTINATION_ANNOTATIONS[(dest || "").trim()]
    if (note) out += ` (${note})`
    return out
}

/**
 * renderBadDomainLine states the known-bad-domain fact plainly, naming the
 * destination(s) without alarm styling or a merge/threat verdict.
 * @param {string[]} badDomains
 * @returns {string}
 */
function renderBadDomainLine(badDomains) {
    if (badDomains.length === 1) {
        return `Connected to a known bad domain (${annotateDestination(badDomains[0] ?? "")})`
    }
    return `Connected to known bad domains: ${renderDestinationList(badDomains)}`
}

/**
 * @param {string[]} destinations
 * @returns {string}
 */
function renderDestinationList(destinations) {
    let shown = destinations
    let extra = 0
    if (shown.length > MAX_NARRATIVE_DESTINATIONS) {
        extra = shown.length - MAX_NARRATIVE_DESTINATIONS
        shown = shown.slice(0, MAX_NARRATIVE_DESTINATIONS)
    }
    let out = shown.map(annotateDestination).join(", ")
    if (extra > 0) out += `, +${extra} more`
    return out
}

/**
 * @param {EgressPeer} peer
 * @returns {string}
 */
function peerDestination(peer) {
    for (const name of peer.remote_names) {
        if (name.trim() !== "") return name
    }
    if (peer.remote_address !== "") return peer.remote_address
    return "unknown"
}

/**
 * @param {string[]} ancestry
 * @returns {string}
 */
function shortenAncestry(ancestry) {
    if (ancestry.length <= 4) return ancestry.join(" → ")
    return `${ancestry[0]} → … → ${ancestry[ancestry.length - 2]} → ${ancestry[ancestry.length - 1]}`
}

/**
 * @param {string[]} arr
 * @param {string} value
 */
function appendUnique(arr, value) {
    if (value === "" || arr.includes(value)) return
    arr.push(value)
}

/**
 * @param {string[]} arr
 * @param {string} value
 */
function removeValue(arr, value) {
    const idx = arr.indexOf(value)
    if (idx !== -1) arr.splice(idx, 1)
}

/**
 * @typedef {{
 *   leaf: string
 *   shortTree: string
 *   destinations: string[]
 *   badDomains: string[]
 *   detections: string[]
 *   flagged: boolean
 *   order: number
 *   unattributed?: boolean
 * }} ProcessGroup
 */

/**
 * record folds one peer's destination and detections into a process group. A
 * destination is named a known bad domain only when the known_bad_domain
 * detection is present; a bad result alone can come from a process behavior and
 * must not relabel an ordinary destination.
 * @param {ProcessGroup} g
 * @param {EgressPeer} peer
 * @param {string} dest
 */
function recordPeerActivity(g, peer, dest) {
    const badDest = peer.detections.includes(KNOWN_BAD_DOMAIN_DETECTION)
    if (dest !== "" && dest !== "unknown") {
        if (badDest) {
            removeValue(g.destinations, dest)
            appendUnique(g.badDomains, dest)
        } else if (!g.badDomains.includes(dest)) {
            appendUnique(g.destinations, dest)
        }
    }
    for (const det of peer.detections) {
        if (isMeaningfulDetection(det)) appendUnique(g.detections, det.trim())
    }
    if (peer.result === "fail" || peer.result === "attention" || hasMeaningfulDetection(peer.detections)) {
        g.flagged = true
    }
}

/**
 * @param {NormalizedProfile[]} profiles
 * @returns {ProcessGroup[]}
 */
function buildProcessGroups(profiles) {
    /** @type {Map<string, ProcessGroup>} */
    const byTree = new Map()
    let order = 0
    /** @type {ProcessGroup | undefined} */
    let unattributed
    for (const profile of profiles) {
        for (const peer of profile.egress_peers) {
            const dest = peerDestination(peer)
            let attributed = false
            for (const procTree of peer.proc_trees) {
                const ancestry = procTree.ancestry
                if (ancestry.length === 0) continue
                attributed = true
                const key = ancestry.join("\u0000")
                let g = byTree.get(key)
                if (g === undefined) {
                    g = {
                        leaf: ancestry[ancestry.length - 1] ?? "",
                        shortTree: shortenAncestry(ancestry),
                        destinations: [],
                        badDomains: [],
                        detections: [],
                        flagged: false,
                        order: order++,
                    }
                    byTree.set(key, g)
                }
                recordPeerActivity(g, peer, dest)
            }
            if (!attributed) {
                // The peer carries no usable process lineage; keep its
                // destinations/detections in the narrative under a catch-all
                // group rather than hiding them in the collapsed evidence.
                if (unattributed === undefined) {
                    unattributed = {
                        leaf: "",
                        shortTree: "",
                        destinations: [],
                        badDomains: [],
                        detections: [],
                        flagged: false,
                        order: order++,
                        unattributed: true,
                    }
                }
                recordPeerActivity(unattributed, peer, dest)
            }
        }
    }
    const groups = [...byTree.values()]
    if (unattributed !== undefined) groups.push(unattributed)
    groups.sort((a, b) => {
        if (a.flagged !== b.flagged) return a.flagged ? -1 : 1
        return a.order - b.order
    })
    return groups
}

/**
 * @param {NormalizedProfile[]} profiles
 * @returns {string}
 */
function renderNarrative(profiles) {
    const groups = buildProcessGroups(profiles)
    if (groups.length === 0) {
        return "No outbound network connections were observed during this run.\n"
    }
    let out = ""
    for (const g of groups) {
        if (g.unattributed) {
            out += "**Network activity without an attributed process**\n\n"
        } else {
            out += `**\`${escapeMarkdown(g.leaf)}\`** (\`${escapeMarkdown(g.shortTree)}\`)\n\n`
        }
        if (g.detections.length > 0 || g.badDomains.length > 0) {
            out += "What it did:\n"
            const rendered = []
            // Name known-bad destinations plainly and factually, not alarm-styled.
            if (g.badDomains.length > 0) {
                const line = renderBadDomainLine(g.badDomains)
                rendered.push(line)
                out += `- ${line}\n`
            }
            for (const det of g.detections) {
                // The known-bad-domain fact is already named above with the
                // actual destination(s); skip the generic restatement.
                if (det === KNOWN_BAD_DOMAIN_DETECTION) continue
                const line = humanizeDetection(det)
                if (rendered.includes(line)) continue
                rendered.push(line)
                out += `- ${line}\n`
            }
            if (g.destinations.length > 0) {
                out += `- Connected to: ${renderDestinationList(g.destinations)}\n`
            }
            out += "\n"
            continue
        }
        if (g.destinations.length > 0) {
            const noun = g.destinations.length === 1 ? "destination" : "destinations"
            out += `Connected to ${g.destinations.length} ${noun}: ${renderDestinationList(g.destinations)}\n\n`
            continue
        }
        out += "Ran without making outbound connections.\n\n"
    }
    return out
}

/**
 * renderSummaryLine is the neutral one-line summary (≈1s read). No risk verdict.
 * @param {NormalizedProfile[]} profiles
 * @returns {string}
 */
function renderSummaryLine(profiles) {
    let domains = 0
    let connections = 0
    for (const profile of profiles) {
        domains += profile.telemetry.total_domains
        connections += profile.telemetry.total_connections
    }
    const jobs = profiles.length
    const parts = [
        `${jobs} ${jobs === 1 ? "job" : "jobs"}`,
        `${domains} ${domains === 1 ? "domain" : "domains"}`,
        `${connections} ${connections === 1 ? "connection" : "connections"}`,
    ]
    return `Here's what your pipeline did at runtime — ${parts.join(", ")}.`
}

/**
 * @param {NormalizedProfile} profile
 * @returns {string}
 */
function renderProfileSection(profile) {
    const title = escapeHtml(formatWorkflowJob(profile.github.workflow, profile.github.job))
    const assertionBadge = escapeHtml(getAssertionBadge(profile))
    const workloadTable = renderKeyValueTable([
        ["Workflow", profile.github.workflow],
        ["Repository", profile.github.repository],
        ["Branch", profile.github.ref],
        ["Commit", profile.github.sha],
        ["Triggered by", profile.github.actor],
        ["Run ID / Job", formatRunJob(profile.github.repository, profile.github.run_id, profile.github.job)],
    ])
    const networkSection = renderNetworkSection(profile)
    const assertionSection = renderAssertionSection(profile)
    const footer = renderProfileFooter(profile)

    return [
        `<details>`,
        `<summary><strong>${title}</strong> · ${assertionBadge}</summary>`,
        "",
        "#### Workload Summary",
        "",
        workloadTable,
        "",
        networkSection,
        "",
        assertionSection,
        "",
        footer,
        "</details>",
    ].join("\n")
}

/**
 * @param {NormalizedProfile} profile
 * @returns {string}
 */
function renderNetworkSection(profile) {
    if (!hasNetworkData(profile)) {
        return [
            "#### Network Egress Summary",
            "",
            "Duplicate egress destinations including their process tree are omitted.",
            "",
            "No network information available.",
        ].join("\n")
    }

    const rows = []
    const seen = new Set()
    let skippedRemoteNames = 0
    let totalRemoteNames = 0

    for (const peer of profile.egress_peers) {
        for (const remoteName of peer.remote_names) {
            totalRemoteNames += 1
            if (peer.result !== "fail") {
                if (seen.has(remoteName)) {
                    skippedRemoteNames += 1
                    continue
                }
                seen.add(remoteName)
            }

            rows.push([
                `\`${escapeMarkdown(remoteName)}\``,
                renderProcessTrees(peer.proc_trees),
                getResultIcon(peer.result),
            ])
        }
    }

    const egressTable =
        rows.length > 0
            ? renderTable(["Destination", "Process Tree", "Status"], rows)
            : "No egress peers information available."

    /** @type {[string, string][]} */
    const telemetryRows = [
        ["Total egress unique domain(s)", String(profile.telemetry.total_domains)],
        ["Total egress destination(s)", String(totalRemoteNames)],
        ["Total egress omitted destination(s)", String(skippedRemoteNames)],
        ["Total egress connection(s)", String(profile.telemetry.total_connections)],
        ["Total egress flow(s)", String(profile.egress_peers.length)],
    ]

    return [
        "#### Network Egress Summary",
        "",
        "Duplicate egress destinations including their process tree are omitted.",
        "",
        egressTable,
        "",
        "##### Network Telemetry Summary",
        "",
        renderKeyValueTable(telemetryRows),
    ].join("\n")
}

/**
 * @param {NormalizedProfile} profile
 * @returns {string}
 */
function renderAssertionSection(profile) {
    if (profile.assertions.length === 0) {
        return ["#### Assertions", "", "No assertions information available."].join("\n")
    }

    const rows = profile.assertions.map(assertion => [
        escapeMarkdown(assertion.id),
        escapeMarkdown(getResultIconText(assertion.result)),
    ])

    return ["#### Assertions", "", renderTable(["Check", "Result"], rows)].join("\n")
}

/**
 * @param {NormalizedProfile} profile
 * @returns {string}
 */
function renderProfileFooter(profile) {
    /** @type {string[]} */
    const footerParts = []
    footerParts.push(
        `${profile.telemetry.total_domains} unique domains · ${profile.telemetry.total_connections} connections`,
    )
    if (profile.github.run_id.length > 0 || profile.github.job.length > 0) {
        footerParts.push(
            `Workflow ${escapeHtml(getDisplayValue(profile.github.workflow, "-"))} - Run #${escapeHtml(getDisplayValue(profile.github.run_id, "-"))} - Job ${escapeHtml(getDisplayValue(profile.github.job, "-"))}`,
        )
    }
    if (profile.timestamp.length > 0) {
        footerParts.push(`timestamp ${escapeHtml(profile.timestamp)}`)
    }

    const header = footerParts.join("  -  ")
    const viewLink = buildProfileFooterLink(profile.report_link)

    return `<div align="right"><sub>${header}</sub><br><b>Powered by Garnet</b>${viewLink}</div>`
}

/**
 * @param {ProcTree[]} procTrees
 * @returns {string}
 */
function renderProcessTrees(procTrees) {
    const rendered = procTrees
        .map(procTree => {
            if (procTree.ancestry.length === 0) {
                return ""
            }

            const [rootProcess, ...remainingAncestry] = procTree.ancestry
            if (rootProcess === undefined || rootProcess === "") {
                return ""
            }

            const items = []
            items.push(`\`${escapeMarkdown(rootProcess)}\``)

            let start = 1
            if (procTree.ancestry.length > 4) {
                start = procTree.ancestry.length - 3
                items.push("`...`")
            }

            for (const processName of remainingAncestry.slice(start - 1)) {
                items.push(`\`${escapeMarkdown(processName)}\``)
            }

            return items.join(" → ")
        })
        .filter(value => value.length > 0)

    return rendered.length > 0 ? rendered.join("<br>") : "-"
}

/**
 * @param {string[]} headers
 * @param {string[][]} rows
 * @returns {string}
 */
function renderTable(headers, rows) {
    const headerRow = `| ${headers.map(header => escapeMarkdown(header)).join(" | ")} |`
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
        rows.map(([key, value]) => [escapeMarkdown(key), escapeMarkdown(getDisplayValue(value, "-"))]),
    )
}

/**
 * @param {CommentState} state
 * @returns {string}
 */
function encodeCommentState(state) {
    return Buffer.from(JSON.stringify(state), "utf8").toString("base64url")
}

/**
 * @param {string} body
 * @param {string} markerPrefix
 * @returns {string | null}
 */
function parseCommentMarkerValue(body, markerPrefix) {
    const marker = `<!-- ${markerPrefix}`
    const start = body.indexOf(marker)
    if (start === -1) {
        return null
    }

    const end = body.indexOf("-->", start)
    if (end === -1) {
        return null
    }

    return body.slice(start + marker.length, end).trim()
}

/**
 * @param {NormalizedProfile[]} profiles
 * @returns {string}
 */
function getCommentCommitSha(profiles) {
    for (const profile of profiles) {
        if (profile.github.sha !== "") {
            return profile.github.sha
        }
    }

    return ""
}

/**
 * @param {{ repository: string, run_id: string, job: string }} values
 * @returns {string}
 */
function buildReportLink(values) {
    const baseURL = resolveAppBaseUrl()
    if (values.run_id === "") {
        return utmTrackedURL(baseURL)
    }

    // TODO: Switch back to the full repository/job route once the dashboard
    // supports /dashboard/runs/{org}/{repo}/{runID}/{job}.
    return utmTrackedURL(`${baseURL}/dashboard/runs/${encodeURIComponent(values.run_id)}`)
}

/**
 * @param {string} rawURL
 * @returns {string}
 */
function utmTrackedURL(rawURL) {
    try {
        const url = new URL(rawURL)
        url.searchParams.set("utm_source", UTM_SOURCE)
        url.searchParams.set("utm_medium", UTM_MEDIUM)
        return url.toString()
    } catch {
        return rawURL
    }
}

/**
 * @param {string} repository
 * @param {string} runId
 * @returns {string}
 */
function buildGitHubRunLink(repository, runId) {
    const repositoryPath = repository
        .split("/")
        .filter(part => part !== "")
        .map(part => encodeURIComponent(part))
        .join("/")

    if (repositoryPath === "" || !repositoryPath.includes("/") || runId === "") {
        return ""
    }

    return `https://github.com/${repositoryPath}/actions/runs/${encodeURIComponent(runId)}`
}

/**
 * @returns {string}
 */
function resolveAppBaseUrl() {
    const apiUrl = getConfiguredApiUrl()
    if (apiUrl === "") {
        return DEFAULT_APP_BASE_URL
    }

    try {
        const url = new URL(apiUrl)
        const appHost = mapApiHostToAppHost(url.host)
        return `${url.protocol}//${appHost}`
    } catch {
        return DEFAULT_APP_BASE_URL
    }
}

/**
 * @returns {string}
 */
function getConfiguredApiUrl() {
    if (typeof process.env.GARNET_API_URL === "string" && process.env.GARNET_API_URL !== "") {
        return process.env.GARNET_API_URL
    }

    if (typeof process.env.INPUT_API_URL === "string" && process.env.INPUT_API_URL !== "") {
        return process.env.INPUT_API_URL
    }

    return ""
}

/**
 * @param {string} host
 * @returns {string}
 */
function mapApiHostToAppHost(host) {
    if (host === "dev-api.garnet.ai") {
        return "dev-app.garnet.ai"
    }
    if (host === "staging-api.garnet.ai") {
        return "staging-app.garnet.ai"
    }
    if (host === "api.garnet.ai") {
        return "app.garnet.ai"
    }

    return host
}

/**
 * @param {NormalizedProfile} profile
 * @returns {"passed" | "failed"}
 */
function getAssertionState(profile) {
    return profile.assertions.some(assertion => assertion.result === "fail") ? "failed" : "passed"
}

/**
 * @param {NormalizedProfile} profile
 * @returns {string}
 */
function getAssertionBadge(profile) {
    return getAssertionState(profile) === "failed" ? "🔴 Failed" : "✅ Passed"
}

/**
 * @param {NormalizedProfile} profile
 * @returns {boolean}
 */
function hasNetworkData(profile) {
    return (
        profile.egress_peers.length > 0 ||
        profile.telemetry.total_domains > 0 ||
        profile.telemetry.total_connections > 0
    )
}

/**
 * @param {ProfileResult} result
 * @returns {string}
 */
function getResultIcon(result) {
    if (result === "fail") {
        return "🔴"
    }
    if (result === "pass" || result === "attention") {
        return "✅"
    }
    return "❓"
}

/**
 * @param {ProfileResult} result
 * @returns {string}
 */
function getResultIconText(result) {
    if (result === "fail") {
        return "🔴 fail"
    }
    if (result === "pass" || result === "attention") {
        return "✅ pass"
    }
    return "❓ unknown"
}

/**
 * @param {{ run_id: string, run_attempt: number }} left
 * @param {{ run_id: string, run_attempt: number }} right
 * @returns {number}
 */
function compareRuns(left, right) {
    const leftRunId = toBigInt(left.run_id)
    const rightRunId = toBigInt(right.run_id)
    if (leftRunId > rightRunId) {
        return 1
    }
    if (leftRunId < rightRunId) {
        return -1
    }

    if (left.run_attempt > right.run_attempt) {
        return 1
    }
    if (left.run_attempt < right.run_attempt) {
        return -1
    }

    return 0
}

/**
 * @param {LegacyCommentState} state
 * @returns {CommentState}
 */
function upgradeLegacyCommentState(state) {
    return {
        version: 2,
        workflow_runs: state.profiles.reduce((accumulator, profile) => {
            accumulator[getWorkflowKey(profile)] = state.latest_run
            return accumulator
        }, /** @type {Record<string, WorkflowRun>} */ ({})),
        profiles: [...state.profiles].sort(compareProfiles),
    }
}

/**
 * @param {NormalizedProfile} profile
 * @returns {string}
 */
function getWorkflowKey(profile) {
    return getDisplayValue(profile.github.workflow, "unknown-workflow")
}

/**
 * @param {NormalizedProfile} profile
 * @returns {string}
 */
function getProfileKey(profile) {
    return `${getWorkflowKey(profile)}\u0000${getDisplayValue(profile.github.job, "unknown-job")}`
}

/**
 * @param {NormalizedProfile} left
 * @param {NormalizedProfile} right
 * @returns {number}
 */
function compareProfiles(left, right) {
    const workflowCompare = getWorkflowKey(left).localeCompare(getWorkflowKey(right))
    if (workflowCompare !== 0) {
        return workflowCompare
    }

    return left.github.job.localeCompare(right.github.job)
}

/**
 * @param {string} workflow
 * @param {string} job
 * @returns {string}
 */
function formatWorkflowJob(workflow, job) {
    return `${getDisplayValue(workflow, "Unknown workflow")} / ${getDisplayValue(job, "Unknown job")}`
}

/**
 * @param {string} value
 * @returns {bigint}
 */
function toBigInt(value) {
    try {
        return BigInt(value)
    } catch {
        return 0n
    }
}

/**
 * @param {unknown} value
 * @returns {ProfileResult}
 */
function normalizeResult(value) {
    const normalized = getString(value).toLowerCase()
    if (normalized === "pass" || normalized === "attention" || normalized === "fail") {
        return normalized
    }
    return "unknown"
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function getNumber(value) {
    return typeof value === "number" ? value : 0
}

/**
 * @param {unknown} profile
 * @returns {EgressPeer[]}
 */
function getProfileNetworkPeers(profile) {
    const root = getOptionalRecord(profile)
    const network = getOptionalRecord(root?.network)
    const egress = getOptionalRecord(network?.egress)
    return Array.isArray(egress?.peers) ? egress.peers : []
}

/**
 * @param {unknown} profile
 * @returns {NetworkTelemetry}
 */
function getProfileNetworkTelemetry(profile) {
    const root = getOptionalRecord(profile)
    const telemetry = getOptionalRecord(root?.telemetry)
    const network = getOptionalRecord(telemetry?.network)
    const egress = getOptionalRecord(network?.egress)

    return {
        total_domains: getNumber(egress?.total_domains),
        total_connections: getNumber(egress?.total_connections),
    }
}

/**
 * @param {string} reportLink
 * @returns {string}
 */
function buildProfileFooterLink(reportLink) {
    if (reportLink === "") {
        return ""
    }

    return ` · <a href="${escapeHtmlAttribute(reportLink)}">View full report ↗</a>`
}

/**
 * @param {string} value
 * @param {string} fallback
 * @returns {string}
 */
function getDisplayValue(value, fallback) {
    return value !== "" ? value : fallback
}

/**
 * @param {string} repository
 * @param {string} runId
 * @param {string} label
 * @returns {string}
 */
function formatRunMarkdownLink(repository, runId, label) {
    const runLink = buildGitHubRunLink(repository, runId)
    if (runLink === "") {
        return escapeMarkdown(label)
    }

    return `[${escapeMarkdown(label)}](${escapeMarkdownLink(runLink)})`
}

/**
 * @param {string} repository
 * @param {string} runId
 * @param {string} job
 * @returns {string}
 */
function formatRunJob(repository, runId, job) {
    /** @type {string[]} */
    const parts = []
    if (runId !== "") {
        parts.push(formatRunMarkdownLink(repository, runId, runId))
    }
    if (job !== "") {
        parts.push(escapeMarkdown(job))
    }

    return parts.length > 0 ? parts.join(" / ") : "-"
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function getString(value) {
    return typeof value === "string" ? value : ""
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeMarkdown(value) {
    return value.replaceAll("\\", "\\\\").replaceAll("|", "\\|").replaceAll("`", "\\`").replaceAll("\n", " ")
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeMarkdownLink(value) {
    return value.replaceAll(")", "%29")
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtmlAttribute(value) {
    return escapeHtml(value)
}
