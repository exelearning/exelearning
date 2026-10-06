---
id: ADR-2510-01
title: "Apply shared enhancements to each iDevice after it renders"
status: Proposed
date: 2026-10-06
tracking_issue: 2510
deciders:
  - "@ignaciogros"
reviewers:
  - "@erseco"
related:
  prs: []
  changes: []
  adrs: [ADR-2293-01]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5-5"
---

# ADR-2510-01: Apply shared enhancements to each iDevice after it renders

## Context

An exported page is enhanced by shared libraries that know nothing about
iDevices: `$exe` (lightbox links, dialog image sizes), `$exeFX` (effects) and
others. `$exe.init()` applies them once, page-wide, when the page loads
(`public/app/common/common.js` @ `b6c2556c6`, `init()` →
`setMultimediaGalleries()` and `setModalWindowContentSize()`).

JSON iDevices do not ship their final markup. `$exeExport` regenerates it on load:
`loadTemplateAndRender()` fetches the template and `renderWithTemplate()` assigns
`ideviceNode.innerHTML` (`public/app/common/exe_export.js` @ `b6c2556c6`). The
fetch is asynchronous, so the assignment lands after the page-wide pass and
replaces the elements that pass enhanced. The new elements have the same markup
and none of the behaviour.

Issue #2170 hit this with effects inside the Form iDevice and introduced
`$exeExport.afterIdeviceRendered(ideviceNode)`, called once per iDevice after
`renderView()`, `renderBehaviour()` and `init()`, but it only re-ran `$exeFX`.
Issue #2510 hits it again with `rel="lightbox"` links (e.g. "Link to a modal
window") inside a Case study: prettyPhoto was bound to the discarded links, so
clicking the new ones does nothing.

The editor already has the equivalent step: `IdeviceNode.loadLegacyExeFunctionalitiesExport()`
re-runs the shared libraries after an iDevice is rendered
(`public/app/workarea/project/idevices/content/ideviceNode.js` @ `b6c2556c6`).

## Problem

Where should a shared enhancement be applied to content an iDevice renders after
the page-wide initialization, so that it works for every iDevice without each one
knowing about the libraries?

## Decision drivers

- **Correctness independent of timing.** The fix must not depend on which of two
  asynchronous paths finishes first.
- **One place per enhancement.** A new shared enhancement, or a new JSON iDevice,
  must not need its own wiring.
- **iDevices stay unaware of the common libraries**, as #2170 established.
- **No behaviour change for content that already works**, including legacy pages
  and prettyPhoto galleries that span several links.

## Options considered

### Option 1: Each iDevice re-runs the enhancements it needs

Every export script calls `$exe.setMultimediaGalleries()` (and the rest) at the
end of its `init()`.

- Pro: no change to the shared code.
- Con: every export script must remember it, and every new enhancement means editing all
  of them. A forgotten call reproduces #2510 silently.

### Option 2: Delay the page-wide pass until every iDevice has rendered

`$exe.init()` waits for `$exeExport` to report that all JSON iDevices are done.

- Pro: one pass, as today.
- Con: couples `common.js` to the export runtime, delays every page for its
  slowest iDevice, and still breaks for content an iDevice re-renders after load.

### Option 3: Apply the enhancements per iDevice in `afterIdeviceRendered()`

Each shared enhancement accepts an optional context node and limits its work to
it; `afterIdeviceRendered()` calls it with the iDevice node. The page-wide call
in `$exe.init()` stays as it is.

- Pro: one hook for every iDevice and one call per enhancement; works whatever
  the order of the two passes; matches what the editor already does.
- Con: an enhancement may run twice on the same content, so each one must be
  idempotent.

## Evidence

- `public/app/common/exe_export.js` @ `b6c2556c6`: `renderWithTemplate()` sets
  `innerHTML` inside the `fetch()` continuation of `loadTemplateAndRender()`.
- Issue #2510: on an exported page, `$._data(link, "events")` is `undefined` for
  the Case study's `a.exe-dialog-link`, and calling `.prettyPhoto()` on it again
  makes the link work.
- `public/app/common/exe_lightbox/exe_lightbox.js`: `$.fn.prettyPhoto` does
  `unbind("click.prettyphoto").bind(...)`, so binding a link again replaces its
  handler instead of adding one; a `rel="lightbox[set]"` gallery is built from
  the links it was bound with.
- Issue #2170: same failure for effects, fixed through `afterIdeviceRendered()`.

## Decision

We will adopt **Option 3**. `afterIdeviceRendered()` is the single place where
shared enhancements are applied to an iDevice's rendered content, and an
enhancement that has to reach that content takes an optional context node.

For #2510 this means:

- `$exe.setMultimediaGalleries(context)` converts the media links inside
  `context` only, and still binds prettyPhoto to every `rel^='lightbox'` link of
  the page, so galleries keep their current members. The ePub gallery fallback
  readers ("See issue #258" in `common.js`) stays in the page-wide call.
- Media-box ids are the first free `media-box-N` instead of the loop index, so a
  second call cannot duplicate an id.
- `$exe.setModalWindowContentSize(context)` limits its image fix to `context`.
- `afterIdeviceRendered()` calls both after `$exeFX.init()`, which may rebuild the
  iDevice markup.

Without a context node, every function behaves as before.

## Consequences

### Positive

- Lightbox links and dialog images work in every JSON iDevice, not only in Case
  study.
- Adding an enhancement for all iDevices is one call in one function.
- The export page and the editor follow the same rule.

### Negative

- Enhancements must be idempotent and accept a context; legacy functions that do
  not have to be adapted before they are registered.
- Content rendered by JSON iDevices is processed twice (page-wide, then per
  iDevice). The cost is a selector query per iDevice.

### Neutral

- The page-wide pass may create hidden media players for links the iDevice later
  replaces. They stay hidden and unused, as they would after any other re-render.

## Risks

- **A non-idempotent enhancement registered in the hook.** Running it twice
  could duplicate markup or handlers. Mitigated by the requirement above and by
  unit tests calling each enhancement more than once.
- **Context-limited binding splitting a gallery.** Avoided by binding prettyPhoto
  page-wide; covered by a unit test.

## Validation

- Unit tests in `public/app/common/common.test.js`: context-limited conversion,
  no duplicate media-box ids across calls, page-wide prettyPhoto binding, ePub
  fallback skipped with a context, and context-limited dialog image fix.
- Unit tests in `public/app/common/exe_export.test.js`: `afterIdeviceRendered()`
  calls the lightbox helpers with the node, after `$exeFX.init()`.
- Manual check on an exported website: a modal-window link inside a Case study
  opens in prettyPhoto.

## Follow-up work

- This hook is one piece of a wider contract between iDevices and the shared
  libraries (render lifecycle, enhancement hook, teardown). A follow-up issue,
  "Define the iDevice runtime contract", is to collect it, together with the
  edition-side lifecycle in ADR-2293-01.
- Review the other page-wide enhancements in `$exe.init()` and register in
  `afterIdeviceRendered()` those that JSON iDevice content can need.

## References

- Issue #2510 — Export: lightbox links inside JSON iDevices (e.g. Case study) don't open in prettyPhoto
- Issue #2170 — FX elements inside Form iDevice work in the editor but fail to generate HTML upon export
- ADR-2293-01 — Own iDevice edition resources with an explicit lifecycle
