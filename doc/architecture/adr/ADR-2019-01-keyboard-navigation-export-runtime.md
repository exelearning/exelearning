---
id: ADR-2019-01
title: "Keyboard-navigation runtime lives in the shared export/preview runtime and drives existing theme elements"
status: Proposed
date: 2026-07-09
tracking_issue: 2019
legacy_id: ADR-0039
deciders:
  - "@erseco"
reviewers:
  - "@cristinavaldera"
related:
  prs: [2020]
  changes: ["2019-keyboard-navigation-export-preview"]
  adrs: [ADR-2019-02, ADR-2019-03]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-2019-01: Keyboard-navigation runtime lives in the shared export/preview runtime and drives existing theme elements

## Context

Issue #2019 asks eXeLearning to restore the keyboard navigation that the legacy
eXeLearning 2.9 "Presentation" style offered: readers of exported or previewed
content should be able to move between pages, toggle the navigation menu, open
the search box, and toggle Teacher Mode from the keyboard.

Exported HTML5, SCORM, EPUB3 and IMS packages already share a single client
runtime, `public/app/common/exe_export.js` (`window.$exeExport`), which every
page loads from `libs/exe_export.js`. The same runtime is what the in-app
preview executes: `Html5Exporter.generateForPreview()` produces the exact same
page HTML as a real export by calling `PageRenderer` (the preview iframe is
served the identical `libs/exe_export.js`). Themes render a stable set of
navigation elements — `#siteNav`, `.nav-button-left` / `.nav-button-right`,
`#siteNavToggler`, `#searchBarTogger` / `#exe-client-search-text`, and
`#teacher-mode-toggler` — that already respond to mouse clicks.

The project's guiding principles require a single source of truth and forbid
per-code-path duplication (AGENTS.md §1). A prior effort to add an always-on
export JS library (see the export-lib registration work) established that a new
standalone export bundle must be wired into roughly six duplicated registration
sites and must be a classic script, which is easy to get wrong and drifts over
time. Any new reader-facing behavior therefore has to choose deliberately
*where* it lives.

## Problem

Where should the keyboard-navigation behavior live, and how should it act on the
page — as a new standalone export library, as per-theme JavaScript duplicated
across themes, or as a module inside the shared export/preview runtime that
drives the navigation elements themes already emit?

## Decision drivers

- **Single source of truth** — one runtime path for exports and preview, no
  duplication across themes or export formats (AGENTS.md §1, §7.9).
- **Preview/export parity** — the preview iframe must exercise the very same
  code that ships in a package, so a test in preview also validates exports.
- **Theme neutrality** — must work with any theme that emits the standard nav
  elements and be a harmless no-op when they are absent.
- **Low registration burden** — avoid adding another always-on export library
  that needs multiple duplicated registration edits.
- **Robustness across formats** — must tolerate EPUB readers reloading scripts
  when navigating between pages.

## Options considered

### Option 1: Add the behavior to each theme's JavaScript

Ship the keydown handling inside every theme bundle.

- Pros: themes could tailor selectors to their own markup.
- Cons: duplicates the same logic across every theme; guarantees drift; a new
  theme silently ships without the feature; violates the single-source-of-truth
  principle. Rejected.

### Option 2: New standalone always-on export library

Create a dedicated `libs/exe_keyboard_nav.js` and register it everywhere export
libraries are declared.

- Pros: isolates the feature in its own file.
- Cons: reintroduces the ~six duplicated registration sites documented for
  always-on export libraries; must be a classic script; more surface to keep in
  sync across HTML5/SCORM/EPUB/IMS; no functional benefit over living in the
  runtime that already loads on every page. Rejected.

### Option 3 (chosen): A module inside the shared export/preview runtime that drives existing theme elements

Add a `keyboardNav` module to `window.$exeExport` in
`public/app/common/exe_export.js`, initialized from `$exeExport.init()`. It
locates the theme's existing nav elements by their stable selectors and
activates them by clicking the real anchors/togglers, so the theme's own
handlers remain the single source of truth for navigation, menu, search and
Teacher Mode behavior.

- Pros: one code path for all export formats and preview; no new library and no
  registration edits; theme-neutral and a natural no-op when elements are
  absent; reuses the theme's own click handlers instead of re-implementing them.
- Cons: couples the runtime to a set of well-known selectors (mitigated by the
  no-op-when-absent design and by an E2E test that asserts real behavior).

## Evidence

