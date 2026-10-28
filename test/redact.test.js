import assert from "node:assert/strict"
import test from "node:test"
import { redactBase, redactProfile, redactString } from "../src/redact.js"

test("redactString: masks environment variable assignments, flags, headers, and token formats idempotently", () => {
    /** @type {[string, string][]} */
    const cases = [
        ["", ""],
        ["echo hello world", "echo hello world"],
        [
            "GITHUB_TOKEN=abc MY_SECRET=\"two words\" DB_PASSWORD='p' SSH_KEY=k PATH=/usr/bin",
            "GITHUB_TOKEN=*** MY_SECRET=*** DB_PASSWORD=*** SSH_KEY=*** PATH=/usr/bin",
        ],
        [
            "cli --token xyz --password \"sec ret\" --api-key 'k' --access-key=bare",
            "cli --token *** --password \"***\" --api-key '***' --access-key=***",
        ],
        [
            "cli --token dGVzdA== --api-key foo=bar",
            "cli --token *** --api-key ***",
        ],
        [
            "cli --token $GITHUB_TOKEN --auth GITHUB_TOKEN=abc",
            "cli --token $GITHUB_TOKEN --auth GITHUB_TOKEN=***",
        ],
        [
            "curl -H 'Authorization: Bearer secret-jwt-value'",
            "curl -H 'Authorization: Bearer ***'",
        ],
        [
            '{"api_key": "secret-val", "refresh_token": "rt_123", "password": "pw", "client_secret": "cs"}',
            '{"api_key": "***", "refresh_token": "***", "password": "***", "client_secret": "***"}',
        ],
        [
            "X-API-Token: my-raw-token\npassword: my-yaml-password\nclient_secret: 'my-secret'",
            "X-API-Token: ***\npassword: ***\nclient_secret: '***'",
        ],
        [
            `token=ghs_${"a".repeat(36)} pat=ghp_${"B".repeat(36)} fine=github_pat_${"c".repeat(22)}`,
            "token=*** pat=*** fine=***",
        ],
        [
            `npm=npm_${"1".repeat(36)} aws=AKIA${"A".repeat(16)} slack=xoxb-1234567890-abcdef`,
            "npm=*** aws=*** slack=***",
        ],
        [
            `gcp=AIza${"x".repeat(35)} stripe=sk_live_1234567890ab jwt=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJl`,
            "gcp=*** stripe=*** jwt=***",
        ],
        [
            "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA\n-----END RSA PRIVATE KEY-----",
            "***",
        ],
    ]

    for (const [input, expected] of cases) {
        const once = redactString(input)
        assert.equal(once, expected)
        assert.equal(redactString(once), expected)
    }
})

test("redactBase: redacts background ancestry and containers without mutating the input", () => {
    const original = {
        background: {
            ancestry: [
                {
                    cmd: "curl --token secret1",
                    args: "--password=secret2",
                    envs: "GITHUB_TOKEN=secret3",
                    prev_args: "--api-key secret4",
                    prev_envs: "AWS_SECRET_KEY=secret5",
                },
            ],
            containers: {
                containers: [
                    {
                        cmd: ["node", "--auth-token=secret6"],
                        env: ["NPM_TOKEN=secret7", "NODE_ENV=production"],
                    },
                ],
            },
        },
    }

    const redacted = redactBase(original)

    assert.equal(original.background.ancestry[0]?.envs, "GITHUB_TOKEN=secret3")
    assert.deepEqual(redacted, {
        background: {
            ancestry: [
                {
                    cmd: "curl --token ***",
                    args: "--password=***",
                    envs: "GITHUB_TOKEN=***",
                    prev_args: "--api-key ***",
                    prev_envs: "AWS_SECRET_KEY=***",
                },
            ],
            containers: {
                containers: [
                    {
                        cmd: ["node", "--auth-token=***"],
                        env: ["NPM_TOKEN=***", "NODE_ENV=production"],
                    },
                ],
            },
        },
    })
})

test("redactProfile: redacts background, network directions, assertions, and profile detections without mutating input", () => {
    const original = {
        background: {
            ancestry: [{ cmd: "run", args: "--token tok1", envs: "API_KEY=key1", prev_args: "", prev_envs: "" }],
        },
        network: {
            egress: {
                peers: [{ proc_trees: [{ arguments: "curl -H 'Authorization: Bearer tok2' https://example.com" }] }],
            },
            ingress: {
                peers: [{ proc_trees: [{ arguments: "server --password=tok3" }] }],
            },
            local: {
                peers: [{ proc_trees: [{ arguments: "cli --secret tok4" }] }],
            },
        },
        assertions: [
            {
                id: "egress",
                evidence: [
                    {
                        peer: {
                            proc_trees: [{ arguments: "npm publish --token npm_" + "a".repeat(36) }],
                        },
                    },
                ],
            },
        ],
        profile_detections: [
            {
                digested_detections: [
                    {
                        proc_trees: [{ arguments: "deploy PRIVATE_KEY=tok5" }],
                    },
                ],
            },
        ],
    }

    const redacted = redactProfile(original)

    assert.equal(
        original.network.egress.peers[0]?.proc_trees[0]?.arguments,
        "curl -H 'Authorization: Bearer tok2' https://example.com",
    )
    assert.equal(
        redacted.network.egress.peers[0]?.proc_trees[0]?.arguments,
        "curl -H 'Authorization: Bearer ***' https://example.com",
    )
    assert.equal(redacted.network.ingress.peers[0]?.proc_trees[0]?.arguments, "server --password=***")
    assert.equal(redacted.network.local.peers[0]?.proc_trees[0]?.arguments, "cli --secret ***")
    assert.equal(redacted.background.ancestry[0]?.args, "--token ***")
    assert.equal(redacted.background.ancestry[0]?.envs, "API_KEY=***")
    assert.equal(
        redacted.assertions[0]?.evidence[0]?.peer.proc_trees[0]?.arguments,
        "npm publish --token ***",
    )
    assert.equal(
        redacted.profile_detections[0]?.digested_detections[0]?.proc_trees[0]?.arguments,
        "deploy PRIVATE_KEY=***",
    )
})
