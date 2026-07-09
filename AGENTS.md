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

## Repo-specific notes
- Source code lives in `src/`.
- `dist/` is generated from `src/` via npm scripts (`npm run build`); rebuild it after source changes.
- Prefer explicit file imports (for example `./module.js`); avoid barrel `index.js` re-export files.
