/**
 * Runtime Review contract values — vendored from
 * garnet-org/runtime-review-testbed contract/vocab.json at contract v6.10.0.
 * Only the values the renderer and its gates consume are vendored here; the
 * testbed remains the normative source for the full contract. Never hand-edit
 * values outside a contract sync.
 */

export const CONTRACT_VOCAB = {
    version: "6.10.0",
    profileFormatVersion: "0.2.0",
    copy: {
        headlineLead: "Execution Profiles recorded for",
        headlinePendingLead: "Execution Profiles recording for jobs triggered by",
        stepSummaryHeading: "Garnet Execution Summary",
        artifact: "Execution Profile",
        kernelProvenance: "recorded at the kernel by Garnet",
        sensor: "Jibril",
        destinationNoun: "destination",
        chainNoun: "execution chain",
        permalinkLabel: "View this job's Execution Profile in Garnet →",
        emptyPeers: "no outbound destinations recorded.",
        noRunProfile: "no Execution Profile recorded.",
        unknownLineage: "unknown (not recorded)",
        explainerLabel: "💡 How to read this",
        explainerReadingLine:
            "follow a path downward to see what ran and what it did — each path to an observed action is an execution chain",
        explainerComparisonLine: "+ only in the current record · − only in the previous record",
        explainerBackgroundSegment: "runner background = the runner's infrastructure, not your workflow",
        explainerCalloutPath: "process on a path",
        explainerCalloutActed: "process that acted",
        explainerCalloutAction: "observed action",
        explainerLegendLine: "names on the path = processes · ○ = observed action · (…) = context",
        pendingStatus:
            "⏳ Execution Profiles for this commit are still being recorded — this comment updates in place as jobs finish.",
        truncationTemplate: "rendered X of Y destination associations",
        noChange: "unchanged",
        terminalNetwork: "○",
        terminalFile: "□",
        terminalExecution: "▷",
        sinceWord: "since",
        vanishedJobsLabel: "jobs no longer recorded",
        jobsLineNoOutbound: "with no outbound destinations recorded",
        jobsLineVanished: "no longer recorded",
        jobsLineChanged: "changed",
        jobsLineUnchanged: "unchanged",
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
            text: "dns resolver",
            loopbackPattern: "^(127\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}|::1|localhost)$",
        },
        instanceMetadata: {
            text: "cloud metadata",
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
