import { z } from "zod"

export const COMMENT_MARKER = "garnet-runtime-visibility"

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

const PROFILE_RESULT_SCHEMA = z
  .unknown()
  .transform((value) => normalizeResult(value))

const PROC_TREE_SCHEMA = z
  .looseObject({
    ancestry: z.array(z.string()),
  })
  .transform((procTree) => ({
    ancestry: procTree.ancestry.filter((entry) => entry.length > 0),
  }))

const ASSERTION_SCHEMA = z.looseObject({
  id: z.string(),
  result: PROFILE_RESULT_SCHEMA,
})

const PEER_SCHEMA = z
  .looseObject({
    result: PROFILE_RESULT_SCHEMA,
    remote_names: z.array(z.string()),
    proc_trees: z.array(PROC_TREE_SCHEMA),
  })
  .transform((peer) => ({
    remote_names: peer.remote_names.filter((name) => name.length > 0),
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
  .transform((profile) => ({
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

  const issues = result.error.issues.map((issue) => {
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
          ...existingState.profiles.filter(
            (profile) => getWorkflowKey(profile) !== workflowKey,
          ),
          incomingProfile,
        ].sort(compareProfiles),
      },
    }
  }

  const profiles = existingState.profiles.filter(
    (profile) => getProfileKey(profile) !== getProfileKey(incomingProfile),
  )
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
    for (const [workflowKey, workflowRun] of Object.entries(
      state.workflow_runs,
    )) {
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
      if (
        workflowRun === null ||
        latestRun === null ||
        compareRuns(workflowRun, latestRun) !== 0
      ) {
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
  const headline = renderHeadline(profiles)
  const summaryTable = renderSummaryTable(profiles)
  const sections = profiles
    .map((profile) => renderProfileSection(profile))
    .join("\n\n")

  return [
    `<!-- ${COMMENT_MARKER}:${metadata} -->`,
    "## Garnet Runtime Report",
    "",
    headline,
    "",
    summaryTable,
    "",
    sections,
  ].join("\n")
}

/**
 * @param {string} body
 * @returns {CommentState | null}
 */
export function parseCommentState(body) {
  const marker = `<!-- ${COMMENT_MARKER}:`
  const start = body.indexOf(marker)
  if (start === -1) {
    return null
  }

  const end = body.indexOf("-->", start)
  if (end === -1) {
    return null
  }

  const encoded = body.slice(start + marker.length, end).trim()
  try {
    const json = Buffer.from(encoded, "base64url").toString("utf8")
    const parsed = JSON.parse(json)
    const result = COMMENT_STATE_SCHEMA.safeParse(parsed)
    if (result.success) {
      return result.data
    }

    const legacyResult = LEGACY_COMMENT_STATE_SCHEMA.safeParse(parsed)
    return legacyResult.success
      ? upgradeLegacyCommentState(legacyResult.data)
      : null
  } catch {
    return null
  }
}

/**
 * @param {NormalizedProfile[]} profiles
 * @returns {string}
 */
function renderHeadline(profiles) {
  const failedJobs = profiles.filter(
    (profile) => getAssertionState(profile) === "failed",
  ).length
  const passedJobs = profiles.length - failedJobs
  const workflowCount = new Set(
    profiles.map((profile) => getWorkflowKey(profile)),
  ).size

  if (failedJobs > 0) {
    return `🔴 ${failedJobs} job${failedJobs === 1 ? "" : "s"} failed assertions · ${passedJobs} passed across ${workflowCount} workflow${workflowCount === 1 ? "" : "s"}`
  }

  return `✅ ${passedJobs} job${passedJobs === 1 ? "" : "s"} passed assertions across ${workflowCount} workflow${workflowCount === 1 ? "" : "s"}`
}

/**
 * @param {NormalizedProfile[]} profiles
 * @returns {string}
 */
function renderSummaryTable(profiles) {
  const rows = profiles.map((profile) => {
    const workflowLabel = escapeMarkdown(
      getDisplayValue(profile.github.workflow, "unknown"),
    )
    const runLabel =
      profile.github.run_id !== ""
        ? formatRunMarkdownLink(
            profile.github.repository,
            profile.github.run_id,
            `#${profile.github.run_id}`,
          )
        : "-"
    const jobLabel = escapeMarkdown(
      getDisplayValue(profile.github.job, "unknown"),
    )
    const assertionLabel = escapeMarkdown(getAssertionBadge(profile))
    const linkLabel =
      profile.report_link !== ""
        ? `[View ↗](${escapeMarkdownLink(profile.report_link)})`
        : "-"

    return `| ${workflowLabel} | ${runLabel} | ${jobLabel} | ${assertionLabel} | ${linkLabel} |`
  })

  return [
    "| Workflow | Run | Job | Assertions | Profile |",
    "| --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n")
}

/**
 * @param {NormalizedProfile} profile
 * @returns {string}
 */
function renderProfileSection(profile) {
  const title = escapeHtml(
    formatWorkflowJob(profile.github.workflow, profile.github.job),
  )
  const assertionBadge = escapeHtml(getAssertionBadge(profile))
  const workloadTable = renderKeyValueTable([
    ["Workflow", profile.github.workflow],
    ["Repository", profile.github.repository],
    ["Branch", profile.github.ref],
    ["Commit", profile.github.sha],
    ["Triggered by", profile.github.actor],
    [
      "Run ID / Job",
      formatRunJob(
        profile.github.repository,
        profile.github.run_id,
        profile.github.job,
      ),
    ],
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
    return ["#### Assertions", "", "No assertions information available."].join(
      "\n",
    )
  }

  const rows = profile.assertions.map((assertion) => [
    escapeMarkdown(assertion.id),
    escapeMarkdown(getResultIconText(assertion.result)),
  ])

  return ["#### Assertions", "", renderTable(["Check", "Result"], rows)].join(
    "\n",
  )
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
    .map((procTree) => {
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
    .filter((value) => value.length > 0)

  return rendered.length > 0 ? rendered.join("<br>") : "-"
}

/**
 * @param {string[]} headers
 * @param {string[][]} rows
 * @returns {string}
 */
function renderTable(headers, rows) {
  const headerRow = `| ${headers.map((header) => escapeMarkdown(header)).join(" | ")} |`
  const separatorRow = `| ${headers.map(() => "---").join(" | ")} |`
  const bodyRows = rows.map((row) => `| ${row.join(" | ")} |`)
  return [headerRow, separatorRow, ...bodyRows].join("\n")
}

/**
 * @param {[string, string][]} rows
 * @returns {string}
 */
function renderKeyValueTable(rows) {
  return renderTable(
    ["Field", "Value"],
    rows.map(([key, value]) => [
      escapeMarkdown(key),
      escapeMarkdown(getDisplayValue(value, "-")),
    ]),
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
 * @param {{ repository: string, run_id: string, job: string }} values
 * @returns {string}
 */
function buildReportLink(values) {
  const baseURL = resolveAppBaseUrl()
  if (values.run_id === "") {
    return baseURL
  }

  // TODO: Switch back to the full repository/job route once the dashboard
  // supports /dashboard/runs/{org}/{repo}/{runID}/{job}.
  return `${baseURL}/dashboard/runs/${encodeURIComponent(values.run_id)}`
}

/**
 * @param {string} repository
 * @param {string} runId
 * @returns {string}
 */
function buildGitHubRunLink(repository, runId) {
  const repositoryPath = repository
    .split("/")
    .filter((part) => part !== "")
    .map((part) => encodeURIComponent(part))
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
  if (
    typeof process.env.GARNET_API_URL === "string" &&
    process.env.GARNET_API_URL !== ""
  ) {
    return process.env.GARNET_API_URL
  }

  if (
    typeof process.env.INPUT_API_URL === "string" &&
    process.env.INPUT_API_URL !== ""
  ) {
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
  return profile.assertions.some((assertion) => assertion.result === "fail")
    ? "failed"
    : "passed"
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
  const workflowCompare = getWorkflowKey(left).localeCompare(
    getWorkflowKey(right),
  )
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
  if (
    normalized === "pass" ||
    normalized === "attention" ||
    normalized === "fail"
  ) {
    return normalized
  }
  return "unknown"
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown> | null}
 */
function getOptionalRecord(value) {
  return isRecord(value) ? value : null
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
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll("`", "\\`")
    .replaceAll("\n", " ")
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
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtmlAttribute(value) {
  return escapeHtml(value)
}
