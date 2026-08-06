#!/usr/bin/env node
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  addressNameMap,
  buildRunReview,
  compareJobEdges,
  destinationIdentity,
  partitionCommentEdges,
  renderJobDiffTree,
  renderRunReview,
  summarizeProfile,
  VOCAB,
} from "../src/runtime-review.js"

const here = dirname(fileURLToPath(import.meta.url))
const realDir = join(here, "fixtures", "renderer-testdata", "real")
const churnDir = join(realDir, "churn")
const load = (path) => JSON.parse(readFileSync(path, "utf8"))
const clone = (value) => JSON.parse(JSON.stringify(value))

const pairSpecs = [
  ["#98 dev", "pr98-dev-previous.json", "pr98-dev-head.json"],
  ["#98 workload-egress", "pr98-workload-previous.json", "pr98-workload-head.json"],
  [
    "#96 substrate",
    "pr96-substrate-previous.json",
    "pr96-substrate-head.json",
  ],
]

const summarize = (profile) => summarizeProfile(profile)
const reviewForPair = (previous, head) => {
  const job = summarize(head)
  const previousJob = summarize(previous)
  return buildRunReview({
    repo: "garnet-org/runtime-review-testbed",
    sha: job.sha,
    commitUrl: `https://github.com/garnet-org/runtime-review-testbed/commit/${job.sha}`,
    jobs: [job],
    previousSha: previousJob.sha,
    previousJobs: [previousJob],
  })
}

const diffFence = (markdown) => {
  const start = markdown.indexOf("```diff")
  if (start < 0) return ""
  const end = markdown.indexOf("```", start + 7)
  return markdown.slice(start + 7, end < 0 ? markdown.length : end)
}

const markedDestinations = (fence) =>
  fence
    .split("\n")
    .filter((line) => /^[+-] .*→ /.test(line))
    .map((line) => line.slice(line.indexOf("→ ") + 2).replace(/\s+\([^)]*\).*$/, "").trim())

const destinationDisplay = (id) =>
  id.includes(".") && !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(id)
    ? id.replace(/\.(?=[^.]*$)/, "[.]")
    : id
const escapedDisplay = (id) =>
  destinationDisplay(id).replace(/[<>&"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
  })[character])

function assertPairSemantics(label, previous, head) {
  const previousJob = summarize(previous)
  const headJob = summarize(head)
  const headWorkload = partitionCommentEdges(headJob.edges).shown
  const previousWorkload = partitionCommentEdges(previousJob.edges).shown
  const workload = compareJobEdges(headWorkload, previousWorkload)
  const review = reviewForPair(previous, head)
  const markdown = renderRunReview(review)
  const substrateStart = markdown.indexOf("dns + runner substrate")
  const mainMarkdown = substrateStart < 0 ? markdown : markdown.slice(0, substrateStart)
  const fence = diffFence(mainMarkdown)
  const plus = markedDestinations(fence).filter((_, index) => fence.split("\n").filter((line) => /^[+-] .*→ /.test(line))[index].startsWith("+"))
  const minus = markedDestinations(fence).filter((_, index) => fence.split("\n").filter((line) => /^[+-] .*→ /.test(line))[index].startsWith("-"))
  const expectedPlus = [...workload.addedIds].map(destinationDisplay).sort()
  const expectedMinus = [...workload.removedIds].map(destinationDisplay).sort()
  assert.deepEqual([...plus].sort(), expectedPlus, `${label}: added identities`)
  assert.deepEqual([...minus].sort(), expectedMinus, `${label}: removed identities`)
  assert.equal(new Set(plus).size, plus.length, `${label}: duplicate added identity`)
  assert.equal(new Set(minus).size, minus.length, `${label}: duplicate removed identity`)
  assert.equal(workload.addedCount, expectedPlus.length)
  assert.equal(workload.removedCount, expectedMinus.length)

  const pairNames = addressNameMap(headJob.edges, previousJob.edges)
  const expectedVisible = new Set(
    [...headJob.edges, ...previousJob.edges].map((edge) =>
      destinationIdentity(edge, pairNames),
    ),
  )
  for (const identity of expectedVisible) {
    assert.ok(
      markdown.includes(destinationDisplay(identity)) || markdown.includes(escapedDisplay(identity)),
      `${label}: ${identity} is not visible`,
    )
  }
  return { review, markdown, workload }
}

