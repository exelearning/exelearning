---
id: ADR-1593-01
title: "Source vendored frontend libraries from npm and generate them at build time"
status: Proposed
date: 2026-07-09
tracking_issue: 1593
legacy_id: ADR-0029
deciders:
  - "@erseco"
reviewers:
  - "@pabloamayab"
  - "@ignaciogros"
  - "@juanda"
  - "@mnarvaezm"
related:
  prs: [1593]
  changes: ["1593-vendored-frontend-libs-build-pipeline"]
  adrs: [ADR-1593-02, ADR-1593-03]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-1593-01: Source vendored frontend libraries from npm and generate them at build time

## Context

The frontend (`public/`) has historically shipped its third-party JavaScript and
CSS as pre-minified blobs committed directly into the repository. These files
lived under `public/libs/` (jQuery, Bootstrap, showdown, fflate, abcjs,
interact.js, jQuery UI, SimpleLightbox, DOMPurify, fabric, pdf.js, Yjs),
`public/app/common/` (mermaid, DOMPurify inside `edicuatex`), and inside several
iDevice export directories (`public/files/perm/idevices/base/*/export/` for
html2canvas and SimpleLightbox).

The committed blobs carried no provenance metadata, no declared version, and no
automated update path. Several of them were duplicated byte-for-byte across
multiple locations (html2canvas appears under `progress-report`, `checklist`,
and `rubric`; SimpleLightbox under `public/libs/simplelightbox/dist/` and the
`image-gallery` iDevice export; DOMPurify under `edicuatex` and `public/libs/`).
Updating a library meant hand-editing a minified artifact in every copy, which
is error prone and left the tree with tens of thousands of lines of vendored
minified code that reviewers cannot meaningfully audit.

PR #1593 removes those committed artifacts (roughly 56,900 deleted lines across
the vendor blobs) and replaces them with a declared, npm-managed source of
truth plus a deterministic build step. This ADR records the sourcing and
build-time-generation decision. The Yjs-specific shim strategy is recorded
separately in ADR-1593-02, and the automated-update governance in ADR-1593-03.

## Problem

Where should the frontend's third-party libraries come from, and how should the
files under `public/` that the app and exporters load at runtime be produced,
given that (a) provenance and versioning must be explicit and auditable, (b)
duplicated copies must stay in sync, and (c) the app must keep working offline,
in the Electron desktop build, and in the static/embedded builds where a runtime
CDN fetch is not acceptable?

## Decision drivers

- **Provenance and auditability** — every third-party file must trace to a named
  package at a pinned version, not an opaque committed blob.
- **Single source of truth** — duplicated copies (html2canvas ×3, SimpleLightbox
  ×2, DOMPurify ×2) must derive from one declared source, per the AGENTS.md
  "single source of truth" rule.
- **Security update path** — libraries must be updatable through a routine
  dependency-management flow rather than manual blob replacement (see ADR-1593-03).
- **Offline / desktop / static / opaque serving** — the runtime must not depend
  on a third-party CDN; assets are served from the app's own origin under the
  opaque serving model.
- **Deterministic, testable build** — the copy step must fail loudly if it is
  skipped or runs out of order, not ship a silently incomplete bundle.
- **Repository size and reviewability** — remove tens of thousands of lines of
  unreviewable minified code from version control.

## Options considered

### Option 1: Keep committing pre-minified vendor blobs (status quo)

Continue tracking the minified files in `public/`. No new tooling.

- Pros: nothing to build; files are present in a fresh checkout.
- Cons: no provenance or version metadata; duplicated copies drift; no automated
  security updates; large unreviewable diffs; violates the single-source-of-truth
  rule. Rejected.

### Option 2: Fetch libraries from a public CDN at runtime

Reference libraries from a CDN (`<script src="https://cdn...">`) and drop them
from the repo entirely.

- Pros: smallest repository; CDN handles delivery and caching.
- Cons: breaks offline use, the Electron desktop build, and the static/embedded
  distributions; conflicts with the opaque serving model and a strict
  Content-Security-Policy that blocks external hosts; introduces a third-party
  runtime dependency and privacy surface. Rejected.

