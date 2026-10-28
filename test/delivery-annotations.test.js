import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { readFile, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

/**
 * @param {string} script
 * @param {Record<string, string>} [environment]
 * @returns {string}
 */
function runNodeScript(script, environment = {}) {
    return execFileSync(
        process.execPath,
        [
            "--experimental-test-module-mocks",
            "--disable-warning=ExperimentalWarning",
            "--input-type=module",
            "--eval",
            script,
        ],
        {
            cwd: new URL("../", import.meta.url),
            encoding: "utf8",
            env: {
                PATH: process.env.PATH ?? "",
                ...environment,
            },
        },
    )
}

test("delivery failure annotations and artifact uploads stay warning-only", () => {
    const output = runNodeScript(`
        import { mock } from "node:test"

        const calls = {
            warnings: [],
            infos: [],
            setFailed: [],
            errors: [],
            uploads: [],
        }

        function clearCalls() {
            calls.warnings.length = 0
            calls.infos.length = 0
            calls.setFailed.length = 0
            calls.errors.length = 0
            calls.uploads.length = 0
        }

        const core = {
            warning(message, properties = {}) {
                calls.warnings.push({ message, title: properties.title })
            },
            info(message) {
                calls.infos.push(message)
            },
            setFailed(message) {
                calls.setFailed.push(message)
            },
            error(message) {
                calls.errors.push(message)
            },
        }

        mock.module("@actions/core", { namedExports: core })

        let uploadBehavior = "throw"
        mock.module("@actions/artifact", {
            defaultExport: {
                async uploadArtifact(name) {
                    calls.uploads.push(name)
                    if (uploadBehavior === "throw") {
                        throw new Error("upload failed")
                    }
                },
            },
        })

        const annotations = await import("./src/delivery-annotations.js")
        const cases = [
            ["profile_not_written", annotations.NO_PROFILE_TITLE],
            ["profile_empty", annotations.NO_PROFILE_TITLE],
            ["profile_invalid", annotations.NO_PROFILE_TITLE],
            ["profile_unreadable", annotations.NO_PROFILE_TITLE],
            ["profile_too_large", annotations.NO_PROFILE_TITLE],
            ["artifact_upload_failed", annotations.NO_REVIEW_TITLE],
            ["relay_agent_unreadable", annotations.NO_REVIEW_TITLE],
            ["summary_failed", annotations.SUMMARY_FAILED_TITLE],
        ]

        const annotationResults = []
        for (const [cause, title] of cases) {
            clearCalls()
            const detail = \`diagnostic for \${cause}\`
            annotations.annotateDeliveryFailure(cause, detail)
            annotationResults.push({
                cause,
                title,
                warnings: [...calls.warnings],
                infos: [...calls.infos],
                setFailed: [...calls.setFailed],
                errors: [...calls.errors],
            })
        }

        clearCalls()
        annotations.annotateDeliveryFailure("profile_not_written", "")
        const emptyDetailResult = {
            warnings: [...calls.warnings],
            infos: [...calls.infos],
        }

        const { uploadRunArtifact } = await import("./src/run-artifact.js")
        const envelope = {
            schema_version: 1,
            agent: {},
            profile: null,
            stopped: { reason: "stopped_cleanly", profileState: "present" },
        }

        clearCalls()
        await uploadRunArtifact("failed-artifact", envelope)
        const failedUpload = {
            warnings: [...calls.warnings],
            infos: [...calls.infos],
            setFailed: [...calls.setFailed],
            errors: [...calls.errors],
            uploads: [...calls.uploads],
        }

        uploadBehavior = "succeed"
        clearCalls()
        await uploadRunArtifact("oversized-artifact", {
            ...envelope,
            profile: { blob: "x".repeat(17 * 1024 * 1024) },
        })
        const oversizedUpload = {
            warnings: [...calls.warnings],
            infos: [...calls.infos],
            setFailed: [...calls.setFailed],
            errors: [...calls.errors],
            uploads: [...calls.uploads],
        }

        clearCalls()
        await uploadRunArtifact("successful-artifact", envelope)
        const successfulUpload = {
            warnings: [...calls.warnings],
            infos: [...calls.infos],
            setFailed: [...calls.setFailed],
            errors: [...calls.errors],
            uploads: [...calls.uploads],
        }

        process.stdout.write(JSON.stringify({
            annotationResults,
            emptyDetailResult,
            titles: {
                noProfile: annotations.NO_PROFILE_TITLE,
                noReview: annotations.NO_REVIEW_TITLE,
                summaryFailed: annotations.SUMMARY_FAILED_TITLE,
            },
            failedUpload,
            oversizedUpload,
            successfulUpload,
        }))
    `)
    const result = JSON.parse(output)
    assert.deepEqual(result.titles, {
        noProfile: "Garnet: Execution Profile not recorded",
        noReview: "Garnet: no Runtime Review for this job",
        summaryFailed: "Garnet: Runtime Review step error",
    })

    for (const { cause, title, warnings, infos, setFailed, errors } of result.annotationResults) {
        assert.equal(warnings.length, 1, cause)
        assert.equal(warnings[0].title, title, cause)
        assert.equal(typeof warnings[0].message, "string", cause)
        assert.notEqual(warnings[0].message, "", cause)
        assert.equal(warnings[0].message.includes(`diagnostic for ${cause}`), false, cause)
        assert.deepEqual(infos, [`${title}: diagnostic for ${cause}`], cause)
        assert.deepEqual(setFailed, [], cause)
        assert.deepEqual(errors, [], cause)
    }

    assert.equal(result.emptyDetailResult.warnings.length, 1)
    assert.deepEqual(result.emptyDetailResult.infos, [])

    assert.equal(result.failedUpload.warnings.length, 1)
    assert.equal(result.failedUpload.warnings[0].title, result.titles.noReview)
    assert.deepEqual(result.failedUpload.infos, [
        `${result.titles.noReview}: artifact 'failed-artifact': upload failed`,
    ])
    assert.deepEqual(result.failedUpload.setFailed, [])
    assert.deepEqual(result.failedUpload.errors, [])
    assert.deepEqual(result.failedUpload.uploads, ["failed-artifact"])

    assert.equal(result.oversizedUpload.warnings.length, 1)
    assert.equal(result.oversizedUpload.warnings[0].title, result.titles.noProfile)
    assert.deepEqual(result.oversizedUpload.infos, ["Uploaded the Garnet run artifact 'oversized-artifact'"])
    assert.deepEqual(result.oversizedUpload.setFailed, [])
    assert.deepEqual(result.oversizedUpload.errors, [])
    assert.deepEqual(result.oversizedUpload.uploads, ["oversized-artifact"])

    assert.deepEqual(result.successfulUpload.warnings, [])
    assert.deepEqual(result.successfulUpload.setFailed, [])
    assert.deepEqual(result.successfulUpload.errors, [])
    assert.deepEqual(result.successfulUpload.uploads, ["successful-artifact"])
})

test("post step annotates a missing or empty profile once and does not annotate a valid profile", async t => {
    if (process.platform !== "linux" || process.arch !== "x64") {
        t.skip("Linux/x64-only behavior: the post step exits early on unsupported platforms")
        return
    }

    const directory = await mkdtemp(join(tmpdir(), "garnet-delivery-annotations-"))
    t.after(() => rm(directory, { recursive: true, force: true }))

    const profileContent = await readFile(new URL("./fixtures/profiles/sample-profile.json", import.meta.url), "utf8")
    const warningPrefix = "::warning title=Garnet%3A Execution Profile not recorded::"

    for (const state of ["missing", "empty", "present"]) {
        const summaryPath = join(directory, `${state}.md`)
        const output = runNodeScript(
            `
                import { mock } from "node:test"
                const state = ${JSON.stringify(state)}
                const profileContent = ${JSON.stringify(profileContent)}
                let now = 0
                Date.now = () => { now += 100000; return now }
                mock.module("@actions/exec", { namedExports: {
                    exec: async () => 0,
                    getExecOutput: async (command, args) => {
                        if (args[0] === "stat") return {
                            exitCode: state === "missing" ? 1 : 0,
                            stdout: state === "present" ? String(Buffer.byteLength(profileContent, "utf8")) : "0",
                            stderr: "",
                        }
                        if (args[0] === "cat") return {
                            exitCode: 0, stdout: state === "present" ? profileContent : "", stderr: "",
                        }
                        return {
                            exitCode: 0,
                            stdout: "ActiveState=inactive\\nResult=success\\nExecMainStatus=0",
                            stderr: "",
                        }
                    },
                } })
                await import("./src/post.js")
            `,
            {
                GITHUB_STEP_SUMMARY: summaryPath,
                STATE_jibrilStarted: "true",
                STATE_stopTimeoutSeconds: "30",
                GARNET_POST_PROFILE_WAIT_SECONDS: "1",
                JIBRIL_JSONPROFILER_FILE: "/fixture/profile.json",
            },
        )

        assert.doesNotMatch(output, /::error(?::| )/)
        if (state !== "present") {
            const annotationLines = output.split("\n").filter(line => line.includes(warningPrefix))
            assert.equal(annotationLines.length, 1, output)
            assert.ok(annotationLines[0].startsWith(warningPrefix), annotationLines[0])
            console.log(annotationLines[0])
        } else {
            assert.doesNotMatch(output, /::warning title=Garnet/)
        }
    }
})
