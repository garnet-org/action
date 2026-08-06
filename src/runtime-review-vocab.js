/**
 * Machine-readable contract lock — exact copy of
 * garnet-org/runtime-review-testbed contract/vocab.json at commit
 * 814d4d328f679f40b4546918a1c3bf347101413f (contract v6.6.1). Vendored so the
 * renderer needs no filesystem read at runtime. Regenerate by copying the
 * upstream file; never hand-edit values.
 */

export const CONTRACT_VOCAB = {
    "$schema_comment": "Machine-readable execution-comment contract lock (v6.6.1) — single source for exact emitted copy, comparison identity, lossless projection, deterministic factual notes, medium limits, selector/privacy requirements, and deferrals. Consumed by cmd/garnet-runtime-review/review.mjs. Locked by docs/ux-contract.md.",
    "version": "6.6.1",
    "profileFormatVersion": "0.2.0",
    "copy": {
        "headlineLead": "Execution Profiles recorded for",
        "headlineTemplate": "**Execution Profiles recorded for <N> job(s), triggered by [`<sha7>`](<commit-url>)** — the one headline, bold body register, never a `#` heading; all counts and change facts live in the metadata line and job folds",
        "headlinePendingLead": "Execution Profiles recording for jobs triggered by",
        "headlinePendingTemplate": "**Execution Profiles recording for jobs triggered by [`<sha7>`](<commit-url>)**",
        "metadataTemplate": "> *<N>&nbsp;execution chain(s) · <N>&nbsp;destination(s) [· changed|no change since [`<prev7>`](<prev-commit-url>)] · recorded at the kernel by Garnet · <UTC timestamp>* — noun facts only, each · segment one fact; the change clause renders only on comparison comments ; italic blockquote only, never <sub> (GitHub mobile collapses <sub> line-height and a wrapped line overprints itself)",
        "stepSummaryHeading": "Garnet Execution Summary",
        "artifact": "Execution Profile",
        "data": "the record",
        "kernelProvenance": "recorded at the kernel by Garnet",
        "sensor": "Jibril",
        "destinationNoun": "destination",
        "chainNoun": "execution chain",
        "chainNounRule": "first count mention spells 'execution chains'; subsequent counts use bare 'chains'; never 'process chains'; never 'trees' as a count noun — a job has one tree and N chains",
        "permalinkLabel": "View this job's Execution Profile in Garnet →",
        "emptyPeers": "no outbound destinations recorded.",
        "noRunProfile": "no Execution Profile recorded.",
        "unknownLineage": "unknown (not recorded)",
        "explainerLabel": "💡 How to read this",
        "pendingStatus": "⏳ Execution Profiles for this commit are still being recorded — this comment updates in place as jobs finish.",
        "truncationTemplate": "rendered X of Y destination associations",
        "noChange": "no change",
        "noWorkloadChange": "no workload change",
        "sinceWord": "since",
        "vanishedJobsLabel": "jobs no longer recorded",
        "jobsLineTemplate": "> *<X> job(s) changed +A&nbsp;−R&nbsp;destination(s) · <Y> job(s) unchanged [· <Z> job(s) with no outbound destinations] [· <W> job(s) no longer recorded]* — second blockquote paragraph directly under the metadata line, comparison comments only, rendered only when a workload change or a vanished job exists; every segment is a job count over the folds/entries rendered below and the segments sum to the comment's rendered jobs plus the vanished fold's entries (adjacency gate); +A −R are the workload delta totals over the rendered job folds with the unit named and zero sides dropped (vanished chains stay in their own segment); noun facts only",
        "jobsLineNoOutbound": "with no outbound destinations",
        "jobsLineVanished": "no longer recorded",
        "jobsLineChanged": "changed",
        "jobsLineUnchanged": "unchanged",
        "machineSummaryMarker": "garnet:summary",
        "substrateFoldLabel": "dns + runner substrate",
        "whatIsGarnetLabel": "What is Garnet →",
        "whatIsGarnetUrl": "https://docs.garnet.ai?utm_source=github&utm_medium=pr_comment",
        "egressCentricScope": "The record is egress-centric; processes without recorded egress do not appear.",
        "substrateVisibility": "nothing subtracts: attributed workload chains render in the job's main tree; dns-resolver chatter and unattributed runner-infrastructure chains render inside a nested collapsed 'dns + runner substrate' fold in the same job fold; attribution alone (recorded step + Runner.Worker descent) decides the partition — a recorded detection emphasizes a chain wherever it renders but never re-classes an unattributed chain as workload; substrate has its own quiet comparison diff and never changes workload delta counts or changed status; every recorded chain remains visible",
        "foldSentence": "deterministic bounded factual projection of the fold's main tree, spoken only from recorded step attribution — chains without a recorded workflow step (including the sensor's 'NN. Runner Processes' sentinel, which is not attribution) never produce a sentence: process-name fallbacks are runner machinery, not a job's headline summary, and the row falls back to plain counts; each attributed group counts its distinct destinations with the tree's own identity; groups sort changed-first on comparison comments, then destination count descending, then name; at most two groups are named as '<name> reached N destination(s)' and the remainder collapses to 'and K more'; the sentence's numbers must equal the rendered tree's counts (adjacency gate); never an interpretation — no salience, safety, or intent vocabulary",
        "countDedup": "single-job comment: chain/destination counts render in the metadata line ONLY and the fold row carries the fold sentence plus the delta (or 'no change'); multi-job: fold-row <sub> counts render only when the sentence is capped ('and K more'), absent, or partial and count exactly the rendered main tree; a substrate-only job carries no fold-row counts (never '0 chains · 0 destinations') and its body opens with the self-counting substrate fold; the substrate fold carries its own rendered count; metadata counts speak the comment register — chains totals the rendered chain rows for this record across all job folds (workload and substrate; '−' rows never count), destinations the union of their identity keys — while capture multiplicity stays in the evidence register; aggregate counts equal the visible projection and every rendered number counts what sits directly beneath it"
    },
    "comment": {
        "heading": "one ### category heading stating the primitive — Execution Profiles belong to jobs, the commit is the trigger; the product name never appears in the heading",
        "headlineTypography": "### heading, plain text with one linked short sha — no bold, no counts, no delta clause; counts live in the metadata line, deltas in job folds",
        "countDedup": "single-job comment: chain/destination counts render in the metadata line ONLY and the fold row carries the fold sentence plus the delta (or 'no change'); multi-job: fold-row counts as <sub> count exactly the fold's main tree (the substrate fold carries its own count), aggregate counts in the metadata line equal the sum of every rendered chain; a rendered number always counts what sits directly beneath it and never renders twice for the same scope",
        "foldRow": "<code>Workflow</code> / <a href=\"<actions job URL>\"><code>job-id</code>&nbsp;↗</a> · <fold sentence> — the job-id text plus ↗ is the hyperlink (GitHub-context link class); target is the specific Actions job URL when known, else the run URL; each matrix cell is its own job/fold and the cell identity lives in the job-id slot",
        "foldSentence": "deterministic bounded factual projection of the fold's main tree — chains group by recorded step attribution (else deepest recorded process display name, else the unknown-lineage label); each group counts its distinct destinations with the tree's own identity; groups sort changed-first on comparison comments, then destination count descending, then name; at most two groups are named as '<name> reached N destination(s)' and the remainder collapses to 'and K more'; the sentence's numbers must equal the rendered tree's counts (adjacency gate); never an interpretation — no salience, safety, or intent vocabulary",
        "foldRowChanged": "· <b>+A&nbsp;−R</b> since <code><prev7></code> (plus <sub>· N chain(s) · N destination(s)</sub> multi-job only — counts inflect, number and unit glued with &nbsp; so they never wrap apart); the fold renders open",
        "foldRowUnchanged": "· no change — the comparison base sha renders in the metadata line and on changed fold rows only; the fold renders collapsed; `no change` is only true when nothing beneath the fold moved — a job whose nested substrate fold renders a diff says `no workload change` and the substrate fold label carries its own `+N −M destinations`, so no fold ever claims less movement than its body renders",
        "snapshotTree": "no comparison / first profile: plain <pre> tree with 6.4 bold/italic attribution typography; no +/−, no @@ anywhere",
        "changedTree": "changed job: the fold's tree renders as a ```diff fence — same tree walk; new leaf lines carry +, no-longer-recorded leaf lines carry −, unchanged ancestry/leaves are context; one @@ header at the top: '@@ <head-sha> vs <previous-sha> · +A −R @@'; typography is sacrificed inside the fence",
        "defang": "hostnames are defanged on the PR-comment surface only (example[.]com — final dot bracketed) so untrusted destinations never autolink; address literals are left verbatim; Step Summary, model JSON, and the public report stay canonical",
        "explainerPlacement": "bottom of the comment, under a --- divider, <details><summary><sub>💡 How to read this</sub></summary>; closed by default, open only on a first-profile comment; body is the annotated mini tree (the tree teaches — no prose lead) plus, on comparison comments only, one terse <sub><i>…</i></sub> line defining + / − and the moved-destination rule; no defensive or philosophy prose",
        "substrateVisibility": "nothing subtracts: attributed workload chains render in the job's main tree; dns-resolver chatter and unattributed runner-infrastructure chains render in a nested collapsed substrate fold regardless of recorded detections (a detection emphasizes, never re-classes); substrate comparison is quiet and separate from workload deltas; every captured association remains visible",
        "foldOpenRuling": "job folds render open on the first recorded result and on changed comparison jobs while the comment carries at most foldOpenBudget changed jobs; when more jobs changed than the budget, every job fold renders collapsed and the jobs line plus fold-row deltas carry the change facts — nothing subtracts, folds just stop shouting",
        "foldOpenBudget": 3,
        "jobOrdering": "comparison comments order job folds by decision relevance, deterministically: workload-changed jobs first, then substrate-only movement, then no-change jobs, then jobs with no outbound destinations; within a tier the canonical alphabetic 'workflow / job' order holds; a job with a workload delta is a changed job even when its head record is empty (a fully emptied job renders its removals, never the no-outbound line); snapshot comments keep the canonical alphabetic order (no change facts exist to rank by); ordering is a projection of the same complete evidence — no tier is dropped or truncated by rank",
        "jobsLine": "one italic blockquote paragraph under the metadata line, comparison comments only, present only when a workload change or vanished job exists: '<X> job(s) changed +A −R · <Y> job(s) unchanged [· <Z> job(s) with no outbound destinations] [· <W> job(s) no longer recorded]' — each segment counts the job folds (or vanished entries) rendered beneath it and the segments sum to the rendered jobs plus vanished entries; never salience or safety vocabulary",
        "machineSummary": "one HTML comment marker '<!-- garnet:summary {json} -->' after the commit marker with fixed key order (contract, commit, previous, jobs, changed, unchanged, noOutbound, vanished, added, removed, vanishedChains, chains, destinations); every number equals the corresponding rendered count (adjacency gate); comparison-only fields are null on snapshot comments; '--' inside JSON string values is escaped as '--' so no record-sourced value can terminate the comment and JSON.parse restores the recorded bytes; agents read the marker, humans read the surface — same truth, two registers",
        "resolutionLayering": "the evidence register is lossless and keeps PID-distinct associations; the human comment register deduplicates rendered destination identities; ancestry is recorded name-only, so name-level prefix merging loses nothing and splitting name-identical ancestors would invent distinctions the sensor did not record; tree order is deterministic by identity key and never claims chronology",
        "previousProfiledCommit": "the unit of change is strictly the previous profiled commit (this PR, else named base-branch commit); visible copy says 'since <sha>' exactly once, in the headline — the word 'baseline' never renders",
        "comparisonIdentity": "a job is matched to its previous-commit counterpart by workflow + job name + matrix cell index; matrix cells never diff against each other, and a cell with no counterpart diffs against nothing (all chains new)",
        "destinationIdentity": "comparison identity is the canonical recorded name — the first non-empty non-address-like remote_names value, else the first non-empty value — else remote_address, normalized per job; an address-like alias never outranks a recorded hostname; an address-only edge joins a named edge for that address when either side records the name; process paths, PIDs, ports, and capture order never create comparison identities",
        "substrateComparison": "dns-resolver and unattributed runner substrate are excluded from workload added/removed sets and changed status; a non-empty substrate delta renders quietly inside the collapsed substrate fold ; the substrate fold's own label carries its movement ('dns + runner substrate · N chain(s) · +A −R destination(s)') so the quiet diff is never unlabelled",
        "ordering": "comment and diff destinations and process groups sort deterministically by normalized destination identity; capture order and process-path reshaping never change bytes",
        "dualRegister": "human register: readable, deduplicated, defanged PR comment; evidence register: canonical profile JSON/API via permalink, preserving raw IPs, ports, PIDs, hostnames, and multiplicity",
        "losslessProjection": "every captured destination identity appears in the workload tree or substrate fold, and every rendered identity derives from captured evidence; nothing is subtracted",
        "vanishedJobs": "jobs recorded on the previous profiled commit with no counterpart on this one keep their removal count: their comment-visible chains are added to the headline's 'R no longer recorded' total and listed once in a collapsed fold below the job folds (above the explainer divider) as '<details><summary><sub>jobs no longer recorded · N job(s) · M chain(s)</sub></summary>' with one '<workflow> / <job> · N chain(s)' entry per line — history sits below this commit's behavior, never as an alarm strip at the top; a vanished job never renders as 'no change' and its chains never silently leave the comparison"
    },
    "bannedVocabulary": [
        "every process",
        "flagged",
        "detected",
        "baseline",
        "safe",
        "verdict",
        "score",
        "Assertions · beta",
        "monitoring",
        "clean",
        "secure",
        "threat",
        "malicious",
        "as of",
        "github infra",
        "garnet sensor upload",
        "expected plumbing",
        "garnet.ai/what-garnet-records",
        "Run Profile",
        "process lineage",
        "process chains",
        "lineage tree",
        "Runtime Summary",
        "Runtime Review",
        "Reading this review",
        "gone"
    ],
    "edgeModel": {
        "definition": "one destination association = one network.egress.peers[] item × one proc_trees[] item; a peer with no proc_trees emits one association with lineage 'unknown (not recorded)'",
        "preservedFields": [
            "remote_address",
            "remote_names (every value, verbatim — never repaired; the canonical recorded name — first non-empty non-address-like value, else first non-empty — is the production display identity; secondary values are preview-only)",
            "remote_ports (every value, verbatim — explicit Step Summary preview only; the PR comment and production summary show no ports/protocol/address annotations)",
            "protocol (explicit Step Summary preview only)",
            "peer result (recorded ATTENTION is explicit Step Summary preview only)",
            "leaf pid ((pid N) renders on the Step Summary process leaf only, never the PR comment)",
            "leaf process comm name (Step Summary only)",
            "ancestry names in record order",
            "github_step (escaped, labeled 'step:', attribution metadata only)",
            "detections (every non-empty value other than 'flow' is preserved in the model; 'detection: <kind>' notes render only under assertions preview)"
        ],
        "embargoedFields": [
            "arguments",
            "executable"
        ],
        "noDedupe": false,
        "registerModel": "evidence surfaces remain lossless; only human comment and diff surfaces deduplicate destination identities",
        "noMultiplicity": "peers in profile format 0.2 are already deduplicated and carry no per-edge count; ×N is banned; telemetry.total_connections is never row multiplicity",
        "addressLikeNames": "the first remote_names value is the counting identity; secondary values are preserved in the model and preview only, and never create extra rows",
        "pidDistinct": "same ancestry with a different PID remains distinct in the evidence register and Step Summary; comment destination rows are identity-deduplicated"
    },
    "counts": {
        "destinationAssociations": "sum over peers of max(1, len(proc_trees))",
        "recordedProcesses": "distinct recorded lineage + PID + process identities; unrecorded lineage is not called a recorded process",
        "destinations": "distinct non-empty remote_address values represented by rendered associations",
        "primaryRemoteNames": "distinct non-empty first remote_names values; secondary values are not counting identities",
        "observedDomainNames": "distinct non-empty first remote_names values that are not IP/address literals",
        "flows": "len(network.egress.peers)",
        "portsAndProtocols": "render but never create extra destination-count identities",
        "loopbackAndResolver": "displayed and counted; notes never subtract",
        "telemetryFamilies": "sensor Unique domains and Connections pass through verbatim; derived Destinations and Flows are labeled separately and never aliased",
        "expectedJobCoverage": "deferred; the headline renders only '<N> job(s) recorded', never k-of-n",
        "destinationOwnerTags": "deferred to control-plane enrichment: owner/category tags on destinations (imds, garnet telemetry, github infra, package registry) require a versioned destination→owner map carried in the profile or served by the control plane — the renderer never hardcodes owner lists; when the map ships, tags render as leaf notes with the same deterministic note rules and the tag vocabulary is locked here first",
        "chains": "execution chains = destination associations (one root-to-action path per association); the metadata line spells 'execution chains' on first mention, later counts say bare 'chains'"
    },
    "notes": {
        "dnsResolver": {
            "text": "dns resolver",
            "rule": "only when remote_address is loopback AND a remote_ports value has numeric port 53 (including strings such as '53 (dns)')",
            "loopbackPattern": "^(127\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|::1|localhost)$"
        },
        "instanceMetadata": {
            "text": "instance metadata",
            "addresses": [
                "169.254.169.254",
                "169.254.170.2",
                "fd00:ec2::254"
            ],
            "truncationPriority": "IMDS edges present in the record are retained first and never evicted under medium truncation",
            "notACaptureGuarantee": true
        },
        "detection": {
            "rule": "detection notes are assertion-layer vocabulary: 'detection: <kind>' (every non-empty detections[] value other than 'flow') renders only under assertions preview; a recorded non-flow detection still overrides italic scaffolding presentation in prod"
        },
        "forbiddenNotes": [
            "github infra",
            "garnet sensor upload",
            "expected plumbing",
            "inferred DNS causality"
        ]
    },
    "lineage": {
        "attributedTypography": "bold when github_step is non-empty and ancestry contains exact Runner.Worker; otherwise italic runner scaffolding; a non-flow detection always renders bold; typography is attribution context, never trust",
        "githubStep": "escaped recorded metadata labeled 'step:'; used with Runner.Worker descent for attribution, never an allowlist or ownership claim",
        "forbiddenClaim": "complete process inventory/tree"
    },
    "timestamp": {
        "source": "profile.timestamp only (profile.recorded_at does not exist)",
        "format": "YYYY-MM-DD HH:MM:SS UTC",
        "multiProfile": "recorded at the kernel through <max valid profile.timestamp>",
        "missing": "omit — never substitute the renderer clock",
        "pending": "no timestamp and no 'as of'"
    },
    "prComment": {
        "stickyComment": "exactly one stable App-owned sticky Runtime Review comment per PR",
        "workflowTrigger": "runtime-review workflows run on every pull_request base, including stacked PRs with layered non-main/non-trunk bases; no pull_request branches filter is allowed",
        "commitMarker": "<!-- garnet:commit <full sha> -->",
        "writeTimeGuard": "update only if the profile SHA equals the PR's current head at write time; stale old-head events never overwrite a newer head — the guard protects the PR comment only, the job-local Step Summary is published before it",
        "commitIdentity": "every rendered commit SHA — the headline trigger and its permalink, the metadata line's 'since <prev7>', and the '@@ <head7> vs <prev7> @@' pair — must be PR-visible; a recorded synthetic merge SHA (two-parent GITHUB_SHA from refs/pull/N/merge) resolves producer-side to the PR head (the merge commit's second parent) before rendering, on both sides of the comparison; the renderer performs no lookups, and on resolution failure the raw recorded SHA renders unchanged — nothing fabricated or substituted",
        "actionSuppression": "when the App is installed/publishing, the standalone Action comment is suppressed",
        "pending": "headline lead + commit marker + hourglass status + open explainer at the bottom; no timestamp, count, denominator, or permalink",
        "completed": "headline with commit link and state clause; metadata blockquote with kernel provenance from profile.timestamp ('recorded at the kernel' renders exactly once per comment — on the metadata line, never in the explainer); explainer at the bottom, open on the first recorded result and collapsed on later updates; job folds open on the first recorded result and on changed jobs, collapsed otherwise",
        "destinations": "domain-first: the canonical recorded name is the identity, bare IP only when no name is recorded; no ports, protocol, or address annotations on the comment; no [pid · command] suffixes",
        "processDisplayNames": "comment tree node names strip a trailing run of 4+ digits (provjobd1326539233 → provjobd) — display only; the record, Step Summary, model JSON, and chain identity keep the raw name",
        "foldsCollapsedByDefault": true,
        "jobOrder": "alphabetic by 'workflow / job'",
        "edgeOrder": "deterministic by lineage, remote address, ports/protocol, PID",
        "foldHeading": "workflow / job — the job-id text is the hyperlink",
        "profileSelector": "?profile=<Garnet profile ID> — the control-plane profile-envelope ID; a raw profile never fabricates a selector from data.uuid",
        "runLinks": "one exact per-fold Run Profile link when an envelope Profile.ID exists; no top run-index CTA"
    },
    "stepSummary": {
        "headings": [
            "Garnet Execution Summary",
            "Workload Summary",
            "Network Egress Summary"
        ],
        "egressSections": [
            "Process Tree",
            "Destinations"
        ],
        "treePivot": "lineage-first: one '| Process Tree | Destinations |' table row per distinct process lineage keyed on (lineage_recorded, pid, process, ancestry); different PIDs never merge; each row nests that lineage's destinations with identical destination names collapsed (telemetry counts derive from the profile, not rows); compact trees retain the first node and final three nodes with an explicit ellipsis between them; the leaf carries '(pid N)'; each destination is bullet-anchored; captured names are length-bounded with a middle ellipsis",
        "telemetry": "one sentence: Network telemetry observed N unique domains, M destinations, C connections, and F flows. Unique domains and connections pass through from sensor telemetry; destinations and flows remain independently derived from the record",
        "assertions": "omitted by default; assertions: preview renders a collapsed source-context table plus a collapsed Check | Result | Context fold and an evidence table only for record-backed assertions[].evidence",
        "footer": "right-aligned workflow · run · job · profile.timestamp (provenance only, no telemetry counts), then Powered by Garnet · exact Run Profile link; followed by Job summary generated at run-time"
    },
    "gateT": {
        "connections": "telemetry.total_connections must equal len(network.egress.peers)",
        "domains": "telemetry.total_domains must equal distinct non-empty first remote_names",
        "ci": "hard-fail only for pinned fixtures expected to satisfy the invariant",
        "runtime": "never throw; render sensor and derived values in the telemetry one-liner with no discrepancy prose — the divergence stays a model-level fact (telemetryDiscrepancies) checked in CI"
    },
    "mediumLimits": {
        "prCommentHardLimit": 65536,
        "prCommentBudget": 60000,
        "stepSummaryHardLimit": 1048576,
        "runProfileUntruncated": true,
        "truncationStrategy": "deterministic fair round-robin across jobs in canonical order, byte/character budget checked on the final serialized output; PR comments retain IMDS associations first; Step Summaries retain whole destination rows and never split a destination from its process trees; per-job/no-record coverage preserved where possible; truncation is never silent",
        "minimalFallback": "when even fixed overhead exceeds the medium budget, emit deterministic markers, heading, coverage, and an exact rendered-0 omission line within the serialized cap"
    },
    "publicRunProfile": {
        "runIndexRoute": "/public/runs/{run_id} — no logged-out projection without an exact ?profile selector",
        "profileSelectorRoute": "/public/runs/{run_id}?profile=<profile_id>",
        "jobParam": "?job= is not a public profile selector and never authorizes a logged-out projection",
        "selectorMiss": "an absent, empty, or wrong profile ID returns 404 — never a silent fallback to run index/job/first profile",
        "embargoedFields": [
            "argv",
            "arguments",
            "executable paths",
            "environment values",
            "assertions",
            "detection evidence",
            "sensor telemetry",
            "sensitive actor/ref metadata"
        ],
        "policy": {
            "default": "deny (404)",
            "render": "only when backend-truth repository visibility is exactly 'public' AND explicit publication consent exists AND consent is not revoked AND an exact envelope Profile.ID selector resolves, rechecked at request time",
            "deniedStates": [
                "private",
                "internal",
                "unknown",
                "revoked",
                "unconsented",
                "visibility-flipped-to-private",
                "missing-profile-selector",
                "empty-profile-selector",
                "wrong-profile-selector",
                "job-only-selector"
            ],
            "nonOracular404": "all denied cases return the same 404 for HTML and JSON",
            "noCdnCaching": "JSON/HTML responses are not long-lived CDN cached"
        },
        "lossless": "the canonical public Run Profile is untruncated; UI folding/virtualization must be lossless",
        "privateTestbed": "this repository is private — its logged-out permalink correctly 404s; positive public-link acceptance requires a separate public, explicitly consented fixture repository"
    },
    "future": [
        "Phase 1–2: chain canonicalization + previous-profiled-commit resolution wiring in producers (this contract already locks the comparison render shape)",
        "Phase 2+: top atomic-chain diff fence above the folds (additive; in-fold marked trees remain)",
        "Phase 3: garnet:execution:v1 hidden JSON machine block (agents parse the schema block, never ownership markers)",
        "Phase 4: /public/compare/<id> route + 'View execution comparison →' CTA; neutral Check run",
        "commit-history fold"
    ],
    "v7Deferrals": [
        "structural fork/exec ownership and double-fork/reparent correctness",
        "strong DNS causality",
        "guarantee that Jibril captures IMDS/link-local traffic",
        "producer-side argv/executable capture suppression",
        "bytes",
        "full process/file inventory",
        "per-edge connection multiplicity / ×N",
        "expectedJobs / k-of-n coverage",
        "cryptographic sensor-upload provenance",
        "endpoint ownership labels backed by rules-as-data evidence",
        "record-side process/name truncation repair",
        "commit-level cross-run public review permalink beyond the one-run first-release journey"
    ]
}