### Option 3: Declare libraries in `package.json` and copy their dist files at build time (chosen)

Add each library as an npm dependency, copy its published distribution file(s)
from `node_modules/` into the expected `public/` locations during a dedicated
`bundle:vendor` build step, and gitignore the copied destinations.

- Pros: explicit provenance via `package.json` + `bun.lock`; one npm source feeds
  all duplicated copies; assets are still served from the app's own origin;
  enables automated updates (ADR-1593-03); removes committed blobs from the tree.
- Cons: a fresh checkout has no runtime vendor files until `bundle:vendor` runs;
  adds a build step that CI and packaging must invoke. Chosen.

### Option 4: Import every library through the application bundler

`import` each library from the app's esbuild/Vite bundles instead of loading
them as standalone `<script>` files.

- Pros: tree-shaking, one bundle.
- Cons: much of the frontend is vanilla JS that expects browser globals
  (`window.jQuery`, `window.fabric`, jQuery-UI plugins, iDevice export scripts
  loaded as classic scripts). Rewriting every consumer to ESM imports is a large,
  high-risk change out of scope here. Bundler-driven generation is used only for
  Yjs, where a single shared instance matters (see ADR-1593-02). Rejected as the
  general strategy.

## Evidence

- `scripts/copy-vendor-libs.js` — the `COPIES` table maps each `node_modules`
  source to its `public/` destination (pdf.js, mermaid, jQuery, Bootstrap +
  Popper bundle, showdown, fflate, abcjs, html2canvas ×3, DOMPurify ×2, fabric,
  interact.js, jQuery UI, SimpleLightbox ×2). It fails on the first missing
  source rather than skipping silently.
- `scripts/copy-vendor-libs.spec.ts` — asserts the `COPIES` table is non-empty,
  that the runtime-loaded rubric `html2canvas.js` copy is present, that all three
  html2canvas destinations resolve from the npm package, that every `src` path
  exists after install, and that `copyFile` throws on a missing source and
  creates each destination directory once.
- `package.json` — adds `abcjs`, `bootstrap`, `html2canvas`, `interactjs`,
  `jquery`, `jquery-ui`, `showdown`, `simplelightbox` as devDependencies
  (`dompurify`, `fabric`, `esbuild` were already present); `mermaid`,
  `pdfjs-dist`, `yjs`, `y-websocket`, `lib0` are runtime dependencies. It defines
  `"bundle:vendor": "bun scripts/build-yjs-shims.js && bun scripts/copy-vendor-libs.js"`
  and wires it into `build:all` before the parallel `bundle:resources` step.
- `.gitignore` — lists every generated vendor destination under a "Vendored
  frontend libs — generated from npm during bundle:vendor" section (Phase 1:
  libraries already in `package.json`; Phase 2: newly added devDependencies),
  with `public/app/common/exe_math/` explicitly excluded pending the MathJax
  migration.
- `scripts/build-resource-bundles.js` — `BASE_LIBS` marks the gitignored vendor
  files (`libs/jquery/jquery.min.js`, `libs/bootstrap/bootstrap.bundle.min.js`,
  `libs/bootstrap/bootstrap.min.css`, and the two Bootstrap `.map` files) as
  `required: true`; `buildLibsBundle()` throws `Missing required library …`
  when a required file is absent, while repository-tracked sources
  (`common.js`, `favicon.ico`) only warn.
- `scripts/build-resource-bundles.spec.ts` — the "required vendor libs" block
  verifies that jQuery/Bootstrap are marked required, that tracked sources are
  not, and that `buildLibsBundle()` throws when a required file is moved aside.
- `.github/workflows/ci.yml` — adds a "Build vendor libs" step
  (`bun run bundle:vendor`) before the unit-test job.
- `.github/workflows/e2e.yml` — the dynamic-bundles artifact now includes
  `public/libs/**`, the mermaid and edicuatex/DOMPurify outputs, and the
  html2canvas / SimpleLightbox iDevice-export files so E2E runs against the
  generated vendor assets.
- MathJax exclusion is documented in the header of `scripts/copy-vendor-libs.js`
  and in `.gitignore`: `public/app/common/exe_math/` is a customized subset mixing
  MathJax 3.x/4.x files and is intentionally left tracked pending a dedicated
  migration.

