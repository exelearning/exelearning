---
tracking_issue: 2019
title: "Presentation mode for web site exports"
status: in-review
date: 2026-09-15
legacy_id: SDD-0010
authors:
  - "@erseco"
reviewers:
  - "@ignaciogros"
  - "@cristinavaldera"
implementation_prs: [2020]
related_adrs: [ADR-2019-01, ADR-2019-02, ADR-2019-03, ADR-2019-04]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8, claude-fable-5-1"
---

# Presentation mode for web site exports — design

## Motivation

Educators want to show an eXeLearning web site export in class the way they
show a slide deck: menu out of the way, next and previous page from a presenter
remote or the arrow keys. eXeLearning 2.9 offered this through its
"Presentation" style; eXeLearning 3 had no equivalent (issue #2019).

## Problem

A global key handler that changes page is a change to how a web site behaves
and can collide with widgets that own the keyboard (lightbox galleries,
fullscreen media). The first iteration of PR #2020 gated it behind an export
option; review rejected storing the behaviour in the project (see
ADR-2019-04). The mode has to be something the reader chooses, visibly, at the
moment of presenting, without any trace in the `.elpx` and without fighting the
content.

## Scope

Web site (HTML5) exports opened as the top-level document. Not SCORM/IMS
(navigation belongs to the LMS), not EPUB, not content embedded in an iframe
(which includes the editor's preview panel).

## Goals

- A reader can enter and leave presentation mode from a visible control.
- While presenting: menu collapsed, `←`/`PageUp` previous page,
  `→`/`PageDown` next page.
- The choice survives navigation between pages.
- Nothing is injected and no key is captured unless the reader asked for it.
- Open overlays, fullscreen iDevices and form fields keep their keys.

## Non-goals

- Fullscreen. Left to the browser (`F11`); see ADR-2019-04 for why.
- Traversing feedback buttons, FX effects, galleries or video controls with the
  keys: pages remain the navigation unit.
- Changing scrolling: `↑`/`↓` are never captured.
- A pointer/presentation cursor and a `pp_addPresentationControl` export
  option: possible follow-ups, not part of this change.
- Documentation in the user guide (separate repository).

## Requirements

- `?exe-presentation=1|true|yes` enters the mode; `=0` offers the control with
  the mode off; without the parameter nothing is injected.
- The control is visible in every web site export regardless of style, is a
  real `<button>` whose label states the action ("Presentation mode" / "Exit
  presentation mode"), and is hidden in print.
- `Esc` is not the exit key (it belongs to lightboxes, dialogs, videos and
  fullscreen).
- Keys never fire with a modifier, while typing, while an overlay is open or
  while `document.fullscreenElement` is set.

## Scenarios

1. A teacher opens `index.html?exe-presentation=1`, clicks "Presentation
   mode", presses `F11` and drives the class with a remote. Following a menu
   link keeps the mode; the menu can be opened when needed.
2. A page contains an Image Gallery. The teacher opens a photo; `→` moves
   between photos (the gallery's own handler), never to the next page. Closing
   the gallery gives the keys back to the page.
3. A reader opens the same export without the parameter: no control, no key
   captured, the site behaves as before.

## Acceptance criteria

- Without the parameter: no `#exe-presentation-toggler`, no parameter in the
  navigation links, `→` does nothing.
- With `=1`: mode on at once, control reads "Exit presentation mode",
  `html.mode-presentation`, `#siteNavToggler` collapsed, `→`/`PageDown` and
  `←`/`PageUp` change page, every next page re-enters by itself, the menu can
  still be opened.
- After leaving: URL and links carry `=0`, keys inert, the choice survives a
  reload and a page change, and the control reads "Presentation mode" to come
  back in.
- With a SimpleLightbox open: keys inert; after closing: keys work.

## Current state

`public/app/common/exe_export.js` is the runtime every exported page loads. It
already hosts Teacher Mode, a reader-side mode made available by
`?exe-teacher=1` and carried between pages by appending the parameter to the
navigation links. Themes render
`#siteNavToggler` with `aria-expanded` and already propagate their own
`?nav=false` when the menu is collapsed. `#made-with-eXe` is a fixed badge
rendered outside `.exe-content` and the footer, styled in
`public/style/workarea/base.css`.

## Technical design

`presentationMode` in `exe_export.js`, mirroring `teacherMode`:

- `bootstrap()` (runs in `<head>`): reads `?exe-presentation`, sets
  `_available` (parameter present) and `_requested` (truthy value), and marks
  `html.mode-presentation` flicker-free when requested.
- `init()` (runs with `teacherMode.init()`, after the style rendered its
  togglers): returns unless `_available` and `isSupported()`, propagates the
  current state to `#siteNav a` and `.nav-buttons a` through the shared
  `$exeExport.propagateNavParam()`, appends the control before `</body>` and
  enters the mode when requested.
- `isSupported()`: `body.exe-web-site` and `window.self === window.top`.
- `enter()`/`leave()`/`toggle()`: `html.mode-presentation`, `_syncState()`
  (rewrites `exe-presentation=1|0` in the URL with `history.replaceState`, in
  the links, and relabels the control), menu via the theme's own toggler
  (`_setMenuExpanded()` clicks `#siteNavToggler` only when its `aria-expanded`
  differs), one `keydown` listener bound on enter and removed on leave.
- `handleKeydown()`: bails out on `defaultPrevented`, composition, any
  modifier, a typing target or an active overlay; otherwise clicks
  `a.nav-button-left` / `a.nav-button-right` and prevents default only when a
  link existed.
- `overlaySignals` / `isOverlayActive()`: ADR-2019-03, plus
  `document.fullscreenElement`.
- Shared helpers `$exeExport.withNavParam()` / `propagateNavParam()` replace
  the Teacher-Mode-only implementations; `teacherMode.withTeacherParams()` and
  `propagateNavParams()` delegate to them, and search hits receive both
  parameters.
- CSS: `#exe-presentation-toggler` in `base.css` follows the `#made-with-eXe`
  recipe (fixed bottom-right, neutral, print-hidden), shifts left when the
  badge is present and stacks below it (`z-index` 1 vs 2) so the badge's hover
  expansion covers it. Labels: `presentation_mode` and
  `exit_presentation_mode` in `common_i18n.js`.

## Data model

None. No project property, no metadata key, no XML key, no storage. The
navigation parameter is the only state.

## Migration and compatibility

Nothing to migrate. The `pp_addKeyboardNavigation` option of the first
iteration never shipped in a release; its plumbing is removed. Existing exports
are unaffected: without the parameter the runtime injects nothing.

## Security and privacy

The parameter is only compared against three literal values; nothing from the
URL is written to the DOM. The control's label comes from the bundled i18n
file. `history.replaceState` is wrapped in try/catch; the links still carry
the state if the browser refuses it.

## Accessibility

The mode is visible (a button whose label names the action), entered and left
from the interface, and never captures keys with modifiers, inside form fields or while
an overlay is open. `↑`/`↓` keep scrolling. `Esc` keeps its existing meanings.

## Internationalization

`presentation_mode` and `exit_presentation_mode` are added to
`public/app/common/common_i18n.js` with `c_()`; per-language bundles are
generated at build time from the translations, and the runtime falls back to
English when a bundle predates the keys.

## Performance

One `keydown` listener while the mode is active; overlay probes are
`querySelector` calls on the handled keys only.

## Testing strategy

- Unit (`public/app/common/exe_export.test.js`, `describe('presentationMode')`):
  bootstrap, scope guard, control injection, propagation, enter/leave/toggle,
  key handling, typing guard, overlay signals.
- E2E (`test/e2e/playwright/specs/presentation-mode.spec.ts`): the project is
  exported in the browser, served from its own origin through `page.route()`
  (`serveWebSiteExport()` in `workarea-helpers.ts`) and opened top-level, with
  and without the parameter; leaving, reloading, navigating with `=0` and
  re-entering are asserted.
- E2E (`idevices/image-gallery.spec.ts`): real SimpleLightbox in a served export
  with the mode active.

## Rollout plan

Ships with PR #2020. Follow-up: user-guide entry for `?exe-presentation=1`.

## Risks and mitigations

- A host that strips query parameters loses the mode and the control on the
  next page: it is the reader's own link, and every in-package link is
  rewritten by the runtime.
- A style that renames the nav selectors loses the keys: the runtime is a
  no-op when they are absent.

## ADRs required or referenced

- ADR-2019-01 (Proposed): runtime location, updated for presentation mode.
- ADR-2019-02 (Rejected): export option, kept as the record of the first
  iteration.
- ADR-2019-03 (Proposed): overlay deferral registry, extended with the
  Fullscreen API signal.
- ADR-2019-04 (Proposed): reader activation, scope, control placement.

## Alternatives considered

Export option, new export type and fullscreen-driven activation: see
ADR-2019-04.

## External prior art

reveal.js `keyboardCondition`, Bootstrap `.modal-open`, PhotoSwipe
`.pswp--open` and the WAI-ARIA APG modal dialog pattern for "the active surface
owns the keyboard" (ADR-2019-03). Teacher Mode (PR #1972) for the
parameter-plus-control activation pattern.

## References

- Issue #2019, PR #2020 and its review thread (2026-07-01 to 2026-09-15).
- `public/app/common/exe_export.js`, `public/style/workarea/base.css`,
  `public/app/common/common_i18n.js`.
