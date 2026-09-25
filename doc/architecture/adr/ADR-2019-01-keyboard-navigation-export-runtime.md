---
id: ADR-2019-01
title: "Presentation-mode runtime lives in the shared export runtime and drives existing theme elements"
status: Proposed
date: 2026-07-09
tracking_issue: 2019
legacy_id: ADR-0039
deciders:
  - "@erseco"
reviewers:
  - "@cristinavaldera"
  - "@ignaciogros"
related:
  prs: [2020]
  changes: ["2019-keyboard-navigation-export-preview"]
  adrs: [ADR-2019-02, ADR-2019-03, ADR-2019-04]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8, claude-fable-5-1"
---

# ADR-2019-01: Presentation-mode runtime lives in the shared export runtime and drives existing theme elements

## Context

Issue #2019 asks eXeLearning to let readers move through an exported web site
with the keyboard or a presenter remote, as the legacy eXeLearning 2.9
"Presentation" style allowed. After review, the feature became a
reader-activated **presentation mode** (ADR-2019-04): collapse the menu and
make Left/PageUp and Right/PageDown change page.

Every exported page already loads one shared client runtime,
`public/app/common/exe_export.js` (`window.$exeExport`), from
`libs/exe_export.js`. Themes render a stable set of navigation elements that
already respond to clicks: `#siteNav`, `a.nav-button-left` /
`a.nav-button-right` and `#siteNavToggler` (with `aria-expanded`). Teacher Mode
lives in that same runtime and is the established pattern for a reader-side
mode.

The project's guiding principles require a single source of truth and forbid
per-code-path duplication (AGENTS.md §1). Adding an always-on export library
needs roughly six duplicated registration edits and must be a classic script,
which drifts over time.

## Problem

Where should the presentation-mode behaviour live, and how should it act on the
page: as a new standalone export library, as per-theme JavaScript, or as a
module inside the shared export runtime that drives the elements themes already
emit?

## Decision drivers

- **Single source of truth**: one runtime path, no duplication across themes.
- **Theme neutrality**: must work with any theme that emits the standard nav
  elements and be a harmless no-op when they are absent.
- **Low registration burden**: no new always-on export library.
- **Reuse the theme's own menu logic**: collapsing the menu must go through the
  theme's toggler so its state classes, `?nav=false` links and low-resolution
  behaviour stay authoritative.

## Options considered

### Option 1: Add the behaviour to each theme's JavaScript

- Pros: themes could tailor selectors to their own markup.
- Cons: duplicates the logic across every theme; guarantees drift; a new theme
  silently ships without it. Rejected.

### Option 2: New standalone always-on export library

- Pros: isolates the feature in its own file.
- Cons: reintroduces the duplicated registration sites; no functional benefit
  over the runtime that already loads on every page. Rejected.

### Option 3 (chosen): A `presentationMode` module in the shared export runtime

Add `presentationMode` to `window.$exeExport`, next to `teacherMode`. It
locates the theme's existing elements by their stable selectors and activates
them by clicking the real anchors and toggler, so the theme's handlers remain
the single source of truth for what navigation and the menu do; the module only
decides *when* to trigger them.

- Pros: one code path; no new library; theme-neutral; no-op when elements are
  absent; the menu collapse reuses the theme's own toggler.
- Cons: couples the runtime to well-known selectors (mitigated by the
  no-op-when-absent design and an E2E test on a real export).

## Evidence

- `public/app/common/exe_export.js`: `presentationMode.bootstrap()` runs in
  `<head>` next to `teacherMode.bootstrap()`; `presentationMode.init()` runs from
  `$exeExport.init()` in the same deferred step as `teacherMode.init()`, after
  the style has rendered its togglers, wrapped in try/catch.
- `handleKeydown()` clicks `a.nav-button-left` / `a.nav-button-right`;
  `_setMenuExpanded()` clicks `#siteNavToggler` only when its `aria-expanded`
  differs from the wanted state, so the theme's `?nav=false` propagation and
  low-resolution rules keep working and the menu can still be opened normally.
- The `window.$exeExport` block is guarded by
  `if (typeof window.$exeExport === 'undefined')` so scripts reloaded by a
  reader survive; `enter()` binds a single listener and `leave()` removes it.
- Tests: `public/app/common/exe_export.test.js` (`describe('presentationMode')`)
  and `test/e2e/playwright/specs/presentation-mode.spec.ts`, which drives a real
  served web site export across all six built-in themes' shared selectors.

## Decision

We will implement presentation mode as a `presentationMode` module inside the
shared export runtime `public/app/common/exe_export.js`, bootstrapped in
`<head>` and initialised once from `$exeExport.init()`, that operates by
locating and clicking the elements themes already emit (`a.nav-button-*`,
`#siteNavToggler`, `#siteNav a`). It will not be a new export library and will
not be duplicated per theme.

## Consequences

### Positive

- A single implementation covers every web site export and every theme.
- No new export library and no duplicated registration edits.
- The theme's own click handlers remain the single source of truth.

### Negative

- A theme that renames the selectors silently loses the mode (graceful
  degradation, not a crash).

### Neutral

- Whether the mode is on is decided by the reader (ADR-2019-04); this ADR fixes
  *where the runtime lives*, not *whether it is on*.

## Risks

- **Selector drift** (low): mitigated by the no-op-when-absent design and the
  E2E spec on a real export.
- **Double initialisation** (low): mitigated by the `window.$exeExport` guard,
  the `#exe-presentation-toggler` existence check in `init()` and the
  `_active` flag in `enter()`/`leave()`.

## Validation

- Unit tests cover bootstrap, scope, control injection, menu collapse, key
  handling and listener lifecycle against synthetic DOM.
- E2E `presentation-mode.spec.ts` asserts page changes, menu state and
  persistence on a real served export.

## Follow-up work

- Keep the selector list documented alongside the module so theme authors know
  which elements the mode relies on.

## References

- Issue #2019; PR #2020.
- ADR-2019-02 (rejected export option), ADR-2019-03 (overlay deferral),
  ADR-2019-04 (reader activation).
- `public/app/common/exe_export.js`, `public/style/workarea/base.css`.
