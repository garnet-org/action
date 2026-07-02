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
 * @typedef {{ ancestry: string[], github_step?: string | undefined }} ProcTree
 */

/**
 * @typedef {{
 *   org?: string | undefined
 *   city?: string | undefined
 *   country_code?: string | undefined
 * }} PeerGeoInfo
 */

/**
 * @typedef {{
 *   remote_address?: string | undefined
 *   remote_names: string[]
 *   remote_ports?: (string | number)[] | undefined
 *   remote_geo_info?: PeerGeoInfo | undefined
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
        github_step: z.string().optional(),
    })
    .transform(procTree => ({
        ancestry: procTree.ancestry.filter(entry => entry.length > 0),
        ...(procTree.github_step !== undefined ? { github_step: procTree.github_step } : {}),
    }))

const ASSERTION_SCHEMA = z.looseObject({
    id: z.string(),
    result: PROFILE_RESULT_SCHEMA,
})

const PEER_GEO_INFO_SCHEMA = z.looseObject({
    org: z.string().optional(),
    city: z.string().optional(),
    country_code: z.string().optional(),
})

const PEER_SCHEMA = z
    .looseObject({
        result: PROFILE_RESULT_SCHEMA,
        remote_address: z.string().optional(),
        remote_names: z.array(z.string()),
        remote_ports: z.array(z.union([z.string(), z.number()])).optional(),
        remote_geo_info: PEER_GEO_INFO_SCHEMA.optional(),
        proc_trees: z.array(PROC_TREE_SCHEMA),
    })
    .transform(peer => ({
        remote_address: peer.remote_address ?? "",
        remote_names: peer.remote_names.filter(name => name.length > 0),
        proc_trees: peer.proc_trees,
        result: peer.result,
        ...(peer.remote_ports !== undefined ? { remote_ports: peer.remote_ports } : {}),
        ...(peer.remote_geo_info !== undefined ? { remote_geo_info: peer.remote_geo_info } : {}),
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
        "## What this PR did at runtime",
        "",
    ]

    if (profiles.length === 0) {
        parts.push("No runtime activity was recorded for this commit.")
        return parts.join("\n")
    }

    const totalConnections = profiles.reduce((total, profile) => total + profile.telemetry.total_connections, 0)
    const uniqueDomains = new Set()
    for (const profile of profiles) {
        for (const peer of visiblePeers(profile)) {
            uniqueDomains.add(lc(destinationName(peer)))
        }
    }
    const totalDomains =
        uniqueDomains.size > 0
            ? uniqueDomains.size
            : profiles.reduce((total, profile) => total + profile.telemetry.total_domains, 0)
    const workloadDomains = new Set()
    for (const profile of profiles) {
        for (const peer of visiblePeers(profile)) {
            const name = destinationName(peer)
            if (!isInfraEgress(name)) {
                workloadDomains.add(lc(name))
            }
        }
    }

    parts.push(
        renderSummaryLine({
            jobs: profiles.length,
            connections: totalConnections,
            destinations: totalDomains,
            workloadDestinations: workloadDomains.size,
        }),
        "",
    )

    // Each job with workload egress gets its own section, one bullet per unique
    // process lineage. Registry/build-infra egress folds into one deduped block
    // below, so the comment stays short even on a many-job PR.
    for (const profile of profiles) {
        const workload = visiblePeers(profile).filter(peer => !isInfraEgress(destinationName(peer)))
        if (workload.length === 0) {
            continue
        }

        parts.push(`**${escapeMarkdown(profileJobLabel(profile))}** · ${renderJobLinks(profile)}`, "")
        for (const bullet of renderLineageBullets(workload)) {
            parts.push(bullet)
        }
        parts.push("")
    }

    const infraBlock = renderInfraBlock(profiles)
    if (infraBlock.length > 0) {
        parts.push(...infraBlock, "")
    }

    const sha = shortSha(commitSha)
    const reportLink = profiles.map(profile => profile.report_link).find(link => link !== "") ?? ""
    const linkPart = reportLink !== "" ? ` · <a href="${escapeMarkdownLink(reportLink)}">full runtime record ↗</a>` : ""
    parts.push(
        "---",
        `<sub>${pluralize(totalDomains, "destination")} · ${pluralize(totalConnections, "connection")} across ${pluralize(profiles.length, "job")}${sha !== "" ? ` · \`${sha}\`` : ""} · <b>Powered by Garnet</b>${linkPart}</sub>`,
    )

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
 * Package registries & build infrastructure: a FIXED, deterministic list of
 * well-known package registries, source hosts, OS mirrors, and the runtime's
 * own plumbing. Used only to group the snapshot so registry noise folds into
 * one collapsed block — a factual classification, never a judgment. There is
 * no baseline and no history: the same profile always renders the same comment.
 */
