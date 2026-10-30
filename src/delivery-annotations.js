import * as core from "@actions/core"

/** @typedef {"profile_not_written"|"profile_empty"|"profile_invalid"|"profile_unreadable"|"profile_too_large"|"artifact_upload_failed"|"relay_agent_unreadable"|"summary_failed"} DeliveryFailureCause */

/**
 * @typedef {object} DeliveryFailureAnnotation
 * @property {string} title
 * @property {string} message
 */

export const NO_PROFILE_TITLE = "Garnet: Execution Profile not recorded"
export const NO_REVIEW_TITLE = "Garnet: no Runtime Review for this job"
export const SUMMARY_FAILED_TITLE = "Garnet: Runtime Review step error"

/** @type {Readonly<Record<DeliveryFailureCause, DeliveryFailureAnnotation>>} */
const DELIVERY_FAILURE_ANNOTATIONS = Object.freeze({
    profile_not_written: Object.freeze({
        title: NO_PROFILE_TITLE,
        message:
            "The Garnet sensor did not write this job's Execution Profile before the post step's wait ended, so the Runtime Review for this job has no runtime evidence. The job itself is not affected.",
    }),
    profile_empty: Object.freeze({
        title: NO_PROFILE_TITLE,
        message:
            "The Garnet sensor wrote an empty Execution Profile for this job, so the Runtime Review for this job has no runtime evidence. The job itself is not affected.",
    }),
    profile_invalid: Object.freeze({
        title: NO_PROFILE_TITLE,
        message:
            "The Garnet sensor wrote an Execution Profile for this job that could not be parsed, so the Runtime Review for this job has no runtime evidence. The job itself is not affected.",
    }),
    profile_unreadable: Object.freeze({
        title: NO_PROFILE_TITLE,
        message:
            "The Execution Profile for this job could not be read, so the Runtime Review for this job has no runtime evidence. The job itself is not affected.",
    }),
    profile_too_large: Object.freeze({
        title: NO_PROFILE_TITLE,
        message:
            "The Execution Profile for this job is too large to relay through a workflow artifact and was dropped, so the Runtime Review will report this job as unrecorded. The job itself is not affected.",
    }),
    artifact_upload_failed: Object.freeze({
        title: NO_REVIEW_TITLE,
        message:
            "Uploading the Garnet run artifact failed, so no Runtime Review will be published for this job. The job itself is not affected.",
    }),
    relay_agent_unreadable: Object.freeze({
        title: NO_REVIEW_TITLE,
        message:
            "The Garnet agent record saved by the main step could not be read, so the run artifact was skipped and no Runtime Review will be published for this job. The job itself is not affected.",
    }),
    summary_failed: Object.freeze({
        title: SUMMARY_FAILED_TITLE,
        message: "The Runtime Review step hit an unexpected error and did not finish. The job itself is not affected.",
    }),
})

/**
 * @param {DeliveryFailureCause} cause
 * @param {string} detail
 * @returns {void}
 */
export function annotateDeliveryFailure(cause, detail) {
    const annotation = DELIVERY_FAILURE_ANNOTATIONS[cause]
    core.warning(annotation.message, { title: annotation.title })
    if (detail !== "") {
        // core.info does not escape workflow commands; a line break in a
        // diagnostic drawn from the profile could start a new "::" command.
        core.info(`${annotation.title}: ${detail.replace(/[\r\n]+/g, " ")}`)
    }
}
