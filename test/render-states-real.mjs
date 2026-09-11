#!/usr/bin/env node
/**
 * Regenerate the checked-in comment-state mockups under
 * test/fixtures/mockups/ from REAL per-run profiles captured by Jibril on
 * live CI runs of the testbed repo, through the exact vendored renderer
 * code path. Mockups are generated artifacts — never hand-edit them.
 *
 *   node test/render-states-real.mjs
 */
import { readFile, writeFile, mkdir, rm } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import {
    CONTRACT_VOCAB,
    buildRunReview,
    renderRunReview,
    renderPendingReview,
    summarizeProfile,
} from "../src/runtime-review.js"

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, "fixtures", "renderer-testdata", "real")
const outDir = join(here, "fixtures", "mockups")

const REPO = "garnet-org/runtime-review-testbed"
const APP_URL = "https://app.garnet.ai"
const profileEnvelopes = JSON.parse(await readFile(join(dataDir, "profile-envelopes.json"), "utf8"))

/** @param {string} name */
export async function loadProfile(name) {
    const data = JSON.parse(await readFile(join(dataDir, name), "utf8"))
    const envelope = profileEnvelopes[name]
    return envelope?.id ? { id: envelope.id, data } : data
}

/**
 * Render one or more real profiles through the exact CI code path.
 * @param {unknown[]} profiles
 */
export function renderFromProfiles(profiles) {
    const jobs = profiles.map(summarizeProfile).filter(job => job !== null)
    const sha = jobs[0]?.sha ?? ""
    const review = buildRunReview({
        repo: REPO,
        sha,
        commitUrl: sha !== "" ? `https://github.com/${REPO}/commit/${sha}` : "",
        appUrl: APP_URL,
        jobs,
    })
    return { review, body: renderRunReview(review) }
}

/**
 * The waiting/pending body (mirrors the post step's no-profile path).
 * @param {string} sha
 */
export function renderNoRecord(sha) {
    return renderPendingReview({
        sha,
        commitUrl: `https://github.com/${REPO}/commit/${sha}`,
    })
}


async function main() {
    await rm(outDir, { recursive: true, force: true })
    await mkdir(outDir, { recursive: true })
    const normal = await loadProfile("normal-run.json")
    const worth = await loadProfile("worth-a-look-run.json")
    const normalV215 = await loadProfile("normal-v215.json")
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
        "1-no-record.md": renderNoRecord("ef01a52517e7532ab34aadea58b952c9f1e79ece"),
        "2-registry-only.md": renderFromProfiles([normal]).body,
        "3-workload-egress.md": renderFromProfiles([worth]).body,
        "4-multi-job.md": renderFromProfiles(record).body,
        "5-raw-profile-no-selector.md": renderFromProfiles([normalV215]).body,
    }

    for (const [file, body] of Object.entries(states)) {
        await writeFile(join(outDir, file), `${body}\n`)
        console.log(`wrote test/fixtures/mockups/${file}`)
    }
}

const isDirectRun = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]
if (isDirectRun) {
    main().catch(err => {
        console.error(err)
        process.exitCode = 1
    })
}