const INFRA_EGRESS = [
    /(^|\.)npmjs\.(org|com)$/,
    /(^|\.)yarnpkg\.com$/,
    /(^|\.)pypi\.org$/,
    /(^|\.)pythonhosted\.org$/,
    /(^|\.)github\.com$/,
    /(^|\.)githubusercontent\.com$/,
    /(^|\.)ghcr\.io$/,
    /(^|\.)deb\.debian\.org$/,
    /(^|\.)(archive|security)\.ubuntu\.com$/,
    /(^|\.)dl\.google\.com$/,
    /(^|\.)(proxy|sum)\.golang\.org$/,
    /(^|\.)(static\.)?crates\.io$/,
    // The runtime's own plumbing: the Garnet sensor's control-plane endpoint
    // and the GitHub-hosted runner watchdog. Part of running CI, not the PR's
    // workload.
    /(^|\.)garnet\.ai$/,
    /(^|\.)githubapp\.com$/,
    /hosted-compute-watchdog/,
]

/**
 * @param {string} value
 * @returns {string}
 */
function lc(value) {
    return value.trim().toLowerCase()
}

/**
 * @param {string} name
 * @returns {boolean}
 */
function isInfraEgress(name) {
    const normalized = lc(name)
    return INFRA_EGRESS.some(pattern => pattern.test(normalized))
}

/**
 * Pick the most human-meaningful name for a destination: prefer a DNS name
 * over a bare IP.
 *
 * @param {EgressPeer} peer
 * @returns {string}
 */
function destinationName(peer) {
    const dns = peer.remote_names.find(name => /[a-z]/i.test(name) && !/^\d+\.\d+\.\d+\.\d+$/.test(name))
    if (dns !== undefined) {
        return dns
    }

    return peer.remote_names[0] ?? peer.remote_address ?? "an unknown host"
}

/**
 * @param {EgressPeer} peer
 * @returns {string}
 */
function destinationIP(peer) {
    const ip = peer.remote_names.find(name => /^\d+\.\d+\.\d+\.\d+$/.test(name))
    return ip ?? peer.remote_address ?? ""
}

/**
 * Loopback / localhost "peers" are not real outbound egress — they're the
 * local DNS resolver and same-host traffic Jibril also records.
 *
 * @param {EgressPeer} peer
 * @returns {boolean}
 */
function isLoopbackPeer(peer) {
    const names = [...peer.remote_names, peer.remote_address ?? ""].map(lc)
    return names.some(
        name => name === "localhost" || name === "::1" || /^127\./.test(name) || /(^|\.)localhost$/.test(name),
    )
}

/**
 * Peers worth rendering: real outbound egress with a resolvable destination.
 *
 * @param {NormalizedProfile} profile
 * @returns {EgressPeer[]}
 */
function visiblePeers(profile) {
    return profile.egress_peers.filter(peer => !isLoopbackPeer(peer) && destinationName(peer) !== "an unknown host")
}

/**
 * First non-empty ancestry recorded for a peer.
 *
 * @param {EgressPeer} peer
 * @returns {string[]}
 */
function lineageOf(peer) {
    for (const procTree of peer.proc_trees) {
        if (procTree.ancestry.length > 0) {
            return procTree.ancestry
        }
    }

    return []
}