function mutateDuplicateLeaves(profile) {
  const out = clone(profile)
  const peers = out.network?.egress?.peers || []
  const seen = new Set()
  for (const peer of peers) {
    const id = (peer.remote_names || []).find((name) => name !== "") || peer.remote_address || ""
    if (seen.has(id) && Array.isArray(peer.proc_trees) && peer.proc_trees[0]) {
      peer.proc_trees[0].ancestry = [...(peer.proc_trees[0].ancestry || []), "reshaped-duplicate"]
      return out
    }
    seen.add(id)
  }
  return out
}

function perturbations(previous, head) {
  const pid = (profile) => {
    const out = clone(profile)
    for (const peer of out.network?.egress?.peers || []) {
      for (const tree of peer.proc_trees || []) tree.pid = `reshuffled-${tree.pid || "unknown"}`
    }
    return out
  }
  const reorder = (profile) => {
    const out = clone(profile)
    out.network.egress.peers.reverse()
    for (const peer of out.network.egress.peers) peer.proc_trees?.reverse()
    return out
  }
  const dnsJitter = (profile) => {
    const out = clone(profile)
    for (const peer of out.network?.egress?.peers || []) {
      if ((peer.remote_ports || []).some((port) => String(port).startsWith("53"))) {
        peer.remote_address = "127.0.0.54"
      }
    }
    return out
  }
  const stripNames = (profile, targetAddress) => {
    const out = clone(profile)
    for (const peer of out.network?.egress?.peers || []) {
      if (
        peer.remote_address === targetAddress &&
        (peer.remote_names || []).some((name) => name !== "")
      ) {
        peer.remote_names = []
        break
      }
    }
    return out
  }
  const truncateDuplicates = (profile) => {
    const out = clone(profile)
    const seen = new Set()
    for (const peer of out.network?.egress?.peers || []) {
      const id = (peer.remote_names || []).find((name) => name !== "") || peer.remote_address || ""
      if (seen.has(id)) peer.proc_trees = []
      seen.add(id)
    }
    return out
  }
  const sharedNamedAddress = (head.network?.egress?.peers || []).find((peer) =>
    (peer.remote_names || []).some((name) => name !== "") &&
    (previous.network?.egress?.peers || []).some(
      (candidate) =>
      candidate.remote_address === peer.remote_address &&
        (candidate.remote_names || []).some(
          (name) => name !== "" && (peer.remote_names || []).includes(name),
        ),
    ),
  )?.remote_address || ""
  return [
    ["PID reshuffle", pid(previous), pid(head)],
    ["sibling and chain reorder", reorder(previous), reorder(head)],
    ["capture-order shuffle", reorder(previous), head],
    ["DNS resolver IP jitter", dnsJitter(previous), dnsJitter(head)],
    ["safe process-path reshaping", mutateDuplicateLeaves(previous), mutateDuplicateLeaves(head)],
    ["duplicate-leaf truncation", truncateDuplicates(previous), truncateDuplicates(head)],
    ["unnamed-to-named normalization", stripNames(previous, sharedNamedAddress), head],
  ]
}

for (const [label, previousName, headName] of pairSpecs) {
  const previous = load(join(churnDir, previousName))
  const head = load(join(churnDir, headName))
  const baseline = assertPairSemantics(label, previous, head)
  for (const [name, perturbedPrevious, perturbedHead] of perturbations(previous, head)) {
    const rendered = renderRunReview(reviewForPair(perturbedPrevious, perturbedHead))
    assert.equal(rendered, baseline.markdown, `${label}: ${name} changed comparison bytes`)
  }
}

// Synthetic and checked-in real profiles must retain a visible projection of
// every captured identity, while evidence JSON remains untouched by comment
// deduplication.
const fixtureFiles = [
  ...["normal-run.json", "normal-v215.json", "npm-install-run.json", "worth-a-look-run.json"].map((name) =>
    join(realDir, name),
  ),
  ...["duplicate-edges.json", "edge-cases.json", "injection.json", "credential-argv.json"].map((name) =>
    join(here, "fixtures", "renderer-testdata", "synthetic", name),
  ),
]
for (const path of fixtureFiles) {
  const job = summarize(load(path))
  if (!job) continue
  const markdown = renderRunReview(
    buildRunReview({ repo: "fixture", sha: job.sha, jobs: [job] }),
  )
  const jobNames = addressNameMap(job.edges)
  for (const id of new Set(job.edges.map((edge) => destinationIdentity(edge, jobNames)))) {
    assert.ok(
      markdown.includes(id) || markdown.includes(escapedDisplay(id)),
      `${path}: captured ${id} is not visible`,
    )
  }
}

