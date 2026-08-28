import assert from "node:assert/strict"
import { test } from "node:test"
import { assertDownloadableJibrilVersion, isValidJibrilVersion, resolveJibrilVersion } from "../src/action.js"

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

test("valid versions are 'latest' and semantic release tags", () => {
    for (const version of ["latest", "v2.16.0", "2.16.0", "v2.16.0-rc.1", "v10.0.0-alpha.2"]) {
        assert.equal(isValidJibrilVersion(version), true, version)
    }
})

test("jibril_version inputs that could escape the release path are rejected", () => {
    const rejected = [
        "../../../../etc/passwd",
        "v2.16.0/../../../../evil",
        "latest/../v0.0",
        "v2.16.0%2f..%2fevil",
        "https://evil.example.com/jibril",
        "v2.16.0?x=1",
        "v2.16.0#frag",
        "v2.16.0 ; rm -rf /",
        "main",
        "",
    ]

    for (const version of rejected) {
        assert.equal(isValidJibrilVersion(version), false, version)
        if (version !== "") {
            assert.throws(() => resolveJibrilVersion(version, "v2"), /Invalid 'jibril_version' input/, version)
        }
    }
})

test("the download guard accepts this action's own legacy pins", () => {
    for (const version of ["v0.0", "v2.10.4", PINNED_DEFAULT, "latest"]) {
        assert.doesNotThrow(() => assertDownloadableJibrilVersion(version))
    }

    assert.throws(() => assertDownloadableJibrilVersion("../evil"), /Refusing to download jibril/)
})
