/**
 * Containment gates for the main-step credential and sensor-version
 * resolution: when the OIDC endpoint is unavailable (missing token URL), auth
 * falls back to the api_token shape with no network fetch reached, and the
 * Jibril sensor version never floats — every action ref resolves to an
 * explicit pinned version.
 */
import test from "node:test"
import assert from "node:assert/strict"
import { resolveControlPlaneAuth, resolveJibrilVersion } from "../src/action.js"

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

test("gate: OIDC unavailable falls back to the api_token auth shape byte-exactly", async () => {
    const expected = {
        projectToken: "project-token-1",
        workflowToken: "",
        workflowTokenExpiresAt: "",
    }
    await withEnv(
        {
            ACTIONS_ID_TOKEN_REQUEST_URL: undefined,
            ACTIONS_ID_TOKEN_REQUEST_TOKEN: undefined,
        },
        async () => {
            const auth = await resolveControlPlaneAuth({
                apiURL: "https://api.garnet.ai",
                apiToken: "project-token-1",
            })
            assert.deepEqual(auth, expected)
        },
    )
})

test("gate: OIDC failure does not reach fetch", async (t) => {
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
            await resolveControlPlaneAuth({
                apiURL: "https://api.garnet.ai",
                apiToken: "project-token-1",
            })
            assert.equal(fetched, false)
        },
    )
})

test("gate: empty api_token fails when OIDC is also unavailable", async () => {
    await withEnv(
        {
            ACTIONS_ID_TOKEN_REQUEST_URL: undefined,
            ACTIONS_ID_TOKEN_REQUEST_TOKEN: undefined,
        },
        async () => {
            await assert.rejects(
                resolveControlPlaneAuth({
                    apiURL: "https://api.garnet.ai",
                    apiToken: "",
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
