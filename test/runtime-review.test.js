#!/usr/bin/env node
/**
 * Contract tests for the Step Summary receipt — the only surface the Action
 * renders. The PR comment is rendered by the Garnet App.
 *
 * Locks destination-association preservation, escaping, defanging, detection
 * opt-in, medium truncation, selector policy, byte-determinism, and copy lint
 * over every emitted surface and golden.
 */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import {
  escapeMarkdownCell,
  buildRunReview,
  CONTRACT_VOCAB,
  VOCAB,
  STEP_SUMMARY_BUDGET,
  summarizeProfile,
  renderStepSummary,
  renderExecutionChains,
  truncateMiddle,
  formatTimestamp,
  isAddressLike,
  edgeNotes,
  edgeCounts,
  buildLineageRows,
  isGithubInfraName,
  profilePermalink,
  defangHostname,
} from "../src/runtime-review.js"

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

const EMPTY_CONTEXT = {
  sensor: "",
  capture: "",
  sensorIntegrity: "",
  sensorAuthenticity: "",
  steps: "",
}
const EDGE_SUMMARY = renderStepSummary([edgeCaseEnvelope], { appUrl: APP_URL })
const EDGE_SUMMARY_PREVIEW = renderStepSummary([edgeCaseEnvelope], {
  appUrl: APP_URL,
  preview: true,
})
const REAL_SUMMARY = renderStepSummary(recordSet, { appUrl: APP_URL, preview: true })

// ---------------------------------------------------------------------------
// Contract lock
// ---------------------------------------------------------------------------

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

await test("gate 4: one meaning per style — bold marks the process that acted", () => {
  // Bold marks the process that acted; italic wraps annotations only.
  const fold = EDGE_SUMMARY.slice(EDGE_SUMMARY.indexOf("<details><summary><sub>Execution chains"))
  assert.ok(fold.includes("<strong>curl</strong>"))
  assert.ok(!fold.includes("<em>Runner.Worker</em>"))
  for (const match of fold.matchAll(/<em>([^<]*)<\/em>/g)) {
    assert.ok(match[1].startsWith("("), `italic wraps a non-annotation: ${match[0]}`)
  }
  assert.ok(EDGE_SUMMARY.includes("unknown (not recorded)"))
  const workloadSummary = renderStepSummary([workload], { appUrl: APP_URL })
  assert.ok(workloadSummary.includes("<strong>node</strong>"))
  assert.ok(!workloadSummary.includes("detection: exec_from_unusual_dir"))
})

await test("gate 5: evidence keeps PID-distinct edges", () => {
  assert.ok(EDGE_SUMMARY.includes("<sub>pid&nbsp;4104</sub>"))
  assert.ok(EDGE_SUMMARY.includes("<sub>pid&nbsp;4105</sub>"))
  assert.ok(!/×\d/.test(EDGE_SUMMARY))
})

