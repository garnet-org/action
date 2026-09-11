/**
 * The Step Summary body for a run where the sensor produced no usable Run
 * Profile: a single plain line, no markers, no table.
 * @returns {string}
 */
export function renderNoProfileSummary() {
    return "No execution profile was produced for this job (status: no_profile)"
}
