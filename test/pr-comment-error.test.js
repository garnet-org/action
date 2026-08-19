import assert from "node:assert/strict"
import { test } from "node:test"
import { isCommentPermissionError } from "../src/pr-comment-error.js"

function permissionError() {
    const error = new Error("Resource not accessible by integration")
    return Object.assign(error, { status: 403 })
}

test("403 'Resource not accessible by integration' is a permission error", () => {
    assert.equal(isCommentPermissionError(permissionError()), true)
})

test("status carried on the response record is also recognized", () => {
    const error = new Error("Resource not accessible by integration")
    Object.assign(error, { response: { status: 403 } })
    assert.equal(isCommentPermissionError(error), true)
})

test("other 403 errors are not permission errors", () => {
    const error = Object.assign(new Error("API rate limit exceeded"), { status: 403 })
    assert.equal(isCommentPermissionError(error), false)
})

test("non-403 errors are not permission errors", () => {
    const error = Object.assign(new Error("Resource not accessible by integration"), { status: 404 })
    assert.equal(isCommentPermissionError(error), false)
    assert.equal(isCommentPermissionError(new Error("Resource not accessible by integration")), false)
    assert.equal(isCommentPermissionError("boom"), false)
    assert.equal(isCommentPermissionError(null), false)
})
