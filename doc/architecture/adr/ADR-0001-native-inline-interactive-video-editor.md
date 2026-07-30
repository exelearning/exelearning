---
id: ADR-0001
title: "Native inline editor for the Interactive Video iDevice"
status: Proposed
date: 2026-07-09
deciders:
  - "@erseco"
reviewers:
  - "@mnunezcedec"
  - "@cristinavaldera"
related:
  issues: []
  prs: [2147]
  sdds: [SDD-0001]
  adrs: [ADR-0002, ADR-0003, ADR-0005]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-0001: Native inline editor for the Interactive Video iDevice

## Status

Proposed

## Context

The legacy Interactive Video iDevice authored content in a **detached
full-screen editor**: `edition/editor/index.html` (charset `ISO-8859-1`,
`%TOKEN%` i18n) plus a ~2200-line `admin.js`, launched inside a chrome-less
Bootstrap `.modal-fullscreen` iframe. It had its own Save/Quit lifecycle
(authors had to "save the editor, then save the iDevice"), reached across frames
via top-window globals (`top.interactiveVideoEditor`, `parent.document…`), and
had **zero tests**. Every other modern eXeLearning iDevice authors inline inside
the iDevice body using the native `.exe-form-tab` tab pattern.

## Problem

Where should Interactive Video be authored — in a detached full-screen popup, or
inline inside the iDevice body like other modern iDevices?

## Decision drivers

- Usability: a single Save; no "save the editor, then save the iDevice" step.
- Consistency with other iDevices (`trueorfalse`, `form`, `slide`,
  `quick-questions`).
- Accessibility: no keyboard trap in a nested iframe; a normal tab order.
- Multi-instance safety: no `top.*` singletons that forbid more than one instance
  per page.
- Testability and maintainability.

## Options considered

### Option 1: Keep the detached full-screen iframe editor

Pros: no rewrite. Cons: keeps the two-step save, the cross-frame globals, the
single-instance limitation, the accessibility problems and the untested
~2200-line `admin.js`; inconsistent with every other iDevice.

### Option 2: Native inline editor inside the iDevice body

Render the whole authoring UI inline via
`$exeDevicesEdition.iDevice.tabs.init()`, with state scoped to the iDevice
element and `save()` returning the authored object. Pros: one Save, consistent
UX, keyboard-accessible, multi-instance safe, unit-testable. Cons: full rewrite
of the editor and its tests.

## Evidence

- Legacy detached editor and its cross-frame globals: `admin.js` /
  `edition/editor/index.html` (removed by PR #2147).
- New inline editor: `public/files/perm/idevices/base/interactive-video/edition/interactive-video.js`,
  using the native tab pattern with element-scoped state.
- E2E asserts no detached popup:
  `test/e2e/playwright/specs/idevices/interactive-video.spec.ts`
  ("adds the iDevice with an inline … editor and no detached popup"). Exact
  commands and counts are re-verified at the final review commit of PR #2147.
- Precedent iDevices author inline: `slide`, `trueorfalse`, `form`,
  `quick-questions`.

## Decision

We will author the Interactive Video iDevice with a **native inline editor**
rendered inside the iDevice body using native tabs that follow the standard
sibling layout (**General settings** first; the exact tab composition and field
order are defined by SDD-0001), replacing the detached full-screen editor. State
is scoped to the iDevice element and `save()` returns the authored object; the
legacy iframe editor is removed.

## Consequences

### Positive

- One Save, consistent with other iDevices; keyboard-accessible; multi-instance
  safe; unit- and E2E-testable.

### Negative

- Full rewrite of the editor and its tests.

### Neutral

- TinyMCE rich-text fields legitimately use their own iframes; "no detached
  editor" is asserted against the old editor URL, not a blanket iframe count.

## Risks

- Feature-parity gaps with the old editor. One such gap materialized in review:
  "Use current time" worked only for local video, regressing the legacy YouTube
  behavior. It is resolved by the provider adapter (ADR-0004), which exposes
  `getCurrentTime` for every provider, so the editor reads the live playhead for
  external video too. Parity is otherwise held by re-implementing all legacy
  options (video sources, custom texts, SCORM, all 8 interaction kinds) and
  covering them with unit + E2E tests.

## Validation

- The inline editor renders inline with no `.modal-fullscreen` and no old
  detached-editor iframe (E2E).
- Editor unit tests cover source selection, before/after content, custom texts,
  and the review-driven per-kind authoring assertions: `singleChoice` exclusivity
  (exactly one correct via a radio control), the dedicated True/False control, no
  raw `<span style="text-decoration: line-through;">` markup in the cloze/dropdown
  prompt editor, and the single-editor accordion layout (no dual list).
- Exact commands and counts are re-verified at the final review commit of
  PR #2147.

## Follow-up work

- Re-enable Firefox for the E2E spec now that the iframe editor is gone.

## Amendment — side-panel layout + body-editor widget (review round 2, 2026-07)

Two refinements within the native-inline decision (the decision itself stands):

- **Side-panel layout** — the learner runtime and the editor place interaction
  content in a panel to the **right** of the video (the player is full width until
  an interaction is active, then shares the row; the editor's right panel is a
  live preview of the selected interaction). Narrow screens stack the panel below
  the video. This restores the legacy `#player`/`#slide` arrangement in modern,
  responsive form.
- **Body-editor widget** — the note/pause/cover body uses the **shared lite
  TinyMCE** (`$exeTinyMCE`, `.exe-html-editor`) rather than a plain textarea,
  degrading gracefully when TinyMCE is absent. The runtime stays declarative and
  script-free (ADR-0003 unaffected): TinyMCE is an **edit-time** widget only.

## Amendment — the body field is eXe's own editor, not a bespoke one

Note, pause and cover bodies are edited with the SHARED `$exeTinyMCE`
configuration (`$exeTinyMCE.init('multiple-visible', '#ivDetailBody')`), the same
one the Text, Case study, Form and Rubric iDevices use, pointed at this single
field. An earlier bespoke `tinymce.init` here kept the toolbar small but had no
image button and no file picker, so a note or a cover could not contain an image
at all — something the legacy iDevice could do, through TinyMCE's `image` plugin
and a media-library file picker.

Delegating is what makes an image in an interaction body behave like every other
image in eXe: chosen from the Media Library, stored as an `asset://` reference,
carried through preview, export and `.elpx`. Re-implementing that locally would
mean duplicating the file picker, the asset upload handler and the asset-URL
dialog patches, and drifting from them. The cost is a larger toolbar inside the
interaction panel than the bespoke one had; the editor's own toolbar toggle
collapses it.

The body textarea only exists while an interaction is selected, so the page-wide
`.exe-html-editor` pass has already finished by then and this per-field init is
the hook — the same pattern `udl-content` uses.

## References

- SDD-0001 — Interactive Video iDevice refactor.
- PR [#2147](https://github.com/exelearning/exelearning/pull/2147).
- Related: ADR-0002, ADR-0003, ADR-0005.