/**
 * Reviewer-friendly lineage: keep the root and the last few meaningful hops,
 * collapsing the noisy middle so a long CI ancestry stays one readable line
 * (e.g. `systemd → … → bash → node`).
 *
 * @param {string[]} lineage
 * @returns {string}
 */
function lineageDisplay(lineage) {
    if (lineage.length <= 5) {
        return lineage.join(" → ")
    }

    return [lineage[0], "…", ...lineage.slice(-3)].join(" → ")
}

/**
 * Strip GitHub's step-number prefix: "3. Install dependencies" → "Install dependencies".
 *
 * @param {string} step
 * @returns {string}
 */
function cleanStep(step) {
    return step.replace(/^\s*\d+\.\s*/, "").trim()
}

/**
 * @param {EgressPeer} peer
 * @returns {string}
 */
function peerStep(peer) {
    for (const procTree of peer.proc_trees) {
        const step = cleanStep(procTree.github_step ?? "")
        if (step !== "") {
            return step
        }
    }

    return ""
}

/**
 * Compact "who is on the other end" label from Jibril's geo enrichment, e.g.
 * "Cloudflare, Inc. · Toronto, CA". Purely descriptive. Empty when no geo is
 * present.
 *
 * @param {EgressPeer} peer
 * @returns {string}
 */
function hostedByLabel(peer) {
    const geo = peer.remote_geo_info
    if (geo === undefined) {
        return ""
    }

    const owner = (geo.org ?? "").trim()
    const place = [geo.city, geo.country_code].filter(part => part !== undefined && part !== "").join(", ")
    return [owner, place].filter(part => part !== "").join(" · ")
}

/**
 * Join a list into "a", "a and b", or "a, b, and c".
 *
 * @param {string[]} items
 * @returns {string}
 */
function humanList(items) {
    if (items.length === 0) {
        return ""
    }
    if (items.length === 1) {
        return items[0] ?? ""
    }
    if (items.length === 2) {
        return `${items[0]} and ${items[1]}`
    }

    return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`
}

/**
 * @param {NormalizedProfile} profile
 * @returns {string}
 */
function profileJobLabel(profile) {
    const workflow = profile.github.workflow
    const job = profile.github.job
    if (workflow !== "" && job !== "") {
        return `${workflow} / ${job}`
    }

    return getDisplayValue(job !== "" ? job : workflow, "unknown-job")
}

/**
 * @param {NormalizedProfile} profile
 * @returns {string}
 */
function renderJobLinks(profile) {
    const links = []
    if (profile.github.repository !== "" && profile.github.run_id !== "") {
        links.push(`[run ↗](https://github.com/${profile.github.repository}/actions/runs/${profile.github.run_id})`)
    }
    if (profile.report_link !== "") {
        links.push(`[details ↗](${escapeMarkdownLink(profile.report_link)})`)
    }

    return links.join(" · ")
}

/**
 * @typedef {{
 *   display: string
 *   step: string
 *   domains: { name: string, ip: string, hostedBy: string }[]
 * }} LineageGroup
 */

/**
 * Group peers by unique process lineage; append all destinations per lineage.
 *
 * @param {EgressPeer[]} peers
 * @returns {LineageGroup[]}
 */
function groupByLineage(peers) {
    /** @type {Map<string, LineageGroup>} */
    const groups = new Map()
    for (const peer of peers) {
        const lineage = lineageOf(peer)
        const key = lineage.join("\u241f")
        let group = groups.get(key)
        if (group === undefined) {
            group = { display: lineageDisplay(lineage), step: peerStep(peer), domains: [] }
            groups.set(key, group)
        }
        if (group.step === "") {
            group.step = peerStep(peer)
        }

        const name = destinationName(peer)
        if (!group.domains.some(domain => domain.name === name)) {
            group.domains.push({ name, ip: destinationIP(peer), hostedBy: hostedByLabel(peer) })
        }
    }

    return [...groups.values()]
}

const MAX_LINEAGES = 6
const MAX_DOMAINS = 6

