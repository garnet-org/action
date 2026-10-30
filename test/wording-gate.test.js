import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import { CONTRACT_VOCAB } from "../src/runtime-review-vocab.js"

// Wording gate: the Step Summary (the only surface the Action renders), the
// vendored copy behind it, and the repo's user-facing and agent docs are held
// to the current vocabulary from runtime-review-testbed `main`. Hidden machine
// markers (`<!-- … -->`) are not reader-facing text.

const GOLDENS = "test/fixtures/renderer-testdata/goldens"
const COMMENT_FINAL = "test/fixtures/comment-final"
const COMMENT_FINAL_STATES = 8

const BANNED_EVERYWHERE = [
  "Execution Profiles",
  "First record",
  "About this record",
  "No runtime record",
  "Nothing new at runtime",
  "Add to your repo",
  "Garnet makes execution reviewable",
  "(dns resolver)",
  "(cloud metadata)",
  "Run Profile",
  "Runtime Diff",
]
const BANNED_RENDERED = [...BANNED_EVERYWHERE, "unchanged"]
// The App's comment reference keeps one destination-level form under a job's
// tree ("8 other destinations unchanged"); job-level "unchanged" is gone.
const DESTINATION_LEVEL_UNCHANGED = /destinations? unchanged/g
const OUTCOME_WORDS = /\b(detected|verified|caught|safe|risky|malicious)\b/i
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{231A}-\u{23FF}]/u

const REQUIRED_IN_VOCAB = ["Capture is best-effort.", "Cloud IMDS", "github infra", "View this job's Execution Profile in Garnet →"]

const visibleText = (markdown) =>
  markdown.replace(/<!--[\s\S]*?-->/g, "").replace(DESTINATION_LEVEL_UNCHANGED, "")

const stepSummaryGoldens = readdirSync(GOLDENS)
  .filter((name) => name.endsWith(".md"))
  .map((name) => join(GOLDENS, name))
const referenceStates = readdirSync(COMMENT_FINAL)
  .filter((name) => /^0\d-.+\.md$/.test(name))
  .map((name) => join(COMMENT_FINAL, name))

/**
 * @param {string} label
 * @param {string} text
 * @param {string[]} banned
 */
function assertNoneOf(label, text, banned) {
  for (const phrase of banned) {
    assert.ok(!text.includes(phrase), `${label}: superseded wording ${JSON.stringify(phrase)}`)
  }
  assert.ok(!EMOJI.test(text), `${label}: emoji ${JSON.stringify(text.match(EMOJI)?.[0])}`)
}

test("wording gate: Step Summary goldens carry no superseded wording", () => {
  assert.ok(stepSummaryGoldens.length > 0)
  for (const file of stepSummaryGoldens) {
    const text = visibleText(readFileSync(file, "utf8"))
    assertNoneOf(file, text, BANNED_RENDERED)
    const outcome = text.match(OUTCOME_WORDS)
    assert.equal(outcome, null, `${file}: outcome word ${JSON.stringify(outcome?.[0])}`)
  }
})

test("wording gate: vendored copy carries the Step Summary strings and no superseded ones", () => {
  const copy = JSON.stringify({ copy: CONTRACT_VOCAB.copy, notes: CONTRACT_VOCAB.notes })
  for (const phrase of REQUIRED_IN_VOCAB) {
    assert.ok(copy.includes(phrase), `vocab: missing ${JSON.stringify(phrase)}`)
  }
  assertNoneOf("vocab", copy, BANNED_RENDERED)
})

test("wording gate: README, action.yaml and agent rules carry no superseded wording", () => {
  for (const file of ["README.md", "action.yaml", "AGENTS.md", ".cursor/BUGBOT.md", "src/job-summary.js", "src/start-failure.js"]) {
    assertNoneOf(file, readFileSync(file, "utf8"), BANNED_EVERYWHERE)
  }
})

test("wording gate: the vendored comment-final reference states carry the heading family and shared lines", () => {
  assert.equal(referenceStates.length, COMMENT_FINAL_STATES)
  const headings = new Set(
    referenceStates.map((file) => readFileSync(file, "utf8").match(/^### (.+)$/m)?.[1] ?? ""),
  )
  assert.deepEqual(
    [...headings].sort(),
    [
      "No runtime changes",
      "Recording runtime behavior",
      "Runtime behavior changed",
      "Runtime behavior not recorded",
      "Runtime behavior recorded",
    ],
  )
  for (const file of referenceStates) {
    const text = readFileSync(file, "utf8")
    assertNoneOf(file, visibleText(text), BANNED_RENDERED)
    for (const phrase of ["Capture is best-effort.", "Runtime behavior, recorded by Garnet.", "Add it to your CI ↗"]) {
      assert.ok(text.includes(phrase), `${file}: missing ${JSON.stringify(phrase)}`)
    }
  }
})