## Decision

We will source the frontend's third-party libraries from npm (declared in
`package.json`, pinned by `bun.lock`) and generate the files under `public/`
that the app and exporters load at runtime by copying each library's published
distribution from `node_modules/` during a dedicated `bundle:vendor` build step
(`scripts/copy-vendor-libs.js`). The generated destinations are gitignored, the
`bundle:vendor` step runs before `bundle:resources` in `build:all` and in CI,
and `build-resource-bundles.js` fails the build if a required vendor file is
missing. MathJax (`exe_math/`) is explicitly out of scope and stays tracked
until its own migration.

## Consequences

### Positive

- Every vendored file traces to a named package at a pinned version; the large
  minified blobs leave version control (~56,900 lines deleted in PR #1593).
- Duplicated copies (html2canvas ×3, SimpleLightbox ×2, DOMPurify ×2) now derive
  from a single npm source, satisfying the single-source-of-truth rule.
- Assets are still served from the app's own origin, so offline, desktop,
  static, and embedded/opaque builds keep working with no CDN dependency.
- Automated dependency updates become possible (ADR-1593-03).
- A skipped or mis-ordered vendor step fails the build loudly instead of shipping
  an incomplete `libs.zip`.

### Negative

- A fresh checkout has no runtime vendor files until `bundle:vendor` runs; every
  build path (CI, packaging, E2E, contributor setup) must invoke it.
- One more moving part in the build; the `COPIES` table must be kept in step with
  the files consumers actually load.

### Neutral

- The newly added UI libraries are declared as devDependencies because only their
  build-time dist artifacts ship at runtime, not the `node_modules` trees.
- MathJax remains a committed subset until its migration, so the "no committed
  vendor blobs" goal is not yet fully complete.

## Risks

- **Incomplete `COPIES` table** — if a consumer loads a file not listed in
  `COPIES`, the build can ship without it. Mitigated by the `required` flag for
  the critical libs bundle and by `copy-vendor-libs.spec.ts` asserting the
  runtime-loaded copies exist. Residual risk remains for non-required copies.
- **Upstream dist path changes** — a package reorganizing its `dist/` layout
  breaks a `COPIES` `src` path; the copy step fails fast and the spec's
  "resolves every source path" test catches it after install.
- **Duplicated-copy skew during transition** — if a stray tracked copy is not
  gitignored, a stale file could shadow the generated one. Mitigated by the
  `.gitignore` additions removing the tracked destinations.

## Validation

- `scripts/copy-vendor-libs.spec.ts` and the "required vendor libs" tests in
  `scripts/build-resource-bundles.spec.ts` pass under `bun test`.
- CI runs `bun run bundle:vendor` before unit tests; a missing required file
  makes `buildLibsBundle()` throw and fails the build.
- E2E (`make test-e2e` / `test-e2e-static`) exercises the generated assets now
  included in the dynamic-bundles artifact.
- Success signal over time: library updates land as npm version bumps with no
  hand-edited minified files in the diff.

## Follow-up work

- Migrate MathJax (`exe_math/`) off its committed subset and into the same
  npm-sourced flow (tracked by the exclusion note in `scripts/copy-vendor-libs.js`).
- Consider integrity verification (e.g. subresource integrity or checksum
  assertions) for the copied files beyond the lockfile hash.
- Extend the copy manifest as further tracked vendor files are identified.

## References

- PR #1593
- the change design — Vendored frontend libraries sourced from npm and generated at build time
- ADR-1593-02 — Ship Yjs to the browser as esbuild-built global-`window.Y` shims
- ADR-1593-03 — Govern the newly npm-managed frontend dependencies with grouped Dependabot updates
- `scripts/copy-vendor-libs.js`, `scripts/copy-vendor-libs.spec.ts`
- `scripts/build-resource-bundles.js`, `scripts/build-resource-bundles.spec.ts`
- `package.json`, `.gitignore`
- `.github/workflows/ci.yml`, `.github/workflows/e2e.yml`
- `AGENTS.md` — single source of truth; export-lib registration; opaque serving model
