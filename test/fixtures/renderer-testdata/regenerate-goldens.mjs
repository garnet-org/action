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
 * @param {unknown[] | null} [previousProfiles]
 */
function reviewFor(profiles, previousProfiles = null) {
    const jobs = profiles.map(summarizeProfile).filter(job => job !== null)
    const sha = jobs[0]?.sha ?? ""
    const previousJobs = previousProfiles !== null
        ? previousProfiles.map(summarizeProfile).filter(job => job !== null)
        : null
    return buildRunReview({
        repo: REPO,
        sha,
        commitUrl: sha !== "" ? `https://github.com/${REPO}/commit/${sha}` : "",
        appUrl: APP_URL,
        jobs,
        ...(previousJobs !== null
            ? { previousSha: previousJobs[0]?.sha ?? "", previousJobs }
            : {}),
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

    const comparisonPair = JSON.parse(
        await readFile(join(here, "synthetic", "comparison-pair.json"), "utf8"),
    )
    const runnerInfrastructureOnly = JSON.parse(
        await readFile(join(here, "synthetic", "runner-infrastructure-only.json"), "utf8"),
    )
    const attributionCases = JSON.parse(
        await readFile(join(here, "synthetic", "attribution-cases.json"), "utf8"),
    )
    const deltaPartitionPair = JSON.parse(
        await readFile(join(here, "synthetic", "delta-partition-pair.json"), "utf8"),
    )
    const backgroundOnlyPair = JSON.parse(
        await readFile(join(here, "synthetic", "background-only-pair.json"), "utf8"),
    )
    const rotationPair = JSON.parse(
        await readFile(join(here, "synthetic", "rotation-pair.json"), "utf8"),
    )
    const branchMarking = JSON.parse(
        await readFile(join(here, "synthetic", "branch-marking.json"), "utf8"),
    )
    const shaiHuludWormPair = JSON.parse(
        await readFile(join(here, "synthetic", "shai-hulud-worm-pair.json"), "utf8"),
    )

    /** @type {Record<string, { files?: string[], profiles?: unknown[], previous?: unknown[] }>} */
    const states = {
        "registry-only": { files: ["normal-run.json"] },
        "workload-egress": { files: ["worth-a-look-run.json"] },
        "multi-job": {
            files: [
                "record-workload-egress.json",
                "record-docs-build.json",
                "record-install-only.json",
                "record-lint.json",
                "record-typecheck.json",
            ],
        },
        "runner-infrastructure-only": { profiles: [runnerInfrastructureOnly] },
        attribution: { profiles: attributionCases },
        "multi-job-comparison": {
            profiles: comparisonPair.head,
            previous: comparisonPair.previous,
        },
        // v6.10.0 delta partition: one workload addition headlines while
        // background churn counts only in the boundary label on its moved
        // root — every moved line stays marked.
        "delta-partition": {
            profiles: deltaPartitionPair.head,
            previous: deltaPartitionPair.previous,
        },
        // v6.10.0 background-only movement: the workload held still, so the
        // job reads 'unchanged' — never 'No changes' — with the boundary
        // label on the moved background root.
        "background-only": {
            profiles: backgroundOnlyPair.head,
            previous: backgroundOnlyPair.previous,
        },
        // Provable GitHub infrastructure rotation: the same owning process
        // moves between addresses inside one published service block, so the
        // pair joins into one annotated line instead of a −/+ pair.
        "infra-rotation": {
            profiles: rotationPair.head,
            previous: rotationPair.previous,
        },
        // Marking across a branch: every moved line stays marked wherever it
        // sits in the fence.
        "branch-marking": {
            profiles: branchMarking.head,
            previous: branchMarking.previous,
        },
        // Worm-style workload egress appearing against a quiet previous run.
        "shai-hulud-worm": {
            profiles: shaiHuludWormPair.head,
            previous: shaiHuludWormPair.previous,
        },
    }

    for (const [name, state] of Object.entries(states)) {
        const profiles = state.files !== undefined
            ? await Promise.all(state.files.map(loadProfile))
            : (state.profiles ?? [])
        const review = reviewFor(profiles, state.previous ?? null)
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
