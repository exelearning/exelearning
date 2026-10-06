---
id: ADR-2511-01
title: "Run every iDevice instance through one render lifecycle that ends in a DOM event"
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
  adrs: [ADR-2293-01, ADR-2492-01]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5-5"
---

# ADR-2511-01: Run every iDevice instance through one render lifecycle that ends in a DOM event

## Context

An iDevice's runtime script defines an export object with up to three methods:
`renderView`, `renderBehaviour` and `init`. Two hosts call them, each with its own
code.

- **The export runtime** (`public/app/common/exe_export.js` @ `b6c2556c6`,
  `initJsonIdevice()` and `renderWithTemplate()`):
  - calls the methods with no `ideviceId` argument;
  - wraps no phase in `try`;
  - ignores what `init` returns;
  - adds the `loaded` class as soon as `init` returns.
- **The editor** (`IdeviceNode.exportProcessIdeviceJson()`, `ideviceNode.js:1952`)
  calls the same methods with an extra `ideviceId` argument and its own mounting.

Nothing tells other code that an instance has finished rendering:

- Print, search highlighting and the `post-js` class wait a fixed 200 ms
  (`exe_export.js:31,64-78`).
- Shared libraries ran before late markup existed. That is how #2170 (effects) and
  #2510 (lightbox) happened.
- Several runtime scripts keep working after `init` returns: three-d-viewer,
  image-gallery, magnifier and form. `loaded` is set before they finish.
- `slide` is the only one that returns a promise, and nobody waits for it
  ([research](../changes/2511-idevice-runtime-contract/research.md)).

