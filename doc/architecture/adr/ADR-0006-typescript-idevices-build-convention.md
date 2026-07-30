---
id: ADR-0006
title: "TypeScript iDevices: src/ sources compiled by one convention-based build"
status: Proposed
date: 2026-07-30
deciders:
  - "@erseco"
reviewers:
  - "@mnunezcedec"
  - "@cristinavaldera"
related:
  issues: []
  prs: [2147]
  sdds: [SDD-0001]
  adrs: [ADR-0005]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-fable-5"
---

# ADR-0006: TypeScript iDevices — `src/` sources compiled by one convention-based build

## Status

Proposed

## Context

iDevices are classic-script objects loaded by the workarea and the exporters.
Historically each one is hand-written vanilla JavaScript committed directly
under `edition/` and `export/`. Two iDevices now keep their maintained source
in TypeScript instead — Slide (`src/` + a bespoke `scripts/build-slide-editor.ts`)
and Interactive Video (`src/` + a bespoke `scripts/build-interactive-video.ts`).
Two per-iDevice build scripts with duplicated Bun plumbing were already
diverging in flags and behaviour, and every future TypeScript iDevice would
have added another copy plus more package.json entries.

## Problem

How does the repository recognise, build, type-check and test an iDevice whose
maintained source is TypeScript, without a new build pipeline per iDevice?

## Decision drivers

- One obvious convention for the next TypeScript iDevice (zero new scripts).
- The shipped output must remain plain classic-script IIFEs (ADR-0005: the
  language and compile step are not a framework).
- Generated artifacts must never be committed; a clean checkout must
  regenerate them through the existing pipeline (`build:all` / `make bundle`).
- Existing iDevices with special needs (Slide) must fit without renaming their
  shipped bundles.

## Decision

**An iDevice that keeps a `src/` directory is a TypeScript iDevice**, built by
the centralized `scripts/build-idevices.ts`:

- **Convention:** `src/edition/index.ts` → `edition/<name>.js` and
  `src/export/index.ts` → `export/<name>.js` — self-contained IIFEs
  (`target: browser`, linked source maps, unminified), whose entry points
  explicitly assign their window globals (`$exeDevice`, `$<name>`).
- **Escape hatch:** an optional `build.config.json` next to `config.xml`
  replaces the convention for that iDevice (custom entries/naming/globalName/
  minify/sourcemap, plus `externals` mapping bare imports to page-provided
  globals so vendored libraries are never inlined). Slide uses it.
- **Type checking:** each TypeScript iDevice ships its own `tsconfig.json`
  (strict for new code); the runner executes `tsc -p` for every one it finds.
- **Tests:** colocated `*.spec.ts` next to each module, run by **Vitest**
  (`bun test` ignores `public/**`), plus bundle-contract smoke tests that
  evaluate the compiled IIFEs.
- **Artifacts:** generated bundles and source maps are gitignored;
  `build:all` runs `typecheck:idevices` + `bundle:idevices` before
  `bundle:resources` (export bundles ship inside `idevices.zip`).

Package scripts: `typecheck:idevices`, `bundle:idevices`,
`bundle:idevices:watch`; the runner accepts `--only <names>` and `--watch`.

## Options considered

### Option 1: One bespoke build script per TypeScript iDevice (status quo)

Pros: each script is trivially readable. Cons: duplicated plumbing, per-iDevice
package.json entries, drift between scripts (they already differed in
sourcemaps, watch support and failure reporting).

### Option 2: Convention-based central runner + per-iDevice manifest (chosen)

Pros: the next TypeScript iDevice needs no build changes at all; one place to
fix bundler behaviour; deviations are declared, not programmed. Cons: one more
convention to know; the manifest is a small new format (documented in the
runner header and `doc/development/idevices-typescript.md`).

## Consequences

### Positive

- Adding a TypeScript iDevice = create `src/edition|export/index.ts` (+ a
  strict `tsconfig.json`); building, type-checking and watching come for free.
- Slide and Interactive Video share one build path; Slide's output stayed
  byte-identical apart from the generic externals shim's message strings.

### Negative

- A hidden convention: `src/` now has meaning. Mitigated by this ADR,
  `doc/development/idevices-typescript.md` and the idevice skill.

### Neutral

- Classic-script iDevices are untouched; nothing forces a migration.

## Validation

- `scripts/build-idevices.spec.ts` covers discovery, the convention, the
  manifest and its validation against the real repository state.
- `bun run build:all` exercises typecheck + build for every TypeScript
  iDevice on every bundle/test target.

## References

- `scripts/build-idevices.ts` (runner; manifest schema in its header).
- `doc/development/idevices-typescript.md` (developer guide).
- ADR-0005 — framework-free stance for Interactive Video.
- PR [#2147](https://github.com/exelearning/exelearning/pull/2147).
