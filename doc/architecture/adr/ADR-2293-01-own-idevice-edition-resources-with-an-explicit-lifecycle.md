---
id: ADR-2293-01
title: "Own iDevice edition resources with an explicit lifecycle"
status: Proposed
date: 2026-08-18
tracking_issue: 2293
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
related:
  prs: [2278]
  changes: []
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-fable-5"
---

# ADR-2293-01: Own iDevice edition resources with an explicit lifecycle

## Context

An iDevice editor is a classic script that assigns a single global,
`var $exeDevice = { init, save, addEvents, ... }`. The workarea loads it, calls
`$exeDevice.init(ideviceBody, ...)`, and the script builds its form and binds
its handlers. When the editor closes, `IdeviceNode` sets `$exeDevice = undefined`
at three sites: `loadEditionIdevice()`, `restartExeIdeviceValue()` and
`remove()` (`public/app/workarea/project/idevices/content/ideviceNode.js` @
`64df99f22`).

Nothing else happened at those sites. The edition's handlers, timers and pending
asynchronous callbacks stayed alive, and the edition form was only replaced
later — `ideviceBody.innerHTML = ...` runs inside `exportProcessIdeviceHtml()`
and `exportProcessIdeviceJson()`, after the global has already been cleared.
Anything firing in that window dereferenced `undefined`.

Issue #2271 recorded 15 Sentry issues and 56 events of exactly that shape across
four iDevices. PR #2278 fixed the reported call sites with
`if (!$exeDevice) return;` guards and `$exeDevice?.method()`. Reviewing it,
@ignaciogros observed that the guards treat the symptom: the same pattern exists
in the other edition scripts, and a newly added handler reintroduces the bug.
Issue #2293 asks for the lifecycle fix.

## Problem

How should an iDevice edition own the resources it creates, so that none of them
can run after the edition has been closed — and so that a new iDevice can be
opened without inheriting anything from the previous one?

## Decision drivers

- **Correctness beyond the reported crashes.** Guarding a call site stops a
  `TypeError`; it does not stop the wrong iDevice being mutated.
- **Genericity.** 55 edition scripts exist and more are added over time. The fix
  must not be a list of guarded call sites.
- **Blast radius.** Edition scripts are legacy, lightly typed, and only partly
  covered by tests. A change that rewrites all of them is riskier than the bug.
- **No new runtime dependencies.** The workarea ships as a bundle plus classic
  scripts; `AbortController` is already used in `public/app/yjs/` and
  `public/app/rest/`.
- **Precise removal.** Edition scripts bind handlers to `document` and `window`,
  which are shared with the rest of the application. Teardown must not remove
  anything it does not own.

## Options considered

### Option 1: Keep adding per-call-site guards (the #2278 approach)

Continue with `if (!$exeDevice) return;` in every handler.

Pros: tiny, local, already proven to remove the user-facing errors.

Cons: does not scale to 55 scripts; every new handler is a new opportunity to
forget; and, decisively, it does not fix the dangerous case. When a stale
callback runs, the global usually holds a *valid* object — the iDevice the user
just opened. The guard passes and the callback drives the wrong instance.

### Option 2: Remove the edition form DOM before clearing the global

The approach suggested in the issue. `IdeviceNode` unbinds the form with jQuery
(which, unlike native removal, also drops jQuery's event and data registry for
the subtree) before releasing `$exeDevice`.

Pros: small, central, kills every form-local handler at once — the large
majority of what edition scripts bind.

Cons: incomplete on its own. It does not touch handlers bound to `document`,
`window` or elements outside the form; it does not cancel timers; and it does
not stop a pending `FileReader`, image load or player callback.

### Option 3: An explicit lifecycle object owning the edition's resources

Give every edition instance an `EditionLifecycle`: an identity, an active/
destroying/destroyed state, an `AbortController`, and a registry of disposers.
Edition scripts register timers, listeners, abortable work and third-party
instances through it. `IdeviceNode` disposes it before clearing the global, and
performs the Option 2 form teardown as one step of that sequence.

Pros: covers every resource class; teardown is deterministic and idempotent;
callbacks registered through it are bound to the owning instance, which is what
closes the cross-instance hole; adding a new iDevice has one obvious pattern.

Cons: a new abstraction to learn; migrating the existing scripts is real work.

## Evidence

- The three clearing sites and the absence of any teardown around them:
  `public/app/workarea/project/idevices/content/ideviceNode.js:1646`, `:1767`,
  `:3214` @ `64df99f22`.
- The form is replaced only after the global is cleared:
  `exportProcessIdeviceHtml()` and `exportProcessIdeviceJson()` in the same file
  assign `this.ideviceBody.innerHTML` during `loadInitScriptIdevice('export')`,
  which begins by calling `restartExeIdeviceValue()`.
