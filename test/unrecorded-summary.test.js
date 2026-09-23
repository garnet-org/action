import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { run } from "../src/action.js"
import { appendUnrecordedSummary, renderUnrecordedSummary } from "../src/job-summary.js"

test("credentialless runs warn, write a terminal summary, and never start recording", async t => {
    const directory = await mkdtemp(join(tmpdir(), "garnet-no-auth-"))
    t.after(() => rm(directory, { recursive: true, force: true }))
    const summaryPath = join(directory, "summary.md")
    const overlay = {
        GARNET_API_TOKEN: " \t ",
        GARNET_API_URL: "https://api.garnet.ai",
        ACTIONS_ID_TOKEN_REQUEST_URL: "",
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: "",
        GITHUB_STEP_SUMMARY: summaryPath,
        GITHUB_EVENT_NAME: "push",
    }
    const saved = { ...process.env }
    Object.assign(process.env, overlay)
    t.after(() => {
        for (const name of Object.keys(overlay)) {
            if (saved[name] === undefined) delete process.env[name]
            else process.env[name] = saved[name]
        }
    })
    let output = ""
    t.mock.method(process.stdout, "write", chunk => {
        output += String(chunk)
        return true
    })
    const fetch = t.mock.method(globalThis, "fetch", async () => {
        throw new Error("credentialless runs must not register an agent")
    })

    assert.equal(await run(), false)
    assert.equal(fetch.mock.callCount(), 0)
    assert.match(output, /::warning::Garnet skipped this Runtime Review/)
    assert.doesNotMatch(output, /::error::|Jibril did not start/)
    const summary = await readFile(summaryPath, "utf8")
    assert.match(summary, /Execution Profile for this job · not recorded/)
    assert.match(summary, /no authentication mechanism was available/)
    assert.match(summary, /id-token: write/)
    assert.doesNotMatch(summary, /still being recorded|View this job/)

    process.env.GITHUB_STEP_SUMMARY = directory
    output = ""
    assert.equal(await run(), false)
    assert.match(output, /::warning::Garnet skipped this Runtime Review/)
    assert.match(output, /job summary not written/)
    assert.doesNotMatch(output, /::error::|Jibril did not start/)
})

test("unrecorded summaries do not interpret captured text as HTML or Markdown", () => {
    const summary = renderUnrecordedSummary("<script> & ![image](https://example.test) `code`")
    assert.match(summary, /&lt;script&gt; &amp;/)
    assert.ok(summary.includes("\\!\\[image\\]"))
    assert.ok(summary.includes("\\`code\\`"))
    assert.doesNotMatch(summary, /<script>/)
})

test("an unavailable summary file remains fail-open", async t => {
    const original = process.env.GITHUB_STEP_SUMMARY
    delete process.env.GITHUB_STEP_SUMMARY
    t.after(() => {
        if (original !== undefined) process.env.GITHUB_STEP_SUMMARY = original
    })
    await assert.doesNotReject(appendUnrecordedSummary("No usable profile was produced."))
})