// Run-scope adjacency truth: the metadata's chain/destination numbers count
// exactly the rendered head rows (unmarked and `+`; `−` rows belong to the
// previous record) across every fold, workload and substrate alike.
const undefang = (value) => value.replace(/\[\.\]/g, ".")
function renderedHeadRows(markdown) {
  const body = markdown.split("\n---\n")[0]
  const rows = []
  for (const line of body.split("\n")) {
    const arrow = line.indexOf("→ ")
    if (arrow < 0) continue
    if (/^-/.test(line)) continue
    rows.push(
      undefang(
        line
          .slice(arrow + 2)
          .replace(/<\/?[a-z]+>/g, "")
          .replace(/\s+\([^)]*\).*$/, "")
          .trim(),
      ),
    )
  }
  return rows
}
for (const [label, previousName, headName] of pairSpecs) {
  const { markdown } = assertPairSemantics(
    label,
    load(join(churnDir, previousName)),
    load(join(churnDir, headName)),
  )
  const rows = renderedHeadRows(markdown)
  const chainsClaim = Number(markdown.match(/(\d+)&nbsp;execution chain/)[1])
  const destinationsClaim = Number(markdown.match(/(\d+)&nbsp;destination/)[1])
  assert.equal(chainsClaim, rows.length, `${label}: metadata chains vs rendered rows`)
  assert.equal(
    destinationsClaim,
    new Set(rows).size,
    `${label}: metadata destinations vs rendered identities`,
  )
}

// Cross-partition unification: a name recorded only on a substrate edge
// still names the workload row for the same address — the identity never
// loses its name between the two partitions.
{
  const bare = {
    remote_address: "192.0.2.7",
    remote_names: [],
    remote_ports: ["443"],
    detections: ["flow"],
    pid: "100",
    process: "node",
    ancestry: ["Runner.Worker", "bash", "node"],
    github_step: "1. Install",
    protocols: [],
  }
  const named = {
    ...bare,
    remote_names: ["unified.example.com"],
    pid: "5",
    process: "systemd-resolved",
    ancestry: ["systemd"],
    github_step: "",
  }
  const { shown, substrate } = partitionCommentEdges([bare, named])
  assert.equal(shown.length, 1, "cross-partition: one workload row")
  assert.equal(substrate.length, 0, "cross-partition: no duplicate identity row")
  assert.deepEqual(
    shown[0].remote_names,
    ["unified.example.com"],
    "cross-partition: workload row carries the captured name",
  )
}

// A vanished job whose record was substrate-only still appears under
// `jobs no longer recorded` with its comment-register chain count.
{
  const previous = load(join(churnDir, "pr96-substrate-previous.json"))
  const previousJob = summarize(previous)
  const previousPartition = partitionCommentEdges(previousJob.edges)
  assert.equal(previousPartition.shown.length, 0, "specimen must be substrate-only")
  const headJob = summarize(load(join(churnDir, "pr98-workload-head.json")))
  const markdown = renderRunReview(
    buildRunReview({
      repo: "garnet-org/runtime-review-testbed",
      sha: headJob.sha,
      commitUrl: `https://github.com/garnet-org/runtime-review-testbed/commit/${headJob.sha}`,
      jobs: [headJob],
      previousSha: previousJob.sha,
      previousJobs: [previousJob],
    }),
  )
  assert.ok(
    markdown.includes("jobs no longer recorded"),
    "vanished substrate-only job must be listed",
  )
  const entry = markdown
    .split("\n")
    .find((line) => line.includes("jobs no longer recorded") && line.includes("&nbsp;chain"))
  const count = Number(entry.match(/(\d+)&nbsp;chain/)[1])
  assert.equal(
    count,
    previousPartition.shown.length + previousPartition.substrate.length,
    "vanished job counts its comment-register rows",
  )
}

