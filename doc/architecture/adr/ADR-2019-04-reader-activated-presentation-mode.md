---
id: ADR-2019-04
title: "Presentation mode is activated by the reader through a URL parameter and a visible control, never stored in the project"
status: Proposed
date: 2026-09-15
tracking_issue: 2019
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
  - "@cristinavaldera"
related:
  prs: [2020]
  changes: ["2019-keyboard-navigation-export-preview"]
  adrs: [ADR-2019-01, ADR-2019-02, ADR-2019-03]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-fable-5-1"
---

# ADR-2019-04: Presentation mode is activated by the reader through a URL parameter and a visible control, never stored in the project

## Context

Issue #2019 asks for a way to drive an exported eXeLearning web site like a
presentation, with the keyboard or a presenter remote. The first iteration of
PR #2020 shipped this as an author-side export option (ADR-2019-02). Review on
the PR (@ignaciogros, 2026-09-14 and 2026-09-15; @erseco, 2026-09-14) turned
that decision down for three reasons:

- An export option leaves a trace in the `.elpx`. Anyone who later imports the
  file and exports a web site inherits a changed navigation behaviour without
  being aware of it, and a style could manage the same behaviour differently.
- Presenting is a decision the **reader** takes at the moment of presenting,
  not something an author can anticipate for every future use of the content.
- The export configuration already carries more options than most users need.

Teacher Mode (`public/app/common/exe_export.js`, `teacherMode`) already solves
the same shape of problem: an in-page mode that is made available by a URL
parameter (`?exe-teacher=1`), switched on and off by the reader with a visible
control, and carried between pages by appending the parameter to the
navigation links. Nothing about it is stored in the project. Presentation mode
goes one step further: the parameter's only purpose is presenting, so its
value is the state itself and no storage is needed.

## Problem

How is presentation mode switched on, by whom, where does its state live, and
where does the control that enters and leaves it go?

## Decision drivers

- **No invisible behaviour.** A mode with no visible way in or out is what the
  review rejected; readers must see the mode, enter it and leave it from the
  interface.
- **No trace in the project.** Sharing or importing an `.elpx` must never
  change how someone else's web site export behaves.
- **Reuse the Teacher Mode pattern** rather than inventing a second one.
- **Respect the browser and the overlays.** `Esc` already closes lightboxes,
  dialogs, videos and fullscreen; fullscreen itself has platform gaps.
- **Style independence.** Third-party styles customise `.page-header` and the
  footer, and `#siteFooter` is hidden when empty (#2145); the control must not
  depend on either.

## Options considered

### Option 1: Export option stored in project metadata (ADR-2019-02)

- Pros: consistent with the other export toggles.
- Cons: leaves a trace in the `.elpx`; the author decides for every reader; one
  more option in an already large export configuration. Rejected in review.

### Option 2: A new export type ("Export as presentation")

- Pros: no trace in the `.elpx`.
- Cons: makes the export menu more complex; still an author-time decision.
  Rejected in review.

### Option 3: Fullscreen entered from an eXe control enables the mode

- Pros: a single, intuitive gesture.
- Cons: the Fullscreen API needs a user gesture, is lost on navigation in
  Firefox/Safari and on `file://`, is unavailable on iPhone, and needs its own
  exit control and fallback; `Esc` would collide with the overlays the mode
  must respect. Rejected in review.

### Option 4 (chosen): Reader-activated mode carried by the parameter itself

`?exe-presentation=1|true|yes` enters the mode and shows a visible "Exit
presentation mode" control; `?exe-presentation=0` shows the control with the
mode off; without the parameter nothing is injected and no key is captured.
While presenting, `←`/`PageUp` and `→`/`PageDown` change page, `M` shows or
hides the menu through the style's own toggler and `T` toggles Teacher Mode
through its own toggle where that mode is available (all plain keys only, so
`Ctrl`/`Cmd+T` is never shadowed); the control's tooltip lists them and points
to `F11` for full screen.
The parameter is the state: entering or leaving rewrites it in the current URL
(`history.replaceState`) and in the menu, previous/next and search-result
links, so the choice survives page changes and reloads with no storage at
all. Unlike Teacher Mode, the parameter does activate the mode: revealing
teacher content is a content change that must stay behind a click, whereas
the only reason to add this parameter to a link is to present, and one more
click would be pure friction. Fullscreen is left to the browser (`F11`),
which is what presenters already do.

## Evidence

- Runtime: `public/app/common/exe_export.js`, `presentationMode` —
  `bootstrap()` runs in `<head>` (reads the parameter, marks
  `html.mode-presentation` flicker-free), `init()` appends the control and
  enters the mode when the parameter asked for it, `enter()`/`leave()`/
  `toggle()` manage `html.mode-presentation`, the menu and, through
  `_syncState()`, the URL, the links and the control's label.
- Shared propagation helpers `$exeExport.withNavParam()` and
  `$exeExport.propagateNavParam()` serve both Teacher Mode and presentation mode
  (single source of truth, AGENTS.md §1); search hits get both parameters in
  `$exeExport.searchBar`.
- Scope guard: `presentationMode.isSupported()` requires `body.exe-web-site`
  (set only by `Html5Exporter`; SCORM/IMS/EPUB bodies carry their own classes)
  and `window.self === window.top`.
- Control placement and look: appended to `<body>` after `#made-with-eXe`,
  styled in `public/style/workarea/base.css` with the same recipe as the badge
  (fixed bottom-right, neutral, hidden in print, offset when the badge exists)
  and stacked below it (`z-index` 1 vs 2) so the badge's hover expansion
  covers the control instead of the other way round. The label changes with
  the state ("Presentation mode" / "Exit presentation mode"), so it is a plain
  button, not an `aria-pressed` toggle.
- Labels: `presentation_mode`, `exit_presentation_mode` and
  `presentation_mode_keys` (tooltip) in `public/app/common/common_i18n.js`,
  the template every export's `libs/common_i18n.js` is generated from (English
  fallback in the runtime).
