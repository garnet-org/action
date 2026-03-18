import { getEnv } from "./shared.js"
import { getPullRequestHeadShaFromEvent } from "./github-event.js"

/**
 * @returns {string}
 */
export function getProfileJobName() {
  return getEnv("GARNET_PROFILE_JOB", getEnv("GITHUB_JOB"))
}

/**
 * @returns {Promise<Record<string, string>>}
 */
export async function createGitHubContext() {
  return {
    job: getProfileJobName(),
    run_id: getEnv("GITHUB_RUN_ID"),
    workflow: getProfileWorkflowName(),
    repository: getEnv("GITHUB_REPOSITORY"),
    repository_id: getEnv("GITHUB_REPOSITORY_ID"),
    repository_owner: getEnv("GITHUB_REPOSITORY_OWNER"),
    repository_owner_id: getEnv("GITHUB_REPOSITORY_OWNER_ID"),
    event_name: getEnv("GITHUB_EVENT_NAME"),
    ref: getEnv("GITHUB_REF"),
    sha: await getProfileSha(),
    actor: getEnv("GITHUB_ACTOR"),
    runner_os: getEnv("RUNNER_OS"),
    runner_arch: getEnv("RUNNER_ARCH"),
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
 * @returns {Promise<string>}
 */
async function getProfileSha() {
  const eventPath = getEnv("GITHUB_EVENT_PATH")
  if (eventPath !== "") {
    const pullRequestHeadSha = await getPullRequestHeadShaFromEvent(eventPath)
    if (pullRequestHeadSha !== null) {
      return pullRequestHeadSha
    }
  }

  return getEnv("GITHUB_SHA")
}
