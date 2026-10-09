import { getEnv } from "./shared.js"
import { getPullRequestHeadShaFromEvent } from "./github-event.js"

/** @typedef {import("./control-plane/types.js").AgentGithubContext} AgentGithubContext */

/**
 * @returns {string}
 */
export function getProfileJobName() {
  return getEnv("GARNET_PROFILE_JOB", getEnv("GITHUB_JOB"))
}

/**
 * `job_index` is deliberately absent: GitHub never exposes the matrix leg
 * index to a running step, so only jibril can resolve it, and it does so in
 * the profile it writes.
 * @returns {Promise<AgentGithubContext>}
 */
export async function createGitHubContext() {
  return {
    job: getProfileJobName(),
    run_id: getEnv("GITHUB_RUN_ID"),
    run_attempt: getEnv("GITHUB_RUN_ATTEMPT"),
    run_number: getEnv("GITHUB_RUN_NUMBER"),
    workflow: getProfileWorkflowName(),
    workflow_ref: getEnv("GITHUB_WORKFLOW_REF"),
    workflow_sha: getEnv("GITHUB_WORKFLOW_SHA"),
    repository: getEnv("GITHUB_REPOSITORY"),
    repository_id: getEnv("GITHUB_REPOSITORY_ID"),
    repository_owner: getEnv("GITHUB_REPOSITORY_OWNER"),
    repository_owner_id: getEnv("GITHUB_REPOSITORY_OWNER_ID"),
    sha: await getProfileSha(),
    ref: getEnv("GITHUB_REF"),
    ref_name: getEnv("GITHUB_REF_NAME"),
    ref_type: getEnv("GITHUB_REF_TYPE"),
    ref_protected: getEnv("GITHUB_REF_PROTECTED") === "true",
    event_name: getEnv("GITHUB_EVENT_NAME"),
    action: getEnv("GITHUB_ACTION"),
    actor: getEnv("GITHUB_ACTOR"),
    actor_id: getEnv("GITHUB_ACTOR_ID"),
    triggering_actor: getEnv("GITHUB_TRIGGERING_ACTOR"),
    runner_os: getEnv("RUNNER_OS"),
    runner_arch: getEnv("RUNNER_ARCH"),
    server_url: getEnv("GITHUB_SERVER_URL"),
    workspace: getEnv("GITHUB_WORKSPACE"),
  }
}

/**
 * @returns {string}
 */
export function getWorkflowFilePath() {
  const workspace = getEnv("GITHUB_WORKSPACE")
  const workflowRef = getEnv("GITHUB_WORKFLOW_REF")
  const repository = getEnv("GITHUB_REPOSITORY")

  if (workspace === "" || workflowRef === "" || repository === "") {
    return ""
  }

  const pathPart = workflowRef.split("@")[0] ?? ""
  const repoPrefix = `${repository}/`
  const relativePath = pathPart.startsWith(repoPrefix)
    ? pathPart.slice(repoPrefix.length)
    : pathPart

  return `${workspace}/${relativePath}`
}

/**
 * @returns {string}
 */
function getProfileWorkflowName() {
  return getEnv("GARNET_PROFILE_WORKFLOW", getEnv("GITHUB_WORKFLOW"))
}

/**
 * The head SHA is preferred over GITHUB_SHA, which on a `pull_request` event
 * names the ephemeral merge commit no reviewer sees. The control plane
 * accepts either.
 * @returns {Promise<string>}
 */
export async function getProfileSha() {
  const eventPath = getEnv("GITHUB_EVENT_PATH")
  if (eventPath !== "") {
    const pullRequestHeadSha = await getPullRequestHeadShaFromEvent(eventPath)
    if (pullRequestHeadSha !== null) {
      return pullRequestHeadSha
    }
  }

  return getEnv("GITHUB_SHA")
}
