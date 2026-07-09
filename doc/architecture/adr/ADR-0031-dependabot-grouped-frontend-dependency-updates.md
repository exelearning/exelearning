---
id: ADR-0031
title: "Govern the newly npm-managed frontend dependencies with grouped Dependabot updates"
status: Proposed
date: 2026-07-09
deciders:
  - "@erseco"
reviewers:
  - "@pabloamayab"
  - "@ignaciogros"
  - "@juanda"
  - "@mnarvaezm"
related:
  issues: []
  prs: [1593]
  sdds: [SDD-0007]
  adrs: [ADR-0029, ADR-0030]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-0031: Govern the newly npm-managed frontend dependencies with grouped Dependabot updates

## Status

Proposed

## Context

ADR-0029 moves the frontend's third-party libraries from committed blobs to
npm-declared dependencies, and ADR-0030 generates the browser-side Yjs runtime
from those packages with esbuild. That only delivers a real security-update path
if the newly npm-managed dependencies are actually kept current. Manual bumps do
not scale across the enlarged dependency set (jQuery, Bootstrap, showdown,
fflate, abcjs, interact.js, jQuery UI, SimpleLightbox, DOMPurify, fabric,
html2canvas, pdf.js, mermaid, plus the Yjs ecosystem and the backend/test/build
toolchains).

Two properties of this repository make ungrouped, one-PR-per-package updates a
poor fit:

- **Coupled packages must move together.** The Yjs shim build (ADR-0030) assumes
  a compatible `yjs` / `y-websocket` / `lib0` set; bumping one without the others
  can reintroduce duplicate-instance or protocol mismatches.
- **Some packages need manual validation and must not auto-bump silently.**
  MathJax (`mathjax-full`) backs the customized `exe_math/` subset that ADR-0029
  explicitly leaves out of the copy flow.

PR #1593 adds a Dependabot configuration to automate updates with grouping that
respects these constraints.

## Problem

How should the newly npm-managed frontend dependencies (and the surrounding
toolchains) be kept up to date so that security fixes arrive promptly, coupled
packages stay in lockstep, and manually-validated packages are handled
separately — without drowning maintainers in per-package PRs?

## Decision drivers

- **Timely security updates** — the whole point of ADR-0029 is a working update
  path; it must run on a schedule, not on memory.
- **Lockstep for coupled packages** — the Yjs ecosystem must be bumped as a set
  so the shim build stays valid (ADR-0030).
- **Isolation for risky packages** — MathJax must be updatable on its own so its
  manual `exe_math/` validation is not bundled into an unrelated PR.
- **Reviewable PR volume** — grouping related packages reduces churn versus one
  PR per dependency.
- **Cover the whole supply chain** — not only npm, but also Docker base images,
  the Docker Compose deploy variants, and GitHub Actions.

## Options considered

### Option 1: No automation (manual bumps)

- Pros: full human control; zero config.
- Cons: reproduces the stale-dependency problem in npm form; security fixes lag;
  relies on someone remembering. Rejected.

### Option 2: Ungrouped Dependabot (one PR per package)

- Pros: simple; each change isolated.
- Cons: high PR volume across the enlarged dependency set; splits the Yjs
  ecosystem into separate PRs that can land out of step and break the shim build.
  Rejected.

### Option 3: Grouped Dependabot with targeted groups and separate ecosystems (chosen)

Weekly npm updates with named groups (`yjs-ecosystem`, `mathjax`, `elysia`,
`test-tools`, `build-tools`), plus separate weekly update streams for Docker,
Docker Compose, and GitHub Actions.

- Pros: coupled packages bump together; MathJax isolated for manual validation;
  toolchains grouped to cut noise; covers container and CI supply chain. Chosen.
- Cons: a grouped PR can hide a single-package regression inside an otherwise
  green group; relies on CI to catch it.

## Evidence