// ---------------------------------------------------------------------------
// v6.6.1 signal ordering: change tiers, jobs line, machine summary, fold
// budget, vanished fold placement. Built from real profiles reshaped into a
// multi-job comparison.
{
  const previous = load(join(churnDir, "pr98-workload-previous.json"))
  const head = load(join(churnDir, "pr98-workload-head.json"))
  const asJob = (profile, workflow, name) => ({
    ...summarize(profile),
    workflow,
    name,
    job_index: "",
  })
  const changedJob = asJob(head, "CI", "a-changed")
  const unchangedJob = asJob(head, "CI", "m-same")
  const emptyJob = { ...asJob(head, "CI", "b-empty"), edges: [] }
  const vanishedJob = asJob(previous, "CI", "z-gone")
  const reviewFor = (jobs, previousJobs) =>
    buildRunReview({
      repo: "garnet-org/runtime-review-testbed",
      sha: changedJob.sha,
      commitUrl: `https://github.com/garnet-org/runtime-review-testbed/commit/${changedJob.sha}`,
      jobs,
      previousSha: summarize(previous).sha,
      previousJobs,
    })
  const review = reviewFor(
    [emptyJob, changedJob, unchangedJob],
    [
      { name: "a-changed", workflow: "CI", edges: summarize(previous).edges },
      { name: "m-same", workflow: "CI", edges: summarize(head).edges },
      { name: "z-gone", workflow: "CI", edges: vanishedJob.edges },
    ],
  )
  const markdown = renderRunReview(review)

  // Tier order: the changed fold leads, the unchanged fold follows, the
  // empty job sinks below both, the vanished fold sits below every job.
  const at = (needle) => {
    const index = markdown.indexOf(needle)
    assert.ok(index >= 0, `${needle} must render`)
    return index
  }
  assert.ok(at("a-changed") < at("m-same"), "changed job precedes unchanged job")
  assert.ok(at("m-same") < at("b-empty"), "unchanged job precedes empty job")
  assert.ok(at("b-empty") < at("z-gone"), "vanished fold sits below every job")

  // Jobs line: every segment counts the folds/entries rendered beneath it.
  const jobsLine = markdown
    .split("\n")
    .find((line) => line.startsWith("> *") && line.includes("job changed"))
  assert.ok(jobsLine, "comparison with changes carries a jobs line")
  const workload = compareJobEdges(
    partitionCommentEdges(changedJob.edges).shown,
    partitionCommentEdges(summarize(previous).edges).shown,
  )
  assert.ok(
    jobsLine.includes(
      `1&nbsp;job changed ${[
        workload.addedCount > 0 ? `+${workload.addedCount}` : "",
        workload.removedCount > 0 ? `−${workload.removedCount}` : "",
      ]
        .filter(Boolean)
        .join("&nbsp;")}&nbsp;destination`,
    ),
    "changed segment carries the workload delta totals",
  )
  assert.ok(jobsLine.includes("1&nbsp;job unchanged"), "unchanged segment")
  assert.ok(jobsLine.includes("1&nbsp;job with no outbound destinations"), "no-outbound segment")
  assert.ok(jobsLine.includes("1&nbsp;job no longer recorded"), "vanished segment")

  // Machine summary marker: JSON numbers equal the rendered counts.
  const marker = markdown.split("\n").find((line) => line.startsWith("<!-- garnet:summary "))
  assert.ok(marker, "machine summary marker renders")
  const summary = JSON.parse(marker.slice("<!-- garnet:summary ".length, -" -->".length))
  assert.equal(summary.jobs, 3)
  assert.equal(summary.changed, 1)
  assert.equal(summary.unchanged, 1)
  assert.equal(summary.noOutbound, 1)
  assert.equal(summary.vanished, 1)
  assert.equal(summary.added, workload.addedCount)
  assert.equal(summary.removed, workload.removedCount)
  assert.equal(summary.changed + summary.unchanged + summary.noOutbound, summary.jobs)
  const metadataChains = Number(markdown.match(/(\d+)&nbsp;execution chain/)[1])
  assert.equal(summary.chains, metadataChains, "marker chains equal the metadata count")

  // Fold budget: one changed job renders open; more changed jobs than the
  // budget renders every job fold collapsed while deltas stay on fold rows.
  assert.ok(markdown.includes("<details open"), "within budget, the changed fold opens")
  const crowd = [...Array(4)].map((_, i) => asJob(head, "CI", `crowd-${i}`))
  const crowdPrevious = crowd.map((job) => ({
    name: job.name,
    workflow: "CI",
    edges: summarize(previous).edges,
  }))
  const crowded = renderRunReview(reviewFor(crowd, crowdPrevious))
  assert.ok(!crowded.includes("<details open"), "beyond the budget, no job fold opens")
  assert.ok(crowded.includes("4&nbsp;jobs changed"), "the jobs line still carries the change facts")

  // Snapshot comments carry the marker with null comparison fields and no jobs line.
  const snapshot = renderRunReview(
    buildRunReview({
      repo: "garnet-org/runtime-review-testbed",
      sha: changedJob.sha,
      commitUrl: `https://github.com/garnet-org/runtime-review-testbed/commit/${changedJob.sha}`,
      jobs: [changedJob],
    }),
  )
  const snapshotMarker = snapshot.split("\n").find((line) => line.startsWith("<!-- garnet:summary "))
  assert.ok(snapshotMarker, "snapshot carries the machine summary marker")
  const snapshotSummary = JSON.parse(
    snapshotMarker.slice("<!-- garnet:summary ".length, -" -->".length),
  )
  assert.equal(snapshotSummary.previous, null)
  assert.equal(snapshotSummary.changed, null)
  assert.ok(!snapshot.includes("job unchanged"), "snapshot renders no jobs line")

  // Determinism: job input order never changes bytes.
  const shuffled = renderRunReview(
    reviewFor(
      [changedJob, unchangedJob, emptyJob],
      [
        { name: "z-gone", workflow: "CI", edges: vanishedJob.edges },
        { name: "m-same", workflow: "CI", edges: summarize(head).edges },
        { name: "a-changed", workflow: "CI", edges: summarize(previous).edges },
      ],
    ),
  )
  assert.equal(shuffled, markdown, "job input order never changes bytes")
}

