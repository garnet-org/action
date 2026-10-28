/**
 * Runtime Review contract values — vendored from
 * garnet-org/runtime-review-testbed `main` contract/vocab.json, the single
 * living reference for renderer, vocabulary and goldens. `contractRef` pins
 * the testbed-main SHA the values were copied from. Only the values the
 * renderer and its gates consume are vendored here. Never hand-edit values
 * outside a contract sync; re-vendor from testbed main instead.
 *
 * PREP: until the renderer lane lands the comment-final contract on testbed
 * main, copy values follow its interim ledger (testbed PR 180,
 * docs/design/comment-final/README.md, rows 16-25) and `contractRef` is a
 * placeholder.
 */

export const CONTRACT_VOCAB = {
    version: "6.10.0",
    contractRef: "pending-renderer-lane-v17.3",
    profileFormatVersion: "0.2.0",
    copy: {
        stepSummaryHeading: "Garnet Execution Summary",
        artifact: "Full record in Garnet ↗",
        kernelProvenance: "recorded at the kernel by Garnet",
        sensor: "Jibril",
        destinationNoun: "destination",
        chainNoun: "execution chain",
        permalinkLabel: "View this job's Execution Profile in Garnet →",
        emptyPeers: "no outbound destinations recorded.",
        noRunProfile: "no Execution Profile recorded.",
        unknownLineage: "unknown (not recorded)",
        explainerLabel: "How to read this",
        explainerReadingLine:
            "follow a path downward to see what ran and what it did — each path to an observed action is an execution chain",
        explainerComparisonLine: "+ only in the current record · − only in the previous record",
        explainerBackgroundSegment: "runner background = the runner's infrastructure, not your workflow",
        explainerCalloutPath: "process on a path",
        explainerCalloutActed: "process that acted",
        explainerCalloutAction: "observed action",
        explainerLegendLine: "names on the path = processes · ○ = observed action · (…) = context",
        pendingStatus: "This comment updates when the remaining jobs finish.",
        headings: {
            changed: "Runtime behavior changed",
            nothingNew: "No runtime changes",
            recorded: "Runtime behavior recorded",
            recording: "Recording runtime behavior",
            notRecorded: "Runtime behavior not recorded",
        },
        jobLogLabel: "Job log",
        fullRecordLabel: "Full record in Garnet ↗",
        captureBestEffort: "Capture is best-effort.",
        footerLead: "Runtime behavior, recorded by Garnet.",
        footerLinkLabel: "Add it to your CI ↗",
        onboardingUrl: "https://app.garnet.ai/onboarding",
        truncationTemplate: "rendered X of Y destination associations",
        noChange: "nothing new",
        terminalNetwork: "○",
        terminalFile: "□",
        terminalExecution: "▷",
        sinceWord: "since",
        vanishedJobsLabel: "jobs no longer recorded",
        jobsLineNoOutbound: "with no outbound destinations recorded",
        jobsLineVanished: "no longer recorded",
        jobsLineChanged: "changed",
        jobsLineUnchanged: "nothing new",
        machineSummaryMarker: "garnet:summary",
        whatIsGarnetLabel: "What is Garnet →",
        whatIsGarnetUrl: "https://docs.garnet.ai?utm_source=github&utm_medium=pr_comment",
        runnerBackground: "runner background",
    },
    comment: {
        foldOpenBudget: 3,
    },
    bannedVocabulary: [
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
        "gone",
    ],
    notes: {
        dnsResolver: {
            text: "",
            loopbackPattern: "^(127\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|::1|localhost)$",
        },
        instanceMetadata: {
            text: "Cloud IMDS",
            addresses: ["169.254.169.254"],
        },
        githubInfrastructure: {
            text: "github infra",
            nameSuffixes: [".githubapp.com", ".actions.githubusercontent.com"],
            truncatedSuffixes: [".githubapp"],
        },
        garnetSensor: {
            text: "garnet sensor",
            nameSuffixes: [".garnet.ai"],
        },
        executableProvenance: {
            text: "ran from",
            tempDirPrefixes: ["/tmp/", "/var/tmp/", "/dev/shm/"],
        },
    },
    mediumLimits: {
        prCommentHardLimit: 65536,
        prCommentBudget: 60000,
        stepSummaryHardLimit: 1048576,
    },
    publicRunProfile: {
        profileSelectorRoute: "/public/runs/{run_id}?profile=<profile_id>",
        selectorMiss:
            "an absent, empty, or wrong profile ID returns 404 — never a silent fallback to run index/job/first profile",
        embargoedFields: [
            "argv",
            "arguments",
            "executable paths",
            "environment values",
            "assertions",
            "detection evidence",
            "sensor telemetry",
            "sensitive actor/ref metadata",
        ],
    },
}
