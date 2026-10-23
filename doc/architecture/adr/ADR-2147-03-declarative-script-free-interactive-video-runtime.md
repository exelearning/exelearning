---
id: ADR-2147-03
title: "Declarative, script-free learner runtime for Interactive Video"
status: Proposed
date: 2026-07-09
tracking_issue: 2147
legacy_id: ADR-0003
deciders:
  - "@erseco"
reviewers:
  - "@mnunezcedec"
  - "@cristinavaldera"
related:
  prs: [2147]
  changes: ["2147-interactive-video-refactor"]
  adrs: [ADR-2147-02, ADR-2147-04]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-2147-03: Declarative, script-free learner runtime for Interactive Video

## Context

The legacy learner runtime (~3200 lines) was self-booting: it re-parsed a JSON
island from the DOM, loaded `youtube.com/iframe_api` and jwplayer as external
`<script>`s, drove a nested cross-origin `YT.Player` **synchronously**, and
polled `getCurrentTime()` on a 500 ms `setInterval`. Under eXeLearning's emerging
**opaque-origin** serving model, exported content cannot rely on external scripts
or synchronous cross-origin control without `allow-same-origin`, and injecting
author-provided executable JavaScript is a security liability.

## Problem

How should the learner activity be rendered and driven at runtime so it is
secure, testable, export-stable and compatible with a future sandbox?

## Decision drivers

- Security: no author-provided executable JS, no external provider `<script>` in
  exports.
- Future sandbox compatibility (opaque origin).
- Determinism and testability.
- Export stability (no network SDK dependency at view time).

## Options considered

### Option 1: Keep the self-booting, SDK-loading, polling runtime

Pros: no rewrite. Cons: external scripts and synchronous cross-origin control
break under an opaque sandbox; `eval`-based loading and `setInterval` polling are
fragile; hard to test.

### Option 2: Declarative, script-free runtime rendered from JSON

A fixed, shipped runtime (`renderView` + `renderBehaviour`) renders escaped HTML
from the versioned JSON and schedules interactions from `timeupdate` events. No
author JS is evaluated; no provider SDK `<script>` is emitted. Pros: secure,
deterministic, testable, sandbox-ready. Cons: every interaction must be
represented as data and implemented by trusted runtime code.

## Evidence

- New runtime: `public/files/perm/idevices/base/interactive-video/export/interactive-video.js`
  — `renderView` (declarative HTML) + `renderBehaviour` (event-driven scheduler
  fed by the provider adapter's time events); author content is escaped;
  interaction bodies come from the JSON, not evaluated code.
- No provider SDK in exports: the runtime embeds providers via canonical
  privacy-enhanced iframes and drives them over raw postMessage (see ADR-2147-04),
  never `youtube.com/iframe_api` or any provider `<script>`.
- Grading is pure and in the shared core (`gradeSingleChoice`,
  `gradeMultipleChoice`, `gradeDropdown`, `gradeCloze`, `gradeMatchElements`,
  `gradeSortableList`, `gradeTrueFalse`), covered by
  the colocated `src/**/*.spec.ts` suites. Exact
  commands and counts are re-verified at the final review commit of PR #2147.

## Decision

We will render the learner activity from **declarative JSON** with a fixed,
shipped runtime and **no author-provided executable JavaScript** and **no
external provider `<script>`** in exported content. Timing is event-driven
(native `timeupdate` for local video; the provider's official embed message
events for external embeds — see ADR-2147-04), not polled. All interaction behavior
is implemented by trusted runtime code and represented in data.

**Scope.** This guarantee constrains **exported content**. It is preserved by
driving external embeds through the providers' raw postMessage wire protocols
rather than loading their SDK scripts. Editor-context provider integration (the
workarea "Use current time" flow) is out of this ADR's scope; it may use richer
provider APIs without weakening the export guarantee.

## Consequences

### Positive

- Secure and sandbox-ready; deterministic; testable; export-stable (no SDK
  network dependency at view time).

### Negative

- New interaction kinds require runtime code (they cannot be expressed as author
  scripts).

### Neutral

- In non-opaque contexts, external embeds are **paused** and questions are
  surfaced at their timestamps via validated provider postMessage events (the
  runtime consumes the ADR-2147-04 adapter's time events). The accessible timeline
  list remains as an accessible complement and as the offline/degraded fallback
  (e.g. `file:` exports or a provider in a degraded state).

## Risks

- A trusted-runtime bug affects all activities. Mitigated by pure, unit-tested
  grading/scheduling and E2E coverage.

## Validation

- Runtime tests assert declarative render output and grading for each kind, plus
  external-embed pause and question firing at timestamps via simulated provider
  postMessage events.
- E2E asserts the runtime renders accessible markers and embeds external video
  inline without a provider SDK, and that workarea Preview of an external-provider
  activity pauses and shows a question. Exact commands and counts are re-verified
  at the final review commit of PR #2147.

## Follow-up work

- The non-opaque timed-interaction path ships now via the provider adapter
  (ADR-2147-04). Only **opaque-mode** playback still needs the parent bridge once
  `exe_media_policy` / `exe_media_bridge` land (PR #1968).

## Amendment — multiple instances per page (id namespacing)

The legacy iDevice hard-capped **one interactive video per page** (the
`onlyOne` message "Only one interactive video per page."), because its runtime
booted from top-window globals and shared DOM state. The declarative runtime is
already **per-instance**: state lives in `this.instances[<ideviceId>]`, the
container is `#exe-iv-<ideviceId>`, and every behaviour/grading query is scoped
to `instance.root`. That cap is therefore retired — several interactive-video
iDevices may coexist on one page.

One refinement is required to make coexistence robust. Interaction ids
(`iv-0`, `iv-cover`, …) are only unique **within a document**, and the runtime
uses them to build the question controls' `id` / `name` / `for` / `aria-*`
attributes. Two instances would emit duplicate `id`s (breaking `<label for>`
across instances) and — worse — share radio-group `name`s (so answering one
video could clear another's selection). The runtime now **namespaces those
attribute values with the instance id** via `_scopeId(ns, id)`, threaded through
`_renderInteractionBody` → `_renderQuestion` → each kind renderer. Per-instance
**state keys stay the raw interaction id** (`recordResult`, `seen`, `consumed`,
the results-table `data-iv-result`), since that state is already isolated per
instance. Direct-render callers (unit tests, legacy fallbacks) pass no `ns` and
keep the raw ids.

Validated by the colocated `src/export/*.spec.ts` suites (a `multi-instance id
namespacing` suite: `_scopeId`, per-kind namespaced controls, distinct radio
`name`s, raw-id fallback, and two firing instances grading independently) and by
the E2E test "supports more than one interactive-video iDevice on the same
page".

## References

- the change design — Interactive Video iDevice refactor.
- PR [#2147](https://github.com/exelearning/exelearning/pull/2147).
- Related: ADR-2147-02, ADR-2147-04.
