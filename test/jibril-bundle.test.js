/**
 * Gates for the v2.17.0+ release bundle: the tarball is only trusted when every
 * payload, its checksums, the release manifest, and each detached Sigstore
 * bundle agree, and the manifest names the tag we asked for.
 */
import assert from "node:assert/strict"
import { test } from "node:test"
import { createHash } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { verifyJibrilBundle } from "../src/action.js"

const BINARY = "jibril"
const CHECKSUMS = "jibril-checksums.txt"
const MANIFEST = "release.json"
const TAG = "v2.17.0"

/**
 * @param {string} content
 * @returns {string}
 */
function sha256(content) {
    return createHash("sha256").update(content).digest("hex")
}

/**
 * The shape the release publishes: a cosign blob signature whose messageDigest
 * is the base64 sha256 of the payload.
 * @param {string} content
 * @returns {string}
 */
function sigstoreBundleFor(content) {
    return JSON.stringify({
        mediaType: "application/vnd.dev.sigstore.bundle.v0.3+json",
        messageSignature: {
            messageDigest: {
                algorithm: "SHA2_256",
                digest: createHash("sha256").update(content).digest("base64"),
            },
            signature: "MEQCIG1Ivxu2tzIuEGRYqidZcio2GqbcsLHpKdph4Y1a155d",
        },
    })
}

/**
 * @param {string} binaryContent
 * @param {string} tag
 * @returns {Promise<string>}
 */
async function writeConsistentBundle(binaryContent, tag = TAG) {
    const bundleDir = await mkdtemp(join(tmpdir(), "jibril-bundle-"))
    const checksums = `${sha256(binaryContent)}  ${BINARY}\n`
    const manifest = JSON.stringify({
        schemaVersion: 1,
        release: { tag, source_sha: "c0336ead1882f2f7d5d603b78fe7e2fdab58e679", platforms: ["linux-x86_64"] },
        subjects: [
            { name: BINARY, sha256: sha256(binaryContent) },
            { name: CHECKSUMS, sha256: sha256(checksums) },
        ],
    })

    const payloads = [
        [BINARY, binaryContent],
        [CHECKSUMS, checksums],
        [MANIFEST, manifest],
    ]
    for (const [name, content] of payloads) {
        await writeFile(join(bundleDir, String(name)), String(content))
        await writeFile(join(bundleDir, `${name}.sigstore.json`), sigstoreBundleFor(String(content)))
    }

    return bundleDir
}

test("a consistent bundle verifies", async function (t) {
    const bundleDir = await writeConsistentBundle("jibril-binary-bytes")
    t.after(() => rm(bundleDir, { recursive: true, force: true }))

    await verifyJibrilBundle(bundleDir, TAG)
})

test("a swapped binary is rejected", async function (t) {
    const bundleDir = await writeConsistentBundle("jibril-binary-bytes")
    t.after(() => rm(bundleDir, { recursive: true, force: true }))
    await writeFile(join(bundleDir, BINARY), "malicious-bytes")

    await assert.rejects(verifyJibrilBundle(bundleDir, TAG), /sha256 mismatch for jibril/)
})

test("a swapped binary with a matching re-signed checksums file is still rejected", async function (t) {
    const bundleDir = await writeConsistentBundle("jibril-binary-bytes")
    t.after(() => rm(bundleDir, { recursive: true, force: true }))

    // The signed digests still pin the original bytes.
    const checksums = `${sha256("malicious-bytes")}  ${BINARY}\n`
    await writeFile(join(bundleDir, BINARY), "malicious-bytes")
    await writeFile(join(bundleDir, CHECKSUMS), checksums)

    await assert.rejects(verifyJibrilBundle(bundleDir, TAG), /sha256 mismatch for jibril/)
})

test("a bundle published for another tag is rejected", async function (t) {
    const bundleDir = await writeConsistentBundle("jibril-binary-bytes", "v2.17.1")
    t.after(() => rm(bundleDir, { recursive: true, force: true }))

    await assert.rejects(verifyJibrilBundle(bundleDir, TAG), /is for v2\.17\.1, expected v2\.17\.0/)
})

test("a missing payload or signature is rejected", async function (t) {
    const bundleDir = await writeConsistentBundle("jibril-binary-bytes")
    t.after(() => rm(bundleDir, { recursive: true, force: true }))
    await rm(join(bundleDir, `${BINARY}.sigstore.json`))

    await assert.rejects(verifyJibrilBundle(bundleDir, TAG), /missing jibril\.sigstore\.json/)
})

test("a malformed Sigstore bundle is rejected", async function (t) {
    const bundleDir = await writeConsistentBundle("jibril-binary-bytes")
    t.after(() => rm(bundleDir, { recursive: true, force: true }))
    await writeFile(join(bundleDir, `${BINARY}.sigstore.json`), "not json")

    await assert.rejects(verifyJibrilBundle(bundleDir, TAG), /Invalid Sigstore bundle/)
})

test("a malformed release manifest is rejected", async function (t) {
    const bundleDir = await writeConsistentBundle("jibril-binary-bytes")
    t.after(() => rm(bundleDir, { recursive: true, force: true }))
    const manifest = JSON.stringify({ schemaVersion: 1, subjects: [] })
    await writeFile(join(bundleDir, MANIFEST), manifest)
    await writeFile(join(bundleDir, `${MANIFEST}.sigstore.json`), sigstoreBundleFor(manifest))

    await assert.rejects(verifyJibrilBundle(bundleDir, TAG), /Invalid release\.json/)
})
