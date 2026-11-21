---
tracking_issue: 2511
title: "iDevice runtime contract — design"
date: 2026-10-06
authors:
  - "@erseco"
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5-5"
---

# iDevice runtime contract — design

How the hosts and the shared libraries implement the [specification](spec.md). The
evidence behind "current state" is in [research.md](research.md). Line references
are at `b6c2556c6`.

## Current state

### Export runtime

`$exeExport.init()` runs on DOM ready (`public/app/common/exe_export.js`). It runs
the page-wide `$exe.init()` first, and only then starts the JSON iDevices with
`initJsonIdevices()`:

1. For each JSON type on the page, `initJsonIdeviceInterval()` polls every 50 ms
   until the type's export object exists.
2. `initJsonIdevice()` sets `data.ideviceId` and branches:
   - Types in the hard-coded `jsonOnlyIdevices` list, and `db-no-data` nodes, go
     through `loadTemplateAndRender()`. That method may `fetch()` the template.
     `renderWithTemplate()` then calls `renderView` → `innerHTML` →
     `renderBehaviour` → `init` → `afterIdeviceRendered()`.
   - Every other JSON instance gets only `renderBehaviour` → `init` →
     `afterIdeviceRendered()`.
3. `loaded` is added as soon as `init()` returns.

Problems with this flow:

- No phase is wrapped in `try`. An exception stops every later instance of that type
  in the same `forEach`.
- `ideviceId` is never passed as an argument; it only arrives as `data.ideviceId`.
- `afterIdeviceRendered()` only runs `$exeFX.init(node)` at `b6c2556c6`. PR #2512
  has since added the lightbox and dialog-size helpers.
- Print, search highlighting and the `post-js` class wait a fixed 200 ms
  (`delayLoadingPageTime`).

HTML-type iDevices are not driven by the runtime at all. They start themselves from
`$(function () { … })` and scan the page.

### Editor host

`IdeviceNode.exportProcessIdeviceJson()` runs the same three phases with an extra
`ideviceId` argument (`ideviceNode.js:1952`). The HTML path only assigns
`innerHTML` (`:1939`).

There is no per-instance enhancement. After a save, `IdeviceNode` and
`IdevicesEngine` each define their own `loadLegacyExeFunctionalitiesExport()`
(`ideviceNode.js:3638`, `idevicesEngine.js:2818`). Both re-run every shared library
over the whole page: `$exeFX`, `$exeGames`, `$exeHighlighter`, `$exeABCmusic`,
`$exe.init()`, and `$exe.setMultimediaGalleries()`, which `$exe.init()` has just
called. `exe_export.js` is not loaded in the workarea (`views/workarea/workarea.njk`
loads `common.js`), so `afterIdeviceRendered()` is not available there.

On the editor side, teardown exists for editions (ADR-2293-01) but not for rendered
instances. A remote edit reloads the whole page through the Yjs bridge, because
running HTML-type runtimes piecemeal breaks the other instances (#2434,
`idevicesEngine.js:1700`). The only shared runtime cleanup,
`gamification.observers.observersDisconnect()`, runs when the node's `mode`
attribute changes (`common.js:3755`).

## Technical design

### 1. A host-neutral runtime: `$exe.ideviceRuntime`

A new classic script, `public/app/common/exe_idevice_runtime.js`, defines
`$exe.ideviceRuntime`. It loads after `common.js` in both hosts: in the workarea next
to `common.js` in `workarea.njk`, and in exports wherever `exe_export.js` is listed
today (`src/shared/export/constants.ts`, `PageRenderer.ts`,
`PrintPreviewExporter.ts`, `FileSystemResourceProvider.ts`). It also exports through
`module.exports` for Vitest, as `exe_games.js` does.

It is a separate file, not more of `common.js`, so that it can be tested and linted
as new code. `common.js` is excluded from Biome and already has 3,900 lines.

| Function | Spec | Behaviour |
|---|---|---|
| `run(node, exportObject, data, options)` | §3 | Runs view → mount → behaviour → init → enhance → rendered, each phase in `try`. Waits for a thenable from `init` and `enhance` with `Promise.race` against `options.timeout` (default 10 s). Returns a promise for the status. `options.mount(html)` lets the editor wrap the HTML with `exportHtmlView()`; the default assigns `innerHTML`. `options.renderView` says whether the view step runs. |
| `enhance(context)` | §5 | Runs the enhancement list (below) on `context`. Returns a promise for the asynchronous entries. |
| `rendered(node, reason)` | §4, §6 | Enhances the node, sets `loaded`, dispatches `exe-idevice-rendered`. `run()` calls it with `render`; runtime scripts call it with `update`. |
| `lifecycle(node)` | §7 | Returns the node's instance lifecycle, creating it on first use. `run()` creates it before the behaviour step. |
| `destroy(node)` | §7 | The R7.2 sequence. Idempotent. |

The two `exe-idevice-*` events are created with `new CustomEvent(name, { bubbles: true,
detail })`. Every browser the project supports provides that constructor.

