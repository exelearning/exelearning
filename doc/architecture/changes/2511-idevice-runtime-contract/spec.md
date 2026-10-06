---
tracking_issue: 2511
title: "iDevice runtime contract — specification"
date: 2026-10-06
authors:
  - "@erseco"
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5-5"
---

# iDevice runtime contract — specification

This is the contract between an iDevice's runtime script, the hosts that drive it and
the shared libraries that enhance its content. **Must**, **must not**, **should** and
**may** are used in the usual sense. Requirements are numbered so that reviews and
tests can cite them (`R3.4`).

The names of the runtime API (`$exe.ideviceRuntime.*`) and of the events are normative.
Where they live and how they are built is in the [design](design.md).

## 1. Terms

- **Host**: the code that places an iDevice instance on a page and drives its runtime.
  There are two:
  - the **export runtime**, `$exeExport` in `public/app/common/exe_export.js`, used by
    exported, preview and static pages;
  - the **editor host**, `IdeviceNode` and `IdevicesEngine` under
    `public/app/workarea/project/idevices/`, which shows the same runtime inside the
    workarea.
- **Runtime script**: an iDevice's export script, which defines its **export
  object** `window['$' + type.replace(/-/g, '')]`.
- **Instance**: one `.idevice_node` element on the page. Its **component id** is the
  element's `id`.
- **Render**: one run of the lifecycle in §3 for one instance.
- **Shared enhancement**: behaviour from a shared library applied to any content,
  whatever iDevice produced it. Examples: effects, lightbox links, dialog image sizes,
  math, Mermaid, code highlighting, ABC notation, tooltips, media players, definition
  lists.
- **Instance lifecycle**: the resource owner of one instance (§7).

## 2. Instance identity and scope

- **R2.1** Hosts identify an instance by its component id. They pass it as
  `data.ideviceId` and as the last argument of every phase in §3.
- **R2.2** A runtime script must derive everything that has to be unique per instance
  from the component id, never from the instance's position on the page. This covers
  DOM ids, storage keys, SCORM activity ids and timer owners. (For saved games,
  [ADR-2492-01](../../adr/ADR-2492-01-keep-saved-idevice-games-under-their-component-id.md)
  already applies this rule.)
- **R2.3** A phase called for one instance must not read, rebuild or bind to the DOM
  of another instance.
- **R2.4** A resource that serves the whole page (one style element, one delegated
  `document` handler shared by every instance of a type) is **page-scoped**. It must
  be installed at most once per page, behind a guard, and it is not owned by any
  instance (§7.6).

## 3. Render lifecycle

- **R3.1** For each render, the host runs these steps in order. Each step runs at most
  once per render, and none starts before the previous one has finished:
  1. **view**: `renderView(data, accessibility, template, ideviceId)`, then the host
     mounts the returned HTML into the node;
  2. **behaviour**: `renderBehaviour(data, accessibility, ideviceId)`;
  3. **init**: `init(data, accessibility, ideviceId)`;
  4. **enhance**: `$exe.ideviceRuntime.enhance(node)` (§5);
  5. **rendered**: the host marks the instance as rendered and announces it (§6).
- **R3.2** The host runs the view step for types that build their markup at runtime,
  and for instances marked `db-no-data`. For every other instance it skips the step
  and keeps the saved markup.
- **R3.3** `renderView` must return an HTML string, or a falsy value to keep the
  current markup. It must not touch the DOM, start timers, bind handlers or load
  scripts. **Only the host mounts markup into the node.**
- **R3.4** `renderBehaviour` may assume that the node's markup is mounted and connected
  to the document. It attaches behaviour to that markup. It must not replace the
  node's whole markup.
- **R3.5** `init` starts the instance's runtime state. It may return a thenable; the
  host waits for it to settle before the enhance step. Any other return value means
  the instance is done.
- **R3.6** The hosts call every phase with the same arguments, and the same
  implementation runs the phases in both. A runtime script must not need to know
  which host is driving it to render correctly.
- **R3.7** A phase that throws, or an `init` promise that rejects, ends that render
  with status `error`. The render still runs the enhance and rendered steps. It must
  not stop any other instance from rendering.
