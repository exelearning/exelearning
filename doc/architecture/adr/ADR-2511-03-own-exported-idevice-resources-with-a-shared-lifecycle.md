---
id: ADR-2511-03
title: "Own exported iDevice resources with a lifecycle shared with editions"
status: Proposed
date: 2026-10-06
tracking_issue: 2511
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
  - "@mnunezcedec"
related:
  prs: [2301]
  changes: [2511-idevice-runtime-contract]
  adrs: [ADR-2293-01, ADR-2511-01]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5-5"
---

# ADR-2511-03: Own exported iDevice resources with a lifecycle shared with editions

## Context

[ADR-2293-01](ADR-2293-01-own-idevice-edition-resources-with-an-explicit-lifecycle.md)
gave every iDevice **edition** an `EditionLifecycle`
(`public/app/workarea/project/idevices/content/editionLifecycle.js`). The lifecycle
owns the edition's timers, shared-target handlers, observers, players and pending
reads, and releases them before `$exeDevice` is cleared.

The **runtime** side has no counterpart. The editor replaces rendered instances
constantly: after a save, on a page change, and on a remote edit. Nothing releases
what the previous render started. The survey
([research](../changes/2511-idevice-runtime-contract/research.md)) finds:

- game clocks (`setInterval`);
- ResizeObservers on the page container, in 22 games, through
  `gamification.observers.observeResize()`;
- `document`/`window` handlers, some without a namespace;
- YouTube players and `requestAnimationFrame` loops;
- SCORM registrations. `exe-scorm12-activities.js:595` defines `unregister`, but
  nothing calls it.

Only three-sixty-viewer and the three-d-viewer runtime release their own resources.
The one shared cleanup, `observers.observersDisconnect()` (`common.js:3804`), runs
only when the node's `mode` attribute changes in the editor.

On an exported page, instances are rendered once. They are not removed today, but
ADR-2511-01 lets an instance re-render and update itself, and the editor shows the
same runtime.

## Problem

What releases an iDevice instance's runtime resources when its content is removed or
rendered again? And how do runtime scripts register those resources without a second
API to learn?

## Decision drivers

- **Same guarantees as editions**: no use-after-destroy, no callback acting on a
  later instance, idempotent teardown that survives a failing disposer.
- **One API to learn.** Authors already use `$lifecycle` in edition scripts.
- **Exports can run it.** Classic script, no bundler. Exported pages do not load the
  workarea bundle.
- **Precise removal.** Only what the instance owns is released; page-scoped resources
  survive.

## Options considered

### Option 1: An optional `destroyRuntime` hook only

Each export object releases its own resources in `destroyRuntime(ideviceId, node)`.

- Pro: smallest change.
- Con: every iDevice writes its own cleanup, which is the per-site pattern
  ADR-2293-01 rejected. A forgotten timer leaks silently. It gives no protection
  against stale callbacks.

### Option 2: Detect removal with a `MutationObserver`

Watch for removed `.idevice_node` elements and clean up afterwards, as
`common_edition.js:2041` (`cleanupDetachedInstances`) does for editions.

- Pro: no host changes.
- Con: it runs after the DOM is gone, so the hook cannot read it. It does not cover
  an instance rendered again in place. It still needs a registry of what to release.

### Option 3: A resource lifecycle per instance, shared with editions

- A classic-script `ResourceLifecycle` implements the resource API of ADR-2293-01:
  `setTimeout`, `setInterval`, `on`, `addEventListener`, `signal`, `own`,
  `ownInstance`, `ownMedia`, `ownFileReader` and `readFile`. It ships in the runtime
  script that both hosts load (ADR-2511-01).
- Each instance gets one through `$exe.ideviceRuntime.lifecycle(node)`, held in a
  `WeakMap`.
- Hosts call `$exe.ideviceRuntime.destroy(node)` before they remove or re-render an
  instance:
  1. it dispatches `exe-idevice-destroy`;
  2. it calls the optional `destroyRuntime` hook;
  3. it disposes the lifecycle;
  4. it drops jQuery's data registry for the subtree.
- `EditionLifecycle` delegates its registry to the same implementation.

- Pro:
  - every resource class is covered;
  - the two lifecycles share the same API and semantics;
  - the shared gamification helpers can register on the game's behalf, so most games
    need no change of their own.
