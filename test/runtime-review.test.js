#!/usr/bin/env node
/**
 * Contract tests for the Garnet execution-comment renderer — v6.9.0.
 *
 * Locks destination-association preservation, destination-first projection, qualified
 * structural/sensor counts, attributed typography, factual detections,
 * lifecycle copy, escaping, medium truncation, selector/publication policy,
 * Gate T, byte-determinism, and copy lint over every emitted surface/golden.
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import {
  CONTRACT_VOCAB,
  RUNTIME_REVIEW_MARKER,
  COMMENT_MARKER,
  REFERENCE_MOCKUP_MARKER,
  VOCAB,
  SIZE_BUDGET,
  STEP_SUMMARY_BUDGET,
  summarizeProfile,
  renderJobTree,
  isSentinelStep,
  compareJobEdges,
  buildRunReview,
  renderRunReview,
  renderPendingReview,
  renderReferenceMockup,
  renderStepSummary,
  truncateMiddle,
  lintRenderedSurface,
  exportReviewModel,
  formatTimestamp,
  isAddressLike,
  edgeNotes,
  edgeCounts,
  telemetryDiscrepancies,
  buildDestinationRows,
  buildLineageRows,
  hasRecordedDetection,
  isGithubInfraName,
  profilePermalink,
  publicationDecision,
  defangHostname,
  commentEdges,
  addressNameMap,
  destinationIdentity,
  displayProcessName,
} from "../src/runtime-review.js"
import {
  loadProfile,
  renderFromProfiles,
  renderNoRecord,
  renderPublicRunProfileMockup,
} from "./render-states-real.mjs"
import { renderCombined } from "./render-combined-real.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const realEnvelopes = JSON.parse(
  readFileSync(join(here, "fixtures", "renderer-testdata", "real", "profile-envelopes.json"), "utf8"),
)

let passed = 0
let failed = 0
async function test(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`  ok  ${name}`)
  } catch (err) {
    failed += 1
    console.error(`FAIL  ${name}\n      ${err.message}`)
  }
}

const load = (dir, name) => {
  const data = JSON.parse(readFileSync(join(here, "fixtures", "renderer-testdata", dir, name), "utf8"))
  const envelope = dir === "real" ? realEnvelopes[name] : null
  return envelope?.id ? { id: envelope.id, data } : data
}
const rawProfile = (profile) => profile?.data || profile

const REPO = "garnet-org/runtime-review-testbed"
const APP_URL = "https://app.garnet.ai"

function reviewFor(profiles, opts = {}) {
  const jobs = profiles.map(summarizeProfile).filter(Boolean)
  const sha = jobs[0]?.sha || ""
  return buildRunReview({
    repo: REPO,
    sha,
    commitUrl: sha ? `https://github.com/${REPO}/commit/${sha}` : "",
    appUrl: APP_URL,
    appMode: opts.appMode !== false,
    jobs,
  })
}

const workload = load("real", "record-workload-egress.json")
const worth = load("real", "worth-a-look-run.json")
const recordSet = [
  "record-workload-egress.json",
  "record-docs-build.json",
  "record-install-only.json",
  "record-lint.json",
  "record-typecheck.json",
].map((f) => load("real", f))
const edgeCases = load("synthetic", "edge-cases.json")
const injection = load("synthetic", "injection.json")
const credential = load("synthetic", "credential-argv.json")
const duplicateEdges = load("synthetic", "duplicate-edges.json")
const edgeCaseEnvelope = {
  id: "019f5e00-0000-7000-8000-000000000001",
  data: edgeCases,
}

const EDGE_REVIEW = reviewFor([edgeCaseEnvelope])
const EDGE_MD = renderRunReview(EDGE_REVIEW)
const EDGE_SUMMARY = renderStepSummary([edgeCaseEnvelope], { appUrl: APP_URL })
const EDGE_SUMMARY_PREVIEW = renderStepSummary([edgeCaseEnvelope], {
  appUrl: APP_URL,
  preview: true,
})
const REAL_SUMMARY = renderStepSummary(recordSet, { appUrl: APP_URL, preview: true })
const EDGE_MODEL = exportReviewModel(EDGE_REVIEW)

// ---------------------------------------------------------------------------
// Contract lock
// ---------------------------------------------------------------------------

await test("contract: vocab.json is the v6.10.0 machine-readable lock", () => {
  assert.equal(CONTRACT_VOCAB.version, "6.10.0")
  assert.equal(CONTRACT_VOCAB.copy.runnerBackground, "runner background")
  assert.equal(
    CONTRACT_VOCAB.copy.explainerBackgroundSegment,
    "runner background = the runner's infrastructure, not your workflow",
  )
  assert.equal(VOCAB.terminalNetwork, "○")
  assert.equal(CONTRACT_VOCAB.copy.terminalFile, "□")
  assert.equal(CONTRACT_VOCAB.copy.terminalExecution, "▷")
  assert.equal(VOCAB.noChange, "unchanged")
  assert.equal(CONTRACT_VOCAB.profileFormatVersion, "0.2.0")
  assert.equal(VOCAB.headlineLead, "Execution Profiles recorded for")
  assert.equal(VOCAB.stepSummaryHeading, "Garnet Execution Summary")
  assert.equal(VOCAB.artifact, "Execution Profile")
  assert.equal(VOCAB.permalinkLabel, "View this job's Execution Profile in Garnet →")
  assert.equal(CONTRACT_VOCAB.copy.explainerLabel, "💡 How to read this")
  assert.equal(CONTRACT_VOCAB.copy.chainNoun, "execution chain")
  for (const retired of [
    "Run Profile",
    "process lineage",
    "process chain",
    "lineage tree",
    "Runtime Summary",
    "Runtime Review",
    "baseline",
    "gone",
  ]) {
    assert.ok(
      CONTRACT_VOCAB.bannedVocabulary.includes(retired),
      `retired term not banned: ${retired}`,
    )
  }
  assert.equal(
    CONTRACT_VOCAB.publicRunProfile.profileSelectorRoute,
    "/public/runs/{run_id}?profile=<profile_id>",
  )
  assert.ok(
    CONTRACT_VOCAB.publicRunProfile.selectorMiss.includes("absent, empty, or wrong"),
  )
  for (const field of [
    "argv",
    "arguments",
    "executable paths",
    "environment values",
    "assertions",
    "detection evidence",
    "sensor telemetry",
    "sensitive actor/ref metadata",
  ]) {
    assert.ok(CONTRACT_VOCAB.publicRunProfile.embargoedFields.includes(field))
  }
  assert.equal(SIZE_BUDGET, 60_000)
  assert.equal(STEP_SUMMARY_BUDGET, 1_048_576)
  assert.ok(CONTRACT_VOCAB.v7Deferrals.length >= 10)
})

await test("contract: reference mockup preserves App-mode output without App/Action ownership markers", () => {
  const rendered = renderRunReview(reviewFor(recordSet))
  const mockup = renderReferenceMockup(rendered)
  const isolatedBody = rendered
    .replaceAll(RUNTIME_REVIEW_MARKER, "<!-- garnet-reference-renderer-body -->")
    .replaceAll(COMMENT_MARKER, "<!-- garnet-reference-renderer-owner:none -->")
    .replace(
      /<!-- garnet:commit ([0-9a-f]+) -->/gi,
      "<!-- garnet-reference-renderer-commit $1 -->",
    )

  assert.ok(mockup.startsWith(REFERENCE_MOCKUP_MARKER))
  assert.ok(mockup.includes(`**After — v${CONTRACT_VOCAB.version} reference renderer.**`))
  assert.ok(mockup.endsWith(isolatedBody))
  assert.ok(!mockup.includes(RUNTIME_REVIEW_MARKER))
  assert.ok(!mockup.includes(COMMENT_MARKER))
  assert.ok(!mockup.includes("<!-- garnet:commit "))
  // One category heading — the primitive stated first, commit as the trigger.
  assert.ok(rendered.includes("**Execution Profiles recorded for "))
})

await test("contract: real fixture bytes match their provenance manifest", () => {
  const realDir = join(here, "fixtures", "renderer-testdata", "real")
  const provenance = JSON.parse(readFileSync(join(realDir, "provenance.json"), "utf8"))
  for (const [name, entry] of Object.entries(provenance)) {
    if (name.startsWith("$")) continue
    const digest = createHash("sha256").update(readFileSync(join(realDir, name))).digest("hex")
    assert.equal(digest, entry.sha256, `${name} provenance hash drifted`)
  }
})

await test("contract: v2.15.0 producer evidence preserves matrix identity and blank argv", () => {
  const normal = load("real", "normal-v215.json")
  const captures = [normal, ...recordSet].map(rawProfile)
  for (const profile of captures) {
    assert.equal(profile.metadata.version, "0.2.0")
    assert.ok(formatTimestamp(profile.timestamp))
    const argumentsSeen = (profile.network?.egress?.peers || []).flatMap((peer) =>
      (peer.proc_trees || []).map((tree) => String(tree.arguments || "")).filter(Boolean),
    )
    assert.deepEqual(argumentsSeen, [])
  }
  const indexes = recordSet
    .map((profile) => Number(rawProfile(profile).scenarios.github.job_index))
    .sort((a, b) => a - b)
  assert.deepEqual(indexes, [0, 1, 2, 3, 4])
  const executablesSeen = captures.flatMap((profile) =>
    (profile.network?.egress?.peers || []).flatMap((peer) =>
      (peer.proc_trees || []).map((tree) => String(tree.executable || "")).filter(Boolean),
    ),
  )
  assert.ok(executablesSeen.length > 0, "fixture must exercise executable-path embargo")
})

// ---------------------------------------------------------------------------
// Gate 1 — real workload egress: edge-field bijection
// ---------------------------------------------------------------------------

await test("gate 1: one association per peer × proc_tree, every contract field preserved", () => {
  const model = exportReviewModel(reviewFor([workload]))
  const peers = rawProfile(workload).network.egress.peers
  const expectedEdges = peers.reduce((n, p) => n + Math.max(1, (p.proc_trees || []).length), 0)
  assert.equal(model.jobs[0].counts.associations, expectedEdges)
  const key = (addr, names, ports, pid, ancestry) =>
    JSON.stringify([addr, names, ports, pid, ancestry])
  // Multiset comparison (sorted arrays, not Sets): identical duplicate
  // edges must keep their multiplicity.
  const want = []
  for (const p of peers) {
    const trees = (p.proc_trees || []).length ? p.proc_trees : [null]
    for (const t of trees) {
      want.push(
        key(
          p.remote_address || "",
          (p.remote_names || []).map((n) => String(n ?? "")),
          (p.remote_ports || []).map(String),
          t?.pid !== undefined && t?.pid !== null ? String(t.pid) : "",
          t ? (t.ancestry || []).map((a) => String(a ?? "")) : [],
        ),
      )
    }
  }
  const got = model.jobs[0].edges.map((e) =>
    key(e.remote_address, e.remote_names, e.remote_ports, e.pid, e.ancestry),
  )
  assert.deepEqual([...got].sort(), [...want].sort())
})

await test("gate 1b: identical duplicate peer × proc_tree edges keep their multiplicity (multiset, never Set-collapsed)", () => {
  const model = exportReviewModel(reviewFor([duplicateEdges]))
  const peers = rawProfile(duplicateEdges).network.egress.peers
  const key = (e) =>
    JSON.stringify([e.remote_address, e.remote_names, e.remote_ports, e.protocol, e.pid, e.ancestry])
  const expected = peers
    .flatMap((p) =>
      ((p.proc_trees || []).length ? p.proc_trees : [null]).map((t) =>
        key({
          remote_address: p.remote_address || "",
          remote_names: (p.remote_names || []).map((n) => String(n ?? "")),
          remote_ports: (p.remote_ports || []).map(String),
          protocol: p.protocol || "",
          pid: t?.pid !== undefined && t?.pid !== null ? String(t.pid) : "",
          ancestry: t ? (t.ancestry || []).map((a) => String(a ?? "")) : [],
        }),
      ),
    )
    .sort()
  const actual = model.jobs[0].edges.map(key).sort()
  assert.deepEqual(actual, expected)
  // The fixture carries two byte-identical recorded edges; both must survive.
  const dupes = actual.filter((k) => k === actual[0])
  assert.ok(dupes.length >= 2, "identical duplicate edges were collapsed")
  assert.equal(model.jobs[0].counts.associations, expected.length)
})

// ---------------------------------------------------------------------------
// Gates 2–5 — bare IP, ordinary destinations, neutral systemd, PID-distinct
// ---------------------------------------------------------------------------

await test("gate 2: bare-IP egress renders with no note and counts as a destination", () => {
  assert.ok(EDGE_MD.includes("203.0.113.7"))
  const line = EDGE_MD.split("\n").find((l) => l.includes("203.0.113.7"))
  assert.ok(!line.includes("(dns resolver)") && !line.includes("(cloud metadata)"))
})

await test("gate 3: ordinary destinations carry no inferred ownership note", () => {
  for (const name of ["github[.]com", "api.github[.]com", "registry.npmjs[.]org"]) {
    const lines = EDGE_MD.split("\n").filter((l) => l.includes(name))
    assert.ok(lines.length > 0, `missing edge for ${name}`)
    for (const l of lines) {
      assert.ok(!/\((dns resolver|cloud metadata)\)/.test(l), `unexpected note on ${name}`)
    }
  }
  // The retired long form never renders; the v6.9.5 factual context note is
  // the short phrase `(github infra)`.
  assert.ok(!EDGE_MD.includes("(github infrastructure)"))
  assert.ok(!EDGE_MD.includes("garnet sensor upload"))
})

await test("gate 4: one meaning per style — bold marks the process that acted", () => {
  // One meaning per style: bold marks the process that acted (an observed
  // action directly beneath it); every other process line, runner
  // infrastructure included, renders plain — italic wraps annotations only.
  assert.ok(!EDGE_MD.includes("<em>Runner.Worker</em>"))
  assert.ok(EDGE_MD.includes("<strong>curl</strong>"))
  for (const match of EDGE_MD.matchAll(/<em>([^<]*)<\/em>/g)) {
    assert.ok(
      match[1].startsWith("(") || match[1].startsWith("← "),
      `italic wraps a non-annotation: ${match[0]}`,
    )
  }
  // Every recorded root renders in the job's single block — no background
  // fold, section, or label; unattributed roots are whitespace-separated.
  assert.ok(!EDGE_MD.includes("runner background"))
  assert.ok(!EDGE_MD.includes("runner substrate"))
  assert.ok(!EDGE_MD.includes("not shown here"))
  assert.ok(EDGE_SUMMARY.includes("unknown (not recorded)"))

  const detected = exportReviewModel(reviewFor([workload])).jobs[0].edges.find(
    (edge) => edge.detections.includes("exec_from_unusual_dir"),
  )
  assert.ok(hasRecordedDetection(detected))
  const detectedMd = renderRunReview(reviewFor([workload]))
  assert.ok(detectedMd.includes("<strong>node</strong>"))
  // Detection notes are assertion-layer vocabulary: preview-only, never prod.
  assert.ok(!detectedMd.includes("detection: exec_from_unusual_dir"))
})

await test("gate 5: evidence keeps PID-distinct edges while comment rows dedupe destinations", () => {
  assert.ok(EDGE_SUMMARY.includes("<sub>pid&nbsp;4104</sub>"))
  assert.ok(EDGE_SUMMARY.includes("<sub>pid&nbsp;4105</sub>"))
  assert.ok(!EDGE_MD.includes("[4104"))
  assert.ok(!EDGE_MD.includes("[4105"))
  assert.ok(!/×\d/.test(EDGE_MD) && !/×\d/.test(EDGE_SUMMARY))
  const registryRows = EDGE_MD.slice(0, EDGE_MD.indexOf("\n---\n"))
    .split("\n")
    .filter((line) => line.includes("registry.npmjs[.]org"))
  assert.equal(registryRows.length, 1)
})

await test("shape: PR comment merges shared ancestry and attaches shaped terminals to terminal processes", () => {
  // Every recorded root renders in the job's one block; systemd-rooted
  // infrastructure is an independent root in the same block.
  const worker = EDGE_MD.indexOf("<strong>Runner.Worker</strong>")
  const process = EDGE_MD.indexOf("<strong>node</strong>")
  const destination = EDGE_MD.indexOf("○ registry.npmjs[.]org")
  assert.ok(worker !== -1 && worker < process && process < destination)
  // PID-distinct node terminals share one displayed lineage row (PIDs are
  // evidence, not display); the attributed dns leaf sits inline beneath it.
  assert.ok(EDGE_MD.split("<strong>node</strong>").length - 1 >= 1)
  assert.ok(EDGE_MD.includes("○ localhost <em>(dns resolver)</em>"))
  assert.ok(!EDGE_MD.includes("systemd › Runner.Worker"))
})

// ---------------------------------------------------------------------------
// Gates 6–9 — unknown lineage, IMDS, resolver notes
// ---------------------------------------------------------------------------

await test("gate 6: empty proc_trees emits one edge with lineage 'unknown (not recorded)'", () => {
  // Unknown-lineage chains render in the job's block like every recorded
  // root and stay in the model and Step Summary.
  assert.ok(EDGE_MD.includes("○ no-lineage[.]example"))
  assert.ok(!EDGE_MD.includes("[198.51.100.44]"))
  assert.ok(EDGE_SUMMARY.includes("<code>no-lineage.example</code>"))
  assert.ok(EDGE_SUMMARY.includes("<code>unknown (not recorded)</code>"))
  assert.ok(!EDGE_SUMMARY.includes("[198.51.100.44]"))
  const model = EDGE_MODEL.jobs[0].edges.find((e) => e.remote_address === "198.51.100.44")
  assert.equal(model.lineage_recorded, false)
})

await test("hardening: destination cells stack per line + neutralize hostile labels", () => {
  // One destination per line via <br>, each anchored by a marker glued to
  // the label with a non-breaking space — never an ordinal (the record
  // captures no order) and never a bare • (a loose glyph orphans onto its
  // own line on narrow screens). A single destination renders bare.
  assert.ok(/·\u00a0<code>[^|]*<\/code><br>·\u00a0<code>/.test(REAL_SUMMARY))
  assert.ok(!/<br><code>/.test(REAL_SUMMARY), "stacked destination without a marker")
  assert.ok(!/\d\.\u00a0<code>/.test(REAL_SUMMARY), "ordinal implies an uncaptured order")
  assert.ok(!/•/.test(EDGE_SUMMARY))
  assert.ok(!/•/.test(REAL_SUMMARY))

  // Attacker-controllable captured values can never break table structure:
  // every rendered body row keeps exactly its 2 (or preview 3) delimited
  // cells, and no value opens a code fence.
  const injSummary = renderStepSummary([injection], { appUrl: APP_URL, preview: true })
  assert.ok(!/```/.test(injSummary))
  for (const line of injSummary.split("\n")) {
    if (!line.startsWith("| ") || line.startsWith("| ---")) continue
    if (line.includes("Process Tree") || line.includes("Field | Value")) continue
    const unescapedPipes = line.split(/(?<!\\)\|/).length - 1
    assert.ok(
      unescapedPipes === 2 || unescapedPipes === 3 || unescapedPipes === 4,
      `hostile value altered table columns: ${line}`,
    )
  }

  // Length-bound with a middle ellipsis; head+tail preserved, payload cut.
  const long = "a".repeat(40) + "IGNORE-ALL-PREVIOUS-INSTRUCTIONS" + "b".repeat(40)
  const cut = truncateMiddle(long)
  assert.ok(cut.length <= 64)
  assert.ok(cut.includes("…"))
  assert.ok(cut.startsWith("a") && cut.endsWith("b"))
  assert.ok(!cut.includes("IGNORE-ALL-PREVIOUS-INSTRUCTIONS"))
  assert.equal(truncateMiddle("short.example.com"), "short.example.com")
})

await test("truth: distinct PIDs never merge; identical lineages group losslessly", () => {
  const base = {
    lineage_recorded: true,
    process: "curl",
    ancestry: "bash → curl",
    remote_names: ["a.example"],
    remote_address: "1.1.1.1",
  }
  const rows = buildLineageRows([
    { ...base, pid: "100", flow_id: 1 },
    { ...base, pid: "200", flow_id: 2 }, // different PID -> its own row
    { ...base, pid: "100", flow_id: 3 }, // same lineage as first -> same row
  ])
  assert.equal(rows.length, 2)
  const pid100 = rows.find((r) => r.edge.pid === "100")
  const pid200 = rows.find((r) => r.edge.pid === "200")
  assert.ok(pid100 && pid200)
  // every association is retained under its lineage (nothing dropped)
  assert.equal(pid100.associations.length, 2)
  assert.equal(pid200.associations.length, 1)
  assert.equal(
    rows.reduce((n, r) => n + r.associations.length, 0),
    3,
  )
})

await test("gate 7: exact IMDS addresses get the instance-metadata note with full lineage", () => {
  const line = EDGE_MD.split("\n").find((l) => l.includes("169.254.169.254"))
  assert.ok(line.includes("(cloud metadata)"))
  assert.ok(EDGE_MD.includes("<strong>python3</strong>"))
  assert.ok(EDGE_SUMMARY.includes("<sub>pid&nbsp;4106</sub>"))
  assert.deepEqual(
    edgeNotes({ remote_address: "169.254.169.254", remote_ports: [] }),
    ["cloud metadata"],
  )
  // Vendor-specific metadata addresses render bare — the note is reserved
  // for the standardized cloud IMDS constant only.
  for (const addr of ["169.254.170.2", "fd00:ec2::254", "169.254.1.1"]) {
    assert.deepEqual(edgeNotes({ remote_address: addr, remote_ports: [] }), [])
  }
})

await test("gate 7b: the github infra note never trusts a deep name under the truncated suffix", () => {
  assert.ok(isGithubInfraName("glb-2a3c35-public-internal.githubapp.com"))
  assert.ok(isGithubInfraName("pipelines.actions.githubusercontent.com"))
  assert.ok(isGithubInfraName("hosted-compute-watchdog-prod-eus-02.githubapp"))
  assert.ok(!isGithubInfraName("exfil.attacker.githubapp"))
  assert.ok(!isGithubInfraName(".githubapp"))
  assert.ok(!isGithubInfraName("githubapp"))
  assert.ok(!isGithubInfraName("api.github.com"))
  const note = CONTRACT_VOCAB.notes.githubInfrastructure.text
  assert.deepEqual(
    edgeNotes({
      remote_address: "203.0.113.7",
      remote_names: ["hosted-compute-watchdog-prod-eus-02.githubapp"],
      remote_ports: ["443"],
    }),
    [note],
  )
  assert.deepEqual(
    edgeNotes({
      remote_address: "203.0.113.8",
      remote_names: ["exfil.attacker.githubapp"],
      remote_ports: ["443"],
    }),
    [],
  )
})

await test("gate 8: loopback:53 (including '53 (dns)') gets the resolver note and is counted", () => {
  // A dns-resolver chain renders in the job's block as a normal leaf with
  // the `(dns resolver)` note; the Step Summary keeps the destination.
  assert.ok(EDGE_MD.includes("○ localhost <em>(dns resolver)</em>"))
  assert.ok(EDGE_SUMMARY.includes("<code>localhost</code>"))
  // The resolver note appears only inside the full-tree fold (PR-comment
  // grammar) — never in the lineage table above it.
  const summaryFoldStart = EDGE_SUMMARY.indexOf("<details><summary><sub>Full recorded tree")
  assert.ok(!EDGE_SUMMARY.slice(0, summaryFoldStart).includes("(dns resolver)"))
  const previewLine = EDGE_SUMMARY_PREVIEW.split("\n").find((l) =>
    l.includes("127.0.0.53"),
  )
  assert.ok(previewLine.includes("(dns resolver)"))
  const counts = EDGE_MODEL.jobs[0].counts
  const addrs = new Set(EDGE_MODEL.jobs[0].edges.map((e) => e.remote_address))
  assert.ok(addrs.has("127.0.0.53") && addrs.has("127.0.0.1"))
  assert.equal(counts.destinations, addrs.size)
})

await test("gate 9: loopback:8080 gets NO resolver note (and still counts)", () => {
  const line = EDGE_MD.split("\n").find((l) => l.includes("○ 127.0.0.1"))
  assert.ok(!line.includes("(dns resolver)"))
  assert.ok(EDGE_SUMMARY.includes("<code>127.0.0.1</code>"))
  assert.ok(!EDGE_SUMMARY.includes("8080"))
  const previewLine = EDGE_SUMMARY_PREVIEW.split("\n").find((l) => l.includes("8080"))
  assert.ok(previewLine.includes("8080"))
  assert.ok(!previewLine.includes("(dns resolver)"))
})

await test("gate 9b: nothing subtracts — every destination identity renders in its job's block", () => {
  for (const job of EDGE_MODEL.jobs) {
    const shown = commentEdges(job.edges)
    assert.equal(
      new Set(shown.map(
        (edge) => edge.remote_names.find((name) => name !== "") || edge.remote_address,
      )).size,
      new Set(job.edges.map(
        (edge) => edge.remote_names.find((name) => name !== "") || edge.remote_address,
      )).size,
    )
    assert.ok(shown.length > 0 || job.edges.length === 0, "a fold tree is never empty")
  }
  const md = renderRunReview(reviewFor(recordSet))
  assert.ok(!md.includes("not shown here"))
  assert.ok(!md.includes("runner background"))
  assert.ok(!md.includes("runner substrate"))
})

await test("gate 9c: unattributed roots render in the same job block, whitespace-separated", () => {
  // systemd-rooted infrastructure and Runner.Worker workload are independent
  // recorded roots of one job: both render inside the job's single fold.
  const fold = EDGE_MD.split("<details><summary><code>")[1]
  assert.ok(fold !== undefined)
  const body = fold.split("</details>")[0]
  assert.ok(body.includes("Runner.Worker"))
  assert.ok(body.includes("○ no-lineage[.]example"))
})

await test("gate 9f: every fold-row destination count equals the distinct ○ identities beneath it", () => {
  const md = renderRunReview(reviewFor(recordSet))
  const folds = md.split("<details><summary><code>").slice(1)
  assert.ok(folds.length > 0)
  folds.forEach((fold, i) => {
    const summary = fold.split("</summary>")[0]
    const rowMatch = summary.match(/(\d+)&nbsp;destination/)
    const mainPre = fold.split("<pre>")[1]
    if (!mainPre || !rowMatch) return
    const mainTree = mainPre.split("</pre>")[0]
    const leaves = new Set(
      mainTree
        .split("\n")
        .filter((line) => line.includes("○ "))
        .map((line) => line.slice(line.indexOf("○ ") + 2).replace(/ \([^)]*\)/g, "").trim()),
    )
    assert.equal(Number(rowMatch[1]), leaves.size, `job ${i}: row says ${rowMatch[1]}, tree shows ${leaves.size}`)
  })
  // Chain counts never render on the human surface.
  assert.ok(!/&nbsp;chains?\b/.test(md.replace(/<!--[\s\S]*?-->/g, "")))
})

await test("gate 9d: metadata counts inflect — destinations only, no chain counts", () => {
  const singular = renderRunReview(reviewFor([load("real", "normal-run.json")]))
  const metadata = singular.split("\n").find((l) => l.startsWith("> *"))
  assert.ok(metadata.includes("1&nbsp;destination*"))
  assert.ok(!metadata.includes("execution chain"), "chain counts never render on the human surface")
  assert.ok(!metadata.includes("runner-background"))
  assert.ok(!/1&nbsp;destinations/.test(singular))
})

await test("gate 9e: process display names strip trailing provisioning digits — display only", () => {
  assert.equal(displayProcessName("provjobd1326539233"), "provjobd")
  assert.equal(displayProcessName("python3"), "python3")
  assert.equal(displayProcessName("1234567"), "1234567")
  const md = renderRunReview(reviewFor(recordSet))
  assert.ok(!/provjobd\d/.test(md))
  const model = exportReviewModel(reviewFor(recordSet))
  assert.ok(JSON.stringify(model).match(/provjobd\d/), "raw names stay in the model")
})

// ---------------------------------------------------------------------------
// Gates 10–11 — remote names
// ---------------------------------------------------------------------------

await test("gate 10: an address-like remote name never double-renders or counts as a domain", () => {
  const line = EDGE_SUMMARY.split("\n").find((l) => l.includes("140.82.113.23"))
  assert.ok(!line.includes("(140.82.113.23)"), "identical name rendered beside its address")
  assert.ok(isAddressLike("140.82.113.23"))
  const counted = edgeCounts([
    { remote_address: "140.82.113.23", remote_names: ["140.82.113.23"], remote_ports: [] },
  ])
  assert.equal(counted.domains, 0)
  assert.equal(counted.destinations, 1)
})

await test("gate 11: secondary/truncated names stay out of prod and remain verbatim in preview", () => {
  assert.ok(EDGE_SUMMARY.includes("glb-2a3c35-public-internal.githubapp.com"))
  assert.ok(!EDGE_MD.includes("hosted-compute-watchdog-prod-iad-02.githubapp"))
  assert.ok(!EDGE_MD.includes("also recorded:"))
  const previewLine = EDGE_SUMMARY_PREVIEW.split("\n").find((line) =>
    line.includes("also recorded:"),
  )
  assert.ok(previewLine.includes("hosted-compute-watchdog-prod-iad-02.githubapp"))
  assert.ok(previewLine.includes("also recorded:"))
  assert.ok(!EDGE_MD.includes("hosted-compute-watchdog-prod-iad-02.githubapp.com"))
})

await test("gate 11b: non-flow detections annotate only under assertions preview; flow is omitted", () => {
  assert.deepEqual(
    edgeNotes({
      remote_address: "203.0.113.1",
      remote_ports: ["443"],
      detections: ["flow", "exec_from_unusual_dir", "network_peer"],
    }),
    ["detection: exec_from_unusual_dir", "detection: network_peer"],
  )
  assert.deepEqual(
    edgeNotes(
      {
        remote_address: "203.0.113.1",
        remote_ports: ["443"],
        detections: ["flow", "exec_from_unusual_dir"],
      },
      { detections: false },
    ),
    [],
  )
  const md = renderRunReview(reviewFor([workload]))
  assert.ok(!md.includes("detection: exec_from_unusual_dir"))
  assert.ok(!md.includes("detection: flow"))
  const prodSummary = renderStepSummary([workload], { appUrl: APP_URL })
  assert.ok(!prodSummary.includes("detection: exec_from_unusual_dir"))
  const previewSummary = renderStepSummary([workload], { appUrl: APP_URL, preview: true })
  assert.ok(previewSummary.includes("detection: exec_from_unusual_dir"))
  assert.ok(!previewSummary.includes("detection: flow"))
})

// ---------------------------------------------------------------------------
// Gates 12–13 — timestamps and pending state
// ---------------------------------------------------------------------------

await test("gate 12: deterministic sensor timestamp — profile.timestamp only, exact format", () => {
  assert.equal(formatTimestamp("2026-07-08T05:35:56.123456789Z"), "2026-07-08 05:35:56 UTC")
  assert.equal(formatTimestamp(""), "")
  assert.equal(formatTimestamp("not-a-date"), "")
  // The comment's provenance line carries the stamp at minute precision;
  // the Step Summary keeps the record's full-precision stamp.
  assert.ok(EDGE_MD.includes("· 2026-07-08 05:35 UTC"))
  assert.ok(EDGE_SUMMARY.includes("2026-07-08 05:35:56 UTC"))
  // worth-a-look has no profile.timestamp: no recorded-through, no clock fallback.
  const md = renderRunReview(reviewFor([worth]))
  assert.ok(!/\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})? UTC/.test(md.split("\n").find((l) => l.startsWith("> <sub>")) || ""))
  // Multi-profile: the maximum valid profile timestamp on the provenance line.
  const multi = renderRunReview(reviewFor(recordSet))
  const stamps = recordSet.map((p) => formatTimestamp(rawProfile(p).timestamp)).filter(Boolean).sort()
  const provenance = multi.split("\n").find((l) => l.startsWith("> <sub>"))
  const minutePrecision = stamps[stamps.length - 1].replace(/(\d{2}:\d{2}):\d{2}/, "$1")
  assert.ok(provenance.includes(`recorded at the kernel by Garnet · ${minutePrecision}`))
  // "recorded" appears exactly once on the provenance line.
  assert.equal(provenance.split("recorded").length - 1, 1)
})

await test("gate 13: pending state opens explainer and status without timestamp/count/link", () => {
  const md = renderPendingReview({
    sha: "ef01a52517e7532ab34aadea58b952c9f1e79ece",
    commitUrl: `https://github.com/${REPO}/commit/ef01a52517e7532ab34aadea58b952c9f1e79ece`,
  })
  assert.ok(md.startsWith(RUNTIME_REVIEW_MARKER))
  assert.ok(md.includes(COMMENT_MARKER))
  assert.ok(md.includes("<!-- garnet:commit ef01a52517e7532ab34aadea58b952c9f1e79ece -->"))
  assert.ok(md.includes("<details open>"))
  assert.ok(md.includes("💡 How to read this"))
  assert.ok(md.includes("**Execution Profiles recording for jobs triggered by [`ef01a52`]"))
  assert.ok(md.includes("⏳ Execution Profiles for this commit are still being recorded"))
  assert.ok(!md.includes("as of") && !/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(md))
  assert.ok(!md.includes("jobs recorded") && !md.includes("/public/runs/"))
})

// ---------------------------------------------------------------------------
// Gates 14–15 — empty peers and coverage
// ---------------------------------------------------------------------------

await test("gate 14: a job with empty peers renders exactly 'no outbound destinations recorded.'", () => {
  const empty = {
    ...edgeCases,
    telemetry: undefined,
    network: { egress: { peers: [] } },
  }
  const md = renderRunReview(reviewFor([empty]))
  assert.ok(md.includes("no outbound destinations recorded."))
  assert.ok(!md.includes("<details><summary><code>"))
  const summary = renderStepSummary([empty], { appUrl: APP_URL })
  assert.ok(summary.includes("no outbound destinations recorded."))
  assert.ok(!summary.includes("Network telemetry observed"))
})

await test("gate 15: coverage is only k jobs recorded on this commit", () => {
  const four = recordSet.slice(0, 4)
  const partial = renderRunReview(reviewFor(four))
  const complete = renderRunReview(reviewFor(recordSet))
  assert.ok(partial.includes("**Execution Profiles recorded for 4 jobs, triggered by"))
  assert.ok(complete.includes("**Execution Profiles recorded for 5 jobs, triggered by"))
  for (const md of [partial, complete]) {
    assert.ok(!/\d+ of \d+ jobs recorded/.test(md))
    assert.ok(!md.includes(VOCAB.noRunProfile))
  }
})

// ---------------------------------------------------------------------------
// Gates 16–17 — medium truncation
// ---------------------------------------------------------------------------

function oversizedProfile() {
  const peers = [
    {
      protocol: "tcp",
      remote_address: "169.254.169.254",
      remote_names: [],
      remote_ports: ["80"],
      proc_trees: [
        {
          pid: 1,
          process: "python3",
          github_step: "z. metadata",
          ancestry: ["systemd", "Runner.Worker", "bash", "python3"],
        },
      ],
    },
  ]
  for (let i = 0; i < 900; i += 1) {
    peers.push({
      protocol: "tcp",
      remote_address: `198.51.${Math.floor(i / 250)}.${i % 250}`,
      remote_names: [`host-${String(i).padStart(4, "0")}.very-long-domain-name-for-truncation.example`],
      remote_ports: ["443"],
      proc_trees: [
        {
          pid: 10000 + i,
          process: "curl",
          github_step: `step ${i}`,
          ancestry: ["systemd", "Runner.Worker", "bash", "node", "sh", "curl"],
        },
      ],
    })
  }
  return {
    ...edgeCases,
    uuid: "99999999-0000-4000-8000-000000000000",
    network: { egress: { peers } },
  }
}

await test("gate 16: oversized PR comment truncates fairly, keeps IMDS, emits exact omission count, fits budget", () => {
  const review = reviewFor([oversizedProfile()])
  const md = renderRunReview(review)
  const bytes = Buffer.byteLength(md, "utf8")
  assert.ok(bytes <= SIZE_BUDGET, `serialized ${bytes} bytes > ${SIZE_BUDGET}`)
  const m = md.match(/rendered (\d+) of (\d+) destination associations/)
  assert.ok(m, "missing exact truncation line")
  assert.equal(Number(m[2]), 901)
  assert.ok(Number(m[1]) < 901 && Number(m[1]) > 0)
  assert.ok(md.includes("169.254.169.254") && md.includes("(cloud metadata)"), "IMDS edge evicted")
  assert.ok(!md.includes("recorded processes"))
})

await test("gate 16b: PR budget is enforced on serialized UTF-8 bytes", () => {
  const profile = oversizedProfile()
  for (const peer of profile.network.egress.peers) {
    peer.remote_names = (peer.remote_names || []).map((name) => `${name}-界界界界界界界界`)
  }
  const md = renderRunReview(reviewFor([profile]))
  assert.ok(Buffer.byteLength(md, "utf8") <= SIZE_BUDGET)
  assert.match(md, /rendered \d+ of \d+ destination associations/)
})

await test("gate 17: oversized Step Summary truncates under 1 MiB with the exact omission line", () => {
  const big = []
  for (let i = 0; i < 8; i += 1) {
    const p = oversizedProfile()
    p.scenarios = { github: { ...edgeCases.scenarios.github, job: `big-${i}` } }
    big.push(p)
  }
  const summary = renderStepSummary(big, { appUrl: APP_URL })
  assert.ok(Buffer.byteLength(summary, "utf8") <= STEP_SUMMARY_BUDGET)
  assert.match(summary, /rendered \d+ of \d+ execution chains/)
})

// ---------------------------------------------------------------------------
// Gates 16b–17b — true final serialized caps: fixed overhead alone overflows
// ---------------------------------------------------------------------------

function overheadHeavyProfiles(count) {
  // Many jobs, each with one edge — the fixed per-job fold overhead alone
  // exceeds the budget even with zero kept edges.
  const profiles = []
  for (let i = 0; i < count; i += 1) {
    profiles.push({
      uuid: `aaaaaaa${String(i).padStart(1, "0")}-0000-4000-8000-${String(i).padStart(12, "0")}`,
      timestamp: "2026-07-01T00:00:00Z",
      scenarios: {
        github: {
          repository: REPO,
          workflow: `workflow-with-a-deliberately-long-name-${"x".repeat(120)}`,
          job: `job-${String(i).padStart(4, "0")}-${"y".repeat(120)}`,
          sha: "b".repeat(40),
          run_id: "31000000002",
        },
      },
      network: {
        egress: {
          peers: [
            {
              remote_address: "203.0.113.9",
              remote_names: ["example.com"],
              remote_ports: ["443"],
              protocol: "tcp",
              proc_trees: [{ pid: 100 + i, process: "node", ancestry: ["bash", "node"] }],
            },
          ],
        },
      },
    })
  }
  return profiles
}

await test("gate 16b: PR comment cap holds when zero-edge fixed overhead alone overflows — deterministic minimal fallback", () => {
  const profiles = overheadHeavyProfiles(300)
  const review = reviewFor(profiles)
  const md = renderRunReview(review)
  const bytes = Buffer.byteLength(md, "utf8")
  assert.ok(bytes <= SIZE_BUDGET, `serialized ${bytes} bytes > ${SIZE_BUDGET}`)
  assert.ok(md.includes(RUNTIME_REVIEW_MARKER) && md.includes(COMMENT_MARKER), "markers lost")
  assert.ok(md.includes("**Execution Profiles recorded for "), "headline lost")
  assert.ok(md.includes("recorded for 300 jobs, triggered by"), "coverage count lost")
  assert.ok(md.includes(`rendered 0 of ${review.counts.associations} destination associations`), "exact truncation line lost")
  assert.ok(!md.includes("/public/runs/"), "minimal fallback fabricated a non-exact link")
  assert.equal(md, renderRunReview(reviewFor(overheadHeavyProfiles(300))), "fallback not deterministic")
})

await test("gate 16c: multibyte/emoji fixed overhead — minimal fallback cap holds on serialized UTF-8 bytes", () => {
  // Fixed per-job overhead (workflow/job labels) is dominated by multibyte
  // characters, so a character count would under-measure the payload by ~4×;
  // every fallback decision must use Buffer.byteLength(..., 'utf8').
  const profiles = overheadHeavyProfiles(300).map((p, i) => ({
    ...p,
    scenarios: {
      github: {
        ...p.scenarios.github,
        workflow: `🚀界🔥ワークフロー-${"📦".repeat(60)}`,
        job: `ジョブ-${String(i).padStart(4, "0")}-${"界".repeat(100)}`,
      },
    },
  }))
  const review = reviewFor(profiles)
  const md = renderRunReview(review)
  const bytes = Buffer.byteLength(md, "utf8")
  assert.ok(bytes <= 60_000, `serialized ${bytes} bytes > 60000`)
  // The fixture's fold overhead is multibyte-dominated, so the overflow
  // decision itself must measure serialized UTF-8 bytes, not characters.
  const fullOverhead = profiles.map((p) => p.scenarios.github.job).join("")
  assert.ok(Buffer.byteLength(fullOverhead, "utf8") > fullOverhead.length)
  assert.ok(md.includes(RUNTIME_REVIEW_MARKER) && md.includes(COMMENT_MARKER), "markers lost")
  assert.ok(md.includes("recorded for 300 jobs, triggered by"), "coverage count lost")
  assert.ok(md.includes(`rendered 0 of ${review.counts.associations} destination associations`), "exact truncation line lost")
  assert.equal(md, renderRunReview(reviewFor(profiles)), "fallback not deterministic")
})

await test("gate 17b: Step Summary cap holds when fixed per-profile overhead alone overflows 1 MiB", () => {
  const profiles = overheadHeavyProfiles(50).map((p, i) => ({
    ...p,
    scenarios: {
      github: { ...p.scenarios.github, job: `big-${i}-${"z".repeat(30000)}` },
    },
  }))
  const summary = renderStepSummary(profiles, { appUrl: APP_URL })
  assert.ok(Buffer.byteLength(summary, "utf8") <= STEP_SUMMARY_BUDGET)
  assert.ok(summary.includes(`## ${VOCAB.stepSummaryHeading}`), "heading lost")
  assert.match(summary, /50 jobs recorded/)
  assert.match(summary, /rendered 0 of 50 execution chains/)
})

// ---------------------------------------------------------------------------
// Gate — record-faithful empty values
// ---------------------------------------------------------------------------

await test("gate: recorded empty remote_names/ancestry strings are preserved in the model, skipped by projections, excluded from counts", () => {
  const profile = {
    uuid: "cccccccc-0000-4000-8000-00000000000c",
    timestamp: "2026-07-01T00:00:00Z",
    scenarios: { github: { repository: REPO, workflow: "ci", job: "empties", sha: "c".repeat(40), run_id: "31000000003" } },
    network: {
      egress: {
        peers: [
          {
            remote_address: "203.0.113.20",
            remote_names: ["", "names.example", ""],
            remote_ports: ["443"],
            protocol: "tcp",
            proc_trees: [{ pid: 42, process: "node", ancestry: ["", "bash", "", "node"] }],
          },
        ],
      },
    },
  }
  const review = reviewFor([profile])
  const model = exportReviewModel(review)
  const edge = model.jobs[0].edges[0]
  // Record-faithful: empty strings preserved verbatim, in record order.
  assert.deepEqual(edge.remote_names, ["", "names.example", ""])
  assert.deepEqual(edge.ancestry, ["", "bash", "", "node"])
  // Empty slots never count; the canonical non-empty recorded name is the
  // counting and display identity regardless of slot position.
  assert.equal(model.jobs[0].counts.primary_names, 1)
  assert.equal(model.jobs[0].counts.domains, 1)
  // Projections render without empty-name artifacts.
  const md = renderRunReview(review)
  assert.ok(md.includes("names[.]example"))
  assert.ok(!md.includes("also recorded:"))
  assert.ok(!md.includes("(, names") && !md.includes("example, )"), "empty name rendered")
})

// ---------------------------------------------------------------------------
// Gate — generated mockups are byte-gated against fresh renderer output
// ---------------------------------------------------------------------------

await test("gate: checked-in mockups byte-equal fresh renderer output (states, public contract mockup, combined)", async () => {
  const mockup = (rel) => readFileSync(join(here, "fixtures", "mockups", rel), "utf8")
  const normal = await loadProfile("normal-run.json")
  const worthLive = await loadProfile("worth-a-look-run.json")
  const normalV215 = await loadProfile("normal-v215.json")
  const record = await Promise.all(
    [
      "record-workload-egress.json",
      "record-docs-build.json",
      "record-install-only.json",
      "record-lint.json",
      "record-typecheck.json",
    ].map(loadProfile),
  )
  const states = {
    "1-no-record.md": renderNoRecord("ef01a52517e7532ab34aadea58b952c9f1e79ece"),
    "2-registry-only.md": renderFromProfiles([normal]).body,
    "3-workload-egress.md": renderFromProfiles([worthLive]).body,
    "4-multi-job.md": renderFromProfiles(record).body,
    "5-raw-profile-no-selector.md": renderFromProfiles([normalV215]).body,
    "6-public-run-profile.md": renderPublicRunProfileMockup(),
  }
  for (const [file, body] of Object.entries(states)) {
    assert.equal(mockup(file), `${body}\n`, `test/fixtures/mockups/${file} drifted from renderer output`)
  }
  const combined = {
    "combined/1-registry-only.md": renderCombined([normal]),
    "combined/1-registry-only.preview.md": renderCombined([normal], { preview: true }),
    "combined/2-workload-egress.md": renderCombined([worthLive]),
    "combined/2-workload-egress.preview.md": renderCombined([worthLive], {
      preview: true,
    }),
    "combined/3-multi-job.md": renderCombined(record),
    "combined/3-multi-job.preview.md": renderCombined(record, { preview: true }),
  }
  for (const [file, body] of Object.entries(combined)) {
    assert.equal(mockup(file), body, `test/fixtures/mockups/${file} drifted from renderer output`)
  }
})

// ---------------------------------------------------------------------------
// Gates 18–19 — embargo and injection
// ---------------------------------------------------------------------------

const CREDENTIAL_TOKENS = [
  "ghp_SECRETTOKEN",
  "wJalrXUtnFEMIexampleKEY",
  "Authorization: Bearer",
  "secret-tools-DIRNAME9f8e7d6c",
  "curl-wrapper",
  "AWS_SECRET_ACCESS_KEY",
]

await test("gate 18: credential-shaped argv/executable never leak on any surface", () => {
  const review = reviewFor([credential])
  const surfaces = [
    renderRunReview(review),
    renderStepSummary([credential], { appUrl: APP_URL }),
    JSON.stringify(exportReviewModel(review)),
  ]
  for (const surface of surfaces) {
    for (const token of CREDENTIAL_TOKENS) {
      assert.ok(!surface.includes(token), `leaked: ${token}`)
    }
  }
})

await test("gate 19: HTML/Markdown injection payloads render inert on all renderer-owned surfaces", () => {
  const review = reviewFor([injection])
  const surfaces = [renderRunReview(review), renderStepSummary([injection], { appUrl: APP_URL })]
  for (const surface of surfaces) {
    // Code spans neutralize HTML/Markdown on GitHub; everything outside them
    // must carry no raw record-sourced markup at all.
    const outsideCode = surface.replace(/`[^`\n]*`/g, "`code`")
    assert.ok(!outsideCode.includes("<script"), "raw <script>")
    assert.ok(!outsideCode.includes("<img"), "raw <img>")
    assert.ok(!outsideCode.includes("</pre><img"), "pre-block breakout")
    assert.ok(!outsideCode.includes("</pre><details"), "pre-block breakout via details")
    assert.ok(!outsideCode.includes("<details open><summary>x"), "raw injected details")
    assert.ok(surface.includes("&lt;script&gt;") || surface.includes("&lt;img"), "payload dropped instead of escaped")
  }
  // Step Summary: Markdown-image payloads in record-sourced process identity
  // must stay inside code spans, where GitHub leaves them inert.
  const summary = renderStepSummary([injection], { appUrl: APP_URL })
  const outsideCodeSpans = summary
    .replace(/`[^`\n]*`/g, "`code`")
    .replace(/<code>[^<]*<\/code>/g, "<code>code</code>")
    .replace(/<pre>[\s\S]*?<\/pre>/g, "<pre>pre</pre>")
  assert.ok(!outsideCodeSpans.includes("!["), "markdown image outside code span")
  // <pre> content is an HTML block on GitHub — Markdown stays unprocessed —
  // but raw HTML must still arrive escaped there.
  const preBlocks = summary.match(/<pre>[\s\S]*?<\/pre>/g) ?? []
  for (const block of preBlocks) {
    assert.ok(!block.includes("<script"), "raw <script> inside pre")
    assert.ok(!block.includes("<img"), "raw <img> inside pre")
  }
  assert.ok(summary.includes("![exfil](//evil.example/x.png)"), "payload dropped instead of contained")
  // JSON surface: structured, embargo respected, no pre-rendered HTML fields.
  const json = exportReviewModel(review)
  const processes = json.jobs[0].edges.map((edge) => edge.process)
  assert.ok(processes.includes("</pre><img src=x onerror=alert(3)>"))
  assert.ok(processes.includes("![exfil](//evil.example/x.png)"))
  assert.ok(!JSON.stringify(json).includes('"executable"') && !JSON.stringify(json).includes('"arguments"'))
})

// ---------------------------------------------------------------------------
// Gate 20 — selector and publication policy
// ---------------------------------------------------------------------------

await test("gate 20a: per-job links use envelope Profile.ID, never raw record UUID", () => {
  const profileID = "019f5e00-0000-7000-8000-000000000001"
  const recordUuid = "0f5b2a1c-9d4e-4b7a-8c3d-2e1f6a7b8c9d"
  const url = profilePermalink(
    { run_id: "31000000001", profile_id: profileID, uuid: recordUuid },
    APP_URL,
    "pr_comment",
  )
  assert.equal(
    url,
    `https://app.garnet.ai/public/runs/31000000001?profile=${profileID}&utm_source=github&utm_medium=pr_comment`,
  )
  assert.ok(!url.includes(recordUuid))
  assert.ok(EDGE_MD.includes(url.replaceAll("&", "&amp;")), "selector link missing from HTML surface")
  assert.ok(EDGE_SUMMARY.includes("utm_medium=step_summary"))
  assert.equal(profilePermalink({ run_id: "1", profile_id: "" }, APP_URL, "pr_comment"), "")
})

await test("gate 20d: raw profile shape — data.uuid is never a Profile UUID or ?profile= selector", () => {
  // The live workflow supplies raw profiles (no control-plane envelope).
  const job = summarizeProfile(edgeCases)
  assert.equal(job.profile_id, "")
  assert.equal(job.uuid, edgeCases.uuid)
  const md = renderRunReview(reviewFor([edgeCases]))
  const summary = renderStepSummary([edgeCases], { appUrl: APP_URL })
  assert.ok(!summary.includes("Record UUID"), "raw record UUID leaked into Workload Summary")
  assert.ok(!summary.includes("Profile UUID"), "raw data.uuid mislabeled as Profile UUID")
  for (const surface of [md, summary]) {
    assert.ok(!surface.includes(`?profile=${edgeCases.uuid}`), "raw data.uuid fabricated into a selector")
    assert.ok(!surface.includes("?profile="), "raw profile must never carry an exact selector")
  }
  assert.ok(!md.includes("/public/runs/"), "raw profile fabricated a public CTA")
})

await test("gate 20e: enveloped profile shape — envelope Profile.ID is the Profile row and drives the selector", () => {
  const job = summarizeProfile(edgeCaseEnvelope)
  assert.equal(job.profile_id, edgeCaseEnvelope.id)
  assert.equal(job.uuid, edgeCases.uuid)
  const link = profilePermalink(job, APP_URL, "step_summary")
  assert.ok(link !== "")
  assert.ok(EDGE_SUMMARY.includes(`| Profile | [${edgeCaseEnvelope.id}](${link}) |`))
  assert.ok(!EDGE_SUMMARY.includes("Record UUID"))
  assert.ok(EDGE_MD.includes(`?profile=${edgeCaseEnvelope.id}`.replaceAll("&", "&amp;")))
  assert.ok(!EDGE_MD.includes(`?profile=${edgeCases.uuid}`))
})

await test("gate: step summary PR link — pull_request refs link the PR row; other refs omit it", () => {
  const prJob = summarizeProfile(workload)
  assert.equal(
    prJob.pr_url,
    "https://github.com/garnet-org/runtime-review-testbed/pull/76",
  )
  assert.ok(REAL_SUMMARY.includes("| Pull request | [#76](https://github.com/garnet-org/runtime-review-testbed/pull/76) |"))

  const nonPRJob = summarizeProfile(edgeCaseEnvelope)
  assert.equal(nonPRJob.pr_url, "")
  assert.ok(!EDGE_SUMMARY.includes("| Pull request |"))

  // Malformed / missing PR metadata fails closed.
  const malformed = structuredClone(edgeCases)
  malformed.scenarios.github.ref = "refs/pull//merge"
  assert.equal(summarizeProfile(malformed).pr_url, "")
  const noRepo = structuredClone(workload)
  const noRepoData = noRepo.data ?? noRepo
  noRepoData.scenarios.github.repository = ""
  assert.equal(summarizeProfile(noRepo).pr_url, "")
})

await test("gate: step summary full-tree fold — collapsed by default, absolute grammar, no diff markers", () => {
  assert.ok(EDGE_SUMMARY.includes("<details><summary><sub>Full recorded tree</sub></summary>"))
  assert.ok(!EDGE_SUMMARY.includes("<details open"))
  const job = summarizeProfile(edgeCaseEnvelope)
  const tree = renderJobTree(job, job.edges, { defang: false })
  assert.ok(EDGE_SUMMARY.includes(tree))
  // Step Summary stays canonical — no defanged hostnames in the fold.
  assert.ok(!tree.includes("[.]"))
  // Absolute view only — no comparison material inside the fold.
  const foldStart = EDGE_SUMMARY.indexOf("<details><summary><sub>Full recorded tree")
  const foldEnd = EDGE_SUMMARY.indexOf("</details>", foldStart)
  const fold = EDGE_SUMMARY.slice(foldStart, foldEnd)
  assert.ok(!/^[+−-] /m.test(fold.replace(/<[^>]+>/g, "")))
  assert.ok(!fold.includes("no longer recorded"))
})

await test("gate: preview material is contained — default bytes carry none of it on any surface", () => {
  const previewMarkers = [
    "Recorded context preview",
    "<details><summary><strong>Assertions</strong>",
    "| Assertion |",
    "detection:",
    "⚠ attention",
  ]
  const inputs = [recordSet, [edgeCaseEnvelope], [edgeCases], [worth], [injection]]
  for (const profiles of inputs) {
    const defaultSummary = renderStepSummary(profiles, { appUrl: APP_URL })
    const prComment = renderRunReview(reviewFor(profiles))
    for (const marker of previewMarkers) {
      assert.ok(!defaultSummary.includes(marker), `default step summary leaked ${JSON.stringify(marker)}`)
      assert.ok(!prComment.includes(marker), `PR comment leaked ${JSON.stringify(marker)}`)
    }
  }
})

await test("gate 20b: publication policy is fail-closed with one non-oracular 404", () => {
  // Exact profile selection — ?profile supplied and resolving.
  const exact = publicationDecision({
    visibility: "public",
    consent: true,
    revoked: false,
    profileRequested: true,
    selectorResolves: true,
  })
  assert.deepEqual(exact, { status: 200, body: "render" })
  const denied = [
    {},
    { visibility: "private", consent: true },
    { visibility: "internal", consent: true },
    { visibility: "unknown", consent: true },
    { visibility: "public", consent: false },
    { visibility: "public", consent: true, revoked: true },
    // Missing selector and job-only/bare-run requests never render.
    { visibility: "public", consent: true, revoked: false },
    // ?profile supplied with an empty/wrong UUID: exact, no fallback.
    { visibility: "public", consent: true, profileRequested: true, selectorResolves: false },
    { visibility: "public", consent: true, profileRequested: true },
    // Publication policy denies even a resolving selector.
    { visibility: "private", consent: true, profileRequested: true, selectorResolves: true },
    { visibility: "public", consent: false, profileRequested: true, selectorResolves: true },
  ]
  const bodies = new Set()
  for (const state of denied) {
    const res = publicationDecision(state)
    assert.equal(res.status, 404, JSON.stringify(state))
    bodies.add(res.body)
  }
  assert.equal(bodies.size, 1, "denied responses must be indistinguishable")
})

await test("gate 20c: completed comment renders one exact selector per enveloped job fold", () => {
  const single = renderRunReview(reviewFor(recordSet))
  // One selector link per recorded job — the only Garnet links. A job with
  // visible observations carries the fold-footer permalink; an empty
  // projection keeps its Execution Profile link on the plain row.
  const foldedJobs = (profiles) =>
    profiles
      .map(summarizeProfile)
      .filter((job) => commentEdges(job.edges).length > 0).length
  assert.equal(single.split("utm_medium=pr_comment").length - 1, recordSet.length)
  assert.equal(
    single.split("View this job's Execution Profile in Garnet →").length - 1,
    foldedJobs(recordSet),
  )
  const otherRun = JSON.parse(JSON.stringify(recordSet[0]))
  otherRun.id = "019f5e00-0000-7000-8000-000000000002"
  otherRun.data.scenarios.github.run_id = "28999999999"
  otherRun.data.scenarios.github.job = "other-run-job"
  const multi = renderRunReview(reviewFor([...recordSet, otherRun]))
  assert.ok(multi.includes("/public/runs/28999999999?profile="))
  assert.equal(
    multi.split("utm_medium=pr_comment").length - 1,
    recordSet.length + 1,
  )
})

// ---------------------------------------------------------------------------
// Gate 21 — determinism
// ---------------------------------------------------------------------------

await test("gate 21: three renders of the same input byte-compare equal", () => {
  const inputs = [recordSet, [edgeCases], [injection], [oversizedProfile()]]
  for (const profiles of inputs) {
    const bodies = [1, 2, 3].map(() => renderRunReview(reviewFor(profiles)))
    assert.ok(bodies[0] === bodies[1] && bodies[1] === bodies[2])
    const summaries = [1, 2, 3].map(() => renderStepSummary(profiles, { appUrl: APP_URL }))
    assert.ok(summaries[0] === summaries[1] && summaries[1] === summaries[2])
    const models = [1, 2, 3].map(() => JSON.stringify(exportReviewModel(reviewFor(profiles))))
    assert.ok(models[0] === models[1] && models[1] === models[2])
  }
})

await test("gate 21b: comments, models, and the lineage-keyed Step Summary are all canonical (order-independent)", () => {
  const shuffled = recordSet
    .map((profile) => JSON.parse(JSON.stringify(profile)))
    .reverse()
  for (const envelope of shuffled) {
    const data = rawProfile(envelope)
    data.network.egress.peers.reverse()
    for (const peer of data.network.egress.peers) {
      if (Array.isArray(peer.proc_trees)) peer.proc_trees.reverse()
    }
  }
  assert.equal(
    renderRunReview(reviewFor(shuffled)),
    renderRunReview(reviewFor(recordSet)),
  )
  assert.equal(
    renderStepSummary(shuffled, { appUrl: APP_URL, preview: true }),
    renderStepSummary(recordSet, { appUrl: APP_URL, preview: true }),
  )
  assert.equal(
    JSON.stringify(exportReviewModel(reviewFor(shuffled))),
    JSON.stringify(exportReviewModel(reviewFor(recordSet))),
  )
})

// ---------------------------------------------------------------------------
// Ordering + shape locks
// ---------------------------------------------------------------------------

await test("shape: jobs sort alphabetically by 'workflow / job'; folds are collapsed by default", () => {
  const review = reviewFor(recordSet)
  const keys = review.jobs.map((j) => `${j.workflow} / ${j.name}`)
  assert.deepEqual(keys, [...keys].sort())
  const md = renderRunReview(review)
  assert.ok(!md.includes("<details open"))
})

await test("shape: edges sort into an independently specified exact order (lineage, address, ports, protocol, PID)", () => {
  // Hand-authored profile whose expected serialized edge order is specified
  // independently below — NOT derived from the comparator under test.
  const profile = {
    uuid: "eeeeeeee-0000-4000-8000-00000000000e",
    timestamp: "2026-07-01T00:00:00Z",
    scenarios: { github: { repository: REPO, workflow: "ci", job: "order", sha: "a".repeat(40), run_id: "31000000009" } },
    network: {
      egress: {
        peers: [
          // Same lineage/address/ports/protocol, PIDs 9 vs 10 (string order: "10" < "9").
          { remote_address: "10.0.0.1", remote_names: [], remote_ports: ["443"], protocol: "tcp", proc_trees: [{ pid: 9, process: "curl", ancestry: ["bash", "curl"] }, { pid: 10, process: "curl", ancestry: ["bash", "curl"] }] },
          // Same lineage/address/ports, protocol udp vs tcp above.
          { remote_address: "10.0.0.1", remote_names: [], remote_ports: ["443"], protocol: "udp", proc_trees: [{ pid: 7, process: "curl", ancestry: ["bash", "curl"] }] },
          // Same lineage/address, port 80 sorts before 443 ("443" < "80").
          { remote_address: "10.0.0.1", remote_names: [], remote_ports: ["80"], protocol: "tcp", proc_trees: [{ pid: 8, process: "curl", ancestry: ["bash", "curl"] }] },
          // Same lineage, address 10.0.0.2 sorts after 10.0.0.1.
          { remote_address: "10.0.0.2", remote_names: [], remote_ports: ["443"], protocol: "tcp", proc_trees: [{ pid: 6, process: "curl", ancestry: ["bash", "curl"] }] },
          // Lineage "bash › wget" sorts after "bash › curl".
          { remote_address: "10.0.0.1", remote_names: [], remote_ports: ["443"], protocol: "tcp", proc_trees: [{ pid: 5, process: "wget", ancestry: ["bash", "wget"] }] },
          // No proc_trees → lineage "unknown (not recorded)" sorts last.
          { remote_address: "10.0.0.1", remote_names: [], remote_ports: ["443"], protocol: "tcp", proc_trees: [] },
        ],
      },
    },
  }
  const job = summarizeProfile(profile)
  const got = job.edges.map((e) => [e.ancestry.join(" › ") || "(none)", e.remote_address, e.remote_ports.join(","), e.protocol, e.pid])
  // Independent expected order (lineage, then address, then ports string,
  // then protocol, then PID string — all lexicographic).
  const expected = [
    ["bash › curl", "10.0.0.1", "443", "tcp", "10"],
    ["bash › curl", "10.0.0.1", "443", "tcp", "9"],
    ["bash › curl", "10.0.0.1", "443", "udp", "7"],
    ["bash › curl", "10.0.0.1", "80", "tcp", "8"],
    ["bash › curl", "10.0.0.2", "443", "tcp", "6"],
    ["bash › wget", "10.0.0.1", "443", "tcp", "5"],
    ["(none)", "10.0.0.1", "443", "tcp", ""],
  ]
  assert.deepEqual(got, expected)
  assert.ok(
    EDGE_SUMMARY.indexOf("pid&nbsp;4104") <
      EDGE_SUMMARY.indexOf("pid&nbsp;4105"),
  )
})

await test("shape: mismatched sensor telemetry stays modeled but is not presented", () => {
  // edge-cases carries poisoned telemetry (99 domains / 999 connections).
  assert.ok(!EDGE_MD.includes("999"), "sensor telemetry leaked into the PR comment")
  assert.ok(!EDGE_SUMMARY.includes("99 unique domains"))
  assert.ok(!EDGE_SUMMARY.includes("999 connections"))
  assert.ok(!EDGE_SUMMARY.includes("Network telemetry observed"))
  assert.ok(!EDGE_SUMMARY.includes("| Source | Metric | Value |"))
  assert.ok(!EDGE_SUMMARY.includes("Profile discrepancy"))
  assert.equal(EDGE_MODEL.jobs[0].telemetry.total_connections, 999)
  assert.notEqual(
    EDGE_MODEL.jobs[0].telemetry.total_connections,
    EDGE_MODEL.jobs[0].counts.flows,
  )
})

await test("Gate T: pinned v2.15 matrix fixtures satisfy producer invariants", () => {
  for (const profile of recordSet) {
    const job = summarizeProfile(profile)
    assert.equal(job.telemetry.total_connections, job.counts.flows)
    assert.equal(job.telemetry.total_domains, job.counts.primary_names)
    assert.deepEqual(telemetryDiscrepancies(job), [])
  }
})

await test("Gate T: historical mismatches render without unexplained telemetry", () => {
  for (const file of ["normal-run.json", "worth-a-look-run.json"]) {
    const profile = load("real", file)
    const job = summarizeProfile(profile)
    assert.ok(telemetryDiscrepancies(job).length > 0)
    const summary = renderStepSummary([profile], { appUrl: APP_URL })
    assert.ok(!summary.includes("Network telemetry observed"))
    assert.ok(!summary.includes(`${job.telemetry.total_domains} unique domains`))
    assert.ok(!summary.includes(`${job.telemetry.total_connections} connections`))
    assert.ok(!summary.includes("Profile discrepancy"))
  }
})

await test("shape: Step Summary is lineage-keyed (deduped) with preview-only context", () => {
  assert.ok(EDGE_SUMMARY.startsWith(`## ${VOCAB.stepSummaryHeading}`))
  assert.ok(
    EDGE_SUMMARY.indexOf("### Workload Summary") <
      EDGE_SUMMARY.indexOf("### Network Egress Summary"),
  )
  assert.ok(EDGE_SUMMARY.includes("| Process Tree | Destinations |"))
  assert.ok(!EDGE_SUMMARY.includes("| Destination | Process Tree |"))
  assert.ok(
    EDGE_SUMMARY.includes(
      "Keyed by execution chain; repeated destination names within a chain are collapsed.",
    ),
  )
  assert.ok(!EDGE_SUMMARY.includes("in the profile's own order"))
  const uuidRow = EDGE_SUMMARY.indexOf("| Profile |")
  assert.ok(uuidRow !== -1 && uuidRow < EDGE_SUMMARY.indexOf("| Repository"))
  assert.ok(EDGE_SUMMARY.includes(`| Profile | [${edgeCaseEnvelope.id}](`))
  assert.ok(!EDGE_SUMMARY.includes("| Record UUID |"))
  assert.ok(REAL_SUMMARY.includes("| Branch |"))
  assert.ok(REAL_SUMMARY.includes("| Triggered by |"))
  assert.ok(EDGE_SUMMARY.includes("| Run ID / Job |"))
  assert.ok(EDGE_SUMMARY.includes("</code> <sub>pid&nbsp;4104</sub>"))
  // The preview recorded-context table keeps its inline PID form.
  assert.ok(EDGE_SUMMARY_PREVIEW.includes("<code>node (pid 4104)</code>"))
  assert.ok(REAL_SUMMARY.includes("<code>systemd</code> → <code>…</code>"))
  assert.ok(!EDGE_SUMMARY.includes("step: 3. Install dependencies"))
  assert.ok(!EDGE_SUMMARY.includes("detection:"))
  assert.ok(!EDGE_SUMMARY.includes("⚠ attention"))
  assert.ok(!EDGE_SUMMARY.includes("Assertions"))
  assert.ok(
    EDGE_SUMMARY_PREVIEW.includes(
      "<details><summary><strong>Recorded context preview</strong>",
    ),
  )
  assert.ok(EDGE_SUMMARY_PREVIEW.includes("<details><summary><strong>Assertions</strong>"))
  assert.ok(REAL_SUMMARY.includes("| Check | Result | Context |"))
  assert.ok(!EDGE_SUMMARY.includes("Network telemetry observed"))
  assert.ok(REAL_SUMMARY.includes("Network telemetry observed"))
  assert.ok(EDGE_SUMMARY.includes('<div align="right">'))
  // Footer: timestamp + one product path; workflow/run/job identity lives
  // only in the Workload table, and the brand is never doubled beside the CTA.
  assert.ok(!EDGE_SUMMARY.includes("Powered by Garnet</strong> ·"))
  assert.ok(!/<sub>workflow /.test(EDGE_SUMMARY))
  assert.ok(EDGE_SUMMARY.includes("Job summary generated at run-time"))
  assert.ok(EDGE_SUMMARY.includes("2026-07-08 05:35:56 UTC"))

  const rows = buildDestinationRows(EDGE_REVIEW.jobs[0].edges)
  const peers = rawProfile(edgeCases).network.egress.peers
  assert.equal(rows.length, peers.length)
  assert.deepEqual(
    rows.map((row) => row.remote_names.find(Boolean) || row.remote_address),
    peers.map(
      (peer) =>
        (peer.remote_names || []).find(Boolean) || String(peer.remote_address || ""),
    ),
  )
  assert.deepEqual(
    rows.map((row) => row.associations.map((edge) => edge.pid)),
    peers.map((peer) =>
      ((peer.proc_trees || []).length ? peer.proc_trees : [null]).map((tree) =>
        tree?.pid === undefined || tree?.pid === null ? "" : String(tree.pid),
      ),
    ),
  )
  assert.ok(rows.some((row) => row.associations.some((edge) => edge.pid === "4104")))
  assert.ok(rows.some((row) => row.associations.length > 1))
})

await test("shape: assertion evidence renders only when explicitly recorded and previewed", () => {
  const profile = JSON.parse(JSON.stringify(rawProfile(workload)))
  profile.assertions = [
    {
      class_id: "Network Egress",
      assertion_id: "no_bad_egress_domain",
      result: "attention",
      description: "A process contacted a bad network domain.",
      evidence: [
        {
          timestamp: "2026-07-13T23:54:30Z",
          event: "network_peer",
          remote_peer: "bad.example",
          protocol: "tcp",
          ports: ["443"],
          result: "attention",
          arguments: ["--password=assertion-secret"],
          executable: "/tmp/assertion-secret",
        },
      ],
    },
  ]
  const hidden = renderStepSummary([profile], { appUrl: APP_URL })
  const preview = renderStepSummary([profile], { appUrl: APP_URL, preview: true })
  const model = JSON.stringify(
    exportReviewModel(reviewFor([profile])),
  )
  assert.ok(!hidden.includes("bad.example"))
  assert.ok(preview.includes("| Assertion | Timestamp | Event | Remote Peer | Protocol | Ports | Result |"))
  assert.ok(preview.includes("bad.example"))
  assert.ok(preview.includes("network_peer"))
  assert.ok(!preview.includes("assertion-secret"))
  assert.ok(!model.includes("assertion-secret"))
  assert.ok(!model.includes("arguments"))
  assert.ok(!model.includes("executable"))
})

await test("shape: recorded matrix job index remains distinct metadata", () => {
  const data = JSON.parse(JSON.stringify(edgeCases))
  data.scenarios.github.job_index = 3
  const envelope = { id: "019f5e00-0000-7000-8000-000000000003", data }
  const model = exportReviewModel(reviewFor([envelope]))
  assert.equal(model.jobs[0].job_index, "3")
  assert.ok(renderStepSummary([envelope]).includes("| Matrix job index | 3 |"))
})

await test("shape: step attribution renders as factual `(step: …)` context, always HTML-escaped", () => {
  // Recorded step attributions decorate process lines as bracket context;
  // hostile step names stay escaped and structurally inert.
  assert.ok(EDGE_MD.includes("(step: "))
  const inj = renderRunReview(reviewFor([injection]))
  assert.ok(!/<script/i.test(inj), "injected markup must stay escaped")
  // No attributed chains at all → degraded coverage never collapses to an
  // empty tree: the recorded (escaped) lineage still renders.
  assert.ok(inj.includes("<pre>"))
  assert.ok(inj.includes("&lt;"))
})

await test("shape: completed explainer sits at the bottom, collapsed; pending explainer is open", () => {
  for (const md of [EDGE_MD, renderRunReview(reviewFor(recordSet))]) {
    assert.ok(md.includes("<details><summary><sub>💡 How to read this"))
    assert.ok(!md.includes("<details open><summary><sub>💡 How to read this"))
    assert.ok(!md.includes("garnet.ai/what-garnet-records"))
    assert.ok(md.includes("**Execution Profiles recorded for "), "headline missing")
    // Explainer is the last block, below the divider.
    const divider = md.lastIndexOf("\n---\n")
    assert.ok(divider !== -1 && md.indexOf("💡 How to read this") > divider)
    // Headline precedes the metadata blockquote which precedes the first fold.
    const headline = md.indexOf("**Execution Profiles recorded for ")
    const metadata = md.indexOf("> *")
    assert.ok(headline !== -1 && metadata > headline)
  }
  assert.ok(
    renderPendingReview({ sha: "ef01a52" }).includes(
      "<details open><summary><sub>💡 How to read this",
    ),
  )
})

await test("copy: public Markdown never emits the internal noun edge/edges", () => {
  const surfaces = [
    renderPendingReview({ sha: "ef01a52" }),
    renderRunReview(reviewFor(recordSet)),
    renderStepSummary(recordSet, { appUrl: APP_URL, preview: true }),
  ]
  for (const surface of surfaces) {
    assert.ok(!/\bedges?\b/i.test(surface), "internal edge noun leaked")
  }
})

// ---------------------------------------------------------------------------
// 6.5 — comparison states, defang scope, links, count dedup
// ---------------------------------------------------------------------------

function comparisonReviewFor(profiles, previousJobs, previousSha) {
  const jobs = profiles.map(summarizeProfile).filter(Boolean)
  const sha = jobs[0]?.sha || ""
  return buildRunReview({
    repo: REPO,
    sha,
    commitUrl: sha ? `https://github.com/${REPO}/commit/${sha}` : "",
    appUrl: APP_URL,
    appMode: true,
    jobs,
    previousSha,
    previousJobs,
  })
}

const PREV_SHA = "d84f4dc0000000000000000000000000000000dd"

await test("6.5: snapshot (no comparison) renders a plain <pre> tree — no fence, no @@, no +/− markers", () => {
  assert.ok(!EDGE_MD.includes("```"))
  assert.ok(!EDGE_MD.includes("@@"))
  for (const line of EDGE_MD.split("\n")) {
    assert.ok(!/^[+-] /.test(line), `snapshot carries a diff marker: ${line}`)
  }
  assert.ok(EDGE_MD.includes("<pre>"))
  assert.ok(EDGE_MD.includes("**Execution Profiles recorded for 1 job, triggered by"))
})

await test("6.5: comparison is only rendered from a supplied previous profiled commit — never fabricated", () => {
  assert.equal(reviewFor(recordSet).comparison, null)
  const noJobs = comparisonReviewFor(recordSet, null, PREV_SHA)
  assert.equal(noJobs.comparison, null)
  const jobs = recordSet.map(summarizeProfile).filter(Boolean)
  const noSha = comparisonReviewFor(
    recordSet,
    jobs.map((j) => ({ name: j.name, workflow: j.workflow, edges: j.edges })),
    "",
  )
  assert.equal(noSha.comparison, null)
})

await test("6.5: unchanged comparable jobs collapse with 'unchanged'; metadata says compared with", () => {
  const jobs = recordSet.map(summarizeProfile).filter(Boolean)
  const previous = jobs.map((j) => ({ name: j.name, workflow: j.workflow, edges: j.edges }))
  const review = comparisonReviewFor(recordSet, previous, PREV_SHA)
  const md = renderRunReview(review)
  // Zero-delta comparison: the verdict is the finding.
  assert.ok(md.includes("No changes since [`d84f4dc`]("))
  assert.ok(!md.includes("changed since"), "retired comparison copy")
  assert.ok(!md.includes("<details open><summary><code>"))
  assert.ok(md.includes("· unchanged"))
  assert.ok(!md.includes("```diff"))
  assert.ok(md.includes("<pre>"))
  // Nothing changed and nothing vanished: no job segments render.
  assert.ok(!md.includes("job changed") && !md.includes("jobs changed"))
})

await test("6.5: changed jobs open with an in-fold diff fence and one exact @@ header", () => {
  const jobs = recordSet.map(summarizeProfile).filter(Boolean)
  const previous = jobs.map((j) => ({
    name: j.name,
    workflow: j.workflow,
    edges:
      j.name === "workload-egress"
        ? j.edges.filter((e) => !(e.remote_names || []).includes("httpbin.org"))
        : j.edges,
  }))
  const review = comparisonReviewFor(recordSet, previous, PREV_SHA)
  const md = renderRunReview(review)
  const head7 = review.sha.slice(0, 7)
  // The metadata line names the previous profiled commit; the jobs line
  // carries the change facts.
  assert.ok(md.includes("compared with [`d84f4dc`]("))
  assert.match(md, /> \*1&nbsp;job changed/)
  // Changed fold is open, carries a bold delta with the comparison base,
  // and its tree is a diff fence.
  assert.ok(md.includes("<details open><summary><b>+"), "changed fold must open and lead with its bold delta")
  // The fold row carries only its own delta — the comparison base commit
  // renders once at run scope (metadata) and inside the @@ header.
  // v6.10.0: the row carries the bold split alone; the destination unit is
  // named once in the meta block.
  assert.match(md, /<b>\+\d+(&nbsp;−\d+)?<\/b> ·/)
  assert.ok(!/<\/b> since&nbsp;/.test(md), "fold delta repeats the run-scoped comparison sha")
  assert.ok(md.includes("```diff"))
  const headers = md.split("\n").filter((l) => l.startsWith("@@"))
  assert.equal(headers.length, 1, "exactly one @@ header for one changed job")
  // The @@ header names the commit pair only — the delta lives on the fold
  // row directly above; the same fact never renders twice back to back.
  assert.match(headers[0], new RegExp(`^@@ d84f4dc \\(previous\\) vs ${head7} \\(current\\) @@$`))
  // New chains carry + inside the fence; unchanged jobs stay plain <pre>.
  assert.ok(md.split("\n").some((l) => l.startsWith("+")))
  assert.ok(md.includes("<pre>"), "unchanged jobs lost their plain tree")
  // The fence sits inside the fold: <details open> precedes ```diff.
  assert.ok(md.indexOf("<details open><summary><b>+") < md.indexOf("```diff"))
  // Removed chains carry − when the previous profile recorded more.
  const removedReview = comparisonReviewFor(recordSet, jobs.map((j) => ({
    name: j.name,
    workflow: j.workflow,
    edges: [...j.edges, { ...j.edges[0], remote_names: ["removed.example"], remote_address: "203.0.113.99" }],
  })), PREV_SHA)
  const removedMd = renderRunReview(removedReview)
  assert.ok(removedMd.split("\n").some((l) => l.startsWith("-")), "no − marker for a no-longer-recorded chain")
  assert.ok(removedMd.includes("removed.example".replace(/\.(?=[^.]*$)/, "[.]")))
})

await test("6.5: a job that stops being recorded renders in the vanished fold, counted in destinations", () => {
  const jobs = recordSet.map(summarizeProfile).filter(Boolean)
  const vanishing = jobs.find((j) => j.name === "workload-egress")
  const survivors = recordSet.filter((r) => summarizeProfile(r).name !== "workload-egress")
  const previous = jobs.map((j) => ({ name: j.name, workflow: j.workflow, edges: j.edges }))
  const md = renderRunReview(comparisonReviewFor(survivors, previous, PREV_SHA))
  const names = addressNameMap(vanishing.edges)
  const vanishedDestinations = new Set(
    commentEdges(vanishing.edges).map((edge) => destinationIdentity(edge, names)),
  ).size

  assert.match(md, /> \*[\s\S]*no longer recorded/, "vanished jobs must surface on the jobs line")
  // The removal is visible, adjacent to its own count — never only in the total.
  const foldSummary = md
    .split("\n")
    .find((l) => l.includes(VOCAB.vanishedJobsLabel) && l.includes("<details><summary>"))
  assert.ok(foldSummary, "vanished jobs render in their own fold")
  assert.ok(
    foldSummary.includes(`${vanishedDestinations}&nbsp;destination${vanishedDestinations === 1 ? "" : "s"}`),
  )
  const entry = md
    .split("\n")
    .find((l) => l.includes("workload-egress") && l.includes("&nbsp;destination") && !l.includes("<details>"))
  assert.ok(entry, "vanished job entry lists the job with its destination count")
  // History sits below this commit's behavior: the fold follows every job fold row.
  assert.ok(md.indexOf(foldSummary) > md.lastIndexOf("&nbsp;↗"))
})

await test("6.5: matrix cells diff against their own previous cell, never each other", () => {
  const jobs = recordSet.map(summarizeProfile).filter(Boolean)
  const base = jobs.find((j) => j.name === "workload-egress")
  const cell = (job_index, edges) => ({ ...base, id: undefined, job_index, edges })
  const headCells = [cell("0", base.edges), cell("1", base.edges.slice(0, 1))]
  const previousCells = [
    { name: base.name, workflow: base.workflow, job_index: "0", edges: base.edges },
    { name: base.name, workflow: base.workflow, job_index: "1", edges: base.edges.slice(0, 1) },
  ]
  const review = buildRunReview({
    sha: base.sha,
    jobs: headCells,
    previousSha: PREV_SHA,
    previousJobs: previousCells,
  })
  const md = renderRunReview(review)
  // Each cell matches its own index: identical records, so nothing changed.
  assert.ok(md.includes("No changes since \`d84f4dc\`"))
  assert.ok(md.includes("· unchanged"))
  assert.ok(!md.includes("```diff"))
  // Cross-matched cells would diff cell 1's single chain against cell 0's tree.
  const swapped = buildRunReview({
    sha: base.sha,
    jobs: headCells,
    previousSha: PREV_SHA,
    previousJobs: [previousCells[1], previousCells[0]],
  })
  assert.equal(renderRunReview(swapped), md, "cell pairing depends on order, not identity")
})

await test("6.9: fold rows carry no step-name sentence — identity and destination count only", () => {
  const md = renderRunReview(reviewFor(recordSet))
  for (const fold of md.split("<details><summary>").slice(1)) {
    const row = fold.split("</summary>")[0]
    assert.ok(!row.includes("reached "), `fold row carries a step sentence: ${row}`)
    assert.ok(!row.includes("&nbsp;chain"), `fold row carries a chain count: ${row}`)
  }
  // The sensor's `NN. Runner Processes` sentinel is not a workflow step:
  // it is never presented as step attribution.
  assert.ok(isSentinelStep("99. Runner Processes"))
  assert.ok(isSentinelStep("Runner Processes"))
  assert.ok(!isSentinelStep("2. npm test"))
  assert.ok(!md.includes("(step: Runner Processes)"))
})

await test("6.5: hostnames defang on the PR comment only — Step Summary and JSON stay canonical", () => {
  assert.equal(defangHostname("registry.npmjs.org"), "registry.npmjs[.]org")
  assert.equal(defangHostname("localhost"), "localhost")
  assert.equal(defangHostname("140.82.113.23"), "140.82.113.23")
  assert.ok(EDGE_MD.includes("registry.npmjs[.]org"))
  assert.ok(!EDGE_SUMMARY.includes("[.]"))
  assert.ok(!JSON.stringify(EDGE_MODEL).includes("[.]"))
})

await test("6.5: the job-id text itself links to the specific Actions job URL, run URL as fallback", () => {
  const jobs = recordSet.map(summarizeProfile).filter(Boolean)
  const withJobURL = jobs.map((j) => ({
    ...j,
    job_url: `https://github.com/${REPO}/actions/runs/${j.run_id}/job/9${j.id ?? 0}001`,
  }))
  const review = buildRunReview({
    repo: REPO,
    sha: jobs[0].sha,
    commitUrl: `https://github.com/${REPO}/commit/${jobs[0].sha}`,
    appUrl: APP_URL,
    appMode: true,
    jobs: withJobURL,
  })
  const md = renderRunReview(review)
  assert.ok(md.includes("/job/9"), "specific job URL not used")
  assert.match(md, /<a href="[^"]*\/job\/9[^"]*"><code>[^<]+<\/code>&nbsp;↗<\/a>/)
  // Fallback: without job_url the fold links the run URL.
  const fallback = renderRunReview(reviewFor(recordSet))
  assert.match(fallback, /<a href="[^"]*\/actions\/runs\/\d+"><code>[^<]+<\/code>&nbsp;↗<\/a>/)
})

await test("6.9: count dedup — chain counts never render; every fold row carries its own destination count", () => {
  // Chain counts live in the garnet:summary marker and the full profile
  // only; the human surface counts destinations, once per row.
  for (const md of [EDGE_MD, renderRunReview(reviewFor(recordSet))]) {
    const visible = md.replace(/<!--[\s\S]*?-->/g, "")
    // The explainer teaches the execution-chain concept; counts never use it.
    assert.ok(!/\d+&nbsp;execution chain/.test(visible), "chain count rendered on the human surface")
    assert.ok(!/&nbsp;chains?\b/.test(visible))
    // Counts inflect: a count of 1 never reads a plural unit.
    assert.ok(!/(?<!\d)1&nbsp;destinations/.test(visible))
    assert.ok(!visible.includes("process chains"))
    for (const line of visible.split("\n")) {
      if (!line.startsWith("<details")) continue
      const summary = line.split("</summary>")[0]
      if (!summary.includes("&nbsp;↗")) continue // job fold rows only
      assert.match(summary, /\d+&nbsp;destination|<\/b>&nbsp;destinations?/, `fold row missing its destination fact: ${line}`)
    }
  }
})

// ---------------------------------------------------------------------------
// Golden regeneration lock (generated artifacts — never hand-edited)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Semantic surface linter — catches "same fact rendered twice in one block"
// (e.g. the telemetry-count footer duplication) that byte-goldens cannot see.
// ---------------------------------------------------------------------------

await test("lint: no fact family is duplicated within a surface block", () => {
  const stepSurfaces = [
    renderStepSummary([load("real", "normal-run.json")], { appUrl: APP_URL }),
    renderStepSummary([worth], { appUrl: APP_URL }),
    renderStepSummary(recordSet, { appUrl: APP_URL }),
    renderStepSummary(recordSet, { appUrl: APP_URL, preview: true }),
    EDGE_SUMMARY,
    EDGE_SUMMARY_PREVIEW,
  ]
  for (const surface of stepSurfaces) {
    const violations = lintRenderedSurface(surface, "step-summary")
    assert.deepEqual(violations, [], violations.join("; "))
  }
  const prSurfaces = [
    renderRunReview(reviewFor([load("real", "normal-run.json")])),
    renderRunReview(reviewFor(recordSet)),
    EDGE_MD,
  ]
  for (const surface of prSurfaces) {
    const violations = lintRenderedSurface(surface, "pr")
    assert.deepEqual(violations, [], violations.join("; "))
  }
})

await test("lint: linter actually flags a duplicated telemetry footer", () => {
  const dup =
    "Network telemetry observed 9 unique domains, 8 destinations.\n" +
    '<div align="right"><sub>9 unique domains \u00b7 workflow ci</sub></div>'
  const violations = lintRenderedSurface(dup, "step-summary")
  assert.ok(
    violations.some((v) => v.includes("unique-domain")),
    `expected a unique-domain violation, got: ${violations.join("; ")}`,
  )
})

await test("goldens: every golden byte-matches a fresh render", () => {
  const goldenDir = join(here, "fixtures", "renderer-testdata", "goldens")
  const comparisonPair = load("synthetic", "comparison-pair.json")
  const deltaPartitionPair = load("synthetic", "delta-partition-pair.json")
  const backgroundOnlyPair = load("synthetic", "background-only-pair.json")
  // Every generated golden is locked, comparison states included — an
  // unlocked golden silently drifts from the renderer that writes it.
  const states = {
    "registry-only": { profiles: [load("real", "normal-run.json")] },
    "workload-egress": { profiles: [worth] },
    "multi-job": { profiles: recordSet },
    "runner-infrastructure-only": {
      profiles: [load("synthetic", "runner-infrastructure-only.json")],
    },
    attribution: { profiles: load("synthetic", "attribution-cases.json") },
    "multi-job-comparison": {
      profiles: comparisonPair.head,
      previous: comparisonPair.previous,
    },
    "delta-partition": {
      profiles: deltaPartitionPair.head,
      previous: deltaPartitionPair.previous,
    },
    "background-only": {
      profiles: backgroundOnlyPair.head,
      previous: backgroundOnlyPair.previous,
    },
  }
  const noRecord = readFileSync(join(goldenDir, "no-record.pr-comment.md"), "utf8")
  assert.equal(
    noRecord,
    `${renderPendingReview({
      sha: "ef01a52517e7532ab34aadea58b952c9f1e79ece",
      commitUrl: `https://github.com/${REPO}/commit/ef01a52517e7532ab34aadea58b952c9f1e79ece`,
    })}\n`,
  )
  for (const [name, { profiles, previous }] of Object.entries(states)) {
    const previousJobs =
      previous === undefined ? null : previous.map(summarizeProfile).filter(Boolean)
    const review =
      previousJobs === null
        ? reviewFor(profiles)
        : comparisonReviewFor(profiles, previousJobs, previousJobs[0]?.sha ?? "")
    assert.equal(
      readFileSync(join(goldenDir, `${name}.pr-comment.md`), "utf8"),
      `${renderRunReview(review)}\n`,
      `${name}.pr-comment.md drifted`,
    )
    assert.equal(
      readFileSync(join(goldenDir, `${name}.review-model.json`), "utf8"),
      `${JSON.stringify(exportReviewModel(review), null, 2)}\n`,
      `${name}.review-model.json drifted`,
    )
    assert.equal(
      readFileSync(join(goldenDir, `${name}.step-summary.md`), "utf8"),
      `${renderStepSummary(profiles, { appUrl: APP_URL })}\n`,
      `${name}.step-summary.md drifted`,
    )
    assert.equal(
      readFileSync(join(goldenDir, `${name}.step-summary.preview.md`), "utf8"),
      `${renderStepSummary(profiles, { appUrl: APP_URL, preview: true })}\n`,
      `${name}.step-summary.preview.md drifted`,
    )
  }
})

await test("goldens: every pr-comment golden opens with the category heading byte-exactly", () => {
  const goldenDir = join(here, "fixtures", "renderer-testdata", "goldens")
  for (const f of readdirSync(goldenDir).filter((name) => name.endsWith(".pr-comment.md"))) {
    const body = readFileSync(join(goldenDir, f), "utf8")
    assert.ok(
      body.includes("**Execution Profiles record"),
      `${f} missing the category heading`,
    )
  }
})

// ---------------------------------------------------------------------------
// Gate 22 — banned-vocabulary copy-lint over every surface and golden
// ---------------------------------------------------------------------------

await test("gate 22: banned vocabulary absent from every emitted surface and golden", () => {
  const banned = CONTRACT_VOCAB.bannedVocabulary.map((phrase) => ({
    phrase,
    re: new RegExp(
      `(^|[^a-zA-Z])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-zA-Z])`,
      "i",
    ),
  }))
  const goldenDir = join(here, "fixtures", "renderer-testdata", "goldens")
  const surfaces = new Map()
  for (const f of readdirSync(goldenDir)) {
    surfaces.set(`goldens/${f}`, readFileSync(join(goldenDir, f), "utf8"))
  }
  surfaces.set("live:edge-cases.pr", EDGE_MD)
  surfaces.set("live:edge-cases.summary", EDGE_SUMMARY)
  surfaces.set("live:pending", renderPendingReview({ sha: "ef01a52" }))
  surfaces.set("live:multi.pr", renderRunReview(reviewFor(recordSet)))
  surfaces.set("live:multi.summary", renderStepSummary(recordSet, { appUrl: APP_URL }))
  // Record-sourced values (e.g. a workflow literally named "Garnet Runtime
  // Review") are evidence, not renderer copy — mask them before the scan.
  const recordValues = ["normal-run.json", "worth-a-look-run.json"]
    .map((f) => rawProfile(load("real", f)).scenarios?.github?.workflow || "")
    .filter(Boolean)
  for (const [name, body] of surfaces) {
    let masked = body
    for (const value of new Set(recordValues)) {
      masked = masked.replaceAll(value, "RECORD_VALUE")
    }
    for (const { phrase, re } of banned) {
      assert.ok(!re.test(masked), `banned phrase "${phrase}" found in ${name}`)
    }
  }
})

// ---------------------------------------------------------------------------
// Gate 24 — commit identity: synthetic merge SHAs resolve to the PR head
// ---------------------------------------------------------------------------

// Producer-side gate stub: the renderer performs no commit lookups (§8) and
// renders the SHA it is handed, so the resolution rule — a two-parent
// synthetic merge commit resolves to its second parent, the PR head;
// anything else renders unchanged — is locked here as executable spec over
// a fixture until a producer models it.
function resolvePrVisibleSha(recordedSha, parents) {
  return Array.isArray(parents) && parents.length === 2 && parents[1]
    ? parents[1]
    : recordedSha
}

// A pull_request-event record: GITHUB_SHA is the synthetic merge commit on
// refs/pull/N/merge; parents[0] is the base tip, parents[1] the PR head.
const SYNTHETIC_HEAD = {
  sha: "9c0ffeeb0a7500000000000000000000000000aa",
  parents: [
    "ba5eba5e00000000000000000000000000000000",
    "ab34ef1200000000000000000000000000000000",
  ],
}
const SYNTHETIC_PREVIOUS = {
  sha: "5eafd00d000000000000000000000000000000bb",
  parents: [
    "ba5eba5e00000000000000000000000000000000",
    PREV_SHA,
  ],
}

function commitIdentityReviewFor(profiles, sha, previousJobs, previousSha) {
  const jobs = profiles.map(summarizeProfile).filter(Boolean)
  return buildRunReview({
    repo: REPO,
    sha,
    commitUrl: `https://github.com/${REPO}/commit/${sha}`,
    appUrl: APP_URL,
    appMode: true,
    jobs,
    previousSha,
    previousJobs,
  })
}

await test("gate 24: a recorded synthetic merge SHA renders as the resolved PR head in headline and comparison", () => {
  const jobs = recordSet.map(summarizeProfile).filter(Boolean)
  const previous = jobs.map((j) => ({
    name: j.name,
    workflow: j.workflow,
    edges:
      j.name === "workload-egress"
        ? j.edges.filter((e) => !(e.remote_names || []).includes("httpbin.org"))
        : j.edges,
  }))
  const headSha = resolvePrVisibleSha(SYNTHETIC_HEAD.sha, SYNTHETIC_HEAD.parents)
  const prevSha = resolvePrVisibleSha(SYNTHETIC_PREVIOUS.sha, SYNTHETIC_PREVIOUS.parents)
  assert.equal(headSha, SYNTHETIC_HEAD.parents[1])
  assert.equal(prevSha, PREV_SHA)

  const md = renderRunReview(commitIdentityReviewFor(recordSet, headSha, previous, prevSha))
  const head7 = headSha.slice(0, 7)
  const prev7 = prevSha.slice(0, 7)
  // Headline trigger and permalink carry the resolved PR head.
  assert.ok(md.includes(`triggered by [\`${head7}\`](https://github.com/${REPO}/commit/${headSha})`))
  // The metadata comparison clause and the @@ pair carry PR-visible commits only.
  assert.ok(md.includes(`compared with [\`${prev7}\`](`))
  const headers = md.split("\n").filter((l) => l.startsWith("@@"))
  assert.ok(headers.length >= 1, "changed comparison must render an @@ header")
  for (const header of headers) {
    assert.match(header, new RegExp(`^@@ ${prev7} \\(previous\\) vs ${head7} \\(current\\) @@$`))
  }
  // The synthetic merge commits are invisible on the PR and never render.
  for (const synthetic of [SYNTHETIC_HEAD.sha, SYNTHETIC_PREVIOUS.sha]) {
    assert.ok(!md.includes(synthetic.slice(0, 7)), `synthetic merge sha ${synthetic.slice(0, 7)} leaked`)
  }
})

await test("gate 24: on resolution failure the raw recorded SHA renders unchanged — nothing fabricated", () => {
  for (const parents of [null, [], [SYNTHETIC_HEAD.parents[0]], [...SYNTHETIC_HEAD.parents, "cc00000000000000000000000000000000000000"]]) {
    assert.equal(resolvePrVisibleSha(SYNTHETIC_HEAD.sha, parents), SYNTHETIC_HEAD.sha)
  }
  const md = renderRunReview(commitIdentityReviewFor(recordSet, SYNTHETIC_HEAD.sha, null, ""))
  const raw7 = SYNTHETIC_HEAD.sha.slice(0, 7)
  assert.ok(md.includes(`triggered by [\`${raw7}\`](https://github.com/${REPO}/commit/${SYNTHETIC_HEAD.sha})`))
  // Degradation substitutes nothing: no resolved-parent sha, no placeholder.
  assert.ok(!md.includes(SYNTHETIC_HEAD.parents[1].slice(0, 7)))
  assert.ok(!md.includes("`unknown`"))
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
