import assert from "node:assert/strict"
import test from "node:test"

import { assertValidNetworkPolicyYAML, validateNetworkPolicyYAML } from "../src/netpolicy.js"

const VALID_POLICY = `network_policy:
  policy: allow
  mode: monitor
  allow:
    - example.com
    - registry.npmjs.org
  deny:
    - evil.example.com
  rules:
    - policy: deny
      resolve: github.com
`

test("a well-formed merged policy is accepted", () => {
    assert.deepEqual(validateNetworkPolicyYAML(VALID_POLICY), { valid: true, error: "" })
    assert.deepEqual(validateNetworkPolicyYAML(`---\n${VALID_POLICY}`), { valid: true, error: "" })
    assert.doesNotThrow(() => assertValidNetworkPolicyYAML(VALID_POLICY))
})

test("an empty or oversized response is rejected", () => {
    assert.equal(validateNetworkPolicyYAML("").valid, false)
    assert.equal(validateNetworkPolicyYAML("   \n\n").valid, false)
    assert.equal(validateNetworkPolicyYAML(`network_policy:\n  allow:\n${"    - a.example.com\n".repeat(60000)}`).valid, false)
})

test("a response without the network_policy section is rejected", () => {
    assert.equal(validateNetworkPolicyYAML("policy: allow\n").valid, false)
    assert.equal(validateNetworkPolicyYAML("<html><body>gateway error</body></html>\n").valid, false)
    assert.equal(validateNetworkPolicyYAML('{"error":"unauthorized"}\n').valid, false)
})

test("unexpected policy values and YAML machinery are rejected", () => {
    assert.equal(validateNetworkPolicyYAML("network_policy:\n  policy: sudo rm -rf /\n").valid, false)
    assert.equal(validateNetworkPolicyYAML("network_policy:\n  mode: monitor; rm -rf /\n").valid, false)
    assert.equal(validateNetworkPolicyYAML("network_policy: &anchor\n  policy: allow\n").valid, false)
    assert.equal(validateNetworkPolicyYAML("network_policy: !!python/object/apply:os.system\n").valid, false)
    assert.equal(validateNetworkPolicyYAML(`${VALID_POLICY}---\nnetwork_policy:\n  policy: deny\n`).valid, false)
    assert.equal(validateNetworkPolicyYAML("network_policy:\n\tpolicy: allow\n").valid, false)
    assert.equal(validateNetworkPolicyYAML("network_policy:\n  policy: allow\n\u0000evil\n").valid, false)
})

test("a malformed policy throws with a clear, actionable message", () => {
    assert.throws(
        () => assertValidNetworkPolicyYAML("<html>502</html>"),
        /Refusing to install a malformed network policy/,
    )
})
