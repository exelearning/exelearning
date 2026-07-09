---
id: ADR-0040
title: "Keyboard navigation is an opt-in, off-by-default export-metadata option threaded through the unified export pipeline"
status: Proposed
date: 2026-07-09
deciders:
  - "@erseco"
reviewers:
  - "@cristinavaldera"
related:
  issues: [2019]
  prs: [2020]
  sdds: [SDD-0010]
  adrs: [ADR-0039, ADR-0041]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-0040: Keyboard navigation is an opt-in, off-by-default export-metadata option threaded through the unified export pipeline

## Status

Proposed

## Context

The keyboard-navigation runtime introduced by issue #2019 (see ADR-0039) changes
standard page navigation: plain arrow keys move between pages, `m` toggles the
menu, `Alt+/` opens search, and `t` toggles Teacher Mode. That behavior is
useful for slide-like content but can surprise readers of ordinary content and
can conflict with other keyboard-driven widgets on the page — most notably
lightbox image galleries. During review of PR #2020, @ignaciogros asked for the
feature to be off by default so it never silently alters navigation for existing
projects or content that relies on the keyboard for other purposes.

eXeLearning already has a unified export pipeline with a well-worn pattern for
boolean export options. Each one is declared once in
`src/shared/export/metadata-properties.ts`, surfaced as a checkbox in the
project properties UI via `src/routes/config-params.ts`, stored as a Yjs
metadata value, read back by `YjsDocumentAdapter`, and consumed by the
exporters/`PageRenderer`. Sibling options `addSearchBox`, `addMathJax` and
`addAccessibilityToolbar` all follow this exact path. Adding a bespoke mechanism
for one more toggle would duplicate plumbing the project already maintains.

## Problem

Should keyboard navigation be always on, on-by-default with an opt-out, or an
opt-in export option that is off by default — and how should that setting be
represented and carried from the author's choice to the rendered page?

## Decision drivers

- **No surprising behavior change** for existing content or projects.
- **Conflict avoidance** with other keyboard-driven content (e.g. lightbox
  galleries) — reinforced by ADR-0041.
- **Author control** — the author, not the reader, decides whether pages behave
  like a keyboard-navigable presentation.
- **Reuse the existing export-option plumbing** (single source of truth) instead
  of inventing a parallel mechanism.
- **Per-visitor escape hatch** for accessibility or troubleshooting.

## Options considered

### Option 1: Always on

Enable the shortcuts unconditionally in every export.

- Pros: zero configuration.
- Cons: changes navigation for all existing content without consent; guaranteed
  to conflict with keyboard-driven widgets on some pages. Rejected.

### Option 2: On by default, with an opt-out

Enable it everywhere but let authors/visitors disable it.

- Pros: discoverable.
- Cons: still a silent behavior change for every existing project on the first
  export after upgrade; the conflict risk lands on content that never asked for
  it. Rejected per PR #2020 review.

### Option 3 (chosen): Opt-in export option, off by default, plus per-visitor opt-out

Add a boolean `addKeyboardNavigation` export option (default `false`), threaded
through the same pipeline as the other export toggles. When enabled,
`PageRenderer` writes `window.exeKeyboardNavEnabled=true` into the page head
before `libs/exe_export.js`; the runtime reads that flag to decide whether to
attach its keydown listener. A visitor can additionally opt out at runtime with
`?keyboard-navigation=false` or a `exeKeyboardNavigationDisabled` localStorage
value.

- Pros: no behavior change unless the author asks for it; reuses existing
  plumbing end to end; gives readers an escape hatch; matches how every other
  export toggle works.
- Cons: one more checkbox in the properties UI (acceptable and consistent).

## Evidence

- Option declaration (default off): `src/shared/export/metadata-properties.ts`
  lines 175-181 — `{ key: 'addKeyboardNavigation', xmlKey:
  'pp_addKeyboardNavigation', type: 'boolean', defaultValue: false, category:
  'export' }`.
- Properties-UI checkbox and help text (off by default, with the conflict
  rationale): `src/routes/config-params.ts` lines 358-365 —
  `pp_addKeyboardNavigation`, title "Keyboard navigation", `value: 'false'`.
- Typed metadata field: `src/shared/export/interfaces.ts` line 69
  (`ExportMetadata`) and line 677 (`PageRenderOptions`).
- Read back from Yjs with a `false` default:
  `src/shared/export/adapters/YjsDocumentAdapter.ts` line 110 —
  `addKeyboardNavigation: this.parseBoolean(meta.get('addKeyboardNavigation'), false)`.
