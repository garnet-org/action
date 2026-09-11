/**
 * Containment gates for the main-step credential and sensor-version
 * resolution: when the OIDC endpoint is unavailable (missing token URL), auth
 * falls back to the api_token shape with no network fetch reached, and the
 * Jibril sensor version never floats — every action ref resolves to an
 * explicit pinned version.
 *
 * Crucially: an api_token-only workflow that lacks 'id-token: write' must NOT
 * produce a warning annotation — the OIDC miss is expected and silent at info
 * level for that configuration.
 */
import test from "node:test"
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { resolveControlPlaneAuth, resolveJibrilVersion, JIBRIL_STABLE_VERSION } from "../src/action.js"

const here = dirname(fileURLToPath(import.meta.url))

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

test("gate: OIDC permission miss + api_token present logs at info, not warning", async () => {
    // When OIDC is requested but the job lacks 'id-token: write' and the user
    // has configured api_token, the OIDC miss is deliberate — no warning annotation.
    // The branching is straightforward enough to verify directly in source.
    const source = await readFile(join(here, "..", "src", "action.js"), "utf8")

    // When api_token is present, the permission miss must go through core.info, not core.warning.
    assert.match(
        source,
        /isMissingOIDCPermissionError[\s\S]*?hasApiToken[\s\S]*?core\.info/,
        "missing-permission branch must call core.info when api_token is available",
    )

    // The core.warning call in the else (no api_token) branch must not appear
    // before the hasApiToken check in the missing-permission block.
    const permissionBlock = source.match(
        /isMissingOIDCPermissionError\(errorMessage\)[\s\S]*?\} else if \(errorMessage\.startsWith/,
    )?.[0] ?? ""
    assert.match(
        permissionBlock,
        /hasApiToken/,
        "isMissingOIDCPermissionError block must branch on hasApiToken",
    )
    assert.doesNotMatch(
        permissionBlock.split("hasApiToken")[0] ?? "",
        /core\.warning/,
        "core.warning must not be called before the hasApiToken check in the permission-miss block",
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
                /no credential is left for the control plane/,
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
    assert.equal(resolveJibrilVersion("", "v2"), JIBRIL_STABLE_VERSION)
    // SHA, branch, and exact-tag refs get the same stable pin as v2.
    const pinnedRefs = ["04d0e18c0d3a5a1f9d2b7c6e5f4a3b2c1d0e9f8a", "main", "refs/tags/v2.2.0", ""]
    for (const ref of pinnedRefs) {
        assert.equal(resolveJibrilVersion("", ref), JIBRIL_STABLE_VERSION, `ref ${JSON.stringify(ref)}`)
    }
})