- Runtime module and its initialization:
  `public/app/common/exe_export.js` — `keyboardNav` object (lines 558-800),
  invoked from `$exeExport.init()` (line 45, wrapped in try/catch so a failure
  never blocks the rest of page init). The whole `window.$exeExport` block is
  guarded by `if (typeof window.$exeExport === 'undefined')` (lines 27, 802) to
  survive EPUB readers reloading scripts on navigation.
- Drives existing theme elements rather than re-implementing them:
  `getPreviousLink()`/`getNextLink()` target `a.nav-button-left` /
  `a.nav-button-right`; `getFirstNavLink()`/`getLastNavLink()` target
  `#siteNav a[href]`; `toggleMenu()` clicks `#siteNavToggler`; `focusSearch()`
  reuses `#searchBarTogger` then focuses `#exe-client-search-text`;
  `toggleTeacherMode()` clicks `#teacher-mode-toggler`
  (`public/app/common/exe_export.js` lines 607-628, 700-712, 738-743). The
  module docblock (lines 539-557) states it "works with any theme that exposes
  the standard nav elements … and is a no-op when they are absent."
- Preview and export share this runtime: `Html5Exporter.generateForPreview()`
  (`src/shared/export/exporters/Html5Exporter.ts` line 560) builds pages through
  the same `generatePageHtml` → `PageRenderer` path as a full export, and the
  page HTML always loads `libs/exe_export.js`
  (`src/shared/export/renderers/PageRenderer.ts` lines 315, 1338).
- Preview/export parity is asserted by E2E:
  `test/e2e/playwright/specs/preview-keyboard-navigation.spec.ts` header comment
  (lines 16-24) — "The preview iframe renders the exact same HTML/JS as a real
  exported package, so exercising the shortcuts here also covers exports."
- Frontend unit coverage of the module:
  `public/app/common/exe_export.test.js` — `describe('keyboardNav')` (line 2387)
  and `describe('overlaySignals / isOverlayActive')` (line 2565).

## Decision

We will implement keyboard navigation as a `keyboardNav` module inside the
shared export/preview runtime `public/app/common/exe_export.js`, initialized
once from `$exeExport.init()`, that operates by locating and clicking the
navigation elements themes already emit (`#siteNav`, `.nav-button-*`,
`#siteNavToggler`, `#searchBarTogger`, `#teacher-mode-toggler`). It will not be
a new export library and will not be duplicated per theme.

## Consequences

### Positive

- A single implementation covers every export format and the in-app preview.
- No new export library and no duplicated registration edits.
- Works with any current or future theme that emits the standard nav elements;
  harmless no-op otherwise.
- The theme's own click handlers remain the single source of truth for what each
  navigation action does; the module only decides *when* to trigger them.

### Negative

- The module depends on a set of well-known selectors; a theme that renames them
  silently loses the shortcuts (graceful degradation, not a crash).

### Neutral

- The behavior is only active when the author opts in (see ADR-2019-02); this ADR
  fixes *where the runtime lives*, not *whether it is on*.

## Risks

- **Selector drift** (low likelihood, low severity): a redesigned theme could
  change nav selectors. Mitigation: no-op-when-absent design plus an E2E spec
  that drives the real preview and asserts page changes, catching regressions.
- **Double initialization** (low): EPUB readers reload scripts. Mitigation: the
  `window.$exeExport` existence guard and `keyboardNav._initialized` flag
  (`public/app/common/exe_export.js` lines 27, 562-567).

## Validation

- Unit tests in `public/app/common/exe_export.test.js` cover link lookup, menu
  toggle, search focus and Teacher Mode toggle against synthetic DOM.
- E2E `test/e2e/playwright/specs/preview-keyboard-navigation.spec.ts` drives the
  real preview iframe (arrow-key page navigation, `m`/`Alt+M` menu toggle,
  `Alt+/` search) and, by parity, validates the exported runtime.

## Follow-up work

- Keep the selector list documented alongside the module so theme authors know
  which elements enable the feature. See the change design for the operational reference
  links.

## References

- Issue #2019 — keyboard navigation request.
- PR #2020 — implementation.
- the change design — Keyboard navigation for exported and previewed content.
- ADR-2019-02 — opt-in, off-by-default export option.
- ADR-2019-03 — overlay-aware keyboard suppression registry.
- `public/app/common/exe_export.js`, `src/shared/export/renderers/PageRenderer.ts`,
  `src/shared/export/exporters/Html5Exporter.ts`.
