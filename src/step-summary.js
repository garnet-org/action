// Renders the per-job Garnet Runtime Report for the GitHub Step Summary.
// This is the tabular report layout (workload, egress table, telemetry
// counts, assertions) rendered from the normalized JSON profile. It is
// observation-only: no verdict headline and no pass/fail status column.

/** @typedef {import("./profile-comment.js").NormalizedProfile} NormalizedProfile */
/** @typedef {import("./profile-comment.js").ProcTree} ProcTree */

/**
 * Render one job's Run Profile as the Step Summary report.
 * @param {NormalizedProfile} profile
 * @returns {string}
 */
export function renderProfileStepSummary(profile) {
    const sections = [
        "### Garnet Runtime Report",
        "",
        renderWorkloadSection(profile),
        "",
        renderNetworkSection(profile),
        "",
        renderAssertionSection(profile),
        "",
        renderFooter(profile),
    ]

    return sections.join("\n")
}

/**
 * @param {NormalizedProfile} profile
 * @returns {string}
 */
function renderWorkloadSection(profile) {
    const github = profile.github
    if (
        github.workflow === "" &&
        github.repository === "" &&
        github.ref === "" &&
        github.sha === "" &&
        github.actor === "" &&
        github.run_id === "" &&
        github.job === ""
    ) {
        return ["#### Workload Summary", "", "No workload information available."].join("\n")
    }

    const table = renderKeyValueTable([
        ["Workflow", github.workflow],
        ["Repository", github.repository],
        ["Branch", github.ref],
        ["Commit", github.sha],
        ["Triggered by", github.actor],
        ["Run ID / Job", formatRunJob(github.run_id, github.job)],
    ])

    return ["#### Workload Summary", "", table].join("\n")
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

    /** @type {string[][]} */
    const rows = []
    /** @type {Set<string>} */
    const seen = new Set()
    let skippedRemoteNames = 0
    let totalRemoteNames = 0

    for (const peer of profile.egress_peers) {
        for (const remoteName of peer.remote_names) {
            totalRemoteNames += 1
            if (seen.has(remoteName)) {
                skippedRemoteNames += 1
                continue
            }
            seen.add(remoteName)

            rows.push([`\`${escapeMarkdown(remoteName)}\``, renderProcessTrees(peer.proc_trees)])
        }
    }

    const egressTable =
        rows.length > 0 ? renderTable(["Destination", "Process Tree"], rows) : "No egress peers information available."

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
        `\`${escapeMarkdown(assertion.id)}\``,
        escapeMarkdown(assertion.result),
    ])

    return ["#### Assertions", "", renderTable(["Assertion", "Result"], rows)].join("\n")
}

/**
 * @param {NormalizedProfile} profile
 * @returns {string}
 */
function renderFooter(profile) {
    /** @type {string[]} */
    const footerParts = []
    footerParts.push(
        `${profile.telemetry.total_domains} unique domains · ${profile.telemetry.total_connections} connections`,
    )
    if (profile.github.run_id !== "" || profile.github.job !== "") {
        footerParts.push(
            `Workflow ${escapeHtml(getDisplayValue(profile.github.workflow, "-"))} - Run #${escapeHtml(getDisplayValue(profile.github.run_id, "-"))} - Job ${escapeHtml(getDisplayValue(profile.github.job, "-"))}`,
        )
    }
    if (profile.timestamp !== "") {
        footerParts.push(`timestamp ${escapeHtml(profile.timestamp)}`)
    }

    const header = footerParts.join("  -  ")
    const viewLink =
        profile.report_link !== "" ? ` · <a href="${escapeHtml(profile.report_link)}">View full report ↗</a>` : ""

    return `<div align="right"><sub>${header}</sub><br><b>Powered by Garnet</b>${viewLink}</div>`
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
 * @param {string} runId
 * @param {string} job
 * @returns {string}
 */
function formatRunJob(runId, job) {
    /** @type {string[]} */
    const parts = []
    if (runId !== "") {
        parts.push(runId)
    }
    if (job !== "") {
        parts.push(job)
    }

    return parts.length > 0 ? parts.join(" / ") : "-"
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
 * @param {string} value
 * @param {string} fallback
 * @returns {string}
 */
function getDisplayValue(value, fallback) {
    return value !== "" ? value : fallback
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
function escapeHtml(value) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
}