// Synthetic profile helper for edge-case gates.
const syntheticProfile = ({ job = "app", sha = "a".repeat(40), peers = [] }) => ({
  uuid: "eeeeeeee-0000-4000-8000-00000000000e",
  timestamp: "2026-08-01T00:00:00Z",
  scenarios: {
    github: {
      repository: "garnet-org/runtime-review-testbed",
      workflow: "ci",
      job,
      sha,
      run_id: "42000000042",
    },
  },
  network: { egress: { peers } },
})
const workloadPeer = (address, names, overrides = {}) => ({
  remote_address: address,
  remote_names: names,
  remote_ports: ["443"],
  protocol: "tcp",
  proc_trees: [
    {
      pid: 7,
      process: "node",
      github_step: "1. Build",
      ancestry: ["Runner.Worker", "bash", "node"],
    },
  ],
  ...overrides,
})
const reviewFor = (headProfile, previousProfile = null) => {
  const headJob = summarize(headProfile)
  const previousJob = previousProfile ? summarize(previousProfile) : null
  return buildRunReview({
    repo: "garnet-org/runtime-review-testbed",
    sha: headJob?.sha ?? "b".repeat(40),
    jobs: headJob ? [headJob] : [],
    ...(previousJob ? { previousSha: previousJob.sha, previousJobs: [previousJob] } : {}),
  })
}

// Canonical recorded name: an address-like alias in the first remote_names
// slot never outranks a recorded hostname — identity, display, and counts
// all use the hostname; the alias never renders as a separate identity.
{
  const head = syntheticProfile({
    peers: [workloadPeer("203.0.113.9", ["203.0.113.9", "alias.example.org"])],
  })
  const markdown = renderRunReview(reviewFor(head))
  assert.ok(markdown.includes("alias.example[.]org"), "hostname must be the display identity")
  const job = summarize(head)
  assert.equal(
    destinationIdentity(job.edges[0], addressNameMap(job.edges)),
    "alias.example.org",
    "hostname must be the comparison identity",
  )
}

// A job whose whole record left since the previous profiled commit is a
// changed job: its removals render as `−` rows, never 'no outbound
// destinations recorded.'
{
  const previous = syntheticProfile({
    sha: "c".repeat(40),
    peers: [workloadPeer("198.51.100.4", ["left.example.com"])],
  })
  const head = syntheticProfile({ peers: [] })
  const markdown = renderRunReview(reviewFor(head, previous))
  assert.ok(!markdown.includes("no outbound destinations recorded"), "vanished record is a change")
  assert.ok(markdown.includes("left.example[.]com"), "removed destination must stay visible")
  assert.ok(diffFence(markdown).split("\n").some((line) => line.startsWith("- ")), "removal renders as a − row")
}

