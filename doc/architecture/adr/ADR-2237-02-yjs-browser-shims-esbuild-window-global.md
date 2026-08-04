---
id: ADR-2237-02
title: "Ship Yjs to the browser as esbuild-built global-window.Y shims generated from root dependencies"
status: Proposed
date: 2026-07-09
tracking_issue: 2237
legacy_id: ADR-0030
deciders:
  - "@erseco"
reviewers:
  - "@pabloamayab"
  - "@ignaciogros"
  - "@juanda"
  - "@mnarvaezm"
related:
  prs: [1593]
  changes: ["2237-vendored-frontend-libs-build-pipeline"]
  adrs: [ADR-2237-01, ADR-2237-03]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-2237-02: Ship Yjs to the browser as esbuild-built global-window.Y shims generated from root dependencies

## Context

Real-time collaboration in the browser is built on Yjs. The Y.Doc in the browser
is the canonical document state (see `doc/development/real-time.md` and the
"Client is Source of Truth" architecture rule in `AGENTS.md`). The frontend is
vanilla JavaScript with no application bundler on the collaboration path: the
Yjs runtime is loaded as classic `<script>` files that publish browser globals,
and the app code reads those globals (`window.Y`, `window.WebsocketProvider`,
`window.IndexeddbPersistence`).

Historically the three Yjs runtime files (`public/libs/yjs/yjs.min.js`,
`y-websocket.min.js`, `y-indexeddb.min.js`, plus a `build/package.json`) were
committed as pre-minified blobs, sharing the general problems described in
ADR-2237-01. This ADR records how those three files are generated from npm-declared
Yjs packages while preserving two hard constraints unique to Yjs:

1. **A single shared Yjs instance.** Yjs relies on `instanceof`/constructor
   identity checks; loading two distinct copies of Yjs (one for the core, another
   bundled inside the websocket provider) breaks those checks and corrupts
   collaboration. The websocket provider must reuse the exact same Yjs instance
   that the app uses.
2. **Classic-script globals.** The loader expects `window.Y`,
   `window.WebsocketProvider`, and `window.IndexeddbPersistence` to exist after
   the scripts run, because the vanilla frontend never imports Yjs as a module.

PR #1593 replaces the committed Yjs blobs with an esbuild-driven generation step.

## Problem

How should the three browser-side Yjs runtime files be produced from the
npm-declared Yjs packages so that (a) the whole app shares one Yjs instance,
(b) the outputs still expose the browser globals the vanilla loader relies on,
and (c) the files are generated deterministically at build time rather than
committed as opaque blobs?

## Decision drivers

- **Single Yjs instance** — the websocket provider and the core must share one
  Yjs; duplicate imports break constructor/`instanceof` checks.
- **Global-script contract** — the existing loader and consumers read
  `window.Y` / `window.WebsocketProvider` / `window.IndexeddbPersistence`.
- **Provenance** — Yjs must come from the root `package.json` / `bun.lock`, not a
  committed blob (aligns with ADR-2237-01).
- **No app-bundler rewrite** — do not force the vanilla collaboration path onto
  ESM imports.
- **Deterministic, reproducible output** — regenerating from source must yield
  the same three files.

## Options considered

### Option 1: Keep committing pre-built Yjs blobs (status quo)

- Pros: files present in a checkout; already "working."
- Cons: no provenance/version; unreviewable minified diffs; no update path;
  shares every drawback in ADR-2237-01. Rejected.

### Option 2: Import Yjs into the application bundle as ESM

Import `yjs`, `y-websocket`, and IndexedDB persistence directly into an app
bundle and drop the globals.

- Pros: standard module graph; one bundle; tree-shaking.
- Cons: the vanilla collaboration path expects globals and loads scripts via
  `yjs-loader.js`, not ESM imports; provider libraries and other consumers reach
  Yjs through `window.Y`. Rewriting every consumer is a large, high-risk change
  and still has to solve the single-instance problem across separately loaded
  provider code. Rejected here.

### Option 3: Generate IIFE shims with esbuild that publish window globals from the npm packages (chosen)

