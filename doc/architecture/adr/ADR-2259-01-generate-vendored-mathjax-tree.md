---
id: ADR-2259-01
title: "Generate the vendored MathJax tree from one pinned package"
status: Proposed
date: 2026-08-30
tracking_issue: 2259
deciders:
  - "@erseco"
reviewers:
  - "@erseco"
related:
  prs: []
  changes: []
  adrs:
    - ADR-2259-02
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-sonnet-5"
---

# ADR-2259-01: Generate the vendored MathJax tree from one pinned package

## Context

`public/app/common/exe_math/` holds a copy of MathJax committed to git. It has to be
on disk rather than fetched: HTML5, SCORM, IMS and EPUB exports copy the directory
into the package, the static PWA build zips it into `common.zip`
(`scripts/build-resource-bundles.js:262`), and the Electron app runs offline.

The copy was made by hand. PR #752 (`cb778b969`) replaced 35 files with MathJax
4.0.0 and added 50 more that only exist in v4. PR #869 (`9272d5c67`) then rolled
back exactly those 35 files to 3.2.2 and left the other 50 in place. Nothing
detected the mix. For eight months the directory shipped a 3.2.2 combined component
next to a 4.0.0 accessibility stack, and the v3 loader rejected the v4 components
with `Component a11y/sre uses 4.0.0 of MathJax; version in use is 3.2.2`, followed
by `Cannot read properties of undefined (reading 'SpeechMathItemMixin')` — issue
#2259. About 5.8 MB of the 8.4 MB directory was unreachable code that every math
export still carried.

