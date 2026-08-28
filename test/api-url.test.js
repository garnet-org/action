import assert from "node:assert/strict"
import test from "node:test"

import { assertSecureApiURL } from "../src/shared.js"

test("https control planes are accepted", () => {
    assert.doesNotThrow(() => assertSecureApiURL("https://api.garnet.ai"))
    assert.doesNotThrow(() => assertSecureApiURL("https://dev-api.garnet.ai/v1"))
})

test("plaintext http is accepted only on the loopback host", () => {
    assert.doesNotThrow(() => assertSecureApiURL("http://localhost:8080"))
    assert.doesNotThrow(() => assertSecureApiURL("http://127.0.0.1:8080"))
    assert.doesNotThrow(() => assertSecureApiURL("http://[::1]:8080"))
})

test("a plaintext or non-http control plane fails before any token is sent", () => {
    for (const value of [
        "http://api.garnet.ai",
        "http://169.254.169.254",
        "http://localhost.evil.example.com",
        "ftp://api.garnet.ai",
        "file:///etc/passwd",
        "api.garnet.ai",
        "",
    ]) {
        assert.throws(() => assertSecureApiURL(value), /api_url/, value)
    }
})
