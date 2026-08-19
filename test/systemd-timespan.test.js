import assert from "node:assert/strict"
import { test } from "node:test"
import { parseSystemdTimespanSeconds } from "../src/systemd-timespan.js"

test("parses plain seconds", () => {
    assert.equal(parseSystemdTimespanSeconds("45s"), 45)
})

test("parses minutes", () => {
    assert.equal(parseSystemdTimespanSeconds("10min"), 600)
})

test("parses compound spans", () => {
    assert.equal(parseSystemdTimespanSeconds("1min 30s"), 90)
})

test("parses hours", () => {
    assert.equal(parseSystemdTimespanSeconds("1h"), 3600)
})

test("bare numbers are seconds", () => {
    assert.equal(parseSystemdTimespanSeconds("600"), 600)
})

test("sub-second spans round up", () => {
    assert.equal(parseSystemdTimespanSeconds("500ms"), 1)
})

test("infinity returns null", () => {
    assert.equal(parseSystemdTimespanSeconds("infinity"), null)
})

test("empty returns null", () => {
    assert.equal(parseSystemdTimespanSeconds(""), null)
})

test("garbage returns null", () => {
    assert.equal(parseSystemdTimespanSeconds("not-a-span"), null)
})

test("unknown units return null", () => {
    assert.equal(parseSystemdTimespanSeconds("5 parsecs"), null)
})

test("zero returns null", () => {
    assert.equal(parseSystemdTimespanSeconds("0"), null)
})
