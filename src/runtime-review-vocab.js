/**
 * Runtime Review contract values — vendored from
 * garnet-org/runtime-review-testbed `main` contract/vocab.json, the single
 * living reference for renderer, vocabulary and goldens. `contractRef` pins
 * the testbed-main SHA the values were copied from. The Action renders only
 * the Step Summary (the Garnet App owns the PR comment), so only the values
 * the Step Summary and its gates consume are vendored here. Never hand-edit
 * values outside a contract sync; re-vendor from testbed main instead.
 *
 * PREP: until the renderer lane lands the comment-final contract on testbed
 * main, `contractRef` is a placeholder.
 */

export const CONTRACT_VOCAB = {
    version: "6.10.0",
    contractRef: "pending-renderer-lane-v17.3",
    profileFormatVersion: "0.2.0",
    copy: {
        stepSummaryHeading: "Garnet Execution Summary",
        kernelProvenance: "recorded at the kernel by Garnet",
        permalinkLabel: "View this job's Execution Profile in Garnet →",
        emptyPeers: "no outbound destinations recorded.",
        unknownLineage: "unknown (not recorded)",
        captureBestEffort: "Capture is best-effort.",
        terminalNetwork: "○",
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
        stepSummaryHardLimit: 1048576,
    },
}
