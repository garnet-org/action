# AGENTS.md

## Core coding rules
- Use modern JavaScript and built-in platform/Node.js APIs first.
- Avoid third-party libraries whenever possible.
- Always ask before introducing any new dependency.
- Write idiomatic, easy-to-read, self-documenting code.
- Prefer explicit checks; do not rely on truthy/falsy comparisons.
- Handle errors at all I/O, process, and network boundaries.
- Favor strict, safe code (validate external input and fail clearly).
- Use JSDoc types for all public functions, class methods, and non-trivial objects; keep code fully typed under `checkJs`.

## Repo-specific notes
- Source code lives in `src/`.
- `dist/` is generated from `src/` via npm scripts (`npm run build`); rebuild it after source changes.
- Prefer explicit file imports (for example `./module.js`); avoid barrel `index.js` re-export files.