Use `esbuild` `buildSync` to bundle Yjs as an IIFE that assigns `window.Y`,
bundle the websocket provider with the `yjs` import aliased to a shim that
re-exports `window.Y` (so there is exactly one Yjs), and minify a hand-written
IndexedDB-persistence IIFE that reads `window.Y`.

- Pros: one shared Yjs instance guaranteed by the alias; preserves the
  global-script contract; Yjs sourced from root dependencies with full
  provenance; deterministic output; no app-bundler rewrite.
- Cons: bespoke shim sources to maintain; output shape coupled to the esbuild
  version; globals are not tree-shaken. Chosen.

## Evidence

- `scripts/build-yjs-shims.js` — generates three files under `public/libs/yjs/`
  using `esbuild` `buildSync`:
  - `yjs.min.js` — IIFE built from inline `stdin`
    (`const Y = require('yjs'); window.Y = Y;`), `bundle: true`, `minify: true`,
    `format: 'iife'`, resolved against the repo root so `yjs` comes from root
    `node_modules`.
  - `y-websocket.min.js` — bundles `public/libs/yjs/build/y-websocket-entry.js`
    with `alias: { yjs: …/build/yjs-global-shim.js }`, so `WebsocketProvider`
    shares `window.Y` instead of a second Yjs copy.
  - `y-indexeddb.min.js` — minifies `public/libs/yjs/build/y-indexeddb-browser.js`
    with `bundle: false` (a hand-written IIFE that reads `window.Y`).
- `public/libs/yjs/build/yjs-global-shim.js` — re-exports `window.Y` (falling
  back to `require('yjs')`) and re-exports the named symbols provider code needs
  (`Doc`, `Array`, `Map`, `Text`, `XmlFragment`, `applyUpdate`,
  `encodeStateAsUpdate`, …), explicitly to "prevent duplicate Yjs imports which
  break constructor checks."
- `public/libs/yjs/build/y-websocket-entry.js` — imports `WebsocketProvider`
  from `y-websocket` and assigns it to `window.WebsocketProvider`.
- `public/libs/yjs/build/y-indexeddb-browser.js` — hand-written IndexedDB
  persistence IIFE that reads `window.Y` and errors if `yjs.min.js` did not load
  first.
- `public/app/yjs/yjs-loader.js` — `getYJS_DEPENDENCIES()` loads, in order,
  `yjs.min.js` (exports `window.Y`), `y-indexeddb.min.js` (exports
  `window.IndexeddbPersistence`), then `y-websocket.min.js` (exports
  `window.WebsocketProvider`).
- `public/app/yjs/YjsDocumentManager.js` — throws
  `Yjs (window.Y) not loaded. Ensure yjs.min.js is loaded first.` and a parallel
  error for `IndexeddbPersistence`, confirming the global contract the shims
  satisfy. `public/app/yjs/YjsProviderFactory.js` similarly requires
  `y-indexeddb.min.js` to have loaded.
- `public/vitest.setup.js` — loads the generated `libs/yjs/yjs.min.js` (reads the
  file and `eval`s it) and exposes `window.Y` / `global.Y` so frontend Vitest
  tests run against the real generated Yjs shim, not a mock.
- `package.json` — `yjs ^13.6.29`, `y-websocket ^3.0.0`, and `lib0 ^0.2.117` are
  root runtime dependencies; `esbuild ^0.28.0` is a devDependency; `bundle:vendor`
  runs `build-yjs-shims.js` before `copy-vendor-libs.js`.
- `.gitignore` — lists `public/libs/yjs/yjs.min.js`, `y-websocket.min.js`, and
  `y-indexeddb.min.js` as generated outputs (the `build/` source directory stays
  tracked).

## Decision

