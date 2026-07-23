#!/usr/bin/env node
/**
 * Regenerate the checked-in golden fixtures from the vendored renderer:
 *
 *   node test/fixtures/regenerate.mjs
 *
 * Mirrors `cmd/garnet-runtime-review/render-states-real.mjs` (PR-comment
 * states) and `render-combined-real.mjs` (Step Summary reports) in
 * garnet-org/runtime-review-testbed at tag v6.2.0, with the action's one
 * deliberate delta: fold-subtext permalinks are RUN-LEVEL (no `?job=`
 * selector — ENG-1355). Inputs are the real captured Jibril profiles under
 * `profiles/` (vendored from the testbed at the same tag); render clocks are
 * pinned so the goldens stay byte-identical.
 */
import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import {
    buildRunReview,
    renderRunReview,
    renderStepSummary,
    renderNoRecord,
    summarizeProfile,
    COMMENT_MARKER,
    RUNTIME_REVIEW_MARKER,
} from "../../src/runtime-review.js"

const here = dirname(fileURLToPath(import.meta.url))

export const REPO = "garnet-org/runtime-review-testbed"

/** Pinned render clocks so goldens stay byte-identical (§1.2 freshness stamp). */
export const RENDERED_AT = "2026-07-03T14:02:00Z"
/** State 5 renders the SAME jobs at a later clock — the update-in-place story. */
export const RENDERED_AT_LATER = "2026-07-03T16:41:00Z"
/** State 4 renders the five real record jobs at their run's own clock. */
export const RENDERED_AT_RECORD = "2026-07-08T05:36:00Z"

/** Example explicit permalink (§1.1): the tokenless public Run Profile page. */
export const CAPABILITY_LINK = "https://app.garnet.ai/p/runtime-review-testbed"

export const APP_URL = "https://app.garnet.ai"
export const DOCS_URL = "https://github.com/garnet-org/action#readme"

/** @param {string} name */
export async function loadProfile(name) {
    return JSON.parse(await readFile(join(here, "profiles", name), "utf8"))
}

/**
 * Render one or more real profiles through the exact CI code path.
 * @param {unknown[]} profiles
 * @param {{ permalink?: string, expectedJobs?: number, firstRun?: boolean, renderedAt?: string }} [opts]
 */
export function renderFromProfiles(profiles, opts = {}) {
    const jobs = profiles.map(summarizeProfile).filter(job => job !== null)
    const sha = jobs[0]?.sha ?? ""
    const review = buildRunReview({
        repo: REPO,
        sha,
        commitUrl: sha !== "" ? `https://github.com/${REPO}/commit/${sha}` : "",
        permalink: opts.permalink ?? "",
        appUrl: APP_URL,
        docsUrl: DOCS_URL,
        expectedJobs: opts.expectedJobs ?? 0,
        firstRun: opts.firstRun ?? false,
        renderedAt: opts.renderedAt ?? RENDERED_AT,
        jobs,
    })
    return { review, body: renderRunReview(review) }
}

/**
 * The waiting-state body with the PR-comment markers prepended (§2).
 * @param {string} sha
 */
export function renderNoRecordState(sha) {
    return [
        RUNTIME_REVIEW_MARKER,
        COMMENT_MARKER,
        `<!-- garnet:commit ${sha} -->`,
        renderNoRecord({
            sha,
            commitUrl: `https://github.com/${REPO}/commit/${sha}`,
            expectedJobs: 1,
            docsUrl: DOCS_URL,
            renderedAt: RENDERED_AT,
            firstRun: true,
        }),
    ].join("\n")
}

/** @returns {Promise<Record<string, string>>} */
export async function renderCommentStates() {
    const normal = await loadProfile("normal-run.json")
    const worth = await loadProfile("worth-a-look-run.json")
    const record = await Promise.all(
        ["workload-egress", "docs-build", "install-only", "lint", "typecheck"].map(j => loadProfile(`record-${j}.json`)),
    )

    return {
        "1-no-record.md": renderNoRecordState(worth.scenarios?.github?.sha ?? "ef01a52"),
        "2-registry-only.md": renderFromProfiles([normal], { permalink: CAPABILITY_LINK }).body,
        "3-workload-egress.md": renderFromProfiles([worth], { permalink: CAPABILITY_LINK }).body,
        // The representative matrix: the five REAL recorded jobs of the
        // testbed's own workflow — one notable open fold, github-infra-only
        // collapsed folds, registry-only collapsed folds.
        "4-multi-job.md": renderFromProfiles(record, {
            permalink: CAPABILITY_LINK,
            expectedJobs: 5,
            renderedAt: RENDERED_AT_RECORD,
        }).body,
        // A new commit simply re-renders the snapshot in place, with a LATER
        // freshness stamp than state 2.
        "5-updated-commit.md": renderFromProfiles([normal], {
            permalink: CAPABILITY_LINK,
            renderedAt: RENDERED_AT_LATER,
        }).body,
        // S5 — partial coverage: k of n with the growth CTA in the footer.
        "6-partial-coverage.md": renderFromProfiles([worth], { permalink: CAPABILITY_LINK, expectedJobs: 6 }).body,
    }
}

/** @returns {Promise<Record<string, string>>} */
export async function renderStepSummaryStates() {
    const normal = await loadProfile("normal-run.json")
    const install = await loadProfile("npm-install-run.json")
    const worth = await loadProfile("worth-a-look-run.json")

    // §8 preview gating: 2-install renders preview mode (assertions +
    // evidence); the others render the prod default (observation-only).
    return {
        "1-registry-only.md": renderStepSummary([normal]),
        "2-install-with-assertions.md": renderStepSummary([install], { preview: true }),
        "3-workload-egress.md": renderStepSummary([worth]),
        "4-multi-job.md": renderStepSummary([install, worth]),
    }
}

async function main() {
    const states = await renderCommentStates()
    for (const [file, body] of Object.entries(states)) {
        await writeFile(join(here, "mockups", file), `${body}\n`)
    }
    const summaries = await renderStepSummaryStates()
    for (const [file, body] of Object.entries(summaries)) {
        await writeFile(join(here, "step-summary", file), `${body}\n`)
    }
    console.log(
        `Wrote ${Object.keys(states).length} comment states to test/fixtures/mockups/ and ${Object.keys(summaries).length} reports to test/fixtures/step-summary/`,
    )
}

const isDirectRun = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]
if (isDirectRun) {
    main().catch(err => {
        console.error(err)
        process.exitCode = 1
    })
}
