import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import * as fs from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { test } from "node:test"
import { findChecksum, verifyChecksum } from "../src/action.js"

/**
 * @param {string} contents
 * @returns {Promise<string>}
 */
async function writeTempFile(contents) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "garnet-test-"))
    const filePath = path.join(dir, "jibril")
    await fs.writeFile(filePath, contents)
    return filePath
}

/**
 * @param {string} contents
 * @returns {string}
 */
function sha256(contents) {
    return createHash("sha256").update(contents).digest("hex")
}

test("findChecksum reads the digest for a named artifact", () => {
    const digest = "a".repeat(64)
    const checksums = [`${digest}  jibril`, `${"b".repeat(64)}  jibril.sig`, "not a checksum line"].join("\n")

    assert.equal(findChecksum(checksums, "jibril"), digest)
    assert.equal(findChecksum(checksums, "jibril.sig"), "b".repeat(64))
    assert.equal(findChecksum(checksums, "loader"), null)
})

test("findChecksum ignores malformed and truncated entries", () => {
    const checksums = ["deadbeef  jibril", `${"c".repeat(64)}`, `${"c".repeat(64)} `].join("\n")

    assert.equal(findChecksum(checksums, "jibril"), null)
})

test("a matching checksum verifies the downloaded binary", async () => {
    const filePath = await writeTempFile("sensor")
    const checksums = `${sha256("sensor")}  jibril\n`

    assert.equal(await verifyChecksum(filePath, checksums, "jibril"), sha256("sensor"))
})

test("a tampered binary fails checksum verification", async () => {
    const filePath = await writeTempFile("tampered")
    const checksums = `${sha256("sensor")}  jibril\n`

    await assert.rejects(() => verifyChecksum(filePath, checksums, "jibril"), /checksum mismatch/)
})

test("a checksum list without an entry for the binary fails verification", async () => {
    const filePath = await writeTempFile("sensor")
    const checksums = `${sha256("sensor")}  loader\n`

    await assert.rejects(() => verifyChecksum(filePath, checksums, "jibril"), /no entry for this artifact/)
})
