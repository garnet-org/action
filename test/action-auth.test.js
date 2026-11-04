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
import {
    buildSudoArgs,
    buildSudoPreserveEnvFlag,
    resolveControlPlaneAuth,
    resolveJibrilVersion,
    JIBRIL_STABLE_VERSION,
} from "../src/action.js"

const here = dirname(fileURLToPath(import.meta.url))

test("gate: supplied token bypasses an available OIDC endpoint without warnings", async t => {
    let output = ""
    t.mock.method(process.stdout, "write", chunk => {
        output += String(chunk)
        return true
    })
    const fetch = t.mock.method(globalThis, "fetch", async () => {
        throw new Error("OIDC must not be requested when a token was supplied")
    })
    await withEnv(
        {
            ACTIONS_ID_TOKEN_REQUEST_URL: "https://oidc.example/token",
            ACTIONS_ID_TOKEN_REQUEST_TOKEN: "fixture-oidc-token",
        },
        async () => {
            assert.deepEqual(
                await resolveControlPlaneAuth({ apiURL: "https://api.garnet.ai", apiToken: " project-token-1 " }),
                { projectToken: "project-token-1", workflowToken: "", workflowTokenExpiresAt: "" },
            )
        },
    )
    assert.equal(fetch.mock.callCount(), 0)
    assert.doesNotMatch(output, /::warning::|::error::|project-token-1/)
})

test("gate: whitespace token takes the no-token path", async () => {
    await withEnv({ ACTIONS_ID_TOKEN_REQUEST_URL: undefined, ACTIONS_ID_TOKEN_REQUEST_TOKEN: undefined }, async () => {
        await assert.rejects(
            resolveControlPlaneAuth({ apiURL: "https://api.garnet.ai", apiToken: " \t " }),
            /no credential is left for the control plane/,
        )
    })
})

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

test("gate: OIDC failure does not reach fetch", async t => {
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
    const permissionBlock =
        source.match(
            /isMissingOIDCPermissionError\(errorMessage\)[\s\S]*?\} else if \(errorMessage\.startsWith/,
        )?.[0] ?? ""
    assert.match(permissionBlock, /hasApiToken/, "isMissingOIDCPermissionError block must branch on hasApiToken")
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

test("gate: sudo commands do not pass -E and only preserve Jibril/GitHub env vars when requested", async () => {
    const env = {
        GARNET_API_URL: "https://api.garnet.ai",
        GARNET_AGENT_TOKEN: "agent-secret-token",
        GARNET_API_TOKEN: "",
        GITHUB_ACTIONS: "true",
        GITHUB_WORKFLOW: "CI",
        GITHUB_TOKEN: "ghs_secret",
        JIBRIL_JSONPROFILER_FILE: "/var/log/jibril.profile.json",
        RUNNER_OS: "Linux",
        AI_ENABLED: "false",
        CI: "true",
        DEBUG: "false",
        UNSET_VAR: undefined,
        GITHUB_UNSET: undefined,
        PATH: "/usr/local/bin:/usr/bin",
        HOME: "/home/runner",
        LD_PRELOAD: "/tmp/evil.so",
        LD_LIBRARY_PATH: "/tmp/lib",
        "BASH_FUNC_myfunc%%": "() { :; }",
        AWS_SECRET_ACCESS_KEY: "aws-secret",
        NPM_TOKEN: "npm-secret",
    }

    // Default sudo calls (mv, chmod, install, cp, systemctl) never pass -E or --preserve-env.
    assert.deepEqual(buildSudoArgs(["mv", "/tmp/jibril", "/usr/local/bin/jibril"], { env }), [
        "mv",
        "/tmp/jibril",
        "/usr/local/bin/jibril",
    ])

    // Preserved-env sudo calls use explicit --preserve-env=VAR1,VAR2 (supported by both sudo and sudo-rs).
    const flag = buildSudoPreserveEnvFlag(env)
    assert.equal(
        flag,
        "--preserve-env=AI_ENABLED,CI,DEBUG,GARNET_AGENT_TOKEN,GARNET_API_TOKEN,GARNET_API_URL,GITHUB_ACTIONS,GITHUB_TOKEN,GITHUB_WORKFLOW,JIBRIL_JSONPROFILER_FILE,RUNNER_OS",
    )
    assert.ok(!flag.includes("agent-secret-token"), "flag must carry variable names only, never secret values")
    assert.ok(!flag.includes("ghs_secret"), "flag must carry variable names only, never secret values")
    assert.ok(!flag.includes("LD_PRELOAD"), "restricted loader variables must not be preserved")
    assert.ok(!flag.includes("BASH_FUNC"), "invalid identifier names must not be preserved")
    assert.ok(!flag.includes("AWS_SECRET_ACCESS_KEY"), "unrelated user secrets must not be preserved")

    assert.deepEqual(buildSudoArgs(["/usr/local/bin/jibril", "--systemd", "install"], { preserveEnv: true, env }), [
        flag,
        "/usr/local/bin/jibril",
        "--systemd",
        "install",
    ])

    // When no matching variables exist, --preserve-env= is omitted rather than passed empty.
    assert.equal(buildSudoPreserveEnvFlag({ PATH: "/usr/bin", HOME: "/root", GITHUB_SHA: undefined }), "")
    assert.deepEqual(
        buildSudoArgs(["/usr/local/bin/jibril", "--systemd", "install"], {
            preserveEnv: true,
            env: { PATH: "/usr/bin" },
        }),
        ["/usr/local/bin/jibril", "--systemd", "install"],
    )

    // Source gate: -E is never passed to sudo, and jibril --systemd install opts into preserveEnv.
    const source = await readFile(join(here, "..", "src", "action.js"), "utf8")
    assert.doesNotMatch(source, /sudo\s+-E|\["-E"/)
    assert.match(
        source,
        /execSudo\(\[\`\$\{INSTPATH\}\/jibril\`,\s*"--systemd",\s*"install"\],\s*\{\s*preserveEnv:\s*true\s*\}\)/,
    )
})
