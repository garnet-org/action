#!/usr/bin/env node
/**
 * Regenerate the Step Summary byte-goldens under goldens/ from the renderer
 * over the captured profiles under real/ and synthetic/. Goldens are
 * generated artifacts — never hand-edit them.
 *
 *   node test/fixtures/renderer-testdata/regenerate-goldens.mjs
 */
import { readFile, writeFile, mkdir, rm } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { renderStepSummary } from "../../../src/runtime-review.js"

const here = dirname(fileURLToPath(import.meta.url))
const goldenDir = join(here, "goldens")

const APP_URL = "https://app.garnet.ai"

const realEnvelopes = JSON.parse(await readFile(join(here, "real", "profile-envelopes.json"), "utf8"))

/**
 * @param {string} dir
 * @param {string} name
 * @returns {Promise<any>}
 */
async function load(dir, name) {
    const data = JSON.parse(await readFile(join(here, dir, name), "utf8"))
    const envelope = dir === "real" ? realEnvelopes[name] : undefined
    if (envelope !== undefined && envelope !== null && typeof envelope.id === "string" && envelope.id !== "") {
        return { id: envelope.id, data }
    }
    return data
}

async function main() {
    await rm(goldenDir, { recursive: true, force: true })
    await mkdir(goldenDir, { recursive: true })

    const recordSet = await Promise.all(
        [
            "record-workload-egress.json",
            "record-docs-build.json",
            "record-install-only.json",
            "record-lint.json",
            "record-typecheck.json",
        ].map(name => load("real", name)),
    )
    /** @type {Record<string, unknown[]>} */
    const states = {
        "registry-only": [await load("real", "normal-run.json")],
        "workload-egress": [await load("real", "worth-a-look-run.json")],
        "multi-job": recordSet,
        "runner-infrastructure-only": [await load("synthetic", "runner-infrastructure-only.json")],
        attribution: await load("synthetic", "attribution-cases.json"),
        "multi-job-comparison": (await load("synthetic", "comparison-pair.json")).head,
        "delta-partition": (await load("synthetic", "delta-partition-pair.json")).head,
        "background-only": (await load("synthetic", "background-only-pair.json")).head,
        "infra-rotation": (await load("synthetic", "rotation-pair.json")).head,
        "branch-marking": (await load("synthetic", "branch-marking.json")).head,
        "shai-hulud-worm": (await load("synthetic", "shai-hulud-worm-pair.json")).head,
    }

    for (const [name, profiles] of Object.entries(states)) {
        await writeFile(join(goldenDir, `${name}.step-summary.md`), `${renderStepSummary(profiles, { appUrl: APP_URL })}\n`)
        await writeFile(
            join(goldenDir, `${name}.step-summary.preview.md`),
            `${renderStepSummary(profiles, { appUrl: APP_URL, preview: true })}\n`,
        )
        console.log(`wrote goldens/${name}.{step-summary.md,step-summary.preview.md}`)
    }
}

main().catch(err => {
    console.error(err)
    process.exitCode = 1
})