Separately, `src/shared/export/prerender/ServerLatexPreRenderer.ts` renders LaTeX
server-side for CLI exports and the external API, from a second MathJax obtained
through npm (`mathjax-full`, pinned at 3.2.2 by PR #1083). The browser path and the
server path are two implementations of the same output and could drift the same way.

## Problem

How do we keep the vendored MathJax copy, the npm dependency used by the server-side
pre-renderer, and the configuration that loads them from silently disagreeing again?

## Decision drivers

- A version mix must be impossible to commit, not merely discouraged.
- Exports, the static build and Electron need the files on disk, offline.
- The same document must render identically whether the export ran in the browser
  (primary path) or on the server (CLI and external API) — the "single source of
  truth" rule in AGENTS.md.
- Every byte in `exe_math/` ships in every export that contains mathematics.

## Options considered

### Option 1: Remove the dead v4 files, stay on 3.2.2

Delete the 50 orphaned files so the tree is consistently 3.2.2. This is what PR #2260
does on a different branch.

- Pro: smallest possible diff, immediately fixes the console error, −6.2 MB.
- Con: the accessibility menu stays permanently broken, which is what #2259 asks to
  fix. Leaves the project on a MathJax release that is two majors behind.
- Con: does nothing to stop the next hand-copy from re-creating the mix.

### Option 2: Complete the upgrade to MathJax 4, still hand-copied

Vendor a consistent v4 tree manually.

- Pro: fixes accessibility and the version mix.
- Con: the failure mode that produced #2259 remains available to the next person.

### Option 3: Complete the upgrade and derive the tree from a pinned package

Add `mathjax` as a pinned devDependency, generate `exe_math/` from it with a script,
and fail the test suite when the committed tree and the package disagree.

- Pro: a partial revert like `9272d5c67` cannot be committed without the drift test
  going red.
- Pro: the file list becomes an explicit, reviewable manifest instead of an accident
  of whoever last copied files.
- Con: adds a build script and a dependency whose only job is to be copied from.

## Evidence

- The mix and its two commits: `cb778b969` (PR #752) added the v4 files;
  `9272d5c67` (PR #869) reverted 35 of them, `exe_math` stat `35 files changed,
  38 insertions(+), 38 deletions(-)`.
- Version strings measured in the tree at `c169c6cef`: `tex-mml-svg.js` and 34 of 40
  `input/tex/extensions/*.js` report `"3.2.2"`; `core.js`, `loader.js`, `startup.js`,
  all of `a11y/`, `output/`, `ui/`, `adaptors/` and `sre/speech-worker.js` report
  `"4.0.0"`.
- The committed tree is file-for-file the `mathjax` npm package minus the combined
  components that are not loaded and the Node entry points, which is what makes
  generating it viable.
- MathJax 4 removed the `AllPackages` barrel; each TeX extension registers itself on
  import (<https://docs.mathjax.org/en/latest/upgrading/v3.html>). A package named in
  `packages` but never imported is dropped with a console warning, not an error —
  observed as `MathJax Warning: Package 'ams' not found. Omitted.`
- The v4 npm package ships `sre/mathmaps/*.json` and `sre/speech-worker.js` itself,
  so the speech data needs no separate `speech-rule-engine` dependency.
- `adaptors/` contains only jsdom, linkedom and liteDOM, which are Node-only and
  cannot load in a browser.
- Measured sizes: the tree goes from 8.4 MB (85 files, ~5.8 MB unreachable) to
  5.9 MB (74 files, none unreachable).

## Decision

We will upgrade to MathJax 4.1.3 and generate `public/app/common/exe_math/` from the
pinned `mathjax` npm package using `scripts/vendor-mathjax.ts`, run via
`make vendor-mathjax`. The script owns an explicit manifest: the `tex-mml-svg`
combined component and the component entry points, all of `a11y/`, `input/`,
`output/` and `ui/`, the speech worker, and the speech-rule locales from
ADR-2259-02. It excludes `adaptors/`, the combined components eXeLearning does not
load, and the Node entry points.

`scripts/vendor-mathjax.spec.ts` compares the committed tree against the package by
SHA-256 and fails on any missing, extra or changed file, so a partial revert cannot
land. A second test fails if any vendored `.js` still contains the string `"3.2.2"`.

The server-side pre-renderer moves to `@mathjax/src` 4.1.3, replacing `mathjax-full`.
Because v4 has no `AllPackages`, the enabled TeX packages become an explicit list in
`src/shared/export/prerender/mathjax-packages.ts`, and
`mathjax-packages.spec.ts` asserts it equals the browser's `externalExtensions` array
in `public/app/common/common.js`.

The static PWA build stops duplicating the MathJax configuration: it sets
`window.MATHJAX_BASE_PATH` and lets `common.js` build the rest.

## Consequences

### Positive

- The version mix that caused #2259 is now a failing test rather than a silent state.
- `exe_math/` drops from 8.4 MB to 5.9 MB, and nothing in it is dead.
- Browser and server pre-render enable the same TeX packages, enforced by a test.
- The static build no longer carries a second copy of the MathJax configuration
  (28 lines of duplication removed from `scripts/static-bundle/static-index.html`).
- Five TeX extensions the 3.2.2 bundle could not load now work: `begingroup`,
  `colorv2`, `dsfont`, `texhtml`, `units`.

### Negative

- Bumping MathJax now requires running `make vendor-mathjax` and committing the
  regenerated tree; forgetting it produces a red test rather than a silent mix.
- `@mathjax/mathjax-newcm-font` (~50 MB) joins `node_modules` so the server-side
  pre-renderer can load font ranges on demand. It is never packaged into an export.

### Neutral

- `exe_math/` stays committed to git. Fetching it at build time was not considered
  viable while offline Electron builds are supported.
- The default font changes from MathJax's TeX font to `mathjax-newcm`. Both are
  Computer Modern designs, so existing content renders near-identically.

## Risks

- **A MathJax minor release changes the file layout**, breaking the manifest. Low
  severity: the drift test fails loudly at upgrade time, which is when someone is
  already looking.
- **`import(name)` in the server pre-renderer resolves differently under a future
  runtime.** Already bitten once: without an explicit `.js` extension, Node resolved
  `@mathjax/src/js/mathjax` to a non-existent `./cjs/mathjax` while Bun accepted it.
  The E2E suite caught it because Playwright runs specs under Node.

## Validation

- `scripts/vendor-mathjax.spec.ts` — 7 tests; fails on drift or on any 3.2.2 leftover.
- `src/shared/export/prerender/mathjax-packages.spec.ts` — asserts browser/server
  package parity and that every named package is actually registered.
- `test/e2e/playwright/specs/latex-rendering.spec.ts` — 15 tests green.

## Follow-up work

- `tex.displayMath` still lists `$$…$$`, but dollar delimiters were deliberately
  dropped: only `\(…\)` and `\[…\]` are supported (decision on PR #2269, closing
  issue #1990). `$$` renders in exports yet loses a `$` per side through the editor
  round-trip, so it half-works. Aligning the configuration with the decision is a
  separate change — removing it outright would stop existing `$$` content rendering
  in exports, where it currently does.
- `bbm` and `bboldx` stay disabled: MathJax publishes no font package for them under
  the `@mathjax` scope, so their macros render as undefined-macro errors.

## References

- Issue #2259 — Interactive math speech/explorer broken by MathJax 3.2.2/4.0 version mix
- PR #752 (`cb778b969`), PR #869 (`9272d5c67`), PR #1083 (`c6a1b1f56`)
- PR #2260 — removes the dead v4 files, the alternative considered as Option 1
- <https://docs.mathjax.org/en/latest/upgrading/v3.html>
- ADR-2259-02 — accessibility strategy for the upgraded runtime
