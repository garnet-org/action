import { z } from "zod"
import { getOptionalRecord } from "./shared.js"

export const RUNTIME_REVIEW_MARKER = "garnet-runtime-review"
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
 *   remote_address?: string
 *   remote_names: string[]
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
        remote_address: z.string().optional(),
        remote_names: z.array(z.string()),
        proc_trees: z.array(PROC_TREE_SCHEMA),
    })
    .transform(peer => ({
        remote_address: peer.remote_address ?? "",
        remote_names: peer.remote_names.filter(name => name.length > 0),
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
    const commitSha = getCommentCommitSha(profiles)
    const parts = [
        `<!-- ${RUNTIME_REVIEW_MARKER} -->`,
        `<!-- ${ACTION_COMMENT_MARKER} -->`,
        `<!-- ${COMMIT_MARKER_PREFIX}${commitSha} -->`,
        `<!-- ${COMMENT_STATE_MARKER_PREFIX}${metadata} -->`,
        "## Garnet Runtime Review",
        renderMetaLine(profiles),
        "",
        renderHeadline(profiles),
    ]

    const inlineTrees = renderInlineTrees(profiles)
    if (inlineTrees !== "") {
        parts.push("", inlineTrees)
    }

    const quietJobLines = renderQuietJobLines(profiles)
    if (quietJobLines !== "") {
        parts.push("", quietJobLines)
    }

    parts.push("", renderEvidenceFold(profiles), "", "---", renderFooter(profiles))

    return parts.join("\n")
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

/**
 * @param {NormalizedProfile[]} profiles
 * @returns {string}
 */
function renderMetaLine(profiles) {
    const repository = getDisplayValue(profiles[0]?.github.repository ?? "", "unknown-repository")
    const sha = shortSha(getCommentCommitSha(profiles))
    const jobCount = profiles.length
    const workflowCount = new Set(profiles.map(profile => getWorkflowKey(profile))).size

    return `${repository} · ${getDisplayValue(sha, "unknown-commit")} · ${pluralize(jobCount, "job")} · ${pluralize(workflowCount, "workflow")}`
}

/**
 * @param {NormalizedProfile[]} profiles
 * @returns {string}
 */
function renderHeadline(profiles) {
    return (
        renderUniqueDestinationHeadline(profiles) ??
        renderSpawnTopologyHeadline(profiles) ??
        renderCountsHeadline(profiles)
    )
}

/**
 * R1 — a destination reached by exactly one job, computable only when multiple
 * job profiles are present in the payload.
 *
 * @param {NormalizedProfile[]} profiles
 * @returns {string | null}
 */
function renderUniqueDestinationHeadline(profiles) {
    if (profiles.length < 2) {
        return null
    }

    /** @type {Map<string, Set<string>>} */
    const destinationJobs = new Map()
    for (const profile of profiles) {
        const jobKey = getProfileKey(profile)
        for (const peer of profile.egress_peers) {
            for (const remoteName of peer.remote_names) {
                const jobs = destinationJobs.get(remoteName) ?? new Set()
                jobs.add(jobKey)
                destinationJobs.set(remoteName, jobs)
            }
        }
    }

    const uniqueDestinations = [...destinationJobs.entries()]
        .filter(([, jobs]) => jobs.size === 1)
        .map(([destination]) => destination)
        .sort()

    const destination = uniqueDestinations[0]
    if (destination === undefined || destinationJobs.size === uniqueDestinations.length) {
        return null
    }

    const profile = profiles.find(candidate =>
        candidate.egress_peers.some(peer => peer.remote_names.includes(destination)),
    )
    if (profile === undefined) {
        return null
    }

    const jobLabel = getDisplayValue(profile.github.job, "unknown-job")
    const process = findDestinationProcess(profile, destination)
    const reachedBy = process !== "" ? `\`${process}\` reached` : "the job reached"

    return `In \`${jobLabel}\`, ${reachedBy} \`${destination}\` — a destination no other job in this run reached.`
}

/**
 * R2 — a network tool appearing in the lineage tail of an ancestry array.
 *
 * @param {NormalizedProfile[]} profiles
 * @returns {string | null}
 */
function renderSpawnTopologyHeadline(profiles) {
    for (const profile of profiles) {
        for (const peer of profile.egress_peers) {
            for (const procTree of peer.proc_trees) {
                const toolIndex = findNetworkToolIndex(procTree.ancestry)
                if (toolIndex === -1) {
                    continue
                }

                const jobLabel = getDisplayValue(profile.github.job, "unknown-job")
                const parent = procTree.ancestry[toolIndex - 1] ?? ""
                const chain = procTree.ancestry.slice(toolIndex).join(" → ")
                const destination = peer.remote_names[0] ?? ""
                const spawnedBy = parent !== "" ? `\`${parent}\` spawned` : "the job spawned"
                const reached = destination !== "" ? `, which reached \`${destination}\`` : ""

                return `In \`${jobLabel}\`, ${spawnedBy} \`${chain}\`${reached}.`
            }
        }
    }

    return null
}

/**
 * R3 — plain job/workflow/destination counts.
 *
 * @param {NormalizedProfile[]} profiles
 * @returns {string}
 */
function renderCountsHeadline(profiles) {
    const jobCount = profiles.length
    const workflowCount = new Set(profiles.map(profile => getWorkflowKey(profile))).size
    const domainCount = countUniqueDomains(profiles)
    const connectionCount = countConnections(profiles)

    if (domainCount === 0 && connectionCount === 0) {
        return `${pluralize(jobCount, "job")} across ${pluralize(workflowCount, "workflow")} made no outbound connections.`
    }

    return `${pluralize(jobCount, "job")} across ${pluralize(workflowCount, "workflow")} reached ${pluralize(domainCount, "domain")} over ${pluralize(connectionCount, "connection")}.`
}

/**
 * @param {NormalizedProfile[]} profiles
 * @returns {string}
 */
function renderInlineTrees(profiles) {
    const activeProfiles = profiles.filter(profile => !isQuietProfile(profile))
    if (activeProfiles.length === 0) {
        return ""
    }

    const trees = activeProfiles.map(profile => renderJobTree(profile).join("\n"))

    return ["```text", trees.join("\n\n"), "```"].join("\n")
}

/**
 * @param {NormalizedProfile[]} profiles
 * @returns {string}
 */
function renderQuietJobLines(profiles) {
    return profiles
        .filter(profile => isQuietProfile(profile))
        .map(profile => renderQuietJobLine(profile))
        .join("\n")
}

/**
 * @param {NormalizedProfile} profile
 * @returns {string}
 */
function renderQuietJobLine(profile) {
    const jobLabel = escapeMarkdown(getDisplayValue(profile.github.job, "unknown-job"))
    const workflowLabel = escapeMarkdown(getDisplayValue(profile.github.workflow, "unknown-workflow"))

    return `\`${jobLabel}\` · ${workflowLabel} — made no outbound connections.`
}

/**
 * @param {NormalizedProfile[]} profiles
 * @returns {string}
 */
function renderEvidenceFold(profiles) {
    const jobCount = profiles.length
    const domainCount = countUniqueDomains(profiles)
    const connectionCount = countConnections(profiles)
    const summary = `Full process & network evidence · ${pluralize(jobCount, "job")} · ${pluralize(domainCount, "domain")} · ${pluralize(connectionCount, "connection")}`
    const sections = profiles.map(profile => renderEvidenceSection(profile))

    return ["<details>", `<summary>${summary}</summary>`, "", sections.join("\n\n"), "", "</details>"].join("\n")
}

/**
 * @param {NormalizedProfile} profile
 * @returns {string}
 */
function renderEvidenceSection(profile) {
    const workflowLabel = escapeMarkdown(getDisplayValue(profile.github.workflow, "unknown-workflow"))
    const jobLabel = escapeMarkdown(getDisplayValue(profile.github.job, "unknown-job"))
    const heading = `**${workflowLabel} / ${jobLabel}** · ${pluralize(profile.telemetry.total_domains, "domain")} · ${pluralize(profile.telemetry.total_connections, "connection")}`

    if (isQuietProfile(profile)) {
        return [heading, "", "Made no outbound connections."].join("\n")
    }

    return [heading, "", "```text", renderJobTree(profile).join("\n"), "```"].join("\n")
}

/**
 * @param {NormalizedProfile[]} profiles
 * @returns {string}
 */
function renderFooter(profiles) {
    const permalink = profiles.map(profile => profile.report_link).find(link => link !== "") ?? ""
    const runProfileLink = permalink !== "" ? ` · [Run Profile ↗](${escapeMarkdownLink(permalink)})` : ""

    return `<sub>What happened in this PR — each job's processes and where they reached.${runProfileLink}</sub>`
}

/**
 * @typedef {{
 *   children: Map<string, LineageNode>
 *   destinations: Map<string, number>
 * }} LineageNode
 */

/**
 * @returns {LineageNode}
 */
function createLineageNode() {
    return { children: new Map(), destinations: new Map() }
}

/**
 * @param {NormalizedProfile} profile
 * @returns {string[]}
 */
function renderJobTree(profile) {
    const root = createLineageNode()

    for (const peer of profile.egress_peers) {
        const destinations = peer.remote_names.map(remoteName => formatDestination(remoteName, peer.remote_address ?? ""))
        const procTrees = peer.proc_trees.filter(procTree => procTree.ancestry.length > 0)
        const leaves = procTrees.length > 0 ? procTrees.map(procTree => insertLineage(root, procTree.ancestry)) : [root]

        for (const leaf of leaves) {
            for (const destination of destinations) {
                leaf.destinations.set(destination, (leaf.destinations.get(destination) ?? 0) + 1)
            }
        }
    }

    const lines = [getDisplayValue(profile.github.job, "unknown-job")]
    renderLineageNode(root, "", lines)
    return lines
}

/**
 * @param {LineageNode} root
 * @param {string[]} ancestry
 * @returns {LineageNode}
 */
function insertLineage(root, ancestry) {
    let node = root
    for (const processName of ancestry) {
        let child = node.children.get(processName)
        if (child === undefined) {
            child = createLineageNode()
            node.children.set(processName, child)
        }
        node = child
    }

    return node
}

/**
 * @param {LineageNode} node
 * @param {string} prefix
 * @param {string[]} lines
 * @returns {void}
 */
function renderLineageNode(node, prefix, lines) {
    /** @type {{ label: string, child: LineageNode | null }[]} */
    const entries = []
    for (const [destination, count] of node.destinations) {
        entries.push({ label: count > 1 ? `→ ${destination} (×${count})` : `→ ${destination}`, child: null })
    }
    for (const [processName, child] of node.children) {
        entries.push({ label: processName, child })
    }

    entries.forEach((entry, index) => {
        const isLast = index === entries.length - 1
        lines.push(`${prefix}${isLast ? "└─" : "├─"} ${entry.label}`)
        if (entry.child !== null) {
            renderLineageNode(entry.child, `${prefix}${isLast ? "   " : "│  "}`, lines)
        }
    })
}

/**
 * @param {string} remoteName
 * @param {string} remoteAddress
 * @returns {string}
 */
function formatDestination(remoteName, remoteAddress) {
    return remoteAddress !== "" ? `${remoteName} · ${remoteAddress}` : remoteName
}

/**
 * @param {NormalizedProfile} profile
 * @param {string} destination
 * @returns {string}
 */
function findDestinationProcess(profile, destination) {
    for (const peer of profile.egress_peers) {
        if (!peer.remote_names.includes(destination)) {
            continue
        }

        for (const procTree of peer.proc_trees) {
            const leafProcess = procTree.ancestry.at(-1)
            if (leafProcess !== undefined && leafProcess !== "") {
                return leafProcess
            }
        }
    }

    return ""
}

const NETWORK_TOOLS = new Set(["curl", "wget", "sh -c", "bash -c"])
const NETWORK_TOOL_TAIL_LENGTH = 3

/**
 * @param {string[]} ancestry
 * @returns {number}
 */
function findNetworkToolIndex(ancestry) {
    const tailStart = Math.max(0, ancestry.length - NETWORK_TOOL_TAIL_LENGTH)
    for (let index = tailStart; index < ancestry.length; index += 1) {
        const processName = ancestry[index] ?? ""
        if (NETWORK_TOOLS.has(processName) || NETWORK_TOOLS.has(processName.split(" ")[0] ?? "")) {
            return index
        }
    }

    return -1
}

/**
 * @param {NormalizedProfile} profile
 * @returns {boolean}
 */
function isQuietProfile(profile) {
    return profile.egress_peers.every(peer => peer.remote_names.length === 0) && profile.telemetry.total_connections === 0
}

/**
 * @param {NormalizedProfile[]} profiles
 * @returns {number}
 */
function countUniqueDomains(profiles) {
    const domains = new Set()
    for (const profile of profiles) {
        for (const peer of profile.egress_peers) {
            for (const remoteName of peer.remote_names) {
                domains.add(remoteName)
            }
        }
    }

    if (domains.size > 0) {
        return domains.size
    }

    return profiles.reduce((total, profile) => total + profile.telemetry.total_domains, 0)
}

/**
 * @param {NormalizedProfile[]} profiles
 * @returns {number}
 */
function countConnections(profiles) {
    return profiles.reduce((total, profile) => total + profile.telemetry.total_connections, 0)
}

/**
 * @param {number} count
 * @param {string} noun
 * @returns {string}
 */
function pluralize(count, noun) {
    return `${count} ${noun}${count === 1 ? "" : "s"}`
}

/**
 * @param {string} sha
 * @returns {string}
 */
function shortSha(sha) {
    return sha.length > 7 ? sha.slice(0, 7) : sha
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
 * @param {string} value
 * @param {string} fallback
 * @returns {string}
 */
function getDisplayValue(value, fallback) {
    return value !== "" ? value : fallback
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

