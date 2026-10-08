import assert from "node:assert/strict"
import test from "node:test"
import { deriveJobIndexFromJobs } from "../src/github-job-index.js"

/**
 * @param {number} id
 * @param {string} name
 * @param {string=} runnerName
 */
function job(id, name, runnerName) {
    return { id, name, runner_name: runnerName ?? null, status: runnerName === undefined ? "completed" : "in_progress" }
}

test("derives a leg's position among its siblings, ordered by job id", () => {
    const jobs = [
        job(30, "Relay (c)"),
        job(10, "Relay (a)"),
        job(20, "Relay (b)", "runner-7"),
        job(5, "Verify"),
    ]

    assert.equal(deriveJobIndexFromJobs(jobs, "runner-7"), 1)
})

test("refuses to guess rather than risk aliasing one leg onto another", () => {
    const ambiguousRunner = [job(10, "Relay (a)", "runner-7"), job(20, "Relay (b)", "runner-7")]
    assert.equal(deriveJobIndexFromJobs(ambiguousRunner, "runner-7"), null)

    const duplicateNames = [job(10, "Relay (a)", "runner-7"), job(20, "Relay (a)")]
    assert.equal(deriveJobIndexFromJobs(duplicateNames, "runner-7"), null)

    const notAMatrix = [job(10, "Build (fast)", "runner-7"), job(20, "Verify")]
    assert.equal(deriveJobIndexFromJobs(notAMatrix, "runner-7"), null)

    assert.equal(deriveJobIndexFromJobs([job(10, "Relay", "runner-7")], "runner-7"), null)
})