- Consumed by the exporter and passed to the renderer:
  `src/shared/export/exporters/Html5Exporter.ts` line 455 —
  `addKeyboardNavigation: meta.addKeyboardNavigation === true`.
- Emitted only when enabled, before the runtime loads:
  `src/shared/export/renderers/PageRenderer.ts` — `renderHead()` lines 308-315
  and `renderSinglePage()` line 1338 emit
  `<script>window.exeKeyboardNavEnabled=true;</script>` before
  `libs/exe_export.js`; the default parameter is `addKeyboardNavigation = false`
  (lines 122, 269, 1271).
- Runtime honors the flag and the opt-out:
  `public/app/common/exe_export.js` — `isEnabled()` returns
  `window.exeKeyboardNavEnabled === true` (lines 578-580); `isShortcutDisabled()`
  reads `?keyboard-navigation=false` and localStorage
  `exeKeyboardNavigationDisabled` (lines 582-597); `init()` attaches the listener
  only when enabled and not disabled (lines 562-567).
- Frontend property-key mapping (XML ↔ Yjs key):
  `public/app/yjs/YjsPropertiesBinding.js` line 66 and
  `public/app/yjs/YjsProjectBridge.js` line 1880 map `pp_addKeyboardNavigation`
  → `addKeyboardNavigation`.
- Tests: `src/shared/export/renderers/PageRenderer.spec.ts` lines 2048-2096
  assert the flag is absent by default and present (before `exe_export.js`) when
  enabled across `render`/`renderHead`/`renderSinglePage`;
  `src/shared/export/adapters/YjsDocumentAdapter.spec.ts` lines 302-326 assert
  the `false` default and parsing of both boolean `true` and stringified
  `"true"`; E2E
  `test/e2e/playwright/specs/preview-keyboard-navigation.spec.ts` includes a
  "default off" test (lines 274-317) that verifies shortcuts do nothing until
  the option is enabled via
  `enableKeyboardNavigationOption()` (`test/e2e/playwright/helpers/workarea-helpers.ts`
  line 1327).

## Decision

We will represent keyboard navigation as a boolean export option
`addKeyboardNavigation` (XML key `pp_addKeyboardNavigation`), default `false`,
threaded through the existing unified export pipeline
(metadata-properties → properties UI → Yjs metadata → `YjsDocumentAdapter` →
`Html5Exporter` → `PageRenderer`). When enabled, `PageRenderer` emits
`window.exeKeyboardNavEnabled=true` before `libs/exe_export.js`, and the runtime
attaches its handler only then. Visitors may additionally opt out with
`?keyboard-navigation=false` or the `exeKeyboardNavigationDisabled` localStorage
key.

## Consequences

### Positive

- No navigation change for existing projects or content unless the author opts
  in.
- Reuses the established export-option plumbing end to end — no parallel
  mechanism to maintain.
- Provides a per-visitor escape hatch for accessibility or troubleshooting.
- Consistent authoring UX with the other export toggles.

### Negative

- One additional checkbox in the project properties Export options group.
- The feature is invisible unless the author discovers and enables it.

### Neutral

- The inline flag is a hardcoded literal (`=true`), not interpolated user data,
  so it adds no serialization/escaping surface to the page head.

## Risks

- **Discoverability** (medium likelihood, low severity): authors may not find
  the option. Mitigation: descriptive title and help text in the properties UI.
- **Stale opt-out persistence** (low): a visitor's localStorage opt-out persists
  per origin. Mitigation: it is scoped to an explicit, documented key and is
  overridable by clearing it or removing the query parameter.

## Validation

- `PageRenderer.spec.ts` and `YjsDocumentAdapter.spec.ts` prove the default-off
  behavior and correct plumbing.
- The E2E "default off" and "typing suppression" cases prove the option gates
  the runtime and that the opt-in path works.

## Follow-up work

- Document the `addKeyboardNavigation` metadata key and the `?keyboard-navigation`
  / localStorage opt-out in the operational metadata reference (linked from
  SDD-0010).

## References

- Issue #2019; PR #2020 (review request from @ignaciogros for off-by-default).
- SDD-0010 — Keyboard navigation for exported and previewed content.
- ADR-0039 — shared export/preview runtime location.
- ADR-0041 — overlay-aware keyboard suppression registry.
- `src/shared/export/metadata-properties.ts`, `src/routes/config-params.ts`,
  `src/shared/export/adapters/YjsDocumentAdapter.ts`,
  `src/shared/export/exporters/Html5Exporter.ts`,
  `src/shared/export/renderers/PageRenderer.ts`, `public/app/common/exe_export.js`.
