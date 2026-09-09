---
id: ADR-2019-03
title: "Defer to open overlays via an extensible overlay-signal registry (active surface owns the keyboard)"
status: Proposed
date: 2026-07-09
tracking_issue: 2019
legacy_id: ADR-0041
deciders:
  - "@erseco"
reviewers:
  - "@cristinavaldera"
related:
  prs: [2020]
  changes: ["2019-keyboard-navigation-export-preview"]
  adrs: [ADR-2019-01, ADR-2019-02]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-2019-03: Defer to open overlays via an extensible overlay-signal registry (active surface owns the keyboard)

## Context

The keyboard-navigation runtime (ADR-2019-01) listens for `keydown` at the document
level and, on plain arrow keys, navigates between pages. Exported content
frequently contains widgets that own the keyboard while open: the legacy
`exe_lightbox` (prettyPhoto) gallery, the SimpleLightbox used by the Image
Gallery iDevice, full-screen image overlays used by Magnifier and other Games-*
iDevices, and MediaElement.js full-screen video in the Interactive Video
iDevice. If page navigation fires while one of these is open, it steals arrow
keys the widget expects. During review of PR #2020, @ignaciogros flagged that an
open lightbox must fully prevail over the page shortcuts.

A specific timing hazard makes this more than cosmetic: SimpleLightbox binds its
own arrow handling on `keyup`, while our navigation runs on `keydown`. Without
suppression, our `keydown` navigates the page (reloading the iframe) before
SimpleLightbox's `keyup` handler ever runs. Several of these widgets are shared
or third-party, so we cannot rely on each one to call a suppression API.

## Problem

How should the keyboard-navigation runtime detect that an overlay/widget
currently owns the keyboard and suppress its own shortcuts, in a way that is
easy to extend as new overlay-style widgets are added?

## Decision drivers

- **Active surface owns the keyboard** — an open overlay must win over page
  shortcuts.
- **Extensibility** — adding coverage for a future widget should be a one-line
  change, not edits scattered through the keydown handler.
- **Robustness** — a single broken probe must not disable suppression for the
  others.
- **No coupling to third-party widget internals** — SimpleLightbox and prettyPhoto
  are not ours to modify.
- **Live, not cached** — suppression must reflect the overlay's current state on
  every keystroke (overlays open and close between keystrokes).

## Options considered

### Option 1: Inline overlay checks inside `handleKeydown`

Hard-code a sequence of `if (document.querySelector('.sl-wrapper')) return;`
style checks at the top of the handler.

- Pros: simplest to write initially.
- Cons: the list of widgets is buried in control flow; adding a widget means
  editing the hot path and risking a missed early-return; no isolation if one
  check throws. Rejected.

### Option 2: Have each widget announce activity via an API or events

Ask every overlay to call `$exeExport.keyboardNav.suppress()` on open and
release on close, or dispatch custom events.

- Pros: explicit, no DOM probing.
- Cons: requires touching many widgets, including third-party ones
  (SimpleLightbox, prettyPhoto) we do not control; brittle if a widget forgets
  to release; large blast radius for a small feature. Rejected.

### Option 3 (chosen): Central declarative registry of overlay-signal probes

Maintain a single `overlaySignals` array on the `keyboardNav` module. Each entry
is `{ name, isActive(kbNav) }` where `isActive` is a small DOM-presence (and,
where needed, visibility) probe for that widget's active state.
`isOverlayActive()` returns true if any probe matches, wrapping each probe in
try/catch so one failure cannot mask the others. `handleKeydown` calls
`isOverlayActive()` first and bails out when true.

- Pros: adding a widget is a single array entry; the keydown hot path stays
  tiny; per-probe isolation; no dependency on widget cooperation; probes read
  live DOM state each keystroke.
- Cons: relies on knowing each widget's active-state marker class (documented
  inline per entry); a widget that changes its markup would need its probe
  updated.

## Evidence

