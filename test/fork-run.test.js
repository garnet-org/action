/**
 * Gates for the credential-less fork pull request no-op: a `pull_request`
 * run from a fork with no api_token and no OIDC grant skips profiling
 * gracefully; every other credential shape keeps today's behavior, and the
 * post step no-ops cleanly when the main step never started jibril.
 */
import test from "node:test"
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { resolveForkSkip } from "../src/fork-run.js"
import { run } from "../src/action.js"

const execFileAsync = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))

const REPOSITORY = "garnet-org/runtime-review-testbed"

/**
 * @param {Record<string, unknown>} payload
 * @returns {Promise<string>}
 */
async function writeEventPayload(payload) {
    const dir = await mkdtemp(join(tmpdir(), "garnet-fork-test-"))
    const eventPath = join(dir, "event.json")
    await writeFile(eventPath, JSON.stringify(payload))
    return eventPath
}

/**
 * @param {string} headRepoFullName
 * @returns {Record<string, unknown>}
 */
function pullRequestPayload(headRepoFullName) {
    return {
        pull_request: {
            number: 7,
            head: {
                sha: "a".repeat(40),
                repo: { full_name: headRepoFullName },
            },
        },
    }
}

/**
 * Runs a function with a controlled process.env overlay, restoring the
 * original values afterwards.
 * @param {Record<string, string | undefined>} overlay
 * @param {() => Promise<void>} fn
 * @returns {Promise<void>}
 */
async function withEnv(overlay, fn) {
    const saved = {}
    for (const [name, value] of Object.entries(overlay)) {
        saved[name] = process.env[name]
        if (value === undefined) {
            delete process.env[name]
        } else {
            process.env[name] = value
        }
    }
    try {
        await fn()
    } finally {
        for (const [name, value] of Object.entries(saved)) {
            if (value === undefined) {
                delete process.env[name]
            } else {
                process.env[name] = value
            }
        }
    }
}

test("fork + no credentials: pull_request run from a fork skips gracefully", async () => {
    const eventPath = await writeEventPayload(pullRequestPayload("outside/fork"))
    await withEnv(
        { GARNET_ACTION_ENABLE_OIDC_AUTH: undefined, ACTIONS_ID_TOKEN_REQUEST_URL: undefined },
        async () => {
            const decision = await resolveForkSkip({
                eventName: "pull_request",
                eventPath,
                repository: REPOSITORY,
            })
            assert.equal(decision.skip, true)
            assert.match(decision.reason, /forked repositories/)
            assert.match(decision.reason, /job continues normally/)
        },
    )
    await rm(dirname(eventPath), { recursive: true, force: true })
})

test("fork + api_token provided: behaves exactly as today (skip is never consulted)", async () => {
    const source = await readFile(join(here, "..", "src", "action.js"), "utf8")
    const gated = /if \(TOKEN === ""\) \{\s*\n\s*const forkSkip = await resolveForkSkip\(/.test(source)
    assert.ok(gated, "resolveForkSkip must only run when the api_token input resolved empty")
})

test("same-repo + no token: no skip, existing hard error path stays", async () => {
    const eventPath = await writeEventPayload(pullRequestPayload(REPOSITORY))
    const decision = await resolveForkSkip({
        eventName: "pull_request",
        eventPath,
        repository: REPOSITORY,
    })
    assert.equal(decision.skip, false)
    await rm(dirname(eventPath), { recursive: true, force: true })
})

test("pull_request_target: never skips (secrets are available)", async () => {
    const eventPath = await writeEventPayload(pullRequestPayload("outside/fork"))
    const decision = await resolveForkSkip({
        eventName: "pull_request_target",
        eventPath,
        repository: REPOSITORY,
    })
    assert.equal(decision.skip, false)
    await rm(dirname(eventPath), { recursive: true, force: true })
})

test("fork + OIDC grant with flag on: no skip (credential path exists)", async () => {
    const eventPath = await writeEventPayload(pullRequestPayload("outside/fork"))
    await withEnv(
        {
            GARNET_ACTION_ENABLE_OIDC_AUTH: "true",
            ACTIONS_ID_TOKEN_REQUEST_URL: "https://token.actions.example",
            ACTIONS_ID_TOKEN_REQUEST_TOKEN: "runtime-token",
        },
        async () => {
            const decision = await resolveForkSkip({
                eventName: "pull_request",
                eventPath,
                repository: REPOSITORY,
            })
            assert.equal(decision.skip, false)
        },
    )
    await rm(dirname(eventPath), { recursive: true, force: true })
})

test("detection never throws: malformed payloads fall back to current behavior", async () => {
    for (const payload of [{}, { pull_request: null }, { pull_request: { head: {} } }, { pull_request: { head: { repo: { full_name: "" } } } }]) {
        const eventPath = await writeEventPayload(payload)
        const decision = await resolveForkSkip({
            eventName: "pull_request",
            eventPath,
            repository: REPOSITORY,
        })
        assert.equal(decision.skip, false)
        await rm(dirname(eventPath), { recursive: true, force: true })
    }
    const missing = await resolveForkSkip({
        eventName: "pull_request",
        eventPath: "/nonexistent/event.json",
        repository: REPOSITORY,
    })
    assert.equal(missing.skip, false)
    const unreadable = await resolveForkSkip({
        eventName: "pull_request",
        eventPath: "",
        repository: "",
    })
    assert.equal(unreadable.skip, false)
})

test("run(): fork + no credentials exits success without starting jibril", async () => {
    const eventPath = await writeEventPayload(pullRequestPayload("outside/fork"))
    await withEnv(
        {
            GARNET_API_TOKEN: "",
            GITHUB_EVENT_NAME: "pull_request",
            GITHUB_EVENT_PATH: eventPath,
            GITHUB_REPOSITORY: REPOSITORY,
            GARNET_ACTION_ENABLE_OIDC_AUTH: undefined,
            ACTIONS_ID_TOKEN_REQUEST_URL: undefined,
        },
        async () => {
            const started = await run()
            assert.equal(started, false)
        },
    )
    await rm(dirname(eventPath), { recursive: true, force: true })
})

test("post step: no-ops cleanly when jibril never started", async function (t) {
    if (process.platform !== "linux") {
        t.skip("Linux-only behavior: post step exits early on non-Linux platforms")
        return
    }

    const stateDir = await mkdtemp(join(tmpdir(), "garnet-post-test-"))
    const stateFile = join(stateDir, "state")
    await writeFile(stateFile, "")
    const { stdout } = await execFileAsync(process.execPath, [join(here, "..", "src", "post.js")], {
        env: {
            PATH: process.env.PATH,
            HOME: process.env.HOME,
            GITHUB_STATE: stateFile,
        },
    })
    assert.match(stdout, /Jibril did not start in the main step/)
    assert.ok(!stdout.includes("::error"), "post step must not emit errors on no-op")
    await rm(stateDir, { recursive: true, force: true })
})