// Substrate rows that exist only on the previous record still render: the
// substrate fold appears with its removals even when the head record has no
// substrate rows, and its count matches its rendered head rows (zero).
{
  const substratePeer = {
    remote_address: "127.0.0.53",
    remote_names: [],
    remote_ports: ["53"],
    protocol: "udp",
    proc_trees: [{ pid: 5, process: "systemd-resolved", ancestry: ["systemd"] }],
    github_step: "",
  }
  const previous = syntheticProfile({
    sha: "d".repeat(40),
    peers: [workloadPeer("198.51.100.7", ["kept.example.com"]), substratePeer],
  })
  const head = syntheticProfile({
    peers: [workloadPeer("198.51.100.7", ["kept.example.com"])],
  })
  const markdown = renderRunReview(reviewFor(head, previous))
  assert.ok(markdown.includes("dns + runner substrate"), "previous-only substrate fold renders")
  assert.ok(markdown.includes("127.0.0.53"), "previous-only substrate row stays visible")
}

// Partition movement: a destination recorded on both commits never becomes
// added or removed when its attribution moves between the workload tree and
// the substrate fold — one job-wide identity scope governs both partitions.
{
  const moved = "45.55.44.33"
  const previous = syntheticProfile({
    sha: "e".repeat(40),
    peers: [
      workloadPeer("198.51.100.7", ["kept.example.com"]),
      workloadPeer(moved, [], {
        proc_trees: [{ pid: 3, process: "provjobd", github_step: "", ancestry: ["provjobd"] }],
      }),
    ],
  })
  const head = syntheticProfile({
    peers: [workloadPeer("198.51.100.7", ["kept.example.com"]), workloadPeer(moved, [])],
  })
  const markdown = renderRunReview(reviewFor(head, previous))
  const fence = diffFence(markdown)
  assert.ok(
    !fence.split("\n").some((line) => /^[+-] /.test(line) && line.includes(moved)),
    "partition movement is never an added/removed identity",
  )
  assert.ok(markdown.includes(moved), "moved destination stays visible")
}

// A job whose workload tree is unchanged but whose substrate fold renders a
// diff never claims bare `no change`: the fold row scopes the claim to the
// workload and the substrate fold carries its own movement.
{
  const dnsPeer = (address) => ({
    remote_address: address,
    remote_names: ["localhost"],
    remote_ports: ["53 (dns)"],
    protocol: "udp",
    proc_trees: [
      { pid: 9, process: "node", github_step: "1. Build", ancestry: ["Runner.Worker", "bash", "node"] },
    ],
  })
  const previous = syntheticProfile({
    sha: "e".repeat(40),
    peers: [workloadPeer("198.51.100.7", ["kept.example.com"])],
  })
  const head = syntheticProfile({
    peers: [workloadPeer("198.51.100.7", ["kept.example.com"]), dnsPeer("127.0.0.53")],
  })
  const markdown = renderRunReview(reviewFor(head, previous))
  const foldRow = markdown
    .split("\n")
    .find((line) => line.includes("<summary>") && line.includes("<code>app</code>")) || ""
  assert.ok(foldRow.includes(VOCAB.noWorkloadChange), "substrate-only movement scopes the claim to the workload")
  assert.ok(
    !new RegExp(`· ${VOCAB.noChange}(\\b|<)`).test(foldRow),
    "a job whose substrate fold renders a diff never claims bare 'no change'",
  )
  const substrateRow = markdown
    .split("\n")
    .find((line) => line.includes(VOCAB.substrateFoldLabel)) || ""
  assert.match(substrateRow, /\+1&nbsp;destination/, "the substrate fold label carries its own movement")
}