/**
 * One bullet per unique lineage, destinations appended into a single sentence.
 * Caps width so a large PR stays readable; the rest lives in Garnet.
 *
 * @param {EgressPeer[]} peers
 * @returns {string[]}
 */
function renderLineageBullets(peers) {
    const groups = groupByLineage(peers)
    const lines = []
    for (const group of groups.slice(0, MAX_LINEAGES)) {
        const shownDomains = group.domains.slice(0, MAX_DOMAINS)
        // When a lineage reached a single destination, inline who is on the
        // other end (IP · owner · city) — the reviewer's first question. With
        // several destinations, keep the names clean.
        const single = shownDomains.length === 1
        const shown = shownDomains.map(domain => {
            const meta = single
                ? [domain.ip, domain.hostedBy].filter(part => part !== "" && part !== domain.name).map(escapeMarkdown)
                : []
            return meta.length > 0
                ? `\`${escapeMarkdown(domain.name)}\` (${meta.join(" · ")})`
                : `\`${escapeMarkdown(domain.name)}\``
        })
        const extra = group.domains.length > MAX_DOMAINS ? `, and ${group.domains.length - MAX_DOMAINS} more` : ""
        const step = group.step !== "" ? ` — observed during **${escapeMarkdown(group.step)}**` : ""
        const display = group.display !== "" ? group.display : "a process"
        lines.push(`- \`${escapeMarkdown(display)}\` connected to ${humanList(shown)}${extra}${step}`)
    }
    if (groups.length > MAX_LINEAGES) {
        lines.push(`- …and ${groups.length - MAX_LINEAGES} more process lineages`)
    }

    return lines
}

/**
 * Collapsed, deduped registry/build-infra block. Folds the package registries
 * and source hosts across ALL jobs into one short list so the comment shows
 * the workload egress up top and never repeats npm/GitHub noise per job.
 *
 * @param {NormalizedProfile[]} profiles
 * @returns {string[]}
 */
function renderInfraBlock(profiles) {
    /** @type {Map<string, Set<string>>} */
    const domainJobs = new Map()
    for (const profile of profiles) {
        const label = profileJobLabel(profile)
        for (const peer of visiblePeers(profile)) {
            const name = destinationName(peer)
            if (!isInfraEgress(name)) {
                continue
            }
            const jobs = domainJobs.get(name) ?? new Set()
            jobs.add(label)
            domainJobs.set(name, jobs)
        }
    }

    if (domainJobs.size === 0) {
        return []
    }

    const jobs = new Set()
    for (const set of domainJobs.values()) {
        for (const job of set) {
            jobs.add(job)
        }
    }

    const rows = [...domainJobs.entries()].sort((left, right) => right[1].size - left[1].size || left[0].localeCompare(right[0]))
    const lines = [
        `<details><summary>Package registries & build infrastructure · ${pluralize(domainJobs.size, "destination")} across ${pluralize(jobs.size, "job")}</summary>`,
        "",
    ]
    for (const [domain, set] of rows) {
        lines.push(`- \`${escapeMarkdown(domain)}\` — ${pluralize(set.size, "job")}`)
    }
    lines.push("", "</details>")

    return lines
}

/**
 * Opening line — a factual account of the snapshot (counts + where the egress
 * went), with no judgment attached.
 *
 * @param {{ jobs: number, connections: number, destinations: number, workloadDestinations: number }} counts
 * @returns {string}
 */
function renderSummaryLine(counts) {
    if (counts.connections === 0) {
        return `This PR's code made **no outbound connections** across ${pluralize(counts.jobs, "CI job")}.`
    }

    const head = `This PR's code made **${pluralize(counts.connections, "outbound connection")} to ${pluralize(counts.destinations, "destination")}** across ${pluralize(counts.jobs, "CI job")}.`
    if (counts.workloadDestinations === 0) {
        return `${head} All of it went to package registries & build infrastructure.`
    }

    return `${head} Beyond package registries & build infrastructure, its workload connected to ${pluralize(counts.workloadDestinations, "destination")}:`
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

