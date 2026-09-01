import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { buildReportLink } from "../src/report-link.js"
import { profilePermalink, summarizeProfile } from "../src/runtime-review.js"

const here = dirname(fileURLToPath(import.meta.url))
const worthRaw = JSON.parse(await readFile(join(here, "fixtures", "profiles", "worth-a-look-run.json"), "utf8"))

test("report link targets the tokenless PUBLIC run route, run-level", () => {
    // report_url is emitted at action start, before any profile (and
    // therefore any profile_id) exists — it is run-level by design. The
    // profile-scoped permalink lives in the Step Summary.
    const link = buildReportLink({ repository: "x/y", run_id: "28492112239", job: "runtime-review" })
    assert.equal(link, "https://app.garnet.ai/public/runs/28492112239?utm_source=github&utm_medium=ci_log")
    assert.ok(!link.includes("/dashboard/"), "never the authed dashboard route")
})

test("profile permalink is profile-scoped when the envelope ID exists, absent when it doesn't", () => {
    // A control-plane envelope carries the profile ID: the permalink is the
    // exact public profile selector.
    const enveloped = summarizeProfile({ id: "019f1b61-9f3c-7ac8-a8ed-0c07bf1546af", data: worthRaw })
    assert.ok(enveloped !== null)
    const link = profilePermalink(enveloped, "https://app.garnet.ai", "ci_log")
    assert.equal(
        link,
        `https://app.garnet.ai/public/runs/${enveloped.run_id}?profile=019f1b61-9f3c-7ac8-a8ed-0c07bf1546af&utm_source=github&utm_medium=ci_log`,
    )

    // The action's local Jibril profile has no envelope ID: the link fails
    // closed (no run-index fallback, never a guessed selector).
    const local = summarizeProfile(worthRaw)
    assert.ok(local !== null)
    assert.equal(local.profile_id, "")
    assert.equal(profilePermalink(local, "https://app.garnet.ai", "ci_log"), "")
})