- The registry and its four current entries:
  `public/app/common/exe_export.js` `overlaySignals` (lines 643-686):
  1. `exe_lightbox (prettyPhoto)` — probes `.pp_pic_holder` **and** checks
     visibility via `kbNav.isHidden(el)`, because that node is created once and
     only shown/hidden, so existence alone is insufficient (lines 644-654).
  2. `SimpleLightbox (Image Gallery iDevice)` — probes `.sl-wrapper`, which is
     inserted on open and removed on close; the inline comment documents the
     `keyup`-vs-`keydown` race that makes suppression necessary (lines 655-666).
  3. `Fullscreen image overlay (Magnifier + Games-* iDevices)` — probes
     `.Games-OverlayImage` (lines 667-676).
  4. `MediaElement.js fullscreen video (Interactive Video iDevice)` — probes
     `.mejs-container-fullscreen` (lines 677-685).
- Fail-isolated aggregation: `isOverlayActive()` iterates with a per-probe
  try/catch so "a single broken probe must never mask the others"
  (`public/app/common/exe_export.js` lines 688-698).
- Suppression is the first gate in the handler:
  `handleKeydown()` returns early when `isOverlayActive()` is true
  (`public/app/common/exe_export.js` line 760), before any navigation.
- Extensibility is stated in the code: the block comment above `overlaySignals`
  says "Add one entry here to cover a future overlay/widget; nothing else in this
  module needs to change" (lines 638-642).
- Unit coverage: `public/app/common/exe_export.test.js`
  `describe('overlaySignals / isOverlayActive')` (line 2565), including a case
  that overrides `overlaySignals[0].isActive` to verify a throwing probe is
  swallowed (lines 2612-2623), and an `overlay suppression` block (line 3127).
- E2E coverage: a synthetic-overlay smoke test injects three of the four real
  marker classes (`.pp_pic_holder`, `.Games-OverlayImage`,
  `.mejs-container-fullscreen`) and asserts navigation is suppressed then
  restored live
  (`test/e2e/playwright/specs/preview-keyboard-navigation.spec.ts` lines
  319-378); the fourth, SimpleLightbox's `.sl-wrapper`, is instead covered by a
  **real** end-to-end test that asserts page navigation is suppressed while the
  gallery is open and restored on close
  (`test/e2e/playwright/specs/idevices/image-gallery.spec.ts` line 517).

## Decision

We will suppress the runtime's shortcuts whenever any registered overlay signal
reports active, using a central declarative `overlaySignals` registry on the
`keyboardNav` module. `isOverlayActive()` aggregates the probes with per-probe
try/catch isolation and is checked first in `handleKeydown`. New overlay-style
widgets are covered by adding one entry to the array.

## Consequences

### Positive

- An open overlay/lightbox/full-screen widget reliably prevails over page
  shortcuts.
- Covering a new widget is a one-entry change; the keydown hot path is unchanged.
- No dependency on third-party widget cooperation; a broken probe cannot disable
  the others.
- Probes are evaluated live per keystroke, correctly tracking open/close.

### Negative

- The registry hard-codes each widget's active-state marker class; a widget that
  changes its markup requires a probe update.

### Neutral

- Probes are intentionally lightweight `document.querySelector` checks; they run
  on the navigation keystrokes the runtime already handles, not on every event.

## Risks

- **Marker-class drift** (low likelihood, medium severity for the affected
  widget): if a widget renames its active-state class, its probe stops matching
  and navigation could fire during that overlay. Mitigation: each probe is
  documented inline with the file that owns the class, and both a synthetic and
  a real (SimpleLightbox) E2E test guard the behavior.
- **Missing a future widget** (medium): a new overlay added without a probe is
  not covered. Mitigation: the documented one-entry extension pattern and the
  test template make coverage cheap to add.

## Validation

- Unit tests assert `isOverlayActive()` semantics including throwing-probe
  isolation.
- The real SimpleLightbox E2E test validates end-to-end suppression and
  restoration around the `keyup`/`keydown` race.

## Follow-up work

- When adding a new overlay-style iDevice/widget, add its active-state probe to
  `overlaySignals` and a suppression assertion to its E2E spec.

## References

- Issue #2019; PR #2020 (review request from @ignaciogros; @ussefxben context).
- the change design — Keyboard navigation for exported and previewed content.
- ADR-2019-01 — shared export/preview runtime location.
- ADR-2019-02 — opt-in, off-by-default export option.
- `public/app/common/exe_export.js` (`overlaySignals`, `isOverlayActive`,
  `handleKeydown`); `test/e2e/playwright/specs/idevices/image-gallery.spec.ts`.
