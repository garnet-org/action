import { execFileSync } from "node:child_process"

const HOOKS_PATH = ".githooks"

try {
  execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
    stdio: "ignore",
  })
} catch {
  process.exit(0)
}

let currentHooksPath = ""

try {
  currentHooksPath = execFileSync(
    "git",
    ["config", "--get", "core.hooksPath"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    },
  ).trim()
} catch {
  currentHooksPath = ""
}

if (currentHooksPath === HOOKS_PATH) {
  process.exit(0)
}

execFileSync("git", ["config", "core.hooksPath", HOOKS_PATH], {
  stdio: "inherit",
})
