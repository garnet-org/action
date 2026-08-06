#!/usr/bin/env node
/**
 * Render BOTH surfaces side by side from REAL per-run profiles captured by
 * Jibril on live CI runs — the PR-comment projection followed by the Step
 * Summary projection, both produced by the same vendored renderer module.
 *
 *   node test/render-combined-real.mjs
 *
 * Each output file under test/fixtures/mockups/combined/ shows, for one
 * record set:
 *   1. the PR-comment projection, then
 *   2. the Step Summary projection.
 *
 * Mockups are generated artifacts — never hand-edit them.
 */
import { writeFile, mkdir, rm } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { renderStepSummary } from "../src/runtime-review.js"
import { loadProfile, renderFromProfiles } from "./render-states-real.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, "fixtures", "mockups", "combined")
const APP_URL = "https://app.garnet.ai"

/**
 * @param {unknown[]} profiles
 * @param {{ preview?: boolean }} [options]
 */
export function renderCombined(profiles, { preview = false } = {}) {
    const comment = renderFromProfiles(profiles).body
    const summary = renderStepSummary(profiles, { appUrl: APP_URL, preview })
    return [
        "<!-- 1. PR comment — reference-renderer projection -->",
        "",
        comment,
        "",
        "---",
        "",
        "<!-- 2. Step Summary — written to GITHUB_STEP_SUMMARY -->",
        "",
        summary,
        "",
    ].join("\n")
}

async function main() {
    await rm(outDir, { recursive: true, force: true })
    await mkdir(outDir, { recursive: true })
    const normal = await loadProfile("normal-run.json")
    const worth = await loadProfile("worth-a-look-run.json")
    const record = await Promise.all(
        [
            "record-workload-egress.json",
            "record-docs-build.json",
            "record-install-only.json",
            "record-lint.json",
            "record-typecheck.json",
        ].map(loadProfile),
    )

    const states = {
        "1-registry-only.md": renderCombined([normal]),
        "1-registry-only.preview.md": renderCombined([normal], { preview: true }),
        "2-workload-egress.md": renderCombined([worth]),
        "2-workload-egress.preview.md": renderCombined([worth], { preview: true }),
        "3-multi-job.md": renderCombined(record),
        "3-multi-job.preview.md": renderCombined(record, { preview: true }),
    }

    for (const [file, body] of Object.entries(states)) {
        await writeFile(join(outDir, file), body)
        console.log(`wrote test/fixtures/mockups/combined/${file}`)
    }
}

const isDirectRun = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]
if (isDirectRun) {
    main().catch(err => {
        console.error(err)
        process.exitCode = 1
    })
}
