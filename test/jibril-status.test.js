import assert from "node:assert/strict"
import { test } from "node:test"
import { formatEbpfErrors, formatKernelGaps, parseJibrilStatus } from "../src/jibril-status.js"

// jibril embeds its Ebpf struct into the status blocks, so the counters sit
// flat next to `status`, and writes both files as indented JSON.
const EBPF = {
    objects: 4,
    maps: 9,
    ringbufs: 1,
    programs: 12,
    attached: 12,
    live_links: 10,
    errors: { load: 0, attach: 0, link: 0 },
}

const KERNEL = {
    release: "6.8.0-1014-aws",
    arch: "x86_64",
    bpf: { btf: true, lsm: false, tracefs: true, cgroup2: true, lockdown: "none" },
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function asFile(value) {
    return `${JSON.stringify(value, null, 2)}\n`
}

test("the readiness file parses: flat counters, kernel, and no github block", () => {
    const status = parseJibrilStatus(
        asFile({
            status: "ok",
            pid: 1234,
            version: "v2.17.0",
            ready_at: "2026-09-10T21:52:40Z",
            kernel: KERNEL,
            ebpf: EBPF,
        }),
    )

    assert.ok(status !== null)
    assert.equal(status.status, "ok")
    assert.equal(status.readyAt, "2026-09-10T21:52:40Z")
    assert.deepEqual(status.ebpf, {
        programs: 12,
        attached: 12,
        liveLinks: 10,
        errors: { load: 0, attach: 0, link: 0, attachFailures: [] },
    })
    assert.deepEqual(status.kernel, {
        release: "6.8.0-1014-aws",
        bpf: { btf: true, lsm: false, tracefs: true, cgroup2: true, lockdown: "none" },
    })
    assert.equal(status.githubSteps, null)
})

test("the run status file parses the nested ebpf block and the github steps", () => {
    const status = parseJibrilStatus(
        asFile({
            status: "ok",
            kernel: KERNEL,
            features: {
                ebpf: { status: "ok", ...EBPF },
                github: { steps: { status: "ok", source: "api", count: 7 }, workflow: "ci" },
            },
        }),
    )

    assert.ok(status !== null)
    assert.equal(status.ebpf?.attached, 12)
    assert.deepEqual(status.githubSteps, { status: "ok", source: "api", count: 7, errors: [] })
})

test("an omitted ebpf block reads as never reported, not as a clean load", () => {
    const status = parseJibrilStatus(asFile({ status: "ok", kernel: KERNEL, features: { github: { steps: {} } } }))

    assert.ok(status !== null)
    assert.equal(status.ebpf, null)
})

test("a degraded load keeps its counters and names the programs that stayed blind", () => {
    const status = parseJibrilStatus(
        asFile({
            status: "degraded",
            kernel: KERNEL,
            ebpf: {
                ...EBPF,
                attached: 10,
                errors: {
                    load: 0,
                    attach: 2,
                    link: 0,
                    attach_failures: [
                        { program: "sys_enter_execve", section: "tp/syscalls", error: "no such file" },
                        { program: "tcp_connect", section: "fentry/tcp_connect", error: "invalid argument" },
                    ],
                },
            },
        }),
    )

    assert.ok(status !== null)
    assert.equal(status.status, "degraded")
    assert.deepEqual(status.ebpf?.errors.attachFailures, [
        { program: "sys_enter_execve", error: "no such file" },
        { program: "tcp_connect", error: "invalid argument" },
    ])
})

test("degraded step attribution keeps its source and errors", () => {
    const status = parseJibrilStatus(
        asFile({
            features: {
                github: {
                    steps: { status: "degraded", source: "local", count: 3, errors: ["github api: 403", "  "] },
                },
            },
        }),
    )

    assert.ok(status !== null)
    assert.deepEqual(status.githubSteps, {
        status: "degraded",
        source: "local",
        count: 3,
        errors: ["github api: 403"],
    })
})

test("values outside jibril's own enums are not reported as known ones", () => {
    const status = parseJibrilStatus(
        asFile({
            status: "weird",
            kernel: { release: "6.8.0", bpf: { lockdown: "sideways" } },
            features: { github: { steps: { status: "weird", source: "telepathy", count: "3" } } },
        }),
    )

    assert.ok(status !== null)
    assert.equal(status.status, null)
    assert.equal(status.kernel?.bpf.lockdown, null)
    assert.deepEqual(status.githubSteps, { status: null, source: null, count: 0, errors: [] })
})

test("a file that says nothing is null: empty, malformed, truncated, or not an object", () => {
    const truncated = asFile({ status: "ok", kernel: KERNEL, ebpf: EBPF }).slice(0, 40)

    for (const content of ["", "   \n", "{", "not json", "[]", '"ok"', truncated]) {
        assert.equal(parseJibrilStatus(content), null, `expected ${JSON.stringify(content)} to parse as null`)
    }
})

test("eBPF errors name only the non-zero counters, so silence means a clean load", () => {
    const none = { load: 0, attach: 0, link: 0, attachFailures: [] }

    assert.equal(formatEbpfErrors(none), "")
    assert.equal(formatEbpfErrors({ ...none, load: 2, link: 1 }), "load=2, link=1")
})

test("kernel gaps name what the loader did not get, and stay quiet on an ordinary host", () => {
    /** @param {Partial<import("../src/jibril-status.js").JibrilKernelBpf>} bpf */
    const kernel = bpf => ({
        release: "6.8.0-1014-aws",
        bpf: { btf: true, lsm: true, tracefs: true, cgroup2: true, lockdown: /** @type {const} */ ("none"), ...bpf },
    })

    assert.equal(formatKernelGaps(kernel({})), "")
    assert.equal(formatKernelGaps(null), "")
    assert.equal(formatKernelGaps(kernel({ btf: false })), "kernel 6.8.0-1014-aws offers no BTF")
    assert.equal(
        formatKernelGaps(kernel({ btf: false, tracefs: false, cgroup2: false })),
        "kernel 6.8.0-1014-aws offers no BTF, no tracefs, no cgroup2",
    )
    assert.equal(
        formatKernelGaps(kernel({ lockdown: "confidentiality" })),
        "kernel 6.8.0-1014-aws offers lockdown confidentiality",
    )
    // Ordinary on a hosted runner: reported in the payload, never blamed.
    assert.equal(formatKernelGaps(kernel({ lsm: false })), "")
    assert.equal(formatKernelGaps(kernel({ lockdown: "integrity" })), "")
    assert.equal(formatKernelGaps(kernel({ lockdown: "unknown" })), "")
    assert.equal(formatKernelGaps(kernel({ lockdown: null })), "")
})
