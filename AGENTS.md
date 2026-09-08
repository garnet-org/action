# AGENTS.md

## Core coding rules
- Use modern JavaScript and built-in platform/Node.js APIs first.
- Avoid third-party libraries whenever possible.
- Always ask before introducing any new dependency.
- Write idiomatic, easy-to-read, self-documenting code.
- Keep initialism/acronym casing consistent: use `URL`/`url`, `ID`/`id`; never `Url` or `Id`.
- Prefer straightforward control flow (`if` statements and intermediate variables) over clever inline expressions/spreads when constructing objects.
- Do not use top-level arrow functions. Use function declarations at module scope; only use arrow functions inside block scope.
- Prefer explicit checks; do not rely on truthy/falsy comparisons.
- Handle errors at all I/O, process, and network boundaries.
- Favor strict, safe code (validate external input and fail clearly).
- Use JSDoc types for all public functions, class methods, and non-trivial objects; keep code fully typed under `checkJs`.
- If an object type has more than one field, define it as a named `@typedef` instead of inlining it in `@param`, `@returns`, or `@type` annotations.
- Make invalid states unrepresentable instead of guarding against them; do not add branches for conditions the structure or types already rule out.
- Resolve floating or ambiguous inputs to concrete values once, at the boundary, so downstream functions always receive definite values.
- Read regex captures with destructuring defaults (`const [, major = "0"] = match`) to satisfy `noUncheckedIndexedAccess` without casts or repeated `undefined` checks.
- Single-line guard clauses (`if (version === null) return false`) are fine; use braces once the body does more than return or continue.
- Keep network round-trips to a minimum. Derive URLs from a stable naming convention rather than spending a request on metadata that only confirms it.
- Never describe a check as proving more than it does. Integrity (bytes arrived intact) and authenticity (bytes came from the expected signer) are different claims; say which one holds.

## Comments
- Comment why, not what: intent, constraints, tradeoffs, and non-obvious consequences.
- Delete any comment a reader could infer from the function, variable, or type name.
- Keep a comment when it records a decision, a limitation, or a subtlety that the code cannot state on its own.

## Testing and validation
- Tests live in `test/`, use the built-in `node:test` runner, and run with `npm test`.
- Run `npm run validate` (typecheck, tests, build) before treating a change as finished.
- For security-relevant code, test the failure paths (tampered, missing, and malformed input), not just the happy path.

## Repo-specific notes
- Source code lives in `src/`.
- `dist/` is generated from `src/` via npm scripts (`npm run build`); rebuild it after source changes.
- Prefer explicit file imports (for example `./module.js`); avoid barrel `index.js` re-export files.
- Prettier owns formatting (config in `package.json`: no semicolons, 4-space indent, 120 columns); do not hand-format against it.
- Treat `package.json` and `package-lock.json` as intentional edits only. Never upgrade or add dependencies as a side effect of another change.
