import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

test("post step writes terminal summaries for missing, empty and invalid profiles", async t => {
    const directory = await mkdtemp(join(tmpdir(), "garnet-terminal-"))
    t.after(() => rm(directory, { recursive: true, force: true }))
    for (const state of ["missing", "empty", "invalid"]) {
        const summaryPath = join(directory, `${state}.md`)
        const output = execFileSync(
            process.execPath,
            [
                "--experimental-test-module-mocks",
                "--input-type=module",
                "--eval",
                `
                import { mock } from "node:test"
                const state = ${JSON.stringify(state)}
                let now = 0
                Date.now = () => { now += 100000; return now }
                mock.module("@actions/exec", { namedExports: {
                    exec: async () => 0,
                    getExecOutput: async (command, args) => {
                        if (args[0] === "stat") return {
                            exitCode: state === "missing" ? 1 : 0,
                            stdout: state === "invalid" ? "8" : "0", stderr: "",
                        }
                        if (args[0] === "cat") return {
                            exitCode: 0, stdout: state === "invalid" ? "not json" : "", stderr: "",
                        }
                        return { exitCode: 0, stdout: "ActiveState=inactive\\nResult=success\\nExecMainStatus=0", stderr: "" }
                    },
                } })
                await import("./src/post.js")
            `,
            ],
            {
                cwd: new URL("../", import.meta.url),
                encoding: "utf8",
                env: {
                    PATH: process.env.PATH,
                    GITHUB_STEP_SUMMARY: summaryPath,
                    STATE_jibrilStarted: "true",
                    STATE_stopTimeoutSeconds: "30",
                    GARNET_POST_PROFILE_WAIT_SECONDS: "1",
                },
            },
        )
        assert.doesNotMatch(output, /::error::|failed to write Runtime Review summary/)
        const summary = await readFile(summaryPath, "utf8")
        assert.match(summary, /Execution Profile for this job · not recorded/)
        assert.match(summary, /No execution profile was produced for this job \(status: no_profile\)/)
        assert.doesNotMatch(summary, /still being recorded|pending|View this job/)
    }
})

test("setup failure is fail-open with a redacted terminal summary", async t => {
    const directory = await mkdtemp(join(tmpdir(), "garnet-start-failure-"))
    t.after(() => rm(directory, { recursive: true, force: true }))
    const summaryPath = join(directory, "summary.md")
    const secret = "fixture-sensitive-value"
    const output = execFileSync(
        process.execPath,
        [
            "--experimental-test-module-mocks",
            "--input-type=module",
            "--eval",
            `
            import assert from "node:assert/strict"
            import { mock } from "node:test"
            mock.module("@actions/exec", { namedExports: {
                exec: async () => { throw new Error("no root execution expected") },
                getExecOutput: async () => ({
                    exitCode: 0, stdout: "diagnostic fixture-sensitive-value", stderr: "",
                }),
            } })
            const { run } = await import("./src/action.js")
            assert.equal(await run(), false)
        `,
        ],
        {
            cwd: new URL("../", import.meta.url),
            encoding: "utf8",
            env: {
                PATH: process.env.PATH,
                GARNET_API_URL: "http://api.garnet.ai",
                GARNET_API_TOKEN: secret,
                GITHUB_STEP_SUMMARY: summaryPath,
            },
        },
    )
    const summary = await readFile(summaryPath, "utf8")
    assert.match(output, /::warning::Garnet did not attach to this job — nothing was recorded\. Jibril did not start/)
    assert.match(summary, /Execution Profile for this job · not recorded/)
    assert.match(summary, /sensor did not start on this runner/)
    assert.match(summary, /sensor startup log/)
    assert.ok(!output.includes(secret))
    assert.ok(!summary.includes(secret))
})
