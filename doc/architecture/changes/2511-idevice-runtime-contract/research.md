---
tracking_issue: 2511
title: "iDevice runtime contract — research"
date: 2026-10-06
authors:
  - "@erseco"
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5-5"
---

# iDevice runtime contract — research

Source analysis behind the [design](design.md). Method: every runtime script was read
under `public/files/perm/idevices/base/*/export/`, skipping tests and vendored
libraries, together with the shared libraries in `public/app/common/` and the two
hosts. Paths are at `b6c2556c6`. Line numbers point into the named file.

## Inventory

There are 53 base iDevices.

- **16 are JSON-type**: adaptative-quiz, casestudy, digcompedu, example,
  file-attachment, form, image-gallery, lomloe, magnifier, markdown-text,
  scrambled-list, slide, text, three-d-viewer, three-sixty-viewer, trueorfalse.
- **37 are HTML-type.** When `config.xml` has no `<component-type>`, the type is
  `html` (`src/shared/parsers/idevice-parser.ts:282`,
  `src/services/idevice-config.ts:84`).

Of the JSON-type iDevices, only the eight in `jsonOnlyIdevices`
(`exe_export.js:423`) get `renderView` on export. The others rely on their saved
`htmlView`.

## JSON iDevices

| iDevice | Scope of its behaviour | Rendering after `init` | Resources that outlive the node |
|---|---|---|---|
| adaptative-quiz | Node, via `updateConfig` id; math typeset by a page-wide selector `:135` | Question panel rebuilt with `.html()` per question `:949` | Clock `setInterval` `:1093` |
| casestudy | **Page-wide** `$('.CSP-Activities').off/on` `:137-144`; page-wide math selector `:57` | — | — |
| file-attachment | Node (`getElementById(data.ideviceId)` `:37`) | `asset://` links resolved by a promise `:110-122` | — |
| form | Node (`#frmMainContainer-{id}`); page-wide math selector `:367`; calls `MathJax.typesetClear` directly `:528` | Questions appended in `renderBehaviour` `:227`; 200 ms polling fallback `:254`; slideshow timeouts | Clock interval `:740` |
| image-gallery | **Page-wide** click handlers on every gallery link, added again on each call `:51-58` | **`renderBehaviour` replaces the node's markup** (`$node.html(gallery)` `:45-48`); uncapped 200 ms poll for SimpleLightbox `:64-69` | Lightbox instance, poll |
| lomloe | Page-scoped tooltip, guarded by `__lomloeTipBound` `:302` | Starts itself at script load `:408-416` | `document`/`window` handlers (page-scoped, by design) |
| magnifier | Node; `MojoMagnify.init()` scans every `img[data-magnifysrc]` on the page (`mojomagnify.js:204`) | Loads a script, then `setTimeout(500)` `:287-290` | — |
| markdown-text | Node; page-wide math selector `:127-133` | — | — |
| scrambled-list | **Page-wide**: `$('.exe-sortableList').each(enableList)` shuffles every list again on each call `:200-211` | 500 ms timeout `:247` | SCORM registration |
| slide | Page-scoped `document` delegation, `document._slideExportWired` `:127-130` | — | Page-scoped handlers |
| text | Node; page-wide math selector `:161,168` | — | — |
| three-d-viewer | Node, but falls back to the whole document `:1312-1326` | Module load, then boot; asset polling `:439` | MutationObserver per viewer `:1032`; fullscreen handler `:888` |
| three-sixty-viewer | Node | Texture load; rAF loop `:551` | Releases them itself: `_disposeNode` `:1210`, `destroyAll` `:1224`, `pagehide` `:1244` |
| trueorfalse | Node; scoped math `:140-148` | Questions appended in `renderBehaviour` `:87`; a `questionsReady` listener `:720` that nothing triggers | `document` handler, SCORM registration |

digcompedu and example have no runtime behaviour.

Findings:

- **Page-wide behaviour is common.** It is the direct cause of #2434: rendering one
  instance again re-runs the behaviour of the others. Hence R2.3.
- **Only `slide` returns a promise** (`slide.js:128,205`, from `renderBehaviour`), and
  nothing waits for it. `loaded` is added while three-d-viewer, image-gallery,
  magnifier and form are still working. Hence R3.5 and §6.
- **Math is typeset by selector strings that match every instance**:
  `gamification.math.updateLatex('.exe-text-template')`. `updateLatex()` already
  accepts an element (`common.js:3040`). Hence the math entry of the enhancement step.
- **Only the two 3D viewers release anything.** The three-sixty-viewer pattern
  (dispose before re-render, `destroyAll`, `pagehide`) is what R7 generalizes.
- **No export object defines a teardown hook.** `destroy` and `dispose` are already
  used with other meanings (`three-d-viewer-runtime.js:289`, SimpleLightbox), so the
  hook is named `destroyRuntime`, after `destroyEdition` (ADR-2293-01).

## HTML iDevices

All 37 start themselves page-wide from `$(function () { $x.init(); })`, for example
`word-search.js:1224` and `quick-questions.js:1918`. The runtime never calls them.

- **28 games** go through `$exeDevices.iDevice.gamification.initGame()`. It selects
  `$('.' + ideviceClass)` over the whole page (`common.js:1213`), and the game builds
  every instance in an `each((i) => …)`.
  - Instance ids come from the page index: `'sopaMainContainer-' + i`
    (`word-search.js:52-66`).
  - The re-run guard is that the `-DataGame` element has already been removed.
  - ADR-2492-01 had to move four games' saved state off position-based ids. R2.2
    generalizes that.
