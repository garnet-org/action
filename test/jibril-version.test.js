import assert from "node:assert/strict"
import { test } from "node:test"
import { resolveJibrilVersion, JIBRIL_STABLE_VERSION } from "../src/action.js"
import { versionAtLeast } from "../src/jibril-version.js"

test("explicit jibril_version input always wins", () => {
    assert.equal(resolveJibrilVersion("v2.12.0", "v2"), "v2.12.0")
    assert.equal(resolveJibrilVersion("  v2.12.0  ", "main"), "v2.12.0")
    assert.equal(resolveJibrilVersion("latest", "v2"), "latest")
})

test("empty input on the v2 tag resolves the pinned default", () => {
    assert.equal(resolveJibrilVersion("", "v2"), JIBRIL_STABLE_VERSION)
    assert.equal(resolveJibrilVersion("", "refs/tags/v2"), JIBRIL_STABLE_VERSION)
})

test("empty input on SHA refs resolves the pinned default, never latest", () => {
    assert.equal(resolveJibrilVersion("", "3d47f4a9004f7356c980a0e8d420ef5984750e3c"), JIBRIL_STABLE_VERSION)
})

test("empty input on branch and unknown refs resolves the pinned default, never latest", () => {
    assert.equal(resolveJibrilVersion("", "main"), JIBRIL_STABLE_VERSION)
    assert.equal(resolveJibrilVersion("", "refs/heads/main"), JIBRIL_STABLE_VERSION)
    assert.equal(resolveJibrilVersion("", ""), JIBRIL_STABLE_VERSION)
    assert.equal(resolveJibrilVersion("", "v3"), JIBRIL_STABLE_VERSION)
})

test("legacy tag pins are preserved", () => {
    assert.equal(resolveJibrilVersion("", "v0"), "v0.0")
    assert.equal(resolveJibrilVersion("", "refs/tags/v0"), "v0.0")
    assert.equal(resolveJibrilVersion("", "v1"), "v2.10.4")
})

test("no ref ever resolves to latest with an empty input", () => {
    const refs = ["v2", "v1", "v0", "main", "refs/heads/feature", "deadbeef", ""]
    for (const ref of refs) {
        assert.notEqual(resolveJibrilVersion("", ref), "latest")
    }
})

test("the minimum itself and anything newer satisfy the gate", () => {
    assert.equal(versionAtLeast("v2.17.0", 2, 17, 0), true)
    assert.equal(versionAtLeast("2.17.0", 2, 17, 0), true)
    assert.equal(versionAtLeast("  v2.17.0\n", 2, 17, 0), true)
    assert.equal(versionAtLeast("v2.17.1", 2, 17, 0), true)
    assert.equal(versionAtLeast("v2.18.0", 2, 17, 0), true)
    assert.equal(versionAtLeast("v10.0.0", 9, 99, 99), true)
})

test("anything older fails the gate, on any component", () => {
    assert.equal(versionAtLeast("v2.16.9", 2, 17, 0), false)
    assert.equal(versionAtLeast("v2.17.0", 2, 17, 1), false)
    assert.equal(versionAtLeast("v1.99.99", 2, 17, 0), false)
})

test("prereleases sort with their core version", () => {
    assert.equal(versionAtLeast("v2.17.0-rc.5", 2, 17, 0), true)
    assert.equal(versionAtLeast("v2.17.0-rc.5", 2, 17, 1), false)
})

test("latest passes every gate, and any other non-semver tag fails it", () => {
    assert.equal(versionAtLeast("latest", 99, 0, 0), true)
    // Daily builds and an unresolved version must never turn a version-gated
    // feature on by accident.
    assert.equal(versionAtLeast("v0.0", 2, 17, 0), false)
    assert.equal(versionAtLeast("", 2, 17, 0), false)
    assert.equal(versionAtLeast("main", 2, 17, 0), false)
})