### 2. One enhancement list

`enhance(context)` holds the list that `afterIdeviceRendered()` (export) and
`loadLegacyExeFunctionalitiesExport()` (editor) each partly duplicate today. The
order follows R5.5:

1. `$exeFX.init(context)` — rebuilds effect markup.
2. `$exe.setMultimediaGalleries(context)` and `$exe.setModalWindowContentSize(context)`
   — scoped by PR #2512.
3. `$exe.dl.init`, the `a.exe-enlarge` icons, `setIframesProperties`, tooltips, media
   player — scoped and made idempotent as they move in.
4. `$exeHighlighter`, `$exeABCmusic`, Mermaid, then math. Math runs last because it
   typesets what the others produce (#2197). It already accepts an element:
   `gamification.math.updateLatex(element)`.
5. In the editor only: internal `exe-node:` links (`enableInternalLinks`).

`$exeGames.init()` (legacy hangman) stays page-level, called once by
`enhance(document)`, until it is scoped. Its editor-only `<style>` append moves
behind a guard.

`$exe.init()` keeps its page-level work: body classes, ePub handling, loading the
media player. It calls `enhance(document)` instead of the individual functions.

`$exeExport.afterIdeviceRendered(node)` stays as a one-line wrapper around
`enhance(node)`, so code written against #2170 and #2512 keeps working.
`loadLegacyExeFunctionalitiesExport()` is reduced to one method on
`IdevicesEngine` that calls `enhance(document)`.

### 3. Export runtime changes

- `initJsonIdevice()` calls `run()` per instance. That gives every instance its own
  error boundary, the `ideviceId` argument, the async wait and the event. The 50 ms
  poll for the export object stays: it is how a runtime script loaded after
  `exe_export.js` is found.
- `jsonOnlyIdevices` stays as it is. Moving it into each iDevice's `config.xml` is a
  separate decision, recorded in [tasks](tasks.md).
- `init()` counts the instances found at load, and dispatches `exe-idevices-rendered`
  when that many first events have fired. HTML-type instances do not count: they
  have no event yet.
- `triggerPrintIfRequested()`, `searchBar.highlightFromUrl()` and
  `addClassJsExecutedToExeContent()` wait for `exe-idevices-rendered`. The current
  200 ms delay stays as a lower bound, and the render timeout is the upper bound, so
  a page without JSON instances behaves as today.

### 4. Editor host changes

- `IdeviceNode.exportProcessIdeviceJson()` calls `run()` with a `mount` that applies
  `exportHtmlView()`. It keeps its `htmlView` save in edition mode, unchanged.
- `IdeviceNode` calls `destroy(this.ideviceBody)` before `generateContentExportView()`
  replaces the body, and in `remove()`. `this.ideviceBody` is the content root
  (spec §1), so only the iDevice's content is cleaned. The `.idevice_node`
  (`this.ideviceContent`), with the editor's drag, selection and toolbar handlers, is
  not touched. `IdevicesEngine` calls it for every instance
  before a page change empties the content. These are the same sites where
  ADR-2293-01 calls `destroyEditionInstance()`.
- After a save, the editor enhances only the saved node, not the whole page.
  Page-level `enhance(document)` stays for page loads, and for
  `reloadExportRuntime()` while HTML-type runtimes remain page-scoped (R8.2).

### 5. Instance lifecycle

ADR-2511-03 decides that the instance lifecycle and `EditionLifecycle` share one
resource registry. It is implemented in two steps:

1. `exe_idevice_runtime.js` contains `ResourceLifecycle`, a classic-script
   implementation of the resource API in R7.5. It is based on
   `public/app/workarea/project/idevices/content/editionLifecycle.js`, and keeps that
   file's semantics:
   - the namespace is unique to the instance, so `off()` only removes the instance's
     handlers;
   - callbacks are bound to the instance and stop after disposal;
   - slots release what they held;
   - `readFile()` always settles;
   - disposers run in reverse order and survive one another's failures.
2. `EditionLifecycle` keeps what is specific to editions: the active slot, the owner
   node, `destroyEdition` and the TinyMCE step stays in `IdeviceNode`. It delegates
   its resource registry to `ResourceLifecycle`, which it reads from `window`
   because `workarea.njk` loads `exe_idevice_runtime.js` as a classic script. Its
   tests keep passing unchanged. This is what keeps the two APIs from drifting
   apart.

The instance lifecycle is stored in a `WeakMap` keyed by node, so a node removed
without `destroy()` does not keep it alive. Runtime scripts reach it through
`$exe.ideviceRuntime.lifecycle(node)`. They cannot use `this.$lifecycle`, because one
export object serves every instance of its type.

The shared gamification helpers register through the lifecycle of the node they
are called for:

- `reportActivity()` owns `registry.unregister(id)`. The function exists
  (`exe-scorm12-activities.js:595`) but nothing calls it today.
- `observers.observeResize()` owns the observer.
- The game clock (`counterClock`) is owned as an interval.

That one change reaches the 28 games that use the helpers, once they render per
instance.

## Migration and compatibility

- Nothing changes for an export object that does not adopt the contract (R8.1). The
  extra argument is ignored; a phase that returns `undefined` is synchronous.
- HTML-type iDevices are not driven by `run()` (R8.2). They keep their bootstrap and
  get the page-level `enhance(document)`, which runs the same functions as today's
  `$exe.init()`.
- No stored data or saved HTML changes. `renderView` output is saved as `htmlView` in
  the editor, exactly as now.
- Static and offline exports gain one script file. Every export format that ships
  `exe_export.js` ships it too, and `make test-e2e-static` covers it.
- ePub keeps its current exceptions, such as the no-gallery fallback for #258 in
  `setMultimediaGalleries()`, because the page-level call keeps them.

## Security and privacy

No new input is parsed and no new network request is made. Event `detail` carries
identifiers only (R6.5). The render timeout prevents a hung runtime from blocking
page-level work. Releasing SCORM registrations on teardown only affects the editor,
which has no LMS.

## Accessibility

Idempotent enhancements stop duplicate ids. Today `dl.init` and the media boxes
derive ids from element positions, which breaks `aria-controls` and `href="#…"`
references when they run twice. The rendered event lets future work move focus or
announce changes once content exists, instead of after a delay. Nothing changes in
the markup that iDevices produce.

## Internationalization

No new strings.

## Performance

`enhance(node)` replaces page-wide passes with selector queries limited to one node.
In the editor, enhancing only the saved node is less work than re-running every
library over the page. Async inits run concurrently, and only an instance's own
rendered step waits for its promise. `exe-idevices-rendered` can fire later than
200 ms on a page whose templates are slow to fetch. That is the point: print and
search highlighting then see the real content.

## Testing strategy

- `public/app/common/exe_idevice_runtime.test.js`:
  - phase order and arguments;
  - a sync `init` and a thenable one;
  - a thrown phase and a rejected `init`, with the other instances unaffected;
  - the timeout;
  - the event fired once per render and per update;
  - the page event;
  - `destroy` order, idempotency and a failing disposer;
  - `ResourceLifecycle` parity with the `EditionLifecycle` tests.
- An enhancement idempotency test per list entry: enhance twice, compare the DOM and
  `$._data` handler counts with one pass.
- `exe_export.test.js` and `ideviceNode` / `idevicesEngine` tests for the host
  changes.
- A reusable contract helper for iDevice tests: render two instances, check that
  neither touched the other (R2.3), destroy one, and check that no fake timer and no
  `document`/`window` listener remains (R7.3). Each adopting iDevice uses it in its
  existing `*.test.js`.
- Playwright: an exported page with a Case study (lightbox, effects) and a Form,
  asserting the events and a working lightbox (scenario 1). In the editor, edit and
  save a game twice and assert one running clock (scenario 6).

## Rollout plan

Phased, one reviewable PR per step. The order is in [tasks](tasks.md). The runtime
core lands first and changes no iDevice. Each later PR moves one iDevice or one
enhancement, and is the experiment that confirms or corrects the contract for that
case.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| A hung `init` promise delays the event forever. | Timeout with `status: timeout` (R3.8). |
| An enhancement is not idempotent and duplicates markup on the second pass. | It is not added to the list until its "apply twice" test passes (R5.4). |
| `enhance(document)` and per-node `enhance(node)` both run on the same content. | Idempotency, required anyway for updates. |
| `exe-idevices-rendered` never fires on a page with an instance that is never initialized (its script failed to load). | The 50 ms poll gets the same timeout. The page event fires anyway. |
| `EditionLifecycle` and `ResourceLifecycle` drift apart. | The edition delegates its registry (design §5). Shared tests. |
| A runtime script keeps calling page-level init (R5.1) and double-initializes. | Review checklist in the `idevice` skill. The contract helper detects changes outside the node. |

## ADRs required or referenced

| Decision | ADR |
|---|---|
| One render lifecycle per instance, run by one implementation for both hosts and ending in a DOM event | [ADR-2511-01](../../adr/ADR-2511-01-run-every-idevice-instance-through-one-render-lifecycle.md) |
| One enhancement step in the shared runtime script (`exe_idevice_runtime.js`), used by both hosts; enhancements take a context and are idempotent | [ADR-2511-02](../../adr/ADR-2511-02-share-one-enhancement-step-between-editor-and-export.md), building on [ADR-2510-01](../../adr/ADR-2510-01-apply-shared-enhancements-after-idevice-render.md) |
| Export-side teardown through a resource lifecycle shared with editions | [ADR-2511-03](../../adr/ADR-2511-03-own-exported-idevice-resources-with-a-shared-lifecycle.md), the counterpart of [ADR-2293-01](../../adr/ADR-2293-01-own-idevice-edition-resources-with-an-explicit-lifecycle.md) |
| Saved state keyed by component id | [ADR-2492-01](../../adr/ADR-2492-01-keep-saved-idevice-games-under-their-component-id.md), generalized by R2.2 |
