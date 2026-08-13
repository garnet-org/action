import assert from "node:assert/strict"
import { test } from "node:test"
import { resolveJibrilVersion } from "../src/action.js"

const PINNED_DEFAULT = "v2.16.0"

test("explicit jibril_version input always wins", () => {
    assert.equal(resolveJibrilVersion("v2.12.0", "v2"), "v2.12.0")
    assert.equal(resolveJibrilVersion("  v2.12.0  ", "main"), "v2.12.0")
    assert.equal(resolveJibrilVersion("latest", "v2"), "latest")
})

test("empty input on the v2 tag resolves the pinned default", () => {
    assert.equal(resolveJibrilVersion("", "v2"), PINNED_DEFAULT)
    assert.equal(resolveJibrilVersion("", "refs/tags/v2"), PINNED_DEFAULT)
})

test("empty input on SHA refs resolves the pinned default, never latest", () => {
    assert.equal(resolveJibrilVersion("", "3d47f4a9004f7356c980a0e8d420ef5984750e3c"), PINNED_DEFAULT)
})

test("empty input on branch and unknown refs resolves the pinned default, never latest", () => {
    assert.equal(resolveJibrilVersion("", "main"), PINNED_DEFAULT)
    assert.equal(resolveJibrilVersion("", "refs/heads/main"), PINNED_DEFAULT)
    assert.equal(resolveJibrilVersion("", ""), PINNED_DEFAULT)
    assert.equal(resolveJibrilVersion("", "v3"), PINNED_DEFAULT)
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
