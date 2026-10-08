/**
 * Gates for a run with neither `api_token` nor an OIDC ID-token grant. A
 * pull request is relayed through a workflow artifact and must not be
 * skipped; every other event is skipped gracefully *and* says why, naming
 * both credentials.
 */
import test from "node:test"
import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { resolveCredentialMode } from "../src/credential-less-run.js"
import { buildGarnetCredentialLines } from "../src/action.js"

const execFileAsync = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))

const REPOSITORY = "garnet-org/runtime-review-testbed"

/**
 * Every skip reason must name the two credentials a user can act on, so the
 * annotation is actionable without reading the source.
 * @param {string} reason
 */
function assertNamesBothCredentials(reason) {
    assert.match(reason, /api_token/)
    assert.match(reason, /id-token: write/)
}

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

const NO_OIDC = { ACTIONS_ID_TOKEN_REQUEST_URL: undefined, ACTIONS_ID_TOKEN_REQUEST_TOKEN: undefined }

test("no credentials on a pull request: relays instead of skipping", async () => {
    const fork = await writeEventPayload(pullRequestPayload("outside/fork"))
    const sameRepo = await writeEventPayload(pullRequestPayload(REPOSITORY))

    await withEnv(NO_OIDC, async () => {
        const forked = await resolveCredentialMode({
            eventName: "pull_request",
            eventPath: fork,
            repository: REPOSITORY,
        })
        assert.equal(forked.mode, "relay")
        assert.match(forked.reason, /forked repository/)
        assert.match(forked.reason, /workflow artifact/)

        // The event alone decides; no fork check gates the run.
        for (const eventName of ["pull_request", "pull_request_target"]) {
            const decision = await resolveCredentialMode({ eventName, eventPath: sameRepo, repository: REPOSITORY })
            assert.equal(decision.mode, "relay")
            assert.doesNotMatch(decision.reason, /forked repository/)
            assertNamesBothCredentials(decision.reason)
        }
    })

    await rm(dirname(fork), { recursive: true, force: true })
    await rm(dirname(sameRepo), { recursive: true, force: true })
})

test("push + no credentials: skips, because no artifact of a push is ever collected", async () => {
    await withEnv(NO_OIDC, async () => {
        const decision = await resolveCredentialMode({
            eventName: "push",
            eventPath: "",
            repository: REPOSITORY,
        })
        assert.equal(decision.mode, "skip")
        assert.match(decision.reason, /job continues normally/)
        assertNamesBothCredentials(decision.reason)
    })
})

test("api_token provided: behaves exactly as today (the mode is never consulted)", async () => {
    const source = await readFile(join(here, "..", "src", "action.js"), "utf8")
    const gated = /if \(TOKEN === ""\) \{\s*\n\s*const credentialMode = await resolveCredentialMode\(/.test(source)
    assert.ok(gated, "resolveCredentialMode must only run when the api_token input resolved empty")
})

test("the skip is surfaced as a warning annotation, not an info line", async () => {
    const source = await readFile(join(here, "..", "src", "action.js"), "utf8")
    assert.match(source, /if \(credentialMode\.mode === "skip"\) \{\s*\n\s*core\.warning\(credentialMode\.reason\)/)
})

test("OIDC grant: always authenticated, never relayed", async () => {
    const eventPath = await writeEventPayload(pullRequestPayload("outside/fork"))
    await withEnv(
        {
            ACTIONS_ID_TOKEN_REQUEST_URL: "https://token.actions.example",
            ACTIONS_ID_TOKEN_REQUEST_TOKEN: "runtime-token",
        },
        async () => {
            for (const eventName of ["pull_request", "pull_request_target", "push"]) {
                const decision = await resolveCredentialMode({
                    eventName,
                    eventPath,
                    repository: REPOSITORY,
                })
                assert.equal(decision.mode, "authenticated")
            }
        },
    )
    await rm(dirname(eventPath), { recursive: true, force: true })
})

test("detection never throws: malformed payloads still relay, with the generic reason", async () => {
    await withEnv(NO_OIDC, async () => {
        const payloads = [{}, { pull_request: null }, { pull_request: { head: { repo: { full_name: "" } } } }]
        for (const payload of payloads) {
            const eventPath = await writeEventPayload(payload)
            const decision = await resolveCredentialMode({
                eventName: "pull_request",
                eventPath,
                repository: REPOSITORY,
            })
            assert.equal(decision.mode, "relay")
            assert.doesNotMatch(decision.reason, /forked repository/)
            await rm(dirname(eventPath), { recursive: true, force: true })
        }

        const missing = await resolveCredentialMode({
            eventName: "pull_request",
            eventPath: "/nonexistent/event.json",
            repository: REPOSITORY,
        })
        assert.equal(missing.mode, "relay")
    })
})

test("relay: no Garnet credential is written to disk, not even an empty one", () => {
    assert.equal(buildGarnetCredentialLines({ relayMode: true, apiToken: "tok", agentToken: "agent" }), "")
    assert.equal(
        buildGarnetCredentialLines({ relayMode: false, apiToken: "tok", agentToken: "agent" }),
        "GARNET_API_TOKEN=tok\nGARNET_AGENT_TOKEN=agent\n",
    )
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
