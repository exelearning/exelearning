---
id: ADR-2511-02
title: "Share one enhancement step between the editor and exported pages"
status: Proposed
date: 2026-10-06
tracking_issue: 2511
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
  - "@mnunezcedec"
related:
  prs: [2171, 2512]
  changes: [2511-idevice-runtime-contract]
  adrs: [ADR-2511-01]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5-5"
---

# ADR-2511-02: Share one enhancement step between the editor and exported pages

## Context

Shared enhancements are behaviour that libraries add to any content, whatever iDevice
produced it: effects, lightbox links, dialog image sizes, definition lists, math,
Mermaid, code highlighting, ABC notation, tooltips and media players. They are
applied from three places, each with its own list:

- **`$exe.init()`** (`public/app/common/common.js:324` @ `b6c2556c6`) runs once,
  page-wide, on an exported page.
- **`$exeExport.afterIdeviceRendered(node)`** (`exe_export.js:513`) re-runs `$exeFX`
  for a JSON iDevice rendered later (#2170). PR #2512 adds the lightbox and dialog
  sizes there. Its `ADR-2510-01` decides that this hook is the single place where
  shared enhancements reach a rendered iDevice, and that enhancements take a context
  and are idempotent.
- **`loadLegacyExeFunctionalitiesExport()`**, defined twice, identically
  (`ideviceNode.js:3638`, `idevicesEngine.js:2818`). In the editor it re-runs every
  library over the whole page after each save and page load.

`exe_export.js` is not loaded in the workarea (`views/workarea/workarea.njk`), so the
editor cannot call `afterIdeviceRendered()`. The two lists already differ: the editor
runs `$exeGames`, `$exeHighlighter` and `$exeABCmusic` again, and the export hook does
not. Several enhancements derive ids from element positions (`$exe.dl.init`,
`common.js:1070`, and the media boxes before #2512), so running them a second time
produces duplicate ids.

## Problem

Where is the list of shared enhancements defined? How do both hosts apply it to one
iDevice's content? And what does an enhancement have to guarantee to be on that list?

## Decision drivers

- **Editor/export parity.** What an author sees in the editor should be what learners
  get.
- **One place per enhancement.** Adding an enhancement for every iDevice must be one
  change.
- **iDevices stay unaware of the shared libraries** (#2170, `ADR-2510-01`).
- **Repeat-safety.** The same content can be enhanced more than once: page pass, then
  instance pass, then an update.

## Options considered

### Option 1: Keep one list per host

`afterIdeviceRendered()` for exports, `loadLegacyExeFunctionalitiesExport()` for the
editor, documented as two lists to keep in sync.

- Pro: no new shared code.
- Con: they have already drifted. The editor stays page-wide, so it keeps re-running
  every library over unchanged iDevices.

### Option 2: Load `exe_export.js` in the workarea

- Pro: one list.
- Con: `exe_export.js` starts itself on DOM ready, and brings Teacher Mode, the
  search bar, SCORM loading and the box toggles. None of these belong in the
  workarea.

### Option 3: One enhancement step in the host-neutral runtime

`$exe.ideviceRuntime.enhance(context)` lives in the runtime script that both hosts
load after `common.js` (ADR-2511-01). It holds the ordered list, and every entry
accepts a context and is idempotent.

- `afterIdeviceRendered(node)` becomes a wrapper around it.
- `$exe.init()` and the editor's page load call `enhance(document)`.
- The editor calls `enhance(node)` after a save.

- Pro: one list, one order, the same in both hosts. The editor's post-save work
  shrinks to one node.
- Con: every enhancement has to be made context-aware and idempotent before it joins
  the list.

## Evidence

- `exe_export.js:513-520` and PR #2512's diff of the same function.
- `ideviceNode.js:3638-3651` and `idevicesEngine.js:2818-2831`: identical method
  bodies.
- `views/workarea/workarea.njk:31-35`: the workarea loads `common.js`, not
  `exe_export.js`.
- `exe_effects.js:39` (`init(root)`) and `common.js:3040` (`updateLatex(element)`)
  already accept a context.
- Idempotency audit per enhancement:
  [research, "Shared enhancements"](../changes/2511-idevice-runtime-contract/research.md).
- Drupal behaviors apply the same rule, a `context` argument and safe repeated
  attachment: [Drupal JavaScript API](https://www.drupal.org/docs/drupal-apis/javascript-api/javascript-api-overview).

## Decision

We will adopt **Option 3**, extending `ADR-2510-01`:

- `$exe.ideviceRuntime.enhance(context)` holds the only list of shared enhancements,
  in the order of [design §2](../changes/2511-idevice-runtime-contract/design.md).
  Enhancements that rebuild markup come first, and math comes last.
- Every entry takes a context, limits its DOM changes to it, and is idempotent.
  Applying it twice equals applying it once, and no id is derived from a position.
  A registration that has to span the page, such as prettyPhoto galleries, replaces
  its earlier registration.
- An enhancement joins the list only with a test that applies it twice.
- Runtime scripts never call a shared library's page-level initialization.
- `afterIdeviceRendered()` stays as a wrapper, and the two editor methods become one
  `enhance(document)` call.

## Consequences

### Positive

- The editor and exported pages run the same enhancements, in the same order.
- Updates (ADR-2511-01) re-enhance only the changed instance, safely.
- Position-based duplicate ids disappear, which also fixes broken
  `aria-controls` / `href="#…"` references.

### Negative

- Moving each enhancement into the list is real work, done one at a time.
- While the move is in progress, enhancements not yet in the list are still applied
  page-wide.

### Neutral

- `$exeGames` (hangman) stays a page-level entry until it is scoped.

## Risks

- **An enhancement that is not idempotent is added to the list.** Prevented by the
  required test.
- **Ordering regressions**, such as math typeset before effects rebuild their tabs
  (#2197). The order is fixed in one place and covered by a test.

## Validation

- One "apply twice equals once" test per entry: DOM, ids and `$._data` handler
  counts.
- A test that both hosts call `enhance()` with the instance node.
- Playwright: lightbox, effects and math inside a late-rendered Case study.

## Follow-up work

- Add `ADR-2510-01` to `related.adrs` once PR #2512 is merged.
- The migration order of the enhancements is in
  [tasks](../changes/2511-idevice-runtime-contract/tasks.md), step 2.

## References

- Issues #2170, #2197, #2510, #2511
- PR #2171, PR #2512 (`ADR-2510-01`)
- [ADR-2511-01](ADR-2511-01-run-every-idevice-instance-through-one-render-lifecycle.md)
- Change [2511-idevice-runtime-contract](../changes/2511-idevice-runtime-contract/proposal.md)
