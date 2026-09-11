import assert from "node:assert/strict"
import { test } from "node:test"
import { COMMIT_STATUS_CONTEXT, createExecutionReceiptStatus, describeCommitStatus } from "../src/commit-status.js"

test("describeCommitStatus: recorded uses the job count", () => {
    assert.equal(describeCommitStatus("recorded", 1), "recorded · 1 job")
    assert.equal(describeCommitStatus("recorded", 3), "recorded · 3 jobs")
})

test("describeCommitStatus: start_failed", () => {
    assert.equal(describeCommitStatus("start_failed", 0), "not recorded · start_failed")
})

test("describeCommitStatus: no_profile", () => {
    assert.equal(describeCommitStatus("no_profile", 0), "not recorded · no_profile")
})

test("createExecutionReceiptStatus: creates a success receipt with exact params", async () => {
    /** @type {object | null} */
    let captured = null
    const client = {
        createCommitStatus: async params => {
            captured = params
            return {}
        },
    }

    const result = await createExecutionReceiptStatus(
        {
            token: "token",
            repository: "garnet-org/action",
            sha: "abc123",
            description: "recorded · 1 job",
            targetURL: "https://app.garnet.ai/public/runs/1",
        },
        client,
    )

    assert.equal(result, "created")
    assert.equal(captured.owner, "garnet-org")
    assert.equal(captured.repo, "action")
    assert.equal(captured.sha, "abc123")
    assert.equal(captured.state, "success")
    assert.equal(captured.context, COMMIT_STATUS_CONTEXT)
    assert.equal(captured.description, "recorded · 1 job")
    assert.equal(captured.target_url, "https://app.garnet.ai/public/runs/1")
    assert.ok(captured.request.signal instanceof AbortSignal)
})

test("createExecutionReceiptStatus: 403 skips without throwing", async () => {
    const client = {
        createCommitStatus: async () => {
            const error = new Error("Forbidden")
            // @ts-expect-error octokit errors carry an HTTP status
            error.status = 403
            throw error
        },
    }

    const result = await createExecutionReceiptStatus(
        {
            token: "token",
            repository: "garnet-org/action",
            sha: "abc123",
            description: "recorded · 1 job",
            targetURL: "",
        },
        client,
    )

    assert.equal(result, "skipped")
})

test("createExecutionReceiptStatus: 404 skips without throwing", async () => {
    const client = {
        createCommitStatus: async () => {
            const error = new Error("Not Found")
            // @ts-expect-error octokit errors carry an HTTP status
            error.status = 404
            throw error
        },
    }

    const result = await createExecutionReceiptStatus(
        {
            token: "token",
            repository: "garnet-org/action",
            sha: "abc123",
            description: "recorded · 1 job",
            targetURL: "",
        },
        client,
    )

    assert.equal(result, "skipped")
})

test("createExecutionReceiptStatus: unexpected errors skip without throwing", async () => {
    const client = {
        createCommitStatus: async () => {
            throw new Error("boom")
        },
    }

    const result = await createExecutionReceiptStatus(
        {
            token: "token",
            repository: "garnet-org/action",
            sha: "abc123",
            description: "recorded · 1 job",
            targetURL: "",
        },
        client,
    )

    assert.equal(result, "skipped")
})

test("createExecutionReceiptStatus: empty token skips without calling the API", async () => {
    let called = false
    const client = {
        createCommitStatus: async () => {
            called = true
            return {}
        },
    }

    const result = await createExecutionReceiptStatus(
        {
            token: "",
            repository: "garnet-org/action",
            sha: "abc123",
            description: "not recorded · no_profile",
            targetURL: "",
        },
        client,
    )

    assert.equal(result, "skipped")
    assert.equal(called, false)
})
