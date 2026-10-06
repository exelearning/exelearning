---
tracking_issue: 2511
title: "iDevice runtime contract"
status: in-review
date: 2026-10-06
authors:
  - "@erseco"
reviewers:
  - "@ignaciogros"
  - "@mnunezcedec"
implementation_prs: []
related_adrs:
  - ADR-2293-01
  - ADR-2510-01
  - ADR-2492-01
  - ADR-2511-01
  - ADR-2511-02
  - ADR-2511-03
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5-5"
---

# iDevice runtime contract — proposal

## Motivation

An iDevice's runtime script (its *export object*, `window['$' + type]`) and the
shared libraries that enhance a page (`$exe`, `$exeFX`, the lightbox, MathJax,
media players, SCORM…) have no written agreement on who renders what, when, or for
how long it lives. Each iDevice decides on its own when its markup exists, and each
shared library guesses when to look for it.

The cost is a family of bugs fixed one at a time, each with a local hook:

| Issue | Symptom | Local fix |
|---|---|---|
| #2170 | Effects inside a Form iDevice not initialized on export | `$exeExport.afterIdeviceRendered()` re-runs `$exeFX` for the node |
| #2510 | `rel="lightbox"` links inside a Case study do nothing | Same hook re-binds prettyPhoto (PR #2512, `ADR-2510-01`) |
| #2271 / #2293 | Edition handlers and timers crash on a cleared `$exeDevice` | `EditionLifecycle` ([ADR-2293-01](../../adr/ADR-2293-01-own-idevice-edition-resources-with-an-explicit-lifecycle.md)) |
| #2428 / #2434 | A collaborator's new iDevice is not fully rendered; running the post-render hooks for it alone breaks the other iDevices on the page | The editor reloads the whole page instead of one iDevice |

The pieces exist — `renderView` / `renderBehaviour` / `init`, `afterIdeviceRendered()`,
`EditionLifecycle` — but nobody wrote them down as one contract. So every new iDevice
and every new shared enhancement can reintroduce the same timing and teardown
defects, and reviewers have nothing to check them against.

## Problem

There is no single, documented answer to four questions that every runtime script
and every shared library has to answer:

1. **Order.** What may each runtime step assume about the DOM, and what happens when
   an iDevice rebuilds its own markup later?
2. **Enhancement.** Where and how do shared enhancements reach content that an iDevice
   rendered after the page loaded?
3. **Readiness.** How does other code (print, search highlighting, a theme, a test)
   learn that an iDevice has finished rendering, without guessing a delay?
4. **Teardown.** What releases an exported iDevice's timers, listeners, observers,
   players and SCORM registration when its content is removed or rebuilt — which the
   editor does on every save, page change and remote edit?

A solution is acceptable only if every question has one answer that is the same in
the editor and in an exported page.

## Scope

In scope:

- The runtime lifecycle of one iDevice instance, in both hosts that drive it: the
  export runtime (`public/app/common/exe_export.js`) on exported and preview pages,
  and the workarea (`IdeviceNode` / `IdevicesEngine`) in the editor.
- The step where shared enhancements are applied, and the requirements an
  enhancement has to meet (accept a context, be idempotent).
- A ready signal for one instance.
- Export-side teardown, the counterpart of ADR-2293-01.
- An incremental adoption plan, starting with the JSON iDevices that render their
  markup at runtime (`jsonOnlyIdevices` in `exe_export.js`).

## Goals

- One written contract that a reviewer can check a runtime script or a shared
  enhancement against ([spec](spec.md)).
- Shared enhancements reach late-rendered content through one step, in both hosts.
- Readiness is an event, not a delay.
- Removing or rebuilding an instance releases what it created.
- Content that works today keeps working, including legacy ELP content and iDevices
  that never adopt the contract.

## Non-goals

- Rewriting the existing iDevices in one go. Adoption is per iDevice and incremental
  ([tasks](tasks.md)).
- Changing the stored data format of any iDevice, or the HTML that is saved and
  exported.
- Changing the edition lifecycle of ADR-2293-01, beyond sharing its resource
  registry.
- Converting the HTML-type games to per-node initialization. The contract says what
  they have to do to adopt it; doing it is later work.
- A public API for third parties. The contract binds eXeLearning's own iDevices,
  themes and shared libraries.

## Documents

- [spec.md](spec.md) — the contract: normative requirements and scenarios.
- [design.md](design.md) — how the two hosts and a shared runtime script implement it.
- [research.md](research.md) — survey of the 53 base iDevices and the shared libraries.
- [tasks.md](tasks.md) — the phased adoption plan.

Durable decisions:

- [ADR-2511-01](../../adr/ADR-2511-01-run-every-idevice-instance-through-one-render-lifecycle.md) — one render lifecycle per instance, ending in a DOM event.
- [ADR-2511-02](../../adr/ADR-2511-02-share-one-enhancement-step-between-editor-and-export.md) — one enhancement step in the shared runtime script, shared by both hosts.
- [ADR-2511-03](../../adr/ADR-2511-03-own-exported-idevice-resources-with-a-shared-lifecycle.md) — export-side teardown through a shared resource lifecycle.

[ADR-2510-01](../../adr/ADR-2510-01-apply-shared-enhancements-after-idevice-render.md) (PR #2512) decides that `afterIdeviceRendered()` is where
shared enhancements reach a rendered iDevice. ADR-2511-02 builds on it.
