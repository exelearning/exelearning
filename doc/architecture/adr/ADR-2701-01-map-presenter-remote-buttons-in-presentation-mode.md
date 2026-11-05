---
id: ADR-2701-01
title: "Presentation mode maps the remaining presenter remote buttons without taking over Esc or scrolling keys"
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

# ADR-2701-01: Presentation mode maps the remaining presenter remote buttons without taking over Esc or scrolling keys

## Context

Issue #2701 asks for presenter remote support in Presentation mode. Remotes act
as USB keyboards. ADR-2019-04 already handles their previous and next buttons
(`PageUp`/`PageDown`), but not the other two: a start/stop button sending `F5` or
`Shift+F5` and then `Esc`, and a "blank" button sending `B`.

Today, in Presentation mode, the start/stop button reloads the page, which resets
the activities on it, and the "blank" button does nothing.

## Problem

Which of the remaining remote buttons should Presentation mode handle, and how,
given that ADR-2019-04 leaves `↑`/`↓`, `Space`, `Enter` and `Esc` uncaptured?

## Decision drivers

- **Compatibility with Presentation mode.** `Esc` belongs to lightboxes, dialogs,
  videos and fullscreen, and `↑`/`↓`/`Space` scroll long pages (ADR-2019-04).
- **No style changes.** The runtime handles the keys for every style, using links
  the export renderer already generates.
- **No translation changes** for a few extra keys.

## Options considered

### Option 1: Also map `Esc`, `↑`, `↓` and `Space` to page changes

- Pros: every button and key of a remote would have a page-level action.
- Cons: breaks scrolling, and `Esc` would leave a page instead of closing what is
  open. Rejected.

### Option 2: A real blank screen on `B`

- Pros: matches the button's usual meaning in presentation software.
- Cons: new visible state with its own way out and styling, beyond the issue's
  navigation objective. Can be added later.

### Option 3 (chosen): Only the buttons that do not conflict

`Shift+F5` goes to the last page in the menu, `F5` does nothing and `B` goes to the
first page.
`Esc` and `Shift` alone stay uncaptured, so a remote that alternates with `Esc` has
no page-level effect on that press.

## Evidence

- `public/app/common/exe_export.js`, `presentationMode.handleKeydown`.
- The first page link is `#siteNav a.main-node`, and the current page link has
  `.active` (`src/shared/export/renderers/PageRenderer.ts`, `renderNavItemFast`).

## Decision

While presenting, `F5` and `Shift+F5` do not reload the page, including under an
overlay or from a form field, because a reload there would lose work too. `Shift+F5`
also clicks the last `#siteNav a` unless it is the current page, an overlay is open
or the reader is typing. `B` (plain key, matched by `KeyboardEvent.code`, respecting
typing targets and overlays) clicks `#siteNav a.main-node:not(.active)`. Menu links
already carry the mode. `Esc`, `Shift` alone, `↑`, `↓`, `Space` and `Enter` remain
uncaptured.

## Consequences

### Positive

- The start/stop button no longer reloads the page. `F5` keeps the reader on the page
  with its activities intact, and `Shift+F5` gives a fast way to the last page in the menu.
- The "blank" button gives a fast way back to the first page.
- Nothing changes outside the mode: without it, `F5` reloads as usual.

### Negative

- `F5` and `Shift+F5` cannot reload while presenting, since a keyboard and a remote
  send the same keys. `Ctrl`/`Cmd`+`R`, `Ctrl`+`F5` and the browser's button still work.
- The "blank" button does not blank the screen.
- `B` and `Shift+F5` leave the current page, so a press by mistake loses the state of
  its activities and the reader's position. The way back with a remote is `PageUp`,
  repeated as needed.

### Neutral

- The `presentation_mode_keys` tooltip is unchanged: it lists keyboard keys, and
  these buttons do not need explaining on a remote.

## Risks

- **Remotes that send other keys** (medium): models differ, and some use `.` for
  "blank". Those keys keep doing nothing, as they do now. Further keys can be added
  to `handleKeydown` when a model is reported.
- **Focus inside an iframe** (low): an embedded video or iDevice keeps the key event
  from reaching the page, so `F5` reloads and the other keys do nothing, as the arrows
  already did. An active text composition also skips the handler.
- **Hidden last page** (low): `PageDown` can reach a page hidden from the menu, but
  `Shift+F5` stops at the last page the menu lists, and goes back to it from a hidden one.
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