- **R3.8** If `init` has not settled after the render timeout (10 s by default), the
  host continues with status `timeout`. A later settlement is ignored.

## 4. Updates after render

- **R4.1** After it has rendered, an instance may rebuild part of its own markup: the
  next question, a restart, another page of a paginated activity. Once the new markup
  is in place, it must call `$exe.ideviceRuntime.rendered(node, 'update')`. That call
  enhances the node again (§5) and announces the update (§6).
- **R4.2** Before a host renders an instance again (in the editor: after a save, or a
  remote edit), it must tear the previous render down (§7). The new render then
  starts from R3.1.

## 5. Shared enhancements

- **R5.1** Shared enhancements reach an instance only through
  `$exe.ideviceRuntime.enhance(context)`. A runtime script must not call a shared
  library's page-level initialization (`$exe.init()`, `$exeFX.init()`,
  `$exeGames.init()`…) itself.
- **R5.2** The enhancements, and the order they run in, are listed in one place. Both
  hosts use that list. Adding an enhancement for every iDevice is one entry there.
- **R5.3** Every enhancement accepts a context (an element, or the document) and limits
  its DOM changes to it. An enhancement whose registration has to span the page, such
  as prettyPhoto galleries built from every `rel^='lightbox'` link, may register
  page-wide, as long as re-registering replaces its earlier registration instead of
  adding to it.
- **R5.4** Every enhancement is **idempotent**. Applying it twice to the same content
  leaves the same DOM, and the same number of handlers, as applying it once.
  Generated ids must not repeat across calls, so they are never derived from an
  element's position.
- **R5.5** An enhancement that rebuilds markup runs before the enhancements that bind
  to markup.
- **R5.6** `enhance()` may return a promise for asynchronous work, such as loading
  MathJax. The rendered step waits for it, under the same timeout as R3.8.
- **R5.7** At page load, each host runs `enhance(document)` once, for content that is
  not inside a rendered instance. Instances are then enhanced individually, and
  R5.4 makes the overlap harmless.

## 6. Ready signal

- **R6.1** In the rendered step, the host:
  - adds the `loaded` class to the node and removes `loading`;
  - dispatches an `exe-idevice-rendered` `CustomEvent` on the node. The event bubbles
    and is not cancelable. Its `detail` is `{ ideviceId, type, reason, status }`,
    where:
    - `reason` is `render` for a host render and `update` for R4.1;
    - `status` is `ok`, `error` or `timeout`.
- **R6.2** The event fires exactly once per render and once per update call, whatever
  the status. Code waiting for it can never hang.
- **R6.3** Code that starts listening late checks the `loaded` class before it waits
  for the event. `loaded` means that the latest render has reached the rendered step.
- **R6.4** On a page, once every instance present at load has fired its first event,
  the export runtime dispatches `exe-idevices-rendered` on `document`. Work that
  needs the whole page rendered waits for that event, not for a delay. Today that
  work is the print request, search highlighting and the `post-js` class.
- **R6.5** The `detail` carries identifiers only, never learner data or content.

## 7. Teardown

- **R7.1** Before a host removes an instance's node, or renders it again, it calls
  `$exe.ideviceRuntime.destroy(node)`.
- **R7.2** `destroy(node)`, in this order:
  1. dispatches `exe-idevice-destroy` on the node, which bubbles, while the instance's
     DOM is still intact;
  2. calls the export object's optional `destroyRuntime(ideviceId, node)` hook, the
     runtime counterpart of `destroyEdition`;
  3. disposes the instance lifecycle (R7.3), in reverse order of registration;
  4. drops jQuery's event and data registry for the node's subtree;
  5. removes `loaded`.
  It is idempotent. A failing disposer does not stop the others.
- **R7.3** Every resource an instance creates that can outlive its node must be owned
  by its lifecycle, `$exe.ideviceRuntime.lifecycle(node)`, or be released by its
  `destroyRuntime` hook. Such resources are:
  - timers and `requestAnimationFrame` loops;
  - handlers on `document`, `window` or elements outside the node;
  - observers;
  - media and third-party players;
  - pending requests and file reads;
  - SCORM activity registrations.
  Handlers bound inside the node need nothing: step 4 removes them.
