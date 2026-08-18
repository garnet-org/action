/**
 * Vendored, PINNED copy of the published GitHub infrastructure IP ranges the
 * Runtime Review contract consumes: `contract/github-meta-ip-ranges.json` in
 * garnet-org/runtime-review-testbed (contract v6.10.0, testbed main b2fa17a,
 * retrieved 2026-08-08 from https://api.github.com/meta).
 *
 * Contract data, not heuristics — the same class as the public suffix list.
 * Only the `web` and `api` service blocks are vendored: the provable-rotation
 * join (contract comment.rotationJoin) keys on those blocks and never on the
 * `actions` block, which is runner address space where a same-process address
 * substitution is not proof. Refresh by committing new bytes; never fetched at
 * render time.
 *
 * Shipped as a JS module (not .json) so the ncc bundle carries the data
 * without relying on asset relocation.
 */

/** @type {{ source: string, retrieved: string, web: string[], api: string[] }} */
export const GITHUB_META_IP_RANGES = {
    source: "https://api.github.com/meta",
    retrieved: "2026-08-08",
    web: [
        "192.30.252.0/22",
        "185.199.108.0/22",
        "140.82.112.0/20",
        "143.55.64.0/20",
        "2a0a:a440::/29",
        "2606:50c0::/32",
        "20.201.28.151/32",
        "20.205.243.166/32",
        "20.87.245.0/32",
        "4.237.22.38/32",
        "4.228.31.150/32",
        "20.207.73.82/32",
        "20.27.177.113/32",
        "20.200.245.247/32",
        "20.175.192.147/32",
        "20.233.83.145/32",
        "20.29.134.23/32",
        "20.199.39.232/32",
        "20.217.135.5/32",
        "4.225.11.194/32",
        "4.208.26.197/32",
        "20.26.156.215/32",
        "172.182.252.133/32",
        "4.249.131.164/32",
        "48.202.248.40/32",
        "48.204.201.5/32",
    ],
    api: [
        "192.30.252.0/22",
        "185.199.108.0/22",
        "140.82.112.0/20",
        "143.55.64.0/20",
        "2a0a:a440::/29",
        "2606:50c0::/32",
        "20.201.28.148/32",
        "20.205.243.168/32",
        "20.87.245.6/32",
        "4.237.22.34/32",
        "4.228.31.149/32",
        "20.207.73.85/32",
        "20.27.177.116/32",
        "20.200.245.245/32",
        "20.175.192.149/32",
        "20.233.83.146/32",
        "20.29.134.17/32",
        "20.199.39.228/32",
        "20.217.135.0/32",
        "4.225.11.201/32",
        "4.208.26.200/32",
        "20.26.156.210/32",
        "172.182.252.137/32",
        "4.249.131.166/32",
        "48.202.248.39/32",
        "48.204.201.2/32",
    ],
}
