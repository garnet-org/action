import assert from "node:assert/strict"
import { test } from "node:test"
import { resolveStopTimeoutSeconds } from "../src/action.js"

const DEFAULT_SECONDS = 1800

test("empty override resolves the default stop ceiling", () => {
    assert.equal(resolveStopTimeoutSeconds(""), DEFAULT_SECONDS)
})

test("positive integer override wins", () => {
    assert.equal(resolveStopTimeoutSeconds("900"), 900)
    assert.equal(resolveStopTimeoutSeconds("  3600  "), 3600)
})

test("non-numeric override falls back to the default", () => {
    assert.equal(resolveStopTimeoutSeconds("ten minutes"), DEFAULT_SECONDS)
    assert.equal(resolveStopTimeoutSeconds("600s"), DEFAULT_SECONDS)
    assert.equal(resolveStopTimeoutSeconds("-600"), DEFAULT_SECONDS)
    assert.equal(resolveStopTimeoutSeconds("6.5"), DEFAULT_SECONDS)
})

test("zero override falls back to the default", () => {
    assert.equal(resolveStopTimeoutSeconds("0"), DEFAULT_SECONDS)
})
