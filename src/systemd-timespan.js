// Parser for systemd timespan values as printed by `systemctl show`
// (for example "10min", "1min 30s", "45s", "infinity").

/** @type {Record<string, number>} */
const UNIT_SECONDS = {
    usec: 1 / 1e6,
    us: 1 / 1e6,
    msec: 1 / 1e3,
    ms: 1 / 1e3,
    seconds: 1,
    second: 1,
    sec: 1,
    s: 1,
    minutes: 60,
    minute: 60,
    min: 60,
    m: 60,
    hours: 3600,
    hour: 3600,
    hr: 3600,
    h: 3600,
    days: 86400,
    day: 86400,
    d: 86400,
    weeks: 604800,
    week: 604800,
    w: 604800,
}

/**
 * Parses a systemd timespan string into whole seconds (rounded up so a
 * bound derived from it never undercuts the unit's own deadline). Returns
 * null for "infinity", empty, or unparsable values.
 * @param {string} value
 * @returns {number | null}
 */
export function parseSystemdTimespanSeconds(value) {
    const text = String(value === undefined || value === null ? "" : value).trim()
    if (text === "" || text === "infinity") {
        return null
    }

    let totalSeconds = 0
    let matchedLength = 0
    const pattern = /(\d+(?:\.\d+)?)\s*([a-zµ]+)?/gi
    for (const match of text.matchAll(pattern)) {
        const digits = match[1]
        if (digits === undefined) {
            return null
        }
        const amount = Number.parseFloat(digits)
        if (!Number.isFinite(amount)) {
            return null
        }

        const unit = match[2] === undefined ? "s" : match[2].toLowerCase().replace("µs", "us")
        const unitSeconds = UNIT_SECONDS[unit]
        if (unitSeconds === undefined) {
            return null
        }

        totalSeconds += amount * unitSeconds
        matchedLength += match[0].length
    }

    if (matchedLength === 0 || text.replace(/[\s\d.a-zµ]/gi, "") !== "") {
        return null
    }

    const rounded = Math.ceil(totalSeconds)
    if (!Number.isSafeInteger(rounded) || rounded <= 0) {
        return null
    }

    return rounded
}
