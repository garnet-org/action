import assert from "node:assert/strict"
import { test } from "node:test"
import { renderNoProfileSummary } from "../src/post-summary.js"

test("renderNoProfileSummary: exact line", () => {
    assert.equal(renderNoProfileSummary(), "No execution profile was produced for this job (status: no_profile)")
})

test("renderNoProfileSummary: renders no review furniture", () => {
    const summary = renderNoProfileSummary()
    assert.equal(summary.includes("no change"), false)
    assert.equal(summary.includes("clean"), false)
    assert.equal(summary.includes("|"), false)
})
