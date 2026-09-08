/**
 * Containment gates for the main-step credential and sensor-version
 * resolution: a supplied api_token is used as-is without an OIDC attempt or
 * a missing-permission warning; when no token is supplied and the OIDC
 * endpoint is unavailable (missing token URL), auth fails clearly with no
 * network fetch reached; and the Jibril sensor version never floats — every
 * action ref resolves to an explicit pinned version.
 */
import test from "node:test"
import assert from "node:assert/strict"
import { resolveControlPlaneAuth, resolveJibrilVersion } from "../src/action.js"

const API_TOKEN_AUTH = {
    projectToken: "project-token-1",
    workflowToken: "",
    workflowTokenExpiresAt: "",
}

/**
 * Captures everything written to stdout while `fn` runs. @actions/core emits
 * its workflow commands (`::warning::`, `::error::`) there.
 * @param {() => Promise<void>} fn
 * @returns {Promise<string>}
 */
async function captureStdout(fn) {
    const originalWrite = process.stdout.write
    let captured = ""
    // @ts-expect-error - narrow test shim over the overloaded write signature
    process.stdout.write = chunk => {
        captured += String(chunk)
        return true
    }
    try {
        await fn()
    } finally {
        process.stdout.write = originalWrite
    }
    return captured
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

test("gate: api_token without an OIDC grant resolves to the api_token auth shape byte-exactly, no warning", async () => {
    await withEnv(
        {
            ACTIONS_ID_TOKEN_REQUEST_URL: undefined,
            ACTIONS_ID_TOKEN_REQUEST_TOKEN: undefined,
        },
        async () => {
            let auth
            const output = await captureStdout(async () => {
                auth = await resolveControlPlaneAuth({
                    apiURL: "https://api.garnet.ai",
                    apiToken: "project-token-1",
                })
            })
            assert.deepEqual(auth, API_TOKEN_AUTH)
            assert.ok(!output.includes("::warning"), `no warning expected for an intentional api_token run:\n${output}`)
            assert.ok(!output.includes("id-token: write"), `missing-permission hint must not appear:\n${output}`)
            assert.match(output, /Using the supplied 'api_token'/)
        },
    )
})

test("gate: api_token wins over an available OIDC grant — no ID token request, no exchange", async t => {
    const originalFetch = globalThis.fetch
    let fetched = false
    globalThis.fetch = async () => {
        fetched = true
        throw new Error("network must not be reached when api_token is supplied")
    }
    t.after(() => {
        globalThis.fetch = originalFetch
    })

    await withEnv(
        {
            // A closed local port: any ID-token request would fail loudly and
            // surface as a warning below instead of silently succeeding.
            ACTIONS_ID_TOKEN_REQUEST_URL: "http://127.0.0.1:9/oidc",
            ACTIONS_ID_TOKEN_REQUEST_TOKEN: "runtime-token",
        },
        async () => {
            let auth
            const output = await captureStdout(async () => {
                auth = await resolveControlPlaneAuth({
                    apiURL: "https://api.garnet.ai",
                    apiToken: "project-token-1",
                })
            })
            assert.deepEqual(auth, API_TOKEN_AUTH)
            assert.equal(fetched, false)
            assert.ok(
                !output.includes("::warning"),
                `OIDC must not be attempted when api_token is supplied:\n${output}`,
            )
        },
    )
})

test("gate: no api_token and OIDC unavailable fails clearly without reaching fetch", async t => {
    const originalFetch = globalThis.fetch
    let fetched = false
    globalThis.fetch = async () => {
        fetched = true
        throw new Error("network must not be reached when OIDC token URL is absent")
    }
    t.after(() => {
        globalThis.fetch = originalFetch
    })

    await withEnv(
        {
            ACTIONS_ID_TOKEN_REQUEST_URL: undefined,
            ACTIONS_ID_TOKEN_REQUEST_TOKEN: undefined,
        },
        async () => {
            const output = await captureStdout(async () => {
                await assert.rejects(
                    resolveControlPlaneAuth({
                        apiURL: "https://api.garnet.ai",
                        apiToken: "",
                    }),
                    /'api_token' is required/,
                )
            })
            assert.equal(fetched, false)
            assert.match(output, /::warning::.*missing 'id-token: write' permission/)
        },
    )
})

test("gate: whitespace-only api_token is not a token", async () => {
    // main.js passes the raw input through; the client trims on use, so a
    // blank input must take the no-token path rather than be sent as a
    // credential.
    await withEnv(
        {
            ACTIONS_ID_TOKEN_REQUEST_URL: undefined,
            ACTIONS_ID_TOKEN_REQUEST_TOKEN: undefined,
        },
        async () => {
            await assert.rejects(
                resolveControlPlaneAuth({
                    apiURL: "https://api.garnet.ai",
                    apiToken: "   ",
                }),
                /'api_token' is required/,
            )
        },
    )
})

test("gate: jibril sensor version never floats — every ref resolves to an explicit pin", () => {
    // Explicit input always wins.
    assert.equal(resolveJibrilVersion("v9.9.9", "v2"), "v9.9.9")
    // Tag channels keep their published behavior.
    assert.equal(resolveJibrilVersion("", "v0"), "v0.0")
    assert.equal(resolveJibrilVersion("", "refs/tags/v0"), "v0.0")
    assert.equal(resolveJibrilVersion("", "v1"), "v2.10.4")
    assert.equal(resolveJibrilVersion("", "v2"), "v2.16.0")
    // SHA, branch, and exact-tag refs get the same stable pin as v2.
    const pinnedRefs = ["04d0e18c0d3a5a1f9d2b7c6e5f4a3b2c1d0e9f8a", "main", "refs/tags/v2.2.0", ""]
    for (const ref of pinnedRefs) {
        assert.equal(resolveJibrilVersion("", ref), "v2.16.0", `ref ${JSON.stringify(ref)}`)
    }
})
