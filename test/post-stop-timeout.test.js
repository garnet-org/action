import assert from "node:assert/strict"
import { test } from "node:test"
import { resolveStopTimeoutFromSettings, resolveStopTimeoutFromUnit } from "../src/post-stop-timeout.js"

test("settings: env override wins", () => {
    assert.equal(resolveStopTimeoutFromSettings({ envOverride: "42", savedState: "1800" }), 42)
})

test("settings: zero or negative disables the timeout", () => {
    assert.equal(resolveStopTimeoutFromSettings({ envOverride: "0", savedState: "1800" }), 0)
    assert.equal(resolveStopTimeoutFromSettings({ envOverride: "-1", savedState: "1800" }), 0)
    assert.equal(resolveStopTimeoutFromSettings({ envOverride: "", savedState: "0" }), 0)
})

test("settings: saved state gets grace period, invalid values resolve to null", () => {
    assert.equal(resolveStopTimeoutFromSettings({ envOverride: "", savedState: "1800" }), 1830)
    assert.equal(resolveStopTimeoutFromSettings({ envOverride: "", savedState: "abc" }), null)
})

test("unit timeout: readable value gets grace period, unreadable uses default", () => {
    assert.equal(resolveStopTimeoutFromUnit(600), 630)
    assert.equal(resolveStopTimeoutFromUnit(null), 1830)
})