Most runtime scripts act on every instance on the page instead of their own: the
games, casestudy, scrambled-list and image-gallery. As a result, the editor cannot
render one instance again without breaking the others, so it reloads the whole page
after a remote edit (#2434).

## Problem

Which steps does an iDevice instance go through when it is rendered, in what order
and under what guarantees? And how does other code learn, without guessing a delay,
that an instance has finished?

## Decision drivers

- **Correct whatever the timing.** Templates are fetched, scripts are loaded and
  models are booted asynchronously.
- **One behaviour in both hosts.** An iDevice must not render differently in the
  editor and in an export.
- **Unchanged legacy runtimes keep working.** No stored data or saved HTML changes.
- **One instance's failure is contained.** A failure must not stop the other
  instances on the page, and must not leave code waiting forever.
- **No new dependencies.** Classic scripts, shipped to static exports and ePub.

## Options considered

### Option 1: Promise-only API

`$exeExport.whenIdeviceRendered(node)` returns a promise.

- Pro: easy to await.
- Con: only code that knows the runtime object can use it. `exe_export.js` is not
  loaded in the editor. A promise also resolves only once, so it cannot report the
  updates an instance makes later (the next question, a restart).

### Option 2: Event fired right after `init` returns

Dispatch an event where `loaded` is added today.

- Pro: smallest change.
- Con: it is wrong for every asynchronous runtime. It moves the current 200 ms guess
  inside each instance instead of removing it.

### Option 3: One lifecycle driver, async-aware, announcing with a DOM event

- One host-neutral implementation runs the phases for both hosts:
  view → mount → behaviour → init → enhance → rendered. It runs each phase in
  `try`, passes `ideviceId` to every phase, and waits for a thenable from `init`
  under a timeout.
- It always ends with `loaded` and a bubbling `exe-idevice-rendered` event whose
  `status` is `ok`, `error` or `timeout`.
- A runtime script that rebuilds its own markup calls
  `$exe.ideviceRuntime.rendered(node, 'update')`, which fires the same event with
  `reason: update`.
- The page fires `exe-idevices-rendered` once every instance present at load has
  rendered.

- Pro:
  - any code can listen, with no reference to the runtime, and a theme can too;
  - updates are covered;
  - sync runtimes need no change;
  - a failing or hung instance still ends its render, so listeners never hang.
- Con:
  - a new runtime file to ship;
  - asynchronous runtimes must return a promise to benefit;
  - the timeout is a heuristic.

## Evidence

- `exe_export.js` @ `b6c2556c6`:
  - `renderWithTemplate()` and `initJsonIdevice()` call the phases with no `try`;
  - `init`'s return value is discarded;
  - `loaded` is added synchronously;
  - `delayLoadingPageTime: 200` gates print and search highlighting.
- `ideviceNode.js:1963-1978` passes `this.odeIdeviceId` as an extra argument, and
  `exe_export.js` never does.
- `slide/export/slide.js:128,205` returns `Promise.resolve()` from
  `renderBehaviour`. No other export object returns a promise.
- `trueorfalse/export/trueorfalse.js:720` listens for a `questionsReady` event that
  nothing triggers. That is evidence of the need, and of an ad hoc attempt at a
  ready signal.
- Survey of all 53 base iDevices: [research](../changes/2511-idevice-runtime-contract/research.md).
- [`CustomEvent()`](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent),
  MDN.

## Decision

We will adopt **Option 3**. The contract is specified in
[spec §2–§6](../changes/2511-idevice-runtime-contract/spec.md). In short:

- An instance is identified by its component id, passed as `data.ideviceId` and as
  the last argument of every phase. Everything unique per instance derives from it,
  generalizing [ADR-2492-01](ADR-2492-01-keep-saved-idevice-games-under-their-component-id.md).
  A phase acts only on its own instance.
- `renderView` returns HTML and has no side effects; only the host mounts markup.
  `renderBehaviour` binds to the mounted markup and never replaces it. `init` may
  return a promise.
- One implementation, `$exe.ideviceRuntime.run()`, drives the phases in both hosts.
  Each instance has its own error boundary and a 10 s default timeout.
- Every render and every self-update ends with `loaded` and exactly one
  `exe-idevice-rendered` event. Late listeners check `loaded` first.
- Page-level work waits for `exe-idevices-rendered`, not for a delay.

HTML-type iDevices that start themselves page-wide stay outside the driver until
they adopt it (spec R8.2).

## Consequences

### Positive

- Shared libraries, print, search and tests have one signal that is correct for
  asynchronous runtimes.
- One failing iDevice no longer stops the other instances of its type.
- The editor and exports render an instance the same way. That is the prerequisite
  for rendering one instance again instead of reloading the page (#2434).
- Reviewers have a written contract to check runtime scripts against.

### Negative

- Asynchronous runtimes have to return a promise to get an accurate signal. Until
  they do, their event is as early as `loaded` is today.
- Page-level work can start later than 200 ms on a page whose templates are slow to
  load. This is intended, but it is visible.
- One more script ships with every export.

### Neutral

- The `loaded` and `loading` classes keep their names and CSS meaning. Only the
  moment `loaded` is set changes.
- `$exeExport.afterIdeviceRendered()` remains as a wrapper (ADR-2511-02).

## Risks

- **Hung promise.** Bounded by the timeout. The event reports `status: timeout`.
- **Listeners doing heavy work on every update.** The event carries `reason` so that
  listeners can ignore updates.
- **Name collisions.** No existing event uses the `exe-idevice-` prefix (research,
  "Events and observers that already exist").

## Validation

- Unit tests for the driver:
  - order and arguments;
  - sync and async `init`;
  - a throw and a rejection;
  - the timeout;
  - exactly one event per render and per update;
  - the page event.
- `exe_export.test.js` and the `IdeviceNode` tests use the driver.
- Playwright on an exported page: the Case study lightbox works, and the events fire
  (spec scenario 1).

## Follow-up work

- Adoption per iDevice, as in [tasks](../changes/2511-idevice-runtime-contract/tasks.md).
- HTML-type games: a per-node entry point in `initGame()` (separate issue).

## References

- Issue #2511 — Define the iDevice runtime contract
- Issues #2170, #2434, #2510
- PR #2171, PR #2512
- [ADR-2293-01](ADR-2293-01-own-idevice-edition-resources-with-an-explicit-lifecycle.md),
  [ADR-2492-01](ADR-2492-01-keep-saved-idevice-games-under-their-component-id.md)
- Change [2511-idevice-runtime-contract](../changes/2511-idevice-runtime-contract/proposal.md)
