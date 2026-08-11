/**
 * Containment gates for the main-step credential and sensor-version
 * resolution: with the OIDC feature flag off, auth resolves exactly the
 * pre-OIDC api_token shape with no network reachable, and the Jibril
 * sensor version never floats — every action ref resolves to an explicit
 * pinned version.
 */
import test from "node:test"
import assert from "node:assert/strict"
import { resolveControlPlaneAuth, resolveJibrilVersion } from "../src/action.js"

test("gate: OIDC flag off resolves the pre-OIDC api_token auth shape byte-exactly", async () => {
    const expected = {
        projectToken: "project-token-1",
        workflowToken: "",
        workflowTokenExpiresAt: "",
    }
    for (const useOIDCAuth of [false, undefined]) {
        const auth = await resolveControlPlaneAuth({
            apiURL: "https://api.garnet.ai",
            apiToken: "project-token-1",
            useOIDCAuth,
        })
        assert.deepEqual(auth, expected)
    }
})

test("gate: OIDC flag off performs no network request", async (t) => {
    const originalFetch = globalThis.fetch
    let fetched = false
    globalThis.fetch = async () => {
        fetched = true
        throw new Error("network must not be reached with OIDC off")
    }
    t.after(() => {
        globalThis.fetch = originalFetch
    })

    await resolveControlPlaneAuth({
        apiURL: "https://api.garnet.ai",
        apiToken: "project-token-1",
        useOIDCAuth: false,
    })
    assert.equal(fetched, false)
})

test("gate: OIDC flag off with empty api_token fails exactly like the pre-OIDC path", async () => {
    await assert.rejects(
        resolveControlPlaneAuth({
            apiURL: "https://api.garnet.ai",
            apiToken: "",
            useOIDCAuth: false,
        }),
        /'api_token' is required/,
    )
})

test("gate: jibril sensor version never floats — every ref resolves to an explicit pin", () => {
    // Explicit input always wins.
    assert.equal(resolveJibrilVersion("v9.9.9", "v2"), "v9.9.9")
    // Tag channels keep their published behavior.
    assert.equal(resolveJibrilVersion("", "v0"), "v0.0")
    assert.equal(resolveJibrilVersion("", "refs/tags/v0"), "v0.0")
    assert.equal(resolveJibrilVersion("", "v1"), "v2.10.4")
    assert.equal(resolveJibrilVersion("", "v2"), "v2.15.0")
    // SHA, branch, and exact-tag refs get the same stable pin as v2.
    const pinnedRefs = ["04d0e18c0d3a5a1f9d2b7c6e5f4a3b2c1d0e9f8a", "main", "refs/tags/v2.2.0", ""]
    for (const ref of pinnedRefs) {
        assert.equal(resolveJibrilVersion("", ref), "v2.15.0", `ref ${JSON.stringify(ref)}`)
    }
})
