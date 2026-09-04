import assert from "node:assert/strict"
import { test } from "node:test"
import { deriveJobStatusFromJobs } from "../src/github-job-status.js"

/** @typedef {import("../src/github-job-status.js").WorkflowRunJob} WorkflowRunJob */

/**
 * @param {Partial<WorkflowRunJob>=} overrides
 * @returns {WorkflowRunJob}
 */
function createJob(overrides = {}) {
    return {
        name: "build",
        runner_name: "runner-1",
        status: "in_progress",
        conclusion: "",
        steps: [],
        ...overrides,
    }
}

test("deriveJobStatusFromJobs: cancelled conclusion is authoritative", () => {
    const status = deriveJobStatusFromJobs([createJob({ conclusion: "cancelled" })], {
        runnerName: "runner-1",
        jobName: "build",
    })
    assert.equal(status, "cancelled")
})

test("deriveJobStatusFromJobs: step failures are detected", () => {
    const status = deriveJobStatusFromJobs([createJob({ steps: [{ conclusion: "failure" }] })], {
        runnerName: "runner-1",
        jobName: "build",
    })
    assert.equal(status, "failure")
})

test("deriveJobStatusFromJobs: falls back to exact job name when runner match is ambiguous", () => {
    const status = deriveJobStatusFromJobs(
        [
            createJob({ name: "other" }),
            createJob({ name: "build", conclusion: "cancelled" }),
        ],
        {
            runnerName: "runner-1",
            jobName: "build",
        },
    )
    assert.equal(status, "cancelled")
})

test("deriveJobStatusFromJobs: ambiguous or missing matches stay unknown", () => {
    const ambiguous = deriveJobStatusFromJobs([createJob(), createJob({ name: "build" })], {
        runnerName: "runner-1",
        jobName: "build",
    })
    assert.equal(ambiguous, "")

    const missing = deriveJobStatusFromJobs([createJob({ runner_name: "runner-2" })], {
        runnerName: "runner-1",
        jobName: "build",
    })
    assert.equal(missing, "")
})