- **Others**: rubric initializes once per page (`rubric.js:48-53`). udl-content marks
  each element (`udl-content.js:43-46`). external-website selects a duplicated id.
  interactive-video supports a single instance per page.
- **Resources that outlive a removed node:**
  - **ResizeObservers on the page container**, through
    `gamification.observers.observeResize()` (`common.js:3777`), in 22 games;
  - `document`/`window` handlers, sometimes without a namespace (puzzle,
    hidden-image, beforeafter);
  - game clocks;
  - YouTube players;
  - SCORM registrations from `gamification.scorm.reportActivity()`
    (`common.js:1428-1440`). `exe-scorm12-activities.js:595` defines `unregister`,
    but nothing calls it.
- **Existing cleanup**: `observers.observersDisconnect()` (`common.js:3804`) stops
  sounds, the clock and the observers. Only a `mode`/`node-selected` attribute change
  in the editor triggers it (`common.js:3755`).

## Shared enhancements

| Enhancement | Accepts a context | Idempotent | Notes |
|---|---|---|---|
| `$exeFX.init(root)` | yes (#2170) | ids from a monotonic counter; an accordion already rebuilt is only re-enabled (`exe_effects.js:251-258`) | Audit the other effect types for handler re-binding. |
| `$exe.setMultimediaGalleries()` | with PR #2512 | with #2512 (first free `media-box-N`; prettyPhoto `unbind` then `bind`) | |
| `$exe.setModalWindowContentSize()` | with PR #2512 | yes | |
| `$exe.dl.init()` | no | **no**: `exe-dl-` + page index (`common.js:1070`) | Same defect class as the media boxes. |
| `a.exe-enlarge` icons in `$exe.init()` | no | yes (only adds the icon when the link has a single child) | |
| `$exe.setIframesProperties()` | no | yes (class guard) | |
| `$exe.hasTooltips()` | no | to audit: the script loads once, then `$exe.tooltips.init()` runs again over the page | `common.js:1124-1128` |
| `$exe.math.init()` / `updateLatex(element)` | `updateLatex` yes | yes | `math.init` typesets the whole page. |
| `$exe.mermaid.init()` | no | to audit | |
| `$exeHighlighter.init()` | no | `Prism.highlightAll()` over the page | |
| `$exeABCmusic.init()` | no | to audit | `public/libs/abcjs/exe_abc_music.js:207` |
| `$exeGames.init()` (hangman) | no | in the editor, appends one `<style>` per call | `exe_games.js:18-22` |

Who calls them today:

- **Exported page**: `$exe.init()` once (`exe_export.js:92`). `$exeFX`, `$exeGames`,
  `$exeHighlighter` and `$exeABCmusic` start themselves on DOM ready, outside eXe.
  `afterIdeviceRendered()` re-runs `$exeFX`, plus the lightbox with #2512.
- **Editor**: two identical `loadLegacyExeFunctionalitiesExport()` methods
  (`ideviceNode.js:3638`, `idevicesEngine.js:2818`) run all of them page-wide after
  each save and page load. `exe_export.js` is not loaded in the workarea, so the
  shared step has to live outside it.

## Host behaviour

- `initJsonIdevice()` has no `try` around the phases (`exe_export.js:376-450`), so one
  failing instance stops the later instances of its type.
- Neither host passes `ideviceId` the same way: the editor passes it as an extra
  argument (`ideviceNode.js:1963-1978`), and the export runtime does not.
- Print, search highlighting and `post-js` wait a fixed `delayLoadingPageTime` of
  200 ms (`exe_export.js:31,64-78`), which a fetched template can outlast.

## Events and observers that already exist

- **No event announces that an iDevice has rendered.** The existing custom events
  are:
  - `gamification-evaluation-saved` on `window` (`common.js:2822`, listened to by
    progress-report);
  - `EXE_DOCUMENT_READY`;
  - `yjs-ready`;
  - `pageSelected`.
  The `exe-idevice-*` names do not collide with any of them.
- `common_edition.js:2041` (`cleanupDetachedInstances`) detects removed edition
  instances with a `MutationObserver`. It is the closest existing removal-detection
  pattern. The contract prefers explicit `destroy()` calls from the hosts, as
  ADR-2293-01 does, because they run while the DOM is still intact.

## Alternatives considered

The alternatives for each decision are compared in the ADRs:

- **Ready signal**: event plus promise, promise-only API, or event without waiting
  (ADR-2511-01).
- **Where the enhancement list lives**: `common.js` runtime, or separate lists per
  host (ADR-2511-02).
- **Teardown**: shared resource lifecycle, `destroyRuntime` hook only, or detection
  by `MutationObserver` (ADR-2511-03).

## External prior art

- Custom elements' `connectedCallback` / `disconnectedCallback` split setup from
  teardown per element in the same way —
  [HTML Standard, custom element reactions](https://html.spec.whatwg.org/multipage/custom-elements.html#custom-element-reactions).
  Converting iDevices to custom elements would change the saved HTML, which is a
  non-goal.
- Drupal behaviors pass a `context` to every `attach` and require behaviours to be
  safe to attach more than once — the same requirement as R5.3 and R5.4 —
  [Drupal JavaScript API](https://www.drupal.org/docs/drupal-apis/javascript-api/javascript-api-overview).
- [`CustomEvent`](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent)
  and [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal)
  on MDN.