We will generate the three browser-side Yjs runtime files with esbuild from the
root-declared Yjs packages (`scripts/build-yjs-shims.js`), publishing them as
IIFEs that assign `window.Y`, `window.WebsocketProvider`, and
`window.IndexeddbPersistence`. The websocket provider is bundled with its `yjs`
import aliased to `public/libs/yjs/build/yjs-global-shim.js` so the whole app
shares a single Yjs instance. The generated `*.min.js` outputs are gitignored;
their shim sources under `public/libs/yjs/build/` remain tracked. The IndexedDB
persistence file remains a hand-written IIFE (`y-indexeddb-browser.js`) minified
by the same step.

## Consequences

### Positive

- Exactly one Yjs instance across core, IndexedDB persistence, and the websocket
  provider, eliminating the duplicate-import class of collaboration bugs.
- The existing vanilla `yjs-loader.js` global contract is preserved unchanged.
- Yjs traces to `package.json` + `bun.lock`; the committed Yjs blobs leave the
  tree (part of ADR-2237-01's cleanup).
- Frontend tests load the real generated Yjs shim, so tests exercise the shipped
  runtime.

### Negative

- The alias/shim mechanism and the hand-written IndexedDB persistence are
  bespoke sources that must be maintained and understood by future contributors.
- Output is coupled to the esbuild version and options; an esbuild upgrade can
  change the generated bundle (see ADR-2237-03's build-tools group).
- The global-window pattern forgoes tree-shaking for these files.

### Neutral

- The IndexedDB persistence is a hand-written re-implementation "based on
  y-indexeddb source" rather than a copied npm dist; `y-indexeddb` itself is not
  an npm dependency in `package.json`.
- Several files under `public/libs/yjs/build/` exist as shim sources; the build
  script consumes `yjs-global-shim.js`, `y-websocket-entry.js`, and
  `y-indexeddb-browser.js`.

## Risks

- **esbuild upgrade changes shim output** — a bundler behavior change could alter
  the generated globals. Mitigated by unit tests loading the real shim
  (`vitest.setup.js`) and the collaboration E2E suite; the Dependabot build-tools
  group (ADR-2237-03) surfaces esbuild bumps in isolation for review.
- **Version skew inside the Yjs ecosystem** — a mismatched `yjs` / `y-websocket`
  / `lib0` set could reintroduce duplicate-instance or protocol issues. Mitigated
  by the Dependabot `yjs-ecosystem` group (ADR-2237-03) that bumps `yjs`, `y-*`, and
  `lib0` together.
- **Hand-written IndexedDB persistence drift** — it tracks upstream y-indexeddb
  behavior manually and can lag fixes. Mitigated by the collaboration/persistence
  test coverage; residual maintenance risk remains.

## Validation

- Frontend Vitest tests pass loading the generated `yjs.min.js`
  (`public/vitest.setup.js`), and the Yjs client tests under `public/app/yjs/`
  (e.g. `YjsDocumentManager.test.js`, `YjsProjectBridge.test.js`) pass.
- Collaboration E2E specs continue to pass against the generated shims.
- Manual signal: a single Yjs identity is observable at runtime (no
  duplicate-Yjs constructor warnings; provider and core operate on the same
  `window.Y`).

## Follow-up work

- Evaluate whether the hand-written IndexedDB persistence can be replaced by a
  bundled `y-indexeddb` npm package through the same alias mechanism.
- Prune any unused shim-source files under `public/libs/yjs/build/` that the
  current `build-yjs-shims.js` does not consume, to avoid confusion.

## References

- PR #1593
- the change design — Vendored frontend libraries sourced from npm and generated at build time
- ADR-2237-01 — Source vendored frontend libraries from npm and generate them at build time
- ADR-2237-03 — Govern the newly npm-managed frontend dependencies with grouped Dependabot updates
- `scripts/build-yjs-shims.js`
- `public/libs/yjs/build/yjs-global-shim.js`, `y-websocket-entry.js`, `y-indexeddb-browser.js`
- `public/app/yjs/yjs-loader.js`, `public/app/yjs/YjsDocumentManager.js`, `public/app/yjs/YjsProviderFactory.js`
- `public/vitest.setup.js`, `package.json`, `.gitignore`
- `doc/development/real-time.md`, `AGENTS.md` (Client is Source of Truth)
