/**
 * Machine-readable contract lock — vendored byte-exact from
 * garnet-org/runtime-review-testbed contract/vocab.json at commit
 * 1ead243 (contract v6.9.5). Vendored so the renderer needs no filesystem
 * read at runtime; never hand-edit values outside a contract sync.
 */

export const CONTRACT_VOCAB = {
  "$schema_comment": "Machine-readable execution-comment contract lock (v6.9.5) — single source for exact emitted copy, comparison identity, lossless projection, deterministic factual notes, medium limits, selector/privacy requirements, and deferrals. Consumed by cmd/garnet-runtime-review/review.mjs. Locked by docs/ux-contract.md.",
  "version": "6.9.5",
  "profileFormatVersion": "0.2.0",
  "copy": {
    "headlineLead": "Execution Profiles recorded for",
    "headlineTemplate": "**Execution Profiles recorded for <N> job(s), triggered by [`<sha7>`](<commit-url>)** — the one headline, bold body register, never a `#` heading; all counts and change facts live in the metadata line and job folds",
    "headlinePendingLead": "Execution Profiles recording for jobs triggered by",
    "headlinePendingTemplate": "**Execution Profiles recording for jobs triggered by [`<sha7>`](<commit-url>)**",
    "metadataTemplate": "> *<N>&nbsp;destination(s) [· compared with [`<prev7>`](<prev-commit-url>)] · recorded at the kernel by Garnet · <UTC timestamp>* — noun facts only, each · segment one fact; the destination count totals the job folds' trees exactly (dns-resolver leaves included, every recorded root); chain counts never render on the human surface — the chain aggregate lives in the garnet:summary marker and the full profile, and the concept lives in the explainer sentence ('each path to an observed action is an execution chain'); 'compared with' names the comparison without claiming what changed (the jobs line and fold rows do); the comparison clause renders only on comparison comments; italic blockquote only, never <sub> (GitHub mobile collapses <sub> line-height and a wrapped line overprints itself)",
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
    "explainerReadingLine": "follow a path downward to see what ran and what it did — each path to an observed action is an execution chain",
    "explainerComparisonLine": "+ only in the current record · − only in the previous record",
    "explainerCalloutPath": "process on a path",
    "explainerCalloutActed": "process that acted",
    "explainerCalloutAction": "observed action",
    "pendingStatus": "⏳ Execution Profiles for this commit are still being recorded — this comment updates in place as jobs finish.",
    "truncationTemplate": "rendered X of Y destination associations",
    "noChange": "unchanged",
    "noChangeRule": "the row reads '· <N>&nbsp;destinations · unchanged' — adjacency scopes the claim: 'unchanged' sits directly after the destination count, so it claims the destination projection only (ancestry, steps, and other recorded context may differ); a bare standalone 'no changes' never renders",
    "terminalNetwork": "○",
    "terminalFile": "□",
    "terminalExecution": "▷",
    "terminalRule": "observed actions render as shaped terminals in the leaf position — '○ <destination>' for network today; '□' (file) and '▷' (execution — Jibril's event class; command detail is richer context, never the class name) are reserved for future observation classes and never render until those observations surface; the grammar is: plain tree nodes are recorded execution context (process names only — command strings are attributes, never nodes), shaped terminals are what Jibril observed there, brackets are factual context decorating a line; box-drawing characters carry structure, geometric terminals carry evidence — a reader separates the path from the observations at a glance; machine consumers read observation kinds ('network', 'file', 'execution') from the garnet:summary marker, never from the rendered shapes",
    "bracketContextRule": "every '(…)' annotation is factual context: recorded directly (step:, ran from) or deterministically derived from recorded evidence (dns resolver, cloud metadata, github infra, garnet sensor); annotation names stay short, recognizable, and true — no annotation names a fact the record does not deterministically prove (the IMDS constant is provider-generic, so its annotation never names a cloud vendor) — never speculative; annotations decorate lines and never determine grouping, counting, layout, folding, marks, or comparison",
    "sinceWord": "since",
    "vanishedJobsLabel": "jobs no longer recorded",
    "jobsLineTemplate": "> *<X> job(s) changed +A&nbsp;−R&nbsp;destination(s) · <Y> job(s) unchanged [· <Z> job(s) with no outbound destinations] [· <W> job(s) no longer recorded]* — second blockquote paragraph directly under the metadata line, comparison comments only, rendered only when a changed or vanished job exists; every segment is a job count over the folds/entries rendered below and the segments sum to the comment's rendered jobs plus the vanished fold's entries (adjacency gate); +A −R are the whole-job destination delta totals over the rendered job folds with the unit named and zero sides dropped; vanished jobs and their destinations render exclusively in the 'no longer recorded' segment and fold, never double-counted (adjacency gate); noun facts only",
    "jobsLineNoOutbound": "with no outbound destinations",
    "jobsLineVanished": "no longer recorded",
    "jobsLineChanged": "changed",
    "jobsLineUnchanged": "unchanged",
    "machineSummaryMarker": "garnet:summary",
    "whatIsGarnetLabel": "What is Garnet →",
    "whatIsGarnetUrl": "https://docs.garnet.ai?utm_source=github&utm_medium=pr_comment",
    "egressCentricScope": "The record is egress-centric; processes without recorded egress do not appear.",
    "jobBlockRuling": "the job is the only semantic container: one top-level row per job, one <pre>/diff block per fold, holding every recorded root of that job — independent recorded ancestry roots render in the same block separated by one blank line, with no invented common parent and no category labels between them (whitespace means independent recorded roots in the same job, never 'background', 'substrate', or another job); reliable facts determine structure — job scope, recorded kernel ancestry, observed actions; unreliable metadata (step attribution) decorates and never determines grouping, counting, layout, folding, or comparison; nothing subtracts — every recorded chain renders in its owning job's block",
    "foldSentence": "the PR-comment fold row carries no step-name sentence — its facts are the identity and the counts; recorded step attributions render in the tree itself and in the Step Summary evidence register ('\"<recorded step name>\"' — recorded free text in double quotes, identifiers in code ticks, renderer glue plain); never an interpretation — no salience, safety, or intent vocabulary",
    "countDedup": "a count renders only where the reader can point at the counted things: destinations are the pointable ○ leaves, so every job fold row carries 'N destination(s)' totalling the distinct destination leaves in its block; chain counts never render on the human surface (the tree prefix-merges shared ancestry, so chains are not pointable objects) — the chain aggregate lives in the garnet:summary marker only; one destination fact per row: a changed row's destination fact is its bold '+A −R destinations' delta and it carries no second count; the metadata destination count totals the job folds' trees exactly ('−' rows never count) while capture multiplicity stays in the evidence register; every rendered number counts what sits directly beneath or behind it",
    "explainerLegendLine": "names on the path = processes · ○ = observed action · (…) = context"
  },
  "comment": {
    "heading": "one bold-body headline stating the primitive — Execution Profiles belong to jobs, the commit is the trigger; the product name never appears in the headline",
    "headlineTypography": "bold body register with one linked short sha, never a `#` heading — no counts, no delta clause; counts live in the metadata line, deltas in job folds",
    "countDedup": "chain counts never render on the human surface (the garnet:summary marker carries the aggregate); every job fold row carries 'N destination(s)' — the distinct ○ destination leaves its block holds; a changed row's destination fact is its bold '+A −R destinations' delta with no second count; a rendered number always counts what sits directly beneath or behind it and never renders twice for the same scope",
    "foldRow": "<code>Workflow</code> / <a href=\"<actions job URL>\"><code>job-id</code>&nbsp;↗</a> · <N>&nbsp;destination(s) — the job-id text plus ↗ is the hyperlink (GitHub-context link class); target is the specific Actions job URL when known, else the run URL; each matrix cell is its own job/fold and the cell identity lives in the job-id slot; the row carries no step-name sentence — step attributions render in the tree and the Step Summary evidence register; every current job gets one top-level row: jobs with comment-visible observations expand into one fold; an empty projection renders a plain <sub> row ('… — no outbound destinations recorded.') that keeps the job's Execution Profile link when known, so an empty egress projection never implies Garnet observed nothing",
    "foldRowChanged": "<b>+A&nbsp;−R</b>&nbsp;destinations · <identity> — the bold delta leads the row (the left edge is the scan column) and is the row's only destination fact; counts inflect, number and unit glued with &nbsp; so they never wrap apart; the fold renders open within foldOpenBudget",
    "foldRowUnchanged": "· <N>&nbsp;destination(s) · unchanged — adjacency scopes the claim to the destination projection (the count sits directly before it); the comparison base sha renders in the metadata line and on changed fold rows' diff headers only; the fold renders collapsed",
    "snapshotTree": "no comparison / first profile: <pre> tree — one block per job, every recorded root, whitespace-separated; one meaning per style: <strong> marks the process that acted (an observed action directly beneath it), <em> wraps annotations only ((…) bracket context), everything else plain; no +/−, no @@ anywhere",
    "changedTree": "changed job: the fold's tree renders as a ```diff fence — same tree walk over the union of current and previous recorded roots (whitespace-separated, one blank line as a fence-safe ' ' line); leaf lines only in this commit's record carry +, no-longer-recorded leaf lines carry −, unchanged ancestry/leaves are context; every mark counts in +A −R and every counted change renders marked — marks and the row delta reconcile exactly (no quieting layer, no uncounted marks); a wholly new branch marks its process lines + from the divergence point (a process line whose every rendered leaf is +) and a wholly vanished branch marks its process lines − — marked process lines never count in +A −R, which stay destination-anchored; a marked (+/−) leaf line carries the recorded remote_address as one trailing bracket annotation — '(198.51.100.60)' — only when, within the same job's diff fence, an oppositely-marked line shares the same registrable domain (eTLD+1, computed from the versioned public-suffix table vendored at contract/public_suffix_list.dat — data, not heuristics; context, never counting); both lines of such a pair carry their recorded addresses; a marked line with no oppositely-marked same-domain counterpart stays clean; bare-address identities are never annotated (the address is the label); context lines and snapshot <pre> trees carry no address annotation, and a marked line never carries two; one @@ header at the top: '@@ <previous-sha> (previous) vs <head-sha> (current) @@' — snapshot <pre> trees carry no header; typography is sacrificed inside the fence",
    "defang": "hostnames are defanged on the PR-comment surface only (example[.]com — final dot bracketed) so untrusted destinations never autolink; address literals are left verbatim; Step Summary, model JSON, and the public report stay canonical",
    "explainerPlacement": "bottom of the comment, under a --- divider, <details><summary><sub>💡 How to read this</sub></summary>; closed by default, open only on a first-profile comment; body is one <pre> mini tree — Runner.Worker → npm → <strong>node</strong> → ○ npmjs[.]org, bare recorded process names, no command strings, exactly the constructs the real renderer emits — with ← arrow callouts on the lines they describe, aligned in one italic column at visible offset 23 so every callout line fits ~44 monospace columns and reads without horizontal scroll at 390px: '← process on a path' on the root, '← process that acted' on the bold node, '← observed action' on the ○ leaf; beneath the pre, italic <sub><i>…</i></sub> lines in order: the one reading sentence 'follow a path downward to see what ran and what it did — each path to an observed action is an execution chain', the one legend line 'names on the path = processes · ○ = observed action · (…) = context' (the legend carries the (…) teaching — a fourth on-tree callout would push past the phone budget), and — comparison comments only — '+ only in the current record · − only in the previous record'; proportional text wraps instead of scrolling; no defensive or philosophy prose",
    "foldOpenRuling": "deliberate quiet-by-default fold scheme, deterministic and rule-based (no salience heuristics): the only job folds that ever render open are changed comparison folds, and only while the comment carries at most foldOpenBudget changed jobs — when more jobs changed than the budget, every job fold renders collapsed and the jobs line plus fold-row deltas carry the change facts; snapshot folds, first-profile folds, unchanged folds, and the vanished fold always render collapsed (fold rows carry the counts, so a collapsed comment still states every fact); the explainer opens only while pending and on the first recorded result and collapses on every later update — nothing subtracts, folds just stop shouting",
    "foldOpenBudget": 3,
    "jobOrdering": "comparison comments order job rows by decision relevance, deterministically: changed jobs first, then unchanged jobs, then no-outbound rows (above the vanished fold); within a tier the canonical alphabetic 'workflow / job' order holds; a job with a destination delta is a changed job even when its head record is empty (a fully emptied job renders its removals, never the no-outbound line); snapshot comments keep the canonical alphabetic order (no change facts exist to rank by); ordering is a projection of the same complete evidence — no tier is dropped or truncated by rank",
    "jobsLine": "one italic blockquote paragraph under the metadata line, comparison comments only, present only when a changed or vanished job exists: '<X> job(s) changed +A −R · <Y> job(s) unchanged [· <Z> job(s) with no outbound destinations] [· <W> job(s) no longer recorded]' — each segment counts the job rows (or vanished entries) rendered beneath it and the segments sum to the rendered jobs plus vanished entries; never salience or safety vocabulary",
    "machineSummary": "one HTML comment marker '<!-- garnet:summary {json} -->' after the commit marker with fixed key order (contract, commit, previous, jobs, changed, unchanged, noOutbound, vanished, added, removed, vanishedDestinations, chains, destinations, kinds); 'chains' is the machine-register chain aggregate (never rendered on the human surface); 'kinds' lists the observation classes present (today ['network']); every other number equals the corresponding rendered count (adjacency gate); comparison-only fields are null on snapshot comments; '--' inside JSON string values is escaped so no record-sourced value can terminate the comment and JSON.parse restores the recorded bytes; agents read the marker, humans read the surface — same truth, two registers",
    "resolutionLayering": "the evidence register is lossless and keeps PID-distinct associations; the human comment register deduplicates rendered destination identities; ancestry is recorded name-only, so name-level prefix merging loses nothing and splitting name-identical ancestors would invent distinctions the sensor did not record; tree order is deterministic by identity key and never claims chronology",
    "previousProfiledCommit": "the unit of change is strictly the previous profiled commit (this PR, else named base-branch commit); visible copy says 'compared with <sha>' exactly once, in the metadata line — the word 'baseline' never renders",
    "comparisonIdentity": "a job is matched to its previous-commit counterpart by workflow + job name + matrix cell index; matrix cells never diff against each other, and a cell with no counterpart diffs against nothing (all chains new)",
    "destinationIdentity": "comparison identity is the canonical recorded name — the first non-empty non-address-like remote_names value, else the first non-empty value — else remote_address, normalized per job; an address-like alias never outranks a recorded hostname; an address-only edge joins a named edge for that address when either side records the name; process paths, PIDs, ports, and capture order never create comparison identities; identities whose address and recorded name both change are honestly distinct — the record shows one − and one + until record-side DNS-answer evidence makes the join provable (deferred)",
    "unionDiff": "one identity-set diff per job over every recorded chain in the job — the whole job's destination projection, no partition; per identity the outcome is added, removed, or unchanged; canonical destination changed → it counts — no equivalence heuristics, no quieting layer (identity-sorted rows keep a same-domain rotated pair adjacent and address-annotated so rotation reads at a glance, as context); invariant (adjacency gate): no destination identity renders with both marks in one job, and an identity present on both commits renders no mark anywhere",
    "ordering": "comment and diff destinations and process groups sort deterministically by normalized destination identity; capture order and process-path reshaping never change bytes",
    "dualRegister": "human register: readable, deduplicated, defanged PR comment; evidence register: canonical profile JSON/API via permalink, preserving raw IPs, ports, PIDs, hostnames, and multiplicity",
    "losslessProjection": "every captured destination identity appears in its owning job's block, and every rendered identity derives from captured evidence; nothing is subtracted",
    "vanishedJobs": "jobs recorded on the previous profiled commit with no counterpart on this one keep their removal count: listed once in a collapsed fold below the job rows (above the explainer divider) as '<details><summary><sub>jobs no longer recorded · N job(s) · M destination(s)</sub></summary>' with one '<workflow> / <job> · N destination(s)' entry per line — destination counts are the same pointable unit as everywhere else; history sits below this commit's behavior, never as an alarm strip at the top; a vanished job never renders as 'unchanged' and its destinations never silently leave the comparison"
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
    "garnet sensor upload",
    "expected plumbing",
    "garnet.ai/what-garnet-records",
    "Run Profile",
    "process lineage",
    "process chain",
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
      "executable (full path — only its directory may render, as the ran-from provenance note)"
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
    "destinationOwnerTags": "the broad owner/category map (garnet telemetry, package registry, …) stays deferred to control-plane enrichment via a versioned destination→owner map; the single high-confidence exception locked in this contract is notes.githubInfrastructure — GitHub's own published infrastructure domains — because the runner is GitHub's machine and the suffix list is small, stable, and vendored here, never hardcoded in a renderer",
    "chains": "execution chains = destination associations (one root-to-action path per association); chain counts live in the garnet:summary machine register and richer profile surfaces only — never on the human comment (chains are not pointable after prefix merging); the concept renders in the explainer sentence 'each path to an observed action is an execution chain'"
  },
  "notes": {
    "dnsResolver": {
      "text": "dns resolver",
      "rule": "only when remote_address is loopback AND a remote_ports value has numeric port 53 (including strings such as '53 (dns)')",
      "loopbackPattern": "^(127\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|::1|localhost)$"
    },
    "instanceMetadata": {
      "text": "cloud metadata",
      "addresses": [
        "169.254.169.254"
      ],
      "rule": "the '(cloud metadata)' bracket annotation is a per-record protocol fact for the standardized cloud IMDS constant only — the same class as the dns-resolver note; 169.254.169.254 is the provider-generic IMDS address, so the annotation never names a cloud vendor unless the record deterministically proves one (it does not today); it never affects attribution",
      "noVendorAddressLabels": "vendor-specific addresses (e.g. the Azure wireserver 168.63.129.16) render as bare addresses — no vendor address enums or labels",
      "truncationPriority": "IMDS edges present in the record are retained first and never evicted under medium truncation",
      "notACaptureGuarantee": true
    },
    "githubInfrastructure": {
      "text": "github infra",
      "nameSuffixes": [
        ".githubapp.com",
        ".actions.githubusercontent.com"
      ],
      "truncatedSuffixes": [
        ".githubapp"
      ],
      "rule": "the '(github infra)' bracket annotation renders when the destination's primary recorded remote name ends with one of the locked nameSuffixes — GitHub's own published infrastructure domains; a truncatedSuffix covers sensor-recorded names missing the trailing label and matches only when exactly one label precedes it (hosted-compute-watchdog-prod-eus-02.githubapp — a truncated direct child of githubapp.com), because recorded names are workload-influenceable and a deeper name under a non-public suffix (exfil.attacker.githubapp) must never earn the trust cue; a per-record informative fact in the same class as the dns-resolver note; it never affects attribution or counts, and the suffix lists are contract-locked (vendored byte-identically by consumers), never extended in a renderer",
      "notACaptureGuarantee": true
    },
    "garnetSensor": {
      "text": "garnet sensor",
      "nameSuffixes": [
        ".garnet.ai"
      ],
      "rule": "the '(garnet sensor)' bracket annotation renders when the destination's primary recorded remote name is 'garnet.ai' or ends with '.garnet.ai' — Garnet annotates its own recorded connection first (deterministic, contract-locked suffix; it never affects counts, marks, ordering, or comparison)",
      "notACaptureGuarantee": true
    },
    "detection": {
      "rule": "detection notes are assertion-layer vocabulary: 'detection: <kind>' (every non-empty detections[] value other than 'flow') renders only under assertions preview; a recorded non-flow detection still overrides italic scaffolding presentation in prod"
    },
    "forbiddenNotes": [
      "garnet sensor upload",
      "expected plumbing",
      "inferred DNS causality"
    ],
    "executableProvenance": {
      "text": "ran from",
      "tempDirPrefixes": [
        "/tmp/",
        "/var/tmp/",
        "/dev/shm/"
      ],
      "executableLocationDetections": [
        "exec_from_unusual_dir"
      ],
      "rule": "a process line renders '(ran from <recorded directory>/…)' when its recorded executable path sits under a user-writable temp directory — deterministic and record-driven only, never name-based; ordinary processes stay bare; the full executable path never renders, only its directory; peer-scoped detections (profile format 0.2 records detections per peer, not per process) cannot pin one process line, so an executable-location detection annotates only via the recorded executable path",
      "notACaptureGuarantee": true
    }
  },
  "lineage": {
    "attributedTypography": "bold marks the process that acted — a process node with an observed action directly beneath it; italic marks annotations only — the (…) bracket context and the explainer's legend labels; every other tree character is plain, runner-infrastructure trees included; diff fences carry no markup (GitHub renders HTML literally inside fences — their green/red rows are the emphasis there); typography is decoration only — it never determines grouping, counting, layout, folding, marks, ordering, or comparison, and is never a fact's sole carrier",
    "structure": "reliable facts determine structure: job scope, recorded kernel ancestry, observed actions; step attribution is unreliable metadata and only decorates — there is no workload/background partition; every recorded chain renders in its owning job's block",
    "forkTimeAncestry": "producers must record fork-time ancestry, never query-time ppid, so lineage-escape (daemonize/setsid reparenting to systemd) cannot detach a chain from its recorded root",
    "githubStep": "a real recorded step (never the 'NN. Runner Processes' sentinel) renders as a '(step: \"<recorded name>\")' bracket annotation on its process line — the recorded name in double quotes with any leading 'NN. ' ordinal stripped; a recorded name still containing an unexpanded '${{ … }}' expression renders no step annotation; a step annotation renders once per path, on the shallowest process line where that recorded step applies — descendants with the same recorded step render no step annotation (silent inheritance) and a descendant whose recorded step differs renders its own; escaped recorded metadata, additive context only; a tree rendered with and without step metadata has identical structure, counts, ordering, and comparison",
    "truncatedNameCompletion": "a recorded process name truncated by the kernel comm limit (exactly 15 bytes) renders completed only when the record itself carries the full string — the node's recorded executable basename extends the truncated name uniquely; the raw recorded name stays in the model, marker, and Step Summary; no completion ever comes from outside the profile (never guessed, never pattern-completed)",
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
    "commitIdentity": "every rendered commit SHA — the headline trigger and its permalink, the metadata line's 'since <prev7>', and the '@@ <prev7> (previous) vs <head7> (current) @@' pair — must be PR-visible; a recorded synthetic merge SHA (two-parent GITHUB_SHA from refs/pull/N/merge) resolves producer-side to the PR head (the merge commit's second parent) before rendering, on both sides of the comparison; the renderer performs no lookups, and on resolution failure the raw recorded SHA renders unchanged — nothing fabricated or substituted",
    "actionSuppression": "when the App is installed/publishing, the standalone Action comment is suppressed",
    "pending": "headline lead + commit marker + hourglass status + open explainer at the bottom; no timestamp, count, denominator, or permalink",
    "completed": "headline with commit link and state clause; metadata blockquote with kernel provenance from profile.timestamp ('recorded at the kernel' renders exactly once per comment — on the metadata line, never in the explainer); explainer at the bottom, open on the first recorded result and collapsed on later updates; job folds open only on changed comparison jobs within foldOpenBudget, collapsed otherwise (foldOpenRuling)",
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