// Runner-substrate rotation: GitHub rotates the provisioning daemon's PID
// suffix and the load balancer's address between runs. The same recorded
// destination name must stay one identity — never a `−`/`+` pair — and the
// chain must render inside the collapsed substrate fold, never in the
// workload tree.
{
  const substratePeer = (address, pidSuffix) => ({
    remote_address: address,
    remote_names: ["glb-2a3c35-public-internal.githubapp.com"],
    remote_ports: ["443 (https)"],
    protocol: "tcp",
    proc_trees: [
      {
        pid: 1864,
        process: `provjobd${pidSuffix}`,
        github_step: "99. Runner Processes",
        ancestry: ["systemd", "hosted-compute-agent", "sudo", `provjobd${pidSuffix}`],
      },
    ],
  })
  const previous = syntheticProfile({
    sha: "e".repeat(40),
    peers: [workloadPeer("198.51.100.7", ["kept.example.com"]), substratePeer("140.82.112.99", "999999999")],
  })
  const head = syntheticProfile({
    peers: [workloadPeer("198.51.100.7", ["kept.example.com"]), substratePeer("140.82.114.23", "811584691")],
  })
  const markdown = renderRunReview(reviewFor(head, previous))
  assert.ok(
    !diffFence(markdown)
      .split("\n")
      .some((line) => /^[+-] /.test(line) && line.includes("glb-2a3c35-public-internal")),
    "rotated substrate address is never an added/removed identity",
  )
  const lines = markdown.split("\n")
  const substrateFold = lines.findIndex((line) => line.includes(VOCAB.substrateFoldLabel))
  const glb = lines.findIndex((line) => line.includes("glb-2a3c35-public-internal"))
  assert.ok(substrateFold >= 0 && glb > substrateFold, "substrate chain renders inside the substrate fold")
  assert.ok(
    !lines.some((line) => line.includes("provjobd811584691")),
    "the PID suffix never reaches the rendered tree",
  )
}

// An empty run (no jobs recorded) renders deterministically and never throws.
{
  const review = buildRunReview({ repo: "garnet-org/runtime-review-testbed", sha: "f".repeat(40), jobs: [] })
  const markdown = renderRunReview(review)
  assert.equal(markdown, renderRunReview(review), "empty run renders deterministically")
  assert.ok(markdown.length > 0, "empty run still renders a comment body")
}

// Signal-ordering edge cases: fold budget exactly at the threshold, a jobs
// line with zero changed jobs but vanished ones, every job vanished, an
// empty-head changed job counted as changed, and marker JSON escaping.
{
  const previous = load(join(churnDir, "pr98-workload-previous.json"))
  const head = load(join(churnDir, "pr98-workload-head.json"))
  const asJob = (profile, name) => ({ ...summarize(profile), workflow: "CI", name, job_index: "" })
  const multiReview = (jobs, previousJobs) =>
    buildRunReview({
      repo: "garnet-org/runtime-review-testbed",
      sha: summarize(head).sha,
      jobs,
      previousSha: summarize(previous).sha,
      previousJobs,
    })

  // Budget boundary: exactly FOLD_OPEN_BUDGET (3) changed jobs still render
  // open; the fourth changed job collapses every fold.
  const changedJobs = (n) => [...Array(n)].map((_, i) => asJob(head, `crowd-${i}`))
  const changedPrevious = (jobs) =>
    jobs.map((job) => ({ name: job.name, workflow: "CI", edges: summarize(previous).edges }))
  const exactly3 = renderRunReview(multiReview(changedJobs(3), changedPrevious(changedJobs(3))))
  assert.ok(exactly3.includes("<details open"), "exactly 3 changed jobs render open folds")
  const over = renderRunReview(multiReview(changedJobs(4), changedPrevious(changedJobs(4))))
  assert.ok(!over.includes("<details open"), "4 changed jobs render every fold collapsed")

  // Zero changed jobs with vanished ones still renders the jobs line, with
  // the vanished segment carrying the count.
  const same = asJob(head, "steady")
  const zeroChanged = renderRunReview(
    multiReview(
      [same],
      [
        { name: "steady", workflow: "CI", edges: summarize(head).edges },
        { name: "z-gone", workflow: "CI", edges: summarize(previous).edges },
      ],
    ),
  )
  const zeroChangedJobsLine = zeroChanged
    .split("\n")
    .find((line) => line.startsWith("> *") && line.includes("no longer recorded"))
  assert.ok(zeroChangedJobsLine, "vanished-only comparison still carries a jobs line")
  assert.ok(!zeroChangedJobsLine.includes("job changed"), "no changed segment renders")
  assert.ok(zeroChanged.includes("jobs no longer recorded"), "vanished fold renders")

  // All jobs vanished: the head record carries no jobs at all, yet every
  // previous job is listed and counted.
  const allVanished = renderRunReview(
    multiReview(
      [],
      [
        { name: "one-gone", workflow: "CI", edges: summarize(previous).edges },
        { name: "two-gone", workflow: "CI", edges: summarize(head).edges },
      ],
    ),
  )
  assert.ok(allVanished.includes("one-gone"), "first vanished job listed")
  assert.ok(allVanished.includes("two-gone"), "second vanished job listed")
  const allVanishedMarker = JSON.parse(
    allVanished
      .split("\n")
      .find((line) => line.startsWith("<!-- garnet:summary "))
      .slice("<!-- garnet:summary ".length, -" -->".length),
  )
  assert.equal(allVanishedMarker.jobs, 0)
  assert.equal(allVanishedMarker.vanished, 2)

  // An empty-head changed job (whole record left) counts as changed in the
  // jobs line and marker — never as "no outbound destinations".
  const emptied = { ...asJob(head, "emptied"), edges: [] }
  const emptiedRender = renderRunReview(
    multiReview([emptied], [{ name: "emptied", workflow: "CI", edges: summarize(previous).edges }]),
  )
  const emptiedMarker = JSON.parse(
    emptiedRender
      .split("\n")
      .find((line) => line.startsWith("<!-- garnet:summary "))
      .slice("<!-- garnet:summary ".length, -" -->".length),
  )
  assert.equal(emptiedMarker.changed, 1, "emptied job counts as changed")
  assert.equal(emptiedMarker.noOutbound, 0, "emptied job never counts as no-outbound")
  assert.ok(!emptiedRender.includes("no outbound destinations recorded"), "removals render instead")
}

