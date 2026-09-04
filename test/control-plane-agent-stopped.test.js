import assert from "node:assert/strict"
import { createServer } from "node:http"
import { test } from "node:test"
import { ControlPlaneClient } from "../src/control-plane/client.js"

/**
 * @typedef {object} TestServer
 * @property {string} baseURL
 * @property {() => Promise<void>} close
 */

/**
 * @param {import("node:http").RequestListener} handler
 * @returns {Promise<TestServer>}
 */
async function startServer(handler) {
    const server = createServer(handler)

    await new Promise((resolve, reject) => {
        server.once("error", reject)
        server.listen(0, "127.0.0.1", resolve)
    })

    const address = server.address()
    if (address === null || typeof address === "string") {
        throw new Error("failed to resolve test server address")
    }

    return {
        baseURL: `http://127.0.0.1:${address.port}`,
        close: () => new Promise(resolve => server.close(() => resolve())),
    }
}

/**
 * @param {(req: import("node:http").IncomingMessage, body: string) => void} onRequest
 * @returns {Promise<TestServer>}
 */
function startJsonServer(onRequest) {
    return startServer((req, res) => {
        let body = ""
        req.setEncoding("utf8")
        req.on("data", chunk => {
            body += chunk
        })
        req.on("end", () => {
            onRequest(req, body)
            res.statusCode = 202
            res.setHeader("content-type", "application/json")
            res.end("{}")
        })
    })
}

/**
 * @param {() => void} onRequest
 * @returns {Promise<TestServer>}
 */
function startErrorServer(onRequest) {
    return startServer((_, res) => {
        onRequest()
        res.statusCode = 500
        res.setHeader("content-type", "application/json")
        res.end('{"error":"boom"}')
    })
}

/**
 * @typedef {object} CapturedRequest
 * @property {string} method
 * @property {string} url
 * @property {import("node:http").IncomingHttpHeaders} headers
 * @property {unknown} body
 */

/**
 * @returns {import("../src/control-plane/types.js").AgentStoppedRequest}
 */
function getReport() {
    return {
        reason: "flush_timeout",
        profile_state: "missing",
        detail: "stop timed out after 1830s; unit SIGKILLed; profile file missing",
        run_id: "123456",
        run_attempt: "1",
        job: "smoke-c",
        job_status: "cancelled",
        job_status_source: "github_api",
        jibril: {
            active_state: "failed",
            result: "signal",
            exec_main_status: 9,
            stop_outcome: "timed_out",
            force_stopped: true,
        },
    }
}

test("reportAgentStopped sends expected payload and uses agent-token auth precedence", async () => {
    /** @type {CapturedRequest | null} */
    let captured = null

    const server = await startJsonServer((req, body) => {
        captured = {
            method: req.method ?? "",
            url: req.url ?? "",
            headers: req.headers,
            body: JSON.parse(body),
        }
    })

    try {
        const client = new ControlPlaneClient({
            baseURL: server.baseURL,
            agentToken: "agent-token-1",
            workflowToken: "workflow-token-1",
            projectToken: "project-token-1",
        })

        await client.reportAgentStopped(getReport())

        assert.ok(captured !== null)
        assert.equal(captured.method, "POST")
        assert.equal(captured.url, "/api/v1/agent/stopped")
        assert.equal(captured.headers["x-agent-token"], "agent-token-1")
        assert.equal(captured.headers["x-workflow-token"], undefined)
        assert.equal(captured.headers["x-project-token"], undefined)
        assert.deepEqual(captured.body, getReport())
    } finally {
        await server.close()
    }
})

test("reportAgentStopped does not retry on 5xx", async () => {
    let requestCount = 0
    const server = await startErrorServer(() => {
        requestCount += 1
    })

    try {
        const client = new ControlPlaneClient({
            baseURL: server.baseURL,
            agentToken: "agent-token-1",
        })

        await assert.rejects(client.reportAgentStopped(getReport()), /HTTP 500/)
        assert.equal(requestCount, 1)
    } finally {
        await server.close()
    }
})

test("reportAgentStopped does not retry on network failure", async t => {
    const originalFetch = globalThis.fetch
    let fetchCount = 0

    globalThis.fetch = async () => {
        fetchCount += 1
        throw new Error("network down")
    }

    t.after(() => {
        globalThis.fetch = originalFetch
    })

    const client = new ControlPlaneClient({
        baseURL: "http://127.0.0.1:1",
        agentToken: "agent-token-1",
    })

    await assert.rejects(client.reportAgentStopped(getReport()), /network error/i)
    assert.equal(fetchCount, 1)
})

test("reportAgentStopped schema validation rejects invalid payload", async () => {
    const client = new ControlPlaneClient({
        baseURL: "http://127.0.0.1:1",
        agentToken: "agent-token-1",
    })

    await assert.rejects(
        client.reportAgentStopped({
            reason: "unknown_reason",
            profile_state: "missing",
            run_id: "123",
        }),
    )
})