- jQuery removes its event and data registry for a subtree only when jQuery
  performs the removal (`.remove()`, `.empty()`); native removal leaves the
  registry entries behind — jQuery 3.7.1 documentation for
  [`.empty()`](https://api.jquery.com/empty/) and [`.remove()`](https://api.jquery.com/remove/).
- jQuery event namespaces remove exactly the handlers carrying that namespace
  and leave others on the same target registered —
  [`.off()`](https://api.jquery.com/off/), jQuery 3.7.1.
- `AbortSignal` passed to `addEventListener` removes the listener on abort, for
  any target — [MDN, `AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal).
- TinyMCE 5.10.2 is the bundled version (`public/libs/tinymce_5/js/tinymce`),
  and `editor.remove()` is its documented per-instance teardown.
- `AbortController` already ships in the frontend: `public/app/rest/SSEClient.js:152`,
  `public/app/yjs/AssetWebSocketHandler.js:1248`.
- Audit of all 55 edition scripts plus the shared edition helpers for this
  change: the resources that can outlive a form are timers, `document`/`window`
  handlers, and asynchronous callbacks; form-local handlers die with the form.

## Decision

We will adopt **Option 3, with Option 2 as one of its steps**.

`EditionLifecycle`
(`public/app/workarea/project/idevices/content/editionLifecycle.js`) owns the
resources of one edition instance. `IdeviceNode.initExeDeviceEdition()` creates
one and publishes it as `$exeDevice.$lifecycle` and `window.$exeEditionLifecycle`
before calling `$exeDevice.init(...)`. All three clearing sites now call one
`IdeviceNode.destroyEditionInstance()`, which:

1. stops the initialization poll;
2. disposes the lifecycle — marking it inactive first, then cancelling timers and
   aborting the signal, running the iDevice's optional `destroyEdition()` hook
   while its instance and DOM are still available, running registered disposers
   in reverse order, and removing jQuery handlers by the edition's own namespace;
3. removes the TinyMCE editors whose target is inside the form, while those
   targets are still in the document;
4. unbinds the edition form through `jQuery.cleanData`, dropping its event and
   data registry while leaving the markup on screen until the export view
   replaces it;
5. clears `$exeDevice`, last.

Callbacks registered through the lifecycle are bound to the device that owned it,
so a callback created by edition A can never operate on edition B.

Edition scripts are migrated for the resources that can actually outlive a form —
timers, handlers on shared targets, asynchronous callbacks and third-party
instances. Form-local handlers are deliberately **not** rewritten: step 4 already
removes them, and rewriting roughly a thousand of them would be a far larger
change than the defect. The #2278 guards are kept.

## Consequences

### Positive

- Use-after-destroy and cross-instance callbacks are both structurally
  prevented, not merely guarded against.
- One teardown path instead of three ad-hoc ones.
- Teardown is idempotent and survives a failing disposer, so a cleanup bug
  cannot strand the application with a half-destroyed editor.
- New iDevices get one documented pattern for events, timers and disposal.

### Negative

- A new abstraction that iDevice authors must learn.
- Two access paths (`this.$lifecycle` and `window.$exeEditionLifecycle`) exist,
  because the shared edition helpers run outside the device object.

### Neutral

- `isSync` keeps its meaning: a synchronized reload deliberately preserves the
  open editor, so teardown does not run there.
- Guards added by #2278 stay. They are now redundant in the paths the lifecycle
  covers, but they are harmless and still protect scripts as they are migrated.

## Risks

- **Migration coverage.** A resource missed during the audit stays leaked. Low
  severity — the behaviour is no worse than before the change.
- **Over-eager teardown.** Emptying the form at the wrong moment would destroy
  data the editor still needs. Mitigated by ordering: `$exeDevice.save()` runs in
  `saveIdeviceProcess()` before `loadInitScriptIdevice('export')` reaches
  `restartExeIdeviceValue()`, and by the `isSync` exemption.
- **Test harness drift.** Edition tests load scripts directly, so they need a
  lifecycle too; `global.loadIdevice` attaches a real one.

## Validation

- Unit tests for the lifecycle itself, exercising real jQuery 3.7.1, a real
  `AbortController` and Vitest fake timers, including the regression that a
  callback from edition A reaches neither A nor B.
- Unit tests for `IdeviceNode` teardown ordering, idempotency and every close
  path.
- Per-iDevice tests for each migrated resource.
- A Playwright spec covering edit → save, discard, delete and open A → open B,
  asserting no page errors.

## Follow-up work

- Migrate any resource class discovered later to the lifecycle rather than
  adding a new guard.
- Consider removing the #2278 guards once every affected script is migrated and
  covered; they are intentionally left in place for now.

## References

- Issue #2271 — iDevice edition handlers crash when `$exeDevice` is already cleared
- Issue #2293 — Fix iDevice edition teardown globally before clearing `$exeDevice`
- PR #2278 — `fix(idevices): guard edition event handlers against cleared $exeDevice`
- [Review comment by @ignaciogros](https://github.com/exelearning/exelearning/pull/2278#pullrequestreview-4950086204)
- [jQuery `.off()`](https://api.jquery.com/off/), [`.empty()`](https://api.jquery.com/empty/), [`.remove()`](https://api.jquery.com/remove/)
- [MDN — `AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)
- [TinyMCE 5 — `editor.remove()`](https://www.tiny.cloud/docs/tinymce/5/apis/tinymce.editor/#remove)
