---
id: ADR-2147-05
title: "Keep the Interactive Video iDevice framework-free"
status: Proposed
date: 2026-07-09
tracking_issue: 2147
legacy_id: ADR-0005
deciders:
  - "@erseco"
reviewers:
  - "@mnunezcedec"
  - "@cristinavaldera"
related:
  prs: [2147]
  changes: ["2147-interactive-video-refactor"]
  adrs: [ADR-2147-01, ADR-2147-03]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-2147-05: Keep the Interactive Video iDevice framework-free

## Context

Interactive Video is a native eXeLearning iDevice. eXeLearning iDevices are
authored as classic-script objects (`$exeDevice` for the editor,
`$interactivevideo` for the runtime) loaded directly by the workarea and the
exporters, with no per-iDevice build step. H5P — the closest external analogue —
was considered as UX inspiration only. Introducing a UI framework (React, Vue,
Svelte, Angular) or the H5P runtime/editor for a single iDevice would add a build
pipeline, a bundle, and a maintenance surface inconsistent with the rest of the
project.

## Problem

Should this iDevice adopt a frontend framework or the H5P runtime/editor, or stay
framework-free like the rest of the iDevice set?

## Decision drivers

- Consistency with the existing iDevice architecture (vanilla JS classic scripts).
- Bundle size and build complexity.
- Maintainability and testability without a new toolchain.
- The project's stated constraint against frameworks for iDevices.

## Options considered

### Option 1: Introduce a framework or the H5P runtime/editor

Pros: richer component model; H5P has a mature interactive-video UX. Cons: a new
build pipeline and bundle, a large dependency and maintenance surface, licensing
and architecture mismatch, and inconsistency with every other iDevice.

### Option 2: Framework-free TypeScript compiled to classic-script bundles

Implement the editor and runtime as framework-free classic-script objects,
maintained as TypeScript modules and compiled by Bun into two self-contained
IIFE bundles (the same approach the Slide iDevice already uses). Pros:
consistent with the codebase, small footprint, directly unit-testable, strict
typing at the browser boundaries. Cons: explicit DOM/state management and
stronger tests are required by hand, plus a small per-iDevice build script.

## Evidence

- The maintained source is TypeScript under
  `public/files/perm/idevices/base/interactive-video/src/`
  (`shared/` pure core, `providers/` adapters, `edition/` editor, `export/`
  runtime), compiled by the centralized `scripts/build-idevices.ts` (shared with the Slide iDevice) into
  `edition/interactive-video.js` (`window.$exeDevice`) and
  `export/interactive-video.js` (`window.$interactivevideo`) — plain IIFE
  classic scripts loaded via `config.xml` `edition-js`/`export-js`. The
  generated bundles and their source maps are gitignored.
- The provider adapters stay framework-free too: raw provider postMessage
  protocols, no SDK or wrapper library — reaffirming this decision rather than
  departing from it.
- Unit tests are colocated `*.spec.ts` files that import the TypeScript modules
  directly; `src/test/bundle-contract.spec.ts` additionally evaluates the
  compiled bundles and asserts the classic-script contracts.
- Project constraint against frameworks/H5P for iDevices: `AGENTS.md`
  ("No framework: Vanilla JavaScript in `public/app/`") and the change design Non-goals.

## Decision

We will keep the Interactive Video iDevice **framework-free**: classic-script
objects plus a shared pure core, with **no** React, Vue, Svelte, Angular, H5P
runtime/editor, or other UI-framework dependency. TypeScript and the Bun
bundler are a *language and compile step*, not a framework: the shipped output
is plain vanilla-JS classic scripts with zero runtime dependencies.

## Consequences

### Positive

- Consistent with the codebase; small footprint; directly testable; strict
  typing catches boundary mistakes at compile time.

### Negative

- The editor/runtime require explicit DOM and state management and stronger
  hand-written tests, plus a small per-iDevice build script to maintain
  (`bun run bundle:idevices`, integrated into `build:all`).

### Neutral

- Rich-text fields continue to use the existing TinyMCE integration (a
  pre-existing dependency, not a new framework).

## Risks

- Hand-rolled DOM/state can drift without discipline. Mitigated by the shared
  pure core, strict TypeScript and colocated unit tests.
- A stale bundle could ship if the build is skipped. Mitigated by wiring the
  build into `build:all` (which `make bundle` and every test target run) and by
  the generated-bundle contract tests.

## Validation

- `bun run typecheck:idevices` passes with a strict per-iDevice tsconfig;
  `bun run bundle:idevices` emits the two IIFE bundles; the
  colocated Vitest specs and the bundle-contract smoke tests are green.

## Follow-up work

- None; revisit only if a cross-iDevice framework decision is made project-wide
  (which would be its own ADR).

## Amendment — TypeScript sources, same framework-free output (2026-07)

The refactor moved the maintained source from hand-written classic scripts
(with byte-identical per-folder copies of the shared core) to TypeScript
modules compiled into two bundles. The DECISION here — no UI framework, no
H5P runtime — is unchanged; what the earlier text called "no build step" was a
consequence of the old file layout, not the decision itself, and keeping three
manually-synchronized copies of the core proved the worse trade-off.

## References

- the change design — Interactive Video iDevice refactor.
- PR [#2147](https://github.com/exelearning/exelearning/pull/2147).
- `AGENTS.md` (framework policy).
- Related: ADR-2147-01, ADR-2147-03.