- **R7.4** A callback registered through the lifecycle never runs after `destroy`.
- **R7.5** The lifecycle's resource API is the one
  [ADR-2293-01](../../adr/ADR-2293-01-own-idevice-edition-resources-with-an-explicit-lifecycle.md)
  gives editions: `setTimeout`, `setInterval`, `on`, `addEventListener`, `signal`,
  `own`, `ownInstance`, `ownMedia`, `ownFileReader`, `readFile`. Code that already
  works with an edition's resources needs nothing new for runtime resources.
- **R7.6** Page-scoped resources (R2.4) survive instance teardown.

## 8. Compatibility

- **R8.1** An export object that does not adopt the contract renders as it does today:
  - phases that return nothing complete synchronously;
  - the extra `ideviceId` argument is ignored;
  - resources it does not register are not released, which is no worse than today.
- **R8.2** HTML-type iDevices that start themselves page-wide from
  `$(function () { … })` are **page-scoped legacy** runtimes. Hosts do not run §3 for
  them. They keep:
  - the page-level `enhance(document)` and their own bootstrap;
  - in the editor, the page-level reload after a remote edit (#2434).
  To adopt the contract, such an iDevice exposes `renderBehaviour` / `init` for one
  instance (R2.3) and stops its self-boot.
- **R8.3** No stored data, saved HTML or exported file layout changes. Legacy ELP
  content renders as before.
- **R8.4** New iDevices must follow this contract. Changes to an existing runtime
  script should not move it further away from it.

## 9. Scenarios

1. **Late JSON render.** *Given* an exported page with a Case study whose template is
   fetched asynchronously, *when* the template arrives after `$exe.init()`, *then* the
   lightbox links, effects and math inside it work, and `exe-idevice-rendered` fires
   once with `status: ok`.
2. **Async init.** *Given* a 3D viewer whose `init` returns a promise that resolves
   when the model is ready, *when* the page loads, *then* the node gets `loaded` only
   after that promise resolves.
3. **Failing instance.** *Given* two Form iDevices where the first one's
   `renderBehaviour` throws, *when* the page loads, *then* the second one renders, and
   the first one's event fires with `status: error`.
4. **Hung instance.** *Given* an `init` promise that never settles, *when* 10 s have
   passed, *then* the event fires with `status: timeout`, and `exe-idevices-rendered`
   still fires.
5. **Update.** *Given* a rendered game, *when* it rebuilds its question panel and
   calls `rendered(node, 'update')`, *then* the panel's lightbox links work and the
   event fires with `reason: update`.
6. **Editor re-render.** *Given* an iDevice with a running countdown in the
   workarea, *when* the user edits and saves it, *then* the old countdown stops
   before the new render starts, and only one countdown is running afterwards.
7. **Page change.** *Given* a workarea page with rendered iDevices, *when* the user
   opens another page, *then* no timer, observer, listener or SCORM registration of
   the previous page's instances remains.
8. **Idempotency.** *Given* content with an accordion, a lightbox audio link and a
   definition list, *when* it is enhanced twice, *then* its DOM, its ids and its
   handlers are the same as after one pass.
9. **Print.** *Given* `?print=1` on a page with a JSON iDevice whose template is
   fetched, *when* the page loads, *then* the print dialog opens only after that
   iDevice has rendered.

## 10. Acceptance criteria

- [ ] Both hosts render instances through one implementation of §3, and a unit test
      asserts the phase order, the arguments and the error and timeout statuses.
- [ ] The shared enhancements are listed once, and both hosts use that list. Every
      entry has a test that applies it twice and compares the result with one pass.
- [ ] `exe-idevice-rendered` and `exe-idevices-rendered` fire as specified. Print and
      search highlighting wait for them instead of a fixed delay.
- [ ] `destroy(node)` releases everything registered through the lifecycle. A test
      renders, destroys and checks that no timer or listener is left.
- [ ] Every JSON iDevice in `jsonOnlyIdevices` follows R2–R7 and has a test for it.
- [ ] A Playwright spec covers scenarios 1 and 6.
- [ ] The `idevice` skill documents the runtime contract next to the edition
      lifecycle.