// Marker escaping: a record-sourced value containing `-->` can never
// terminate the marker comment, and JSON.parse restores the exact bytes.
{
  const hostileSha = 'x--> "</pre>'
  const review = buildRunReview({
    repo: "garnet-org/runtime-review-testbed",
    sha: hostileSha,
    jobs: [summarize(syntheticProfile({ peers: [workloadPeer("198.51.100.9", ["m.example.net"])], sha: hostileSha }))],
  })
  const markdown = renderRunReview(review)
  const markerLine = markdown.split("\n").find((line) => line.startsWith("<!-- garnet:summary "))
  assert.ok(markerLine.endsWith(" -->"), "marker comment stays one well-formed HTML comment")
  assert.ok(!markerLine.slice(0, -4).includes("-->"), "no early comment terminator")
  const parsed = JSON.parse(markerLine.slice("<!-- garnet:summary ".length, -" -->".length))
  assert.equal(parsed.commit, hostileSha, "JSON.parse restores the recorded bytes")
}

// Attribution alone decides the workload/substrate partition: a recorded
// detection on an unattributed runner-infrastructure chain keeps its emphasis
// and detection note inside the substrate fold, never renders in the workload
// tree, and rotating infra destinations never produce workload +/− rows.
{
  const infraPeer = (name) =>
    workloadPeer("20.75.202.224", [name], {
      proc_trees: [
        {
          pid: 9,
          process: "provjobd",
          github_step: "99. Runner Processes",
          ancestry: ["systemd", "hosted-compute-agent", "sudo", "provjobd"],
        },
      ],
      detections: ["code_modification_through_procfs", "flow"],
    })
  const head = syntheticProfile({
    peers: [
      workloadPeer("198.51.100.7", ["app.example.net"]),
      infraPeer("glb-p4a577-public-internal.githubapp.com"),
    ],
  })
  const previous = syntheticProfile({
    sha: "c".repeat(40),
    peers: [
      workloadPeer("198.51.100.7", ["app.example.net"]),
      infraPeer("hosted-compute-watchdog-prod-eus-02.githubapp"),
    ],
  })

  const snapshot = renderRunReview(reviewFor(head))
  const substrateStart = snapshot.indexOf("dns + runner substrate")
  assert.ok(substrateStart !== -1, "substrate fold renders")
  assert.ok(
    !snapshot.slice(0, substrateStart).includes("glb-p4a577"),
    "infra chain never renders in the workload tree",
  )
  assert.ok(
    snapshot.slice(substrateStart).includes("glb-p4a577-public-internal.githubapp[.]com"),
    "infra destination stays visible inside the fold",
  )
  assert.ok(
    snapshot.slice(substrateStart).includes("<strong>provjobd</strong>"),
    "detection keeps emphasis inside the fold",
  )

  const comparison = renderRunReview(reviewFor(head, previous))
  const workloadFence = diffFence(comparison.slice(0, comparison.indexOf("dns + runner substrate")))
  assert.deepEqual(
    markedDestinations(workloadFence),
    [],
    "rotated infra destination never renders as workload +/−",
  )
}

console.log(`v6.6.1 semantic and perturbation gates passed for ${pairSpecs.length} real pairs`)

