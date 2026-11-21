---
id: ADR-2701-01
title: "Presentation mode stops the presenter remote's start/stop button from reloading the page"
status: Proposed
date: 2026-11-05
tracking_issue: 2701
deciders:
  - "@ignaciogros"
reviewers: []
related:
  prs: []
  changes: ["2019-keyboard-navigation-export-preview"]
  adrs: [ADR-2019-03, ADR-2019-04]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5-5"
---

# ADR-2701-01: Presentation mode stops the presenter remote's start/stop button from reloading the page

## Context

Issue #2701 asks for presenter remote support in Presentation mode. Remotes act
as USB keyboards. ADR-2019-04 already handles their previous and next buttons
(`PageUp`/`PageDown`), but not the start/stop button, which sends `F5` or `Shift+F5`
and then `Esc`. A "blank" button sending `B` also does nothing.

Today, in Presentation mode, the start/stop button reloads the page, which resets
the activities on it.

## Problem

Which of the remaining remote buttons should Presentation mode handle, and how,
given that ADR-2019-04 leaves `↑`/`↓`, `Space`, `Enter` and `Esc` uncaptured?

## Decision drivers

- **Compatibility with Presentation mode.** `Esc` belongs to lightboxes, dialogs,
  videos and fullscreen, and `↑`/`↓`/`Space` scroll long pages (ADR-2019-04).
- **No lost work.** A remote's button must not reset the page's activities, by
  reloading or by leaving the page.
- **No style changes.** The runtime handles the keys for every style.
- **No translation changes.**

## Options considered

### Option 1: Also map `Esc`, `↑`, `↓` and `Space` to page changes

- Pros: every button and key of a remote would have a page-level action.
- Cons: breaks scrolling, and `Esc` would leave a page instead of closing what is
  open. Rejected.

### Option 2: A real blank screen on `B`

- Pros: matches the button's usual meaning in presentation software.
- Cons: new visible state with its own way out and styling, beyond the issue's
  navigation objective. Can be added later.

### Option 3: Jump to the first page on `B` and to the last one on `Shift+F5`

- Pros: gives those buttons a page-level action.
- Cons: the issue asks for navigation, which previous and next already give, and a
  press by mistake leaves the page and loses the reader's progress. `B` is also an
  unmodified letter on `document`, which an iDevice may read. Rejected in the PR #2702
  review.

### Option 4 (chosen): Only stop the start/stop button from reloading

`F5` and `Shift+F5` do nothing. `Esc`, `Shift` alone and `B` stay uncaptured, so the
other presses of those buttons have no page-level effect.

## Evidence

- `public/app/common/exe_export.js`, `presentationMode.handleKeydown`.
- Single-page exports have no `exe-web-site` class, so the mode never runs there.

## Decision

While presenting, `F5` and `Shift+F5` do nothing, including under an overlay or from a
form field, because a reload there would lose work too. `Esc`, `Shift` alone, `B`, `↑`,
`↓`, `Space` and `Enter` remain uncaptured.

## Consequences

### Positive

- The start/stop button keeps the reader on the page with its activities intact.
- Nothing changes outside the mode: without it, `F5` reloads as usual.

### Negative

- `F5` and `Shift+F5` cannot reload while presenting, since a keyboard and a remote
  send the same keys. `Ctrl`/`Cmd`+`R`, `Ctrl`+`F5` and the browser's button still work.
- The start/stop and "blank" buttons have no page-level action.

### Neutral

- The `presentation_mode_keys` tooltip is unchanged: it lists keyboard keys, and
  these buttons do not need explaining on a remote.

## Risks

- **Remotes that send other keys** (medium): models differ. Those keys keep doing
  nothing, as they do now. Further keys can be added to `handleKeydown` when a model
  is reported.
- **Focus inside an iframe** (low): an embedded video or iDevice keeps the key event
  from reaching the page, so `F5` reloads and the other keys do nothing, as the arrows
  already did. An active text composition also skips the handler.
- **Not tested on hardware** (medium): the tests send the key events rather than
  use a physical remote.

## Validation

- Unit: `describe('presenter remote buttons')` in `public/app/common/exe_export.test.js`.
- E2E: the presenter remote case in `test/e2e/playwright/specs/presentation-mode.spec.ts`.

## Follow-up work

- Document the remote buttons in the user guide with `?exe-presentation=1` (see
  ADR-2019-04).

## References

- Issue #2701; issue #2019.
- ADR-2019-03 (overlay deferral), ADR-2019-04 (reader-activated mode).