- Tests: `public/app/common/exe_export.test.js` (`describe('presentationMode')`)
  and `test/e2e/playwright/specs/presentation-mode.spec.ts`, which serves a real
  web site export from its own origin and opens it top-level.

## Decision

Presentation mode is a reader-activated mode of web site exports.
`?exe-presentation=1` (aliases `true`/`yes`) enters it and `=0` leaves the
control available with the mode off; a visible `#exe-presentation-toggler`
control placed next to `#made-with-eXe` enters and leaves it, rewriting the
parameter in the URL and the navigation links. The parameter is the only
state: no storage, no project property, no export option and no export type.
The keys are `←`/`PageUp`, `→`/`PageDown`, `M` (menu) and `T` (Teacher Mode
where available); `↑`/`↓`, `Space`, `Enter` and `Esc` are never captured. Fullscreen is not part of the mode
and `Esc` is not its exit key. It exists only for a web site export opened as
the top-level document.

## Consequences

### Positive

- Sharing or importing an `.elpx` can never change navigation for anyone.
- The reader decides to present exactly when presenting; nothing to configure.
- One pattern (parameter + control + link propagation) for both reader-side
  modes, with no storage at all for this one.
- The control is visible in every web site export whatever the style does.

### Negative

- Discoverability depends on the user guide documenting the parameter.
- The editor preview is an iframe, so the control does not appear there;
  verifying the mode means opening the export.

### Neutral

- A `pp_addPresentationControl` export option (like the accessibility toolbar)
  can be added later if a project wants the control without the parameter.
- The pointer/presentation cursor mentioned in review is deferred.

## Risks

- **Parameter dropped by a host** (low): a link that strips query parameters
  loses the mode and the control. Mitigation: it is the reader's own link; the
  runtime rewrites every in-package link, and a browser that refuses
  `history.replaceState` still keeps the state in the links.
- **Overlap with a style's own badge area** (low): styles may place widgets
  bottom-right. Mitigation: the control is an ordinary id-addressable element
  that any style can restyle or move.

## Validation

- Unit: bootstrap, scope guard, control injection, enter/leave, URL and link
  rewriting, key handling and overlay deferral in `exe_export.test.js`.
- E2E: `presentation-mode.spec.ts` (no parameter → nothing; `=1` → mode on,
  collapsed menu, keys, propagation; leave → `=0` in URL and links, inert
  keys, survives reload and navigation; re-enter) and the SimpleLightbox case
  in `idevices/image-gallery.spec.ts`.

## Follow-up work

- Document `?exe-presentation=1` alongside Teacher Mode, `pp_addExeLink` and
  the accessibility toolbar in the user guide.
- Optional pointer/presentation cursor and `pp_addPresentationControl`.

## References

- Issue #2019; PR #2020 review thread (2026-09-07 to 2026-09-15).
- ADR-2019-01 (runtime location), ADR-2019-02 (rejected export option),
  ADR-2019-03 (overlay deferral).
- Teacher Mode: `public/app/common/exe_export.js` (`teacherMode`), PR #1972.
