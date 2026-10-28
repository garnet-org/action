import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import { CONTRACT_VOCAB } from "../src/runtime-review-vocab.js"

// Wording gate: every Action surface that prints comment-shaped text is held
// to the comment-final vocabulary (testbed contract, ledger rows 16-25).
// Hidden machine markers (`<!-- garnet:… -->`) are not reader-facing text.

const GOLDENS = "test/fixtures/renderer-testdata/goldens"
const MOCKUPS = "test/fixtures/mockups"

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
const BANNED_IN_PR_COMMENT = ["Execution Profile"]
const OUTCOME_WORDS = /\b(detected|verified|caught|safe|risky|malicious)\b/i
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{231A}-\u{23FF}]/u

const REQUIRED_IN_VOCAB = [
  "Runtime behavior changed",
  "No runtime changes",
  "Runtime behavior recorded",
  "Recording runtime behavior",
  "Runtime behavior not recorded",
  "Job log",
  "Full record in Garnet ↗",
  "Capture is best-effort.",
  "Cloud IMDS",
  "Runtime behavior, recorded by Garnet.",
  "Add it to your CI ↗",
]

const visibleText = (markdown) => markdown.replace(/<!--[\s\S]*?-->/g, "")

/** @param {string} dir */
const markdownFiles = (dir) =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".md"))
    .map((name) => join(dir, name))

const renderedSurfaces = [...markdownFiles(GOLDENS), ...markdownFiles(MOCKUPS)]
const prCommentSurfaces = [
  ...markdownFiles(GOLDENS).filter((file) => file.endsWith(".pr-comment.md")),
  ...readdirSync(MOCKUPS)
    .filter((name) => name.endsWith(".md"))
    .map((name) => join(MOCKUPS, name)),
]

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

test("wording gate: rendered goldens and mockups carry no superseded wording", () => {
  assert.ok(renderedSurfaces.length > 0)
  for (const file of renderedSurfaces) {
    const text = visibleText(readFileSync(file, "utf8"))
    assertNoneOf(file, text, BANNED_RENDERED)
    const outcome = text.match(OUTCOME_WORDS)
    assert.equal(outcome, null, `${file}: outcome word ${JSON.stringify(outcome?.[0])}`)
  }
})

test("wording gate: PR-comment surfaces never name the Execution Profile", () => {
  assert.ok(prCommentSurfaces.length > 0)
  for (const file of prCommentSurfaces) {
    assertNoneOf(file, visibleText(readFileSync(file, "utf8")), BANNED_IN_PR_COMMENT)
  }
})

test("wording gate: vendored copy carries the comment-final strings and no superseded ones", () => {
  const copy = JSON.stringify({ copy: CONTRACT_VOCAB.copy, notes: CONTRACT_VOCAB.notes })
  for (const phrase of REQUIRED_IN_VOCAB) {
    assert.ok(copy.includes(phrase), `vocab: missing ${JSON.stringify(phrase)}`)
  }
  assertNoneOf("vocab", copy, BANNED_RENDERED)
})

test("wording gate: README, action.yaml and agent rules carry no superseded wording", () => {
  for (const file of ["README.md", "action.yaml", "AGENTS.md", ".cursor/BUGBOT.md"]) {
    assertNoneOf(file, readFileSync(file, "utf8"), BANNED_EVERYWHERE)
  }
})
