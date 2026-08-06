#!/usr/bin/env node
/**
 * Regenerate the byte-goldens under goldens/ from the vendored renderer
 * over the real captured profiles under real/. Goldens are generated
 * artifacts — never hand-edit them.
 *
 *   node test/fixtures/renderer-testdata/regenerate-goldens.mjs
 */
import { readFile, writeFile, mkdir, rm } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import {
    buildRunReview,
    renderRunReview,
    renderPendingReview,
    renderStepSummary,
    summarizeProfile,
    exportReviewModel,
} from "../../../src/runtime-review.js"

const here = dirname(fileURLToPath(import.meta.url))
const goldenDir = join(here, "goldens")

const REPO = "garnet-org/runtime-review-testbed"
const APP_URL = "https://app.garnet.ai"

const realEnvelopes = JSON.parse(await readFile(join(here, "real", "profile-envelopes.json"), "utf8"))

/**
 * @param {string} name
 * @returns {Promise<unknown>}
 */
async function loadProfile(name) {
    const data = JSON.parse(await readFile(join(here, "real", name), "utf8"))
    const envelope = realEnvelopes[name]
    if (envelope !== undefined && envelope !== null && typeof envelope.id === "string" && envelope.id !== "") {
        return { id: envelope.id, data }
    }
    return data
}

/**
 * @param {unknown[]} profiles
 */
function reviewFor(profiles) {
    const jobs = profiles.map(summarizeProfile).filter(job => job !== null)
    const sha = jobs[0]?.sha ?? ""
    return buildRunReview({
        repo: REPO,
        sha,
        commitUrl: sha !== "" ? `https://github.com/${REPO}/commit/${sha}` : "",
        appUrl: APP_URL,
        jobs,
    })
}

async function main() {
    await rm(goldenDir, { recursive: true, force: true })
    await mkdir(goldenDir, { recursive: true })

    await writeFile(
        join(goldenDir, "no-record.pr-comment.md"),
        `${renderPendingReview({
            sha: "ef01a52517e7532ab34aadea58b952c9f1e79ece",
            commitUrl: `https://github.com/${REPO}/commit/ef01a52517e7532ab34aadea58b952c9f1e79ece`,
        })}\n`,
    )
    console.log("wrote goldens/no-record.pr-comment.md")

    /** @type {Record<string, string[]>} */
    const states = {
        "registry-only": ["normal-run.json"],
        "workload-egress": ["worth-a-look-run.json"],
        "multi-job": [
            "record-workload-egress.json",
            "record-docs-build.json",
            "record-install-only.json",
            "record-lint.json",
            "record-typecheck.json",
        ],
    }

    for (const [name, files] of Object.entries(states)) {
        const profiles = await Promise.all(files.map(loadProfile))
        const review = reviewFor(profiles)
        await writeFile(join(goldenDir, `${name}.pr-comment.md`), `${renderRunReview(review)}\n`)
        await writeFile(
            join(goldenDir, `${name}.review-model.json`),
            `${JSON.stringify(exportReviewModel(review), null, 2)}\n`,
        )
        await writeFile(join(goldenDir, `${name}.step-summary.md`), `${renderStepSummary(profiles, { appUrl: APP_URL })}\n`)
        await writeFile(
            join(goldenDir, `${name}.step-summary.preview.md`),
            `${renderStepSummary(profiles, { appUrl: APP_URL, preview: true })}\n`,
        )
        console.log(`wrote goldens/${name}.{pr-comment.md,review-model.json,step-summary.md,step-summary.preview.md}`)
    }
}

main().catch(err => {
    console.error(err)
    process.exitCode = 1
})
