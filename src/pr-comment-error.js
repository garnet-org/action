// Classification of GitHub API errors raised while publishing the Runtime
// Review PR comment.

import { getErrorMessage, getOptionalNumber, getOptionalRecord } from "./shared.js"

/**
 * Returns true when the comment publish failed because the workflow token
 * lacks permission to comment on the pull request. GitHub reports this as
 * HTTP 403 "Resource not accessible by integration", the normal state for
 * workflows whose `permissions` grant only `contents: read`.
 * @param {unknown} error
 * @returns {boolean}
 */
export function isCommentPermissionError(error) {
    if (getStatusCode(error) !== 403) {
        return false
    }

    return getErrorMessage(error).includes("Resource not accessible by integration")
}

/**
 * @param {unknown} error
 * @returns {number | undefined}
 */
function getStatusCode(error) {
    const errorRecord = getOptionalRecord(error)
    if (errorRecord === null) {
        return undefined
    }

    const statusCode = getOptionalNumber(errorRecord.status)
    if (statusCode !== undefined) {
        return statusCode
    }

    const response = getOptionalRecord(errorRecord.response)
    if (response === null) {
        return undefined
    }

    return getOptionalNumber(response.status)
}
