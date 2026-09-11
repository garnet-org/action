import assert from "node:assert/strict"
import { test } from "node:test"
import { garnetStatusFromProfileState } from "../src/post-profile-state.js"

test("garnetStatusFromProfileState: present maps to recorded", () => {
    assert.equal(garnetStatusFromProfileState("present"), "recorded")
})

test("garnetStatusFromProfileState: missing maps to no_profile", () => {
    assert.equal(garnetStatusFromProfileState("missing"), "no_profile")
})

test("garnetStatusFromProfileState: empty maps to no_profile", () => {
    assert.equal(garnetStatusFromProfileState("empty"), "no_profile")
})

test("garnetStatusFromProfileState: invalid maps to no_profile", () => {
    assert.equal(garnetStatusFromProfileState("invalid"), "no_profile")
})
