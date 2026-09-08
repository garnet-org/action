import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { classifyProfileContent } from "../src/post-profile-state.js"

test("classifyProfileContent: missing file", () => {
    const result = classifyProfileContent({ exists: false, size: 0 }, "")
    assert.equal(result.state, "missing")
    assert.equal(result.profile, null)
})

test("classifyProfileContent: empty file", () => {
    const result = classifyProfileContent({ exists: true, size: 10 }, "   \n\t ")
    assert.equal(result.state, "empty")
    assert.equal(result.profile, null)
})

test("classifyProfileContent: invalid profile content", () => {
    const result = classifyProfileContent({ exists: true, size: 10 }, "{not-json")
    assert.equal(result.state, "invalid")
    assert.equal(result.profile, null)
    assert.notEqual(result.detail, "")
})

test("classifyProfileContent: present valid profile", async () => {
    const fixtureURL = new URL("./fixtures/profiles/sample-profile.json", import.meta.url)
    const content = await readFile(fixtureURL, "utf8")
    const result = classifyProfileContent({ exists: true, size: content.length }, content)

    assert.equal(result.state, "present")
    assert.notEqual(result.profile, null)
    assert.equal(result.detail, "")
})