- Con:
  - a second consumer of the lifecycle code;
  - `EditionLifecycle` has to be refactored without changing its behaviour.

## Evidence

- `editionLifecycle.js` @ `b6c2556c6`: the resource API and its invariants
  (namespace per instance, bound callbacks, reverse disposal, `readFile()` always
  settling).
- `common.js:1428-1440`: `reportActivity()` registers every game with the SCORM
  registry. `exe-scorm12-activities.js:595`: `unregister` has no caller.
- `common.js:3777` (`observeResize`) and `common.js:3804-3843`
  (`observersDisconnect`).
- `three-sixty-viewer/export/three-sixty-viewer.js:1210-1244`: dispose before
  re-render, `destroyAll` and `pagehide`. This is what the contract generalizes.
- `three-d-viewer-runtime.js:289` and SimpleLightbox already use `destroy` with other
  meanings. No export object uses `destroyRuntime`.
- `idevicesEngine.js:1700-1716`: the editor reloads the page after remote edits,
  because runtimes cannot be torn down per instance (#2434).

## Decision

We will adopt **Option 3**:

- Every resource an instance creates that can outlive its node is owned by
  `$exe.ideviceRuntime.lifecycle(node)` or released in the instance's
  `destroyRuntime(ideviceId, node)` hook
  ([spec §7](../changes/2511-idevice-runtime-contract/spec.md)). Handlers inside the
  node need nothing.
- Hosts call `destroy(node)` before removing or rendering an instance again. In the
  editor, that is wherever `destroyEditionInstance()` is called today, and before
  `generateContentExportView()` replaces a body. `destroy(node)` is idempotent and
  survives failing disposers.
- `ResourceLifecycle` is the single implementation of the resource API.
  `EditionLifecycle` keeps what is specific to editions (active slot, owner node,
  `destroyEdition`) and delegates its registry to it.
- The gamification helpers own the SCORM registration, the resize observers and the
  clock through the instance lifecycle.
- Page-scoped resources (one per page, behind a guard, such as the lomloe tooltip
  or slide's `document` wiring) are not owned by any instance, and survive instance
  teardown. This keeps the exception ADR-2293-01 made for lomloe.

## Consequences

### Positive

- The editor stops accumulating timers, observers, players and SCORM registrations
  across saves and page changes.
- One API for editions and runtimes, with the same guarantees.
- Per-instance teardown is the second prerequisite, with ADR-2511-01, for
  re-rendering one instance after a remote edit instead of reloading the page
  (#2434).

### Negative

- `EditionLifecycle` has to be refactored to delegate. Its existing tests guard the
  refactor.
- A runtime script cannot use `this.$lifecycle`, because one export object serves
  every instance of its type. It has to look up the lifecycle by node.

### Neutral

- On an exported page that never re-renders, teardown never runs; `pagehide`
  handlers such as three-sixty-viewer's remain the iDevice's own choice.
- Resources not registered are no worse off than today.

## Risks

- **Over-eager teardown** of a page-scoped resource. Mitigated by R2.4 and the guard
  pattern, and tested with two instances where one is destroyed.
- **Refactor regressions in editions.** Mitigated by keeping the `EditionLifecycle`
  test suite unchanged.
- **Missed resources in a migrated iDevice.** Same low severity as in ADR-2293-01.
  The contract test helper checks that no fake timer and no `document`/`window`
  listener remains after `destroy()`.

## Validation

- `ResourceLifecycle` runs the `EditionLifecycle` invariants tests.
- `destroy()` tests: order, idempotency, a failing disposer, and the event fired
  while the DOM is intact.
- Per-iDevice contract tests as each one adopts the lifecycle.
- Playwright in the editor: save a game with a clock twice; one clock runs
  afterwards.

## Follow-up work

- Migration order: [tasks](../changes/2511-idevice-runtime-contract/tasks.md), steps
  3–6.
- Extend the runtime leak sentinel proposed in ADR-2293-01 to `destroy()`.

## References

- Issues #2271, #2293, #2434, #2511
- PR #2301
- [ADR-2293-01](ADR-2293-01-own-idevice-edition-resources-with-an-explicit-lifecycle.md),
  [ADR-2511-01](ADR-2511-01-run-every-idevice-instance-through-one-render-lifecycle.md)
- Change [2511-idevice-runtime-contract](../changes/2511-idevice-runtime-contract/proposal.md)
- [MDN — `AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)