- `.github/dependabot.yml` — `version: 2`, an `npm` ecosystem at `/` on a weekly
  schedule with `open-pull-requests-limit: 10` and these `groups`:
  - `yjs-ecosystem`: patterns `yjs`, `y-*`, `lib0` — commented "keep in sync —
    shim build depends on compatible versions" (the ADR-0030 constraint).
  - `mathjax`: pattern `mathjax-full` — commented "pinned separately — exe_math/
    is a custom subset requiring manual validation" (the ADR-0029 exclusion).
  - `elysia`: patterns `elysia`, `@elysiajs/*`.
  - `test-tools`: patterns `vitest`, `@vitest/*`, `@playwright/test`, `happy-dom`.
  - `build-tools`: patterns `esbuild`, `vite`, `sass`, `@biomejs/*` — covers the
    `esbuild` used by the Yjs shim build (ADR-0030).
- The same file adds `docker` (at `/`), `docker-compose` (at `/doc/deploy`), and
  `github-actions` (at `/`) ecosystems, each weekly.
- `package.json` — the packages these groups govern are the runtime dependencies
  (`yjs`, `y-websocket`, `lib0`, `mermaid`, `pdfjs-dist`, `mathjax-full`,
  `elysia`) and devDependencies (`esbuild`, `vite`, `sass`, `@biomejs/biome`,
  `vitest`, `@vitest/*`, `@playwright/test`, `happy-dom`, and the newly added UI
  libraries) introduced or relied on by ADR-0029 / ADR-0030.
- `.github/workflows/ci.yml` runs `bun run bundle:vendor` and the unit-test job,
  so a Dependabot bump is validated against the vendor build and tests before it
  can merge.

## Decision

We will manage the newly npm-managed frontend dependencies with a Dependabot
configuration (`.github/dependabot.yml`) that runs weekly npm updates grouped
into `yjs-ecosystem` (kept in lockstep because the Yjs shim build depends on
compatible versions), `mathjax` (isolated for manual `exe_math/` validation),
`elysia`, `test-tools`, and `build-tools`, capped at 10 open PRs, and that
additionally tracks Docker base images, the Docker Compose deploy variants, and
GitHub Actions on the same weekly cadence.

## Consequences

### Positive

- Security and maintenance updates arrive on a schedule, realizing the update
  path ADR-0029 created.
- The Yjs ecosystem bumps as one PR, keeping the shim build (ADR-0030) valid.
- MathJax updates arrive as isolated PRs so their manual validation is not mixed
  into unrelated changes.
- Grouping the test and build toolchains, plus Docker/Compose/Actions, keeps PR
  volume manageable while covering the wider supply chain.

### Negative

- A grouped PR can mask a regression from one package inside an otherwise green
  group, making bisection slightly harder; reviewers must read the group's change
  list, not just the CI result.
- Weekly cadence plus the 10-PR cap means some updates queue rather than land
  immediately.

### Neutral

- Ungrouped packages (those matching no pattern) still open individual PRs.
- The configuration governs update proposals only; the "Definition of Done"
  gates (lint, unit/integration/E2E, coverage) still decide whether a bump merges.

## Risks

- **Hidden breaking change in a group** — likelihood moderate, severity moderate.
  Mitigated by CI running `bundle:vendor` + the full test suite on each PR
  (`.github/workflows/ci.yml`).
- **esbuild bump changes Yjs shim output** — the `build-tools` group can move
  esbuild; a behavioral change could alter the generated Yjs files (ADR-0030).
  Mitigated by frontend tests loading the real shim and by the group isolating
  build-tool bumps for focused review.
- **Group too broad** — an over-broad pattern could sweep an unintended package
  into a group. Mitigated by explicit, narrow patterns and reviewer inspection.

## Validation

- Dependabot opens grouped PRs on the weekly schedule per `.github/dependabot.yml`.
- Each PR runs the CI vendor build and test gate; only green PRs merge.
- Over time, the diff history shows library updates arriving as version bumps
  with green CI rather than manual blob edits.

## Follow-up work

- Fold MathJax into a grouped/automated flow once its `exe_math/` migration
  (ADR-0029 follow-up) removes the manual-validation constraint.
- Revisit group membership and the open-PR cap after a few update cycles to tune
  noise versus latency.

## References

- PR #1593
- SDD-0007 — Vendored frontend libraries sourced from npm and generated at build time
- ADR-0029 — Source vendored frontend libraries from npm and generate them at build time
- ADR-0030 — Ship Yjs to the browser as esbuild-built global-`window.Y` shims
- `.github/dependabot.yml`
- `.github/workflows/ci.yml`
- `package.json`