await test("gate 6: empty proc_trees emits one edge with lineage 'unknown (not recorded)'", () => {
  // Unknown-lineage chains render in the job's block like every recorded
  // root and stay in the model and Step Summary.
  assert.ok(EDGE_SUMMARY.includes("<code>no-lineage&#91;.&#93;example</code>"))
  assert.ok(EDGE_SUMMARY.includes("<code>unknown (not recorded)</code>"))
  // The address stays out of the table; the chains fold keeps it.
  const fold = EDGE_SUMMARY.indexOf("<details><summary><sub>Execution chains ·")
  assert.ok(!EDGE_SUMMARY.slice(0, fold).includes("198.51.100.44"))
  assert.ok(EDGE_SUMMARY.slice(fold).includes("[198.51.100&#91;.&#93;44]"))
  const model = summarizeProfile(edgeCaseEnvelope).edges.find((e) => e.remote_address === "198.51.100.44")
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
  assert.ok(EDGE_SUMMARY.includes("<sub>pid&nbsp;4106</sub>"))
  assert.deepEqual(
    edgeNotes({ remote_address: "169.254.169.254", remote_ports: [] }),
    ["Cloud IMDS"],
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

await test("gate 8: loopback resolvers (:53, including '53 (dns)') are neither rendered nor counted", () => {
  for (const surface of [EDGE_SUMMARY, EDGE_SUMMARY_PREVIEW]) {
    assert.ok(!surface.includes("127.0.0.53") && !surface.includes("127.0.0&#91;.&#93;53"))
  }
  // The record stays lossless; only the Step Summary drops the resolver.
  const recorded = summarizeProfile(edgeCaseEnvelope)
  assert.ok(recorded.edges.some((edge) => edge.remote_address === "127.0.0.53"))
  const shown = buildRunReview({ jobs: [recorded] }).jobs[0]
  assert.ok(!shown.edges.some((edge) => edge.remote_address === "127.0.0.53"))
  assert.equal(shown.counts.destinations, new Set(shown.edges.map((edge) => edge.remote_address)).size)
})

await test("gate 9: loopback:8080 gets NO resolver note (and still counts)", () => {
  assert.ok(EDGE_SUMMARY.includes("<code>127.0.0&#91;.&#93;1</code>"))
  // Ports stay out of the table; the chains fold keeps them losslessly.
  const fold = EDGE_SUMMARY.indexOf("<details><summary><sub>Execution chains ·")
  assert.ok(!EDGE_SUMMARY.slice(0, fold).includes("8080"))
  assert.ok(EDGE_SUMMARY.slice(fold).includes(":8080"))
  const previewLine = EDGE_SUMMARY_PREVIEW.split("\n").find((l) => l.includes("8080"))
  assert.ok(previewLine.includes("8080"))
  assert.ok(!previewLine.includes("(dns resolver)"))
})

await test("gate 10: an address-like remote name never double-renders or counts as a domain", () => {
  const line = EDGE_SUMMARY.split("\n").find((l) => l.includes("140.82.113&#91;.&#93;23"))
  assert.ok(!line.includes("(140.82.113.23)"), "identical name rendered beside its address")
  assert.ok(isAddressLike("140.82.113.23"))
  const counted = edgeCounts([
    { remote_address: "140.82.113.23", remote_names: ["140.82.113.23"], remote_ports: [] },
  ])
  assert.equal(counted.domains, 0)
  assert.equal(counted.destinations, 1)
})

await test("gate 11: secondary/truncated names stay out of prod and remain verbatim in preview", () => {
  assert.ok(EDGE_SUMMARY.includes("glb-2a3c35-public-internal.githubapp&#91;.&#93;com"))
  const previewTable = EDGE_SUMMARY_PREVIEW.slice(EDGE_SUMMARY_PREVIEW.indexOf("Recorded context preview"))
  const previewLine = previewTable.split("\n").find((line) =>
    line.includes("also recorded:"),
  )
  assert.ok(previewLine.includes("hosted-compute-watchdog-prod-iad-02.githubapp"))
  assert.ok(previewLine.includes("also recorded:"))
})

await test("gate 11b: non-flow detections annotate only under assertions preview; flow is omitted", () => {
  assert.deepEqual(
    edgeNotes(
      {
        remote_address: "203.0.113.1",
        remote_ports: ["443"],
        detections: ["flow", "exec_from_unusual_dir", "network_peer"],
      },
      { detections: true },
    ),
    ["detection: exec_from_unusual_dir", "detection: network_peer"],
  )
  // Off unless the caller opts in.
  assert.deepEqual(
    edgeNotes({
      remote_address: "203.0.113.1",
      remote_ports: ["443"],
      detections: ["flow", "exec_from_unusual_dir"],
    }),
    [],
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
  const prodSummary = renderStepSummary([workload], { appUrl: APP_URL })
  assert.ok(!prodSummary.includes("detection: exec_from_unusual_dir"))
  // Preview alone does not turn detections on; only the opt-in does.
  const previewSummary = renderStepSummary([workload], { appUrl: APP_URL, preview: true })
  assert.ok(!previewSummary.includes("detection:"))
  const optedIn = renderStepSummary([workload], { appUrl: APP_URL, preview: true, detections: true })
  assert.ok(optedIn.includes("detection: exec_from_unusual_dir"))
  assert.ok(!optedIn.includes("detection: flow"))
})

// ---------------------------------------------------------------------------
// Gates 12–13 — timestamps and pending state
// ---------------------------------------------------------------------------

await test("gate 12: deterministic sensor timestamp — profile.timestamp only, exact format", () => {
  assert.equal(formatTimestamp("2026-07-08T05:35:56.123456789Z"), "2026-07-08 05:35:56 UTC")
  assert.equal(formatTimestamp(""), "")
  assert.equal(formatTimestamp("not-a-date"), "")
  assert.ok(EDGE_SUMMARY.includes("2026-07-08 05:35:56 UTC"))
})

await test("gate 14: a job with empty peers renders exactly 'no outbound destinations recorded.'", () => {
  const empty = {
    ...edgeCases,
    telemetry: undefined,
    network: { egress: { peers: [] } },
  }
  const summary = renderStepSummary([empty], { appUrl: APP_URL })
  assert.ok(summary.includes("no outbound destinations recorded."))
  assert.ok(!summary.includes("Network telemetry observed"))
})

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

const CREDENTIAL_TOKENS = [
  "ghp_SECRETTOKEN",
  "wJalrXUtnFEMIexampleKEY",
  "Authorization: Bearer",
  "secret-tools-DIRNAME9f8e7d6c",
  "curl-wrapper",
  "AWS_SECRET_ACCESS_KEY",
]

await test("gate 18: credential-shaped argv/executable never leak on any surface", () => {
  const surfaces = [
    renderStepSummary([credential], { appUrl: APP_URL }),
    renderStepSummary([credential], { appUrl: APP_URL, preview: true }),
  ]
  for (const surface of surfaces) {
    for (const token of CREDENTIAL_TOKENS) {
      assert.ok(!surface.includes(token), `leaked: ${token}`)
    }
  }
})

await test("gate 19: HTML/Markdown injection payloads render inert on every Step Summary surface", () => {
  const surfaces = [
    renderStepSummary([injection], { appUrl: APP_URL }),
    renderStepSummary([injection], { appUrl: APP_URL, preview: true }),
  ]
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
  // GitHub parses Markdown inside inline <code>, so table cells must carry the
  // payload with its Markdown punctuation entity-encoded, not merely wrapped.
  const outsidePre = summary.replace(/<pre>[\s\S]*?<\/pre>/g, "<pre>pre</pre>")
  assert.ok(!outsidePre.includes("![exfil]("), "markdown image left active inside a table cell")
  assert.ok(summary.includes("!&#91;exfil&#93;(//evil.example/x.png)"), "payload dropped instead of contained")
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
  assert.ok(EDGE_SUMMARY.includes("utm_medium=step_summary"))
  assert.equal(profilePermalink({ run_id: "1", profile_id: "" }, APP_URL, "pr_comment"), "")
})

await test("gate 20d: raw profile shape — data.uuid is never a Profile UUID or ?profile= selector", () => {
  // The live workflow supplies raw profiles (no control-plane envelope).
  const job = summarizeProfile(edgeCases)
  assert.equal(job.profile_id, "")
  assert.equal(job.uuid, edgeCases.uuid)
  const summary = renderStepSummary([edgeCases], { appUrl: APP_URL })
  assert.ok(!summary.includes("Record UUID"), "raw record UUID leaked into Workload Summary")
  assert.ok(!summary.includes("Profile UUID"), "raw data.uuid mislabeled as Profile UUID")
  for (const surface of [summary]) {
    assert.ok(!surface.includes(`?profile=${edgeCases.uuid}`), "raw data.uuid fabricated into a selector")
    assert.ok(!surface.includes("?profile="), "raw profile must never carry an exact selector")
  }
})

await test("gate 20e: enveloped profile shape — envelope Profile.ID is the Profile row and drives the selector", () => {
  const job = summarizeProfile(edgeCaseEnvelope)
  assert.equal(job.profile_id, edgeCaseEnvelope.id)
  assert.equal(job.uuid, edgeCases.uuid)
  const link = profilePermalink(job, APP_URL, "step_summary")
  assert.ok(link !== "")
  assert.ok(EDGE_SUMMARY.includes(`| Profile | [${edgeCaseEnvelope.id}](${link}) |`))
  assert.ok(!EDGE_SUMMARY.includes("Record UUID"))
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

await test("gate: step summary chains fold — collapsed, root-to-action, PIDs never merged, no diff markers", () => {
  assert.ok(EDGE_SUMMARY.includes("<details><summary><sub>Execution chains · "))
  assert.ok(!EDGE_SUMMARY.includes("Execution tree"))
  assert.ok(!EDGE_SUMMARY.includes("Full recorded tree"))
  assert.ok(!EDGE_SUMMARY.includes("<details open"))
  const job = buildRunReview({ jobs: [summarizeProfile(edgeCaseEnvelope)] }).jobs[0]
  const chains = renderExecutionChains(buildLineageRows(job.edges))
  assert.ok(EDGE_SUMMARY.includes(chains))
  const foldStart = EDGE_SUMMARY.indexOf("<details><summary><sub>Execution chains")
  const foldEnd = EDGE_SUMMARY.indexOf("</details>", foldStart)
  const fold = EDGE_SUMMARY.slice(foldStart, foldEnd)
  // The fold count is the number of action leaves.
  const leaves = (fold.match(/○ /g) || []).length
  assert.equal(leaves, job.edges.length)
  assert.ok(fold.includes(`Execution chains · ${job.edges.length}&nbsp;destination association`))
  // Every recorded PID is its own bold process line.
  const pids = new Set(job.edges.filter((edge) => edge.pid !== "").map((edge) => edge.pid))
  for (const pid of pids) {
    assert.equal(fold.split(`<em>(pid ${pid})</em>`).length - 1, 1, `pid ${pid} must render exactly once`)
  }
  // Absolute view only — no comparison material inside the fold.
  assert.ok(!/^[+−-] /m.test(fold.replace(/<[^>]+>/g, "")))
  assert.ok(!fold.includes("no longer recorded"))
})

await test("gate: execution chains fold preserves destination identity order", () => {
  const summary = renderStepSummary([worth], { appUrl: APP_URL })
  const foldStart = summary.indexOf("<details><summary><sub>Execution chains")
  assert.notEqual(foldStart, -1)
  const fold = summary
    .slice(foldStart, summary.indexOf("</details>", foldStart))
    .replace(/<[^>]+>/g, "")
    .replaceAll("&#91;.&#93;", ".")
  const expectedOrder = [
    "npm test",
    "○ api.garnet.ai",
    "○ github.com",
    "○ images.unsplash.com",
    "○ registry.npmjs.org",
    "npm install",
  ]
  let previousIndex = -1
  for (const value of expectedOrder) {
    const index = fold.indexOf(value, previousIndex + 1)
    assert.ok(index > previousIndex, `expected ${JSON.stringify(value)} after the preceding item`)
    previousIndex = index
  }
})

await test("detections: off by default on every Action surface, restored only by the opt-in", () => {
  const surfaces = [
    ...recordSet,
    workload,
    worth,
    edgeCaseEnvelope,
  ].flatMap((profile) => [
    renderStepSummary([profile], { appUrl: APP_URL }),
    renderStepSummary([profile], { appUrl: APP_URL, preview: true }),
  ])
  for (const surface of surfaces) {
    assert.ok(!surface.includes("detection:"), "a default surface carries a detection label")
    assert.ok(!surface.includes("exec_from_unusual_dir"), "a default surface carries a detection kind")
  }
  const optedIn = renderStepSummary([workload], { appUrl: APP_URL, detections: true })
  const fold = optedIn.slice(optedIn.indexOf("<details><summary><sub>Execution chains"))
  assert.ok(fold.includes("detection: exec_from_unusual_dir"))
  // The record itself stays lossless; only presentation is gated.
  assert.ok(summarizeProfile(workload).edges.some((edge) => edge.detections.includes("exec_from_unusual_dir")))
})

await test("shape: workload context heads the receipt with every recorded fact and the post-step context", () => {
  const context = {
    sensor: "Jibril v2.17.0",
    capture: "capture incomplete: eBPF errors: attach=1",
    sensorIntegrity: "bundle digests match the signed release manifest",
    sensorAuthenticity: "not checked: github_token is unset",
    steps: "8 recorded (source: api)",
  }
  const summary = renderStepSummary([workload], { appUrl: APP_URL, context })
  const head = summary.slice(0, summary.indexOf("### Network egress"))
  for (const row of [
    "| Workflow |",
    "| Job |",
    "| Commit |",
    "| Run |",
    "| Coverage |",
    "| Capture | <code>capture incomplete&#58; eBPF errors&#58; attach=1</code> |",
    "| Sensor | Jibril v2.17.0 |",
    "| Sensor integrity | bundle digests match the signed release manifest |",
    "| Sensor authenticity | not checked&#58; github&#95;token is unset |",
    "| Workflow steps |",
    "| Workload activity |",
    "| Runner activity |",
    "| Sensor network totals |",
  ]) {
    assert.ok(head.includes(row), `workload context lacks ${row}`)
  }
  assert.ok(!/verified|detected|caught|\bsafe\b/i.test(head))
  // Without post-step context the record-only rows still render, nothing is guessed.
  const bare = renderStepSummary([workload], { appUrl: APP_URL })
  assert.ok(!bare.includes("| Sensor |") && !bare.includes("| Capture |"))
  assert.ok(bare.includes("| Coverage |"))
})

await test("shape: chains share parents only on an exact recorded ancestry match", () => {
  const edge = (pid, ancestry) => ({
    remote_names: ["example.org"],
    remote_address: "203.0.113.9",
    remote_ports: ["443"],
    protocol: "TCP",
    proc_trees: [{ pid, process: ancestry[ancestry.length - 1], ancestry, github_step: "4. Run workload" }],
  })
  const profile = {
    scenarios: { github: { job: "j", workflow: "w", repository: "o/r", run_id: "1" } },
    network: {
      egress: {
        peers: [
          edge(101, ["systemd", "Runner.Worker", "bash", "node"]),
          edge(102, ["systemd", "Runner.Worker", "bash", "node"]),
          edge(103, ["systemd", "Runner.Worker", "bash", "node", "dash", "curl"]),
        ],
      },
    },
  }
  const job = summarizeProfile(profile)
  const chains = renderExecutionChains(buildLineageRows(job.edges))
  const blocks = chains.split("\n\n")
  // 101 and 102 share the exact ancestry above them: one group, two leaves.
  assert.equal(blocks.length, 2)
  assert.ok(blocks[0].includes("(pid 101)") && blocks[0].includes("(pid 102)"))
  assert.equal(blocks[0].split("<strong>node</strong>").length - 1, 2)
  // 103's ancestry only shares a prefix, so it stays its own chain.
  assert.ok(blocks[1].includes("(pid 103)") && !blocks[1].includes("(pid 101)"))
  assert.ok(blocks[1].startsWith("systemd\n└─ Runner.Worker"))
})

await test("gate: preview material is contained — default bytes carry none of it on any surface", () => {
  const previewMarkers = [
    "Recorded context preview",
    "<details><summary><strong>Assertions</strong>",
    "| Assertion |",
    "detection:",
    "attention",
  ]
  const inputs = [recordSet, [edgeCaseEnvelope], [edgeCases], [worth], [injection]]
  for (const profiles of inputs) {
    const defaultSummary = renderStepSummary(profiles, { appUrl: APP_URL })
    for (const marker of previewMarkers) {
      assert.ok(!defaultSummary.includes(marker), `default step summary leaked ${JSON.stringify(marker)}`)
    }
  }
})

await test("gate 21: three renders of the same input byte-compare equal", () => {
  const inputs = [recordSet, [edgeCases], [injection], [oversizedProfile()]]
  for (const profiles of inputs) {
    const summaries = [1, 2, 3].map(() => renderStepSummary(profiles, { appUrl: APP_URL }))
    assert.ok(summaries[0] === summaries[1] && summaries[1] === summaries[2])
  }
})

await test("gate 21b: the lineage-keyed Step Summary is canonical (order-independent)", () => {
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
    renderStepSummary(shuffled, { appUrl: APP_URL, preview: true }),
    renderStepSummary(recordSet, { appUrl: APP_URL, preview: true }),
  )
})

// ---------------------------------------------------------------------------
// Ordering + shape locks
// ---------------------------------------------------------------------------

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
  assert.ok(!EDGE_SUMMARY.includes("99 unique domains"))
  assert.ok(!EDGE_SUMMARY.includes("999 connections"))
  assert.ok(!EDGE_SUMMARY.includes("Network telemetry observed"))
  assert.ok(!EDGE_SUMMARY.includes("| Source | Metric | Value |"))
  assert.ok(!EDGE_SUMMARY.includes("Profile discrepancy"))
  const job = summarizeProfile(edgeCaseEnvelope)
  assert.equal(job.telemetry.total_connections, 999)
  assert.notEqual(job.telemetry.total_connections, job.counts.flows)
})

await test("Gate T: historical mismatches render without unexplained telemetry", () => {
  for (const file of ["normal-run.json", "worth-a-look-run.json"]) {
    const profile = load("real", file)
    const job = summarizeProfile(profile)
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
    EDGE_SUMMARY.indexOf("### Workload context") <
      EDGE_SUMMARY.indexOf("### Network egress"),
  )
  assert.ok(
    EDGE_SUMMARY.indexOf("| Execution chain | Destinations |") <
      EDGE_SUMMARY.indexOf("<details><summary><sub>Execution chains"),
  )
  assert.ok(EDGE_SUMMARY.includes("| Execution chain | Destinations |"))
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
  assert.ok(EDGE_SUMMARY.includes("| Run |"))
  assert.ok(EDGE_SUMMARY.includes("| Coverage | recorded at the kernel by Garnet. Capture is best-effort. |"))
  assert.ok(EDGE_SUMMARY.includes("</code> <sub>pid&nbsp;4104</sub>"))
  // The preview recorded-context table keeps its inline PID form.
  assert.ok(EDGE_SUMMARY_PREVIEW.includes("<code>node (pid 4104)</code>"))
  assert.ok(REAL_SUMMARY.includes("<code>systemd</code> → <code>…</code>"))
  assert.ok(!EDGE_SUMMARY.includes("step: 3. Install dependencies"))
  assert.ok(!EDGE_SUMMARY.includes("detection:"))
  assert.ok(!EDGE_SUMMARY.includes("attention"))
  assert.ok(!EDGE_SUMMARY.includes("Assertions"))
  assert.ok(
    EDGE_SUMMARY_PREVIEW.includes(
      "<details><summary><strong>Recorded context preview</strong>",
    ),
  )
  assert.ok(EDGE_SUMMARY_PREVIEW.includes("<details><summary><strong>Assertions</strong>"))
  assert.ok(REAL_SUMMARY.includes("| Check | Result | Context |"))
  assert.ok(!EDGE_SUMMARY.includes("Network telemetry observed"))
  assert.ok(REAL_SUMMARY.includes("| Sensor network totals |"))
  assert.ok(EDGE_SUMMARY.includes('<div align="right">'))
  // Footer: timestamp + one product path; workflow/run/job identity lives
  // only in the Workload table, and the brand is never doubled beside the CTA.
  assert.ok(!EDGE_SUMMARY.includes("Powered by Garnet</strong> ·"))
  assert.ok(!/<sub>workflow /.test(EDGE_SUMMARY))
  // GitHub prints its own "Job summary generated at run-time" line; the CTA ends the summary.
  assert.ok(!EDGE_SUMMARY.includes("Job summary generated at run-time"))
  assert.ok(EDGE_SUMMARY.trimEnd().endsWith("</div>"))
  assert.ok(EDGE_SUMMARY.includes("2026-07-08 05:35:56 UTC"))

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
  assert.ok(!hidden.includes("bad.example"))
  assert.ok(preview.includes("| Assertion | Timestamp | Event | Remote Peer | Protocol | Ports | Result |"))
  assert.ok(preview.includes("bad.example"))
  assert.ok(preview.includes("network&#95;peer"))
  assert.ok(!preview.includes("assertion-secret"))
})

await test("shape: recorded matrix job index remains distinct metadata", () => {
  const data = JSON.parse(JSON.stringify(edgeCases))
  data.scenarios.github.job_index = 3
  const envelope = { id: "019f5e00-0000-7000-8000-000000000003", data }
  assert.equal(summarizeProfile(envelope).job_index, "3")
  assert.ok(renderStepSummary([envelope]).includes("| Matrix job index | <code>3</code> |"))
  // A matrix leg reads `<job> (i of N)` once the job total is known.
  const name = summarizeProfile(envelope).name
  const labelled = renderStepSummary([envelope], { appUrl: APP_URL, context: { ...EMPTY_CONTEXT, jobTotal: "5" } })
  assert.ok(labelled.includes(`| Job | <code>${escapeMarkdownCell(name)} (4 of 5)</code> |`))
  assert.ok(renderStepSummary([envelope], { appUrl: APP_URL }).includes(`| Job | <code>${escapeMarkdownCell(name)}</code> |`))
})

await test("hardening: bidi, zero-width, C1 and separator characters never reach the Step Summary", () => {
  const data = JSON.parse(JSON.stringify(edgeCases))
  data.scenarios.github.event_name = "pull_request_target\u202E"
  data.scenarios.github.workflow = "\u0085\uFEFFci\u2066hidden\u2069\u2028"
  data.network.egress.peers[0].remote_names = ["registry.npmjs.org\u200B"]
  data.network.egress.peers[0].proc_trees[0].process = "\u202Egro.sjmpn.yrtsiger"
  const summary = renderStepSummary([data], { appUrl: APP_URL, preview: true })
  assert.equal(summary.match(/[\u0080-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]/), null)
})

await test("hardening: record-sourced context cells sit in <code>, so @mentions and #refs stay inert", () => {
  const data = JSON.parse(JSON.stringify(edgeCases))
  data.scenarios.github.workflow = "fix #123 @octocat"
  data.scenarios.github.job = "build @octocat"
  data.scenarios.github.ref = "refs/heads/fix-@maintainer"
  data.scenarios.github.actor = "octocat"
  data.scenarios.github.event_name = "push #7"
  const head = renderStepSummary([data], { appUrl: APP_URL }).split("### Network egress")[0]
  for (const row of head.split("\n").filter((line) => /^\| (Workflow|Job|Branch|Event|Triggered by|Repository|Commit) \|/.test(line))) {
    assert.match(row, /^\| [A-Za-z ]+ \| <code>[^<]*<\/code> \|$/, `record cell outside <code>: ${row}`)
  }
  assert.ok(head.includes("<code>fix #123 &#64;octocat</code>"))
})

await test("gate 19b: table cells entity-encode Markdown link, emphasis, autolink and mention syntax", () => {
  const cell = escapeMarkdownCell("[a](https://evil.example/x) **b** @octocat www.evil.example | x")
  for (const active of ["[a](", "**", "https://", "@octocat", "www.", " | "]) {
    assert.ok(!cell.includes(active), `active Markdown survived: ${active}`)
  }
  assert.equal(
    cell,
    "&#91;a&#93;(https&#58;//evil.example/x) &#42;&#42;b&#42;&#42; &#64;octocat www&#46;evil.example \\| x",
  )
})

await test("copy: public Markdown never emits the internal noun edge/edges", () => {
  const surfaces = [
    renderStepSummary(recordSet, { appUrl: APP_URL }),
    renderStepSummary(recordSet, { appUrl: APP_URL, preview: true }),
  ]
  for (const surface of surfaces) {
    assert.ok(!/\bedges?\b/i.test(surface), "internal edge noun leaked")
  }
})

await test("defang: hosts and IPv4 addresses defang in the human register only", () => {
  assert.equal(defangHostname("registry.npmjs.org"), "registry.npmjs[.]org")
  assert.equal(defangHostname("localhost"), "localhost")
  assert.equal(defangHostname("140.82.113.23"), "140.82.113[.]23")
  assert.ok(EDGE_SUMMARY.includes("registry.npmjs&#91;.&#93;org"))
  assert.ok(!EDGE_SUMMARY.includes("[.]"))
  assert.ok(!JSON.stringify(summarizeProfile(edgeCaseEnvelope)).includes("[.]"))
})

await test("goldens: every Step Summary golden byte-matches a fresh render", () => {
  const goldenDir = join(here, "fixtures", "renderer-testdata", "goldens")
  const states = {
    "registry-only": [load("real", "normal-run.json")],
    "workload-egress": [worth],
    "multi-job": recordSet,
    "runner-infrastructure-only": [load("synthetic", "runner-infrastructure-only.json")],
    attribution: load("synthetic", "attribution-cases.json"),
    "multi-job-comparison": load("synthetic", "comparison-pair.json").head,
    "delta-partition": load("synthetic", "delta-partition-pair.json").head,
    "background-only": load("synthetic", "background-only-pair.json").head,
    "infra-rotation": load("synthetic", "rotation-pair.json").head,
    "branch-marking": load("synthetic", "branch-marking.json").head,
    "shai-hulud-worm": load("synthetic", "shai-hulud-worm-pair.json").head,
  }
  const expected = Object.keys(states).flatMap((name) => [`${name}.step-summary.md`, `${name}.step-summary.preview.md`])
  assert.deepEqual(readdirSync(goldenDir).sort(), expected.sort())
  for (const [name, profiles] of Object.entries(states)) {
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
  surfaces.set("live:edge-cases.summary", EDGE_SUMMARY)
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

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
