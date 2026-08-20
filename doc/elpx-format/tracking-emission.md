# Tracking Emission: SCORM and xAPI

Reference document for **how a published eXeLearning package reports learner
scores** to a host (LMS / LRS). Two channels coexist:

- **SCORM 1.2/2004** — emitted only by SCORM exports, via the bundled SCORM API
  wrapper. Pre-existing behaviour.
- **xAPI (Experience API)** — emitted by the **web export family** (HTML5, ELPX,
  single page, editor preview) via `libs/xapi/exe_xapi.js`, with **no export-time
  option**. SCORM, IMS and EPUB packages do not carry it (ADR-2302-02).

Both channels are fed from the **same single score source** in
`public/app/common/common.js` (the `gamification` namespace), so the score math
is never duplicated.

Related: [export-pipeline.md](./export-pipeline.md) ·
[libraries.md](./libraries.md) · [ids.md](./ids.md)

### Scope

- This feature adds **xAPI statement emission** to published packages.
- It does **not** replace SCORM — SCORM output is unchanged and both channels can
  run side by side.
- It does **not** implement **cmi5**. cmi5 requires additional launch (fetch
  token), session `LaunchData`, AU metadata, `moveOn` rules, cmi5-defined context
  categories and packaging semantics that are intentionally out of scope here.
  The emitter ships only in the **web export family** — HTML5, ELPX, single page and
  the editor preview. SCORM 1.2, SCORM 2004, IMS Content Package, EPUB3 and the print
  preview carry no emitter: SCORM grades through `cmi.*`, IMS CP defers runtime
  communication out of scope, and EPUB3 defines no tracking mechanism. See
  [ADR-2302-02](../architecture/adr/ADR-2302-02-ship-xapi-emitter-only-in-web-exports.md).

  The `initialized`/`terminated` statements below are **generic xAPI lifecycle
  statements**, not cmi5 ones.
- The package only **emits** statements. The host LMS/LRS is responsible for
  **authentication, learner identity, validation, storage and gradebook
  mapping**. The emitter never invents learner PII.

---

## 1. How SCORM is emitted

SCORM emission lives in `public/app/common/common.js` under
`$exeDevices.iDevice.gamification.scorm`, with the ADL wrapper files added to
SCORM exports only.

| Piece | Where |
|---|---|
| Score logic | `gamification.scorm` in `public/app/common/common.js` |
| SCORM API wrapper (pipwerks) | `public/app/common/scorm/SCORM_API_wrapper.js` |
| SCO lifecycle (`loadPage`/`unloadPage`) | `public/app/common/scorm/SCOFunctions.js` |
| Injected for | SCORM exports only — `SCORM_LIBRARIES` + `getScormHeadScripts()` |
| Runtime gate | `$("body").hasClass("exe-scorm")` |

Flow:

1. The exporter sets `body class="exe-scorm exe-scorm12"` and injects the wrapper
   scripts in `<head>` (`Scorm12Exporter.getScormHeadScripts()`).
2. On load, `SCOFunctions.loadPage()` calls `scorm.init()` (pipwerks).
3. Each gradable iDevice calls `gamification.scorm.registerActivity(game)` and,
   on submit, `gamification.scorm.sendScoreNew(auto, game)`.
4. Per-iDevice scores are serialised into **`cmi.suspend_data`**
   (`<n>. "<title>"; Score: <s>%; Weight: <w>%`).
5. The weighted package total (`getFinalScore`) is written to
   **`cmi.core.score.raw`** and the status to **`cmi.core.lesson_status`**
   (`passed` when total ≥ 50, else `failed`).

Every `gamification.scorm.*` method early-returns when `pipwerks` is undefined,
so SCORM does nothing outside SCORM exports.

---

## 2. How xAPI is emitted

xAPI emission lives in `public/app/common/xapi/exe_xapi.js`
(`$exeDevices.iDevice.xapi`), included in **web exports** via
`WEB_EXPORT_LIBRARIES` / `BaseExporter.emitsXapi()` (ADR-2302-02).
It does **not** depend on SCORM/pipwerks.

### 2.1 Wiring at export time

| Piece | Where |
|---|---|
| Emitter library | `public/app/common/xapi/exe_xapi.js` |
| Inclusion (web exports only) | `WEB_EXPORT_LIBRARIES` (`src/shared/export/constants.ts`) + `BaseExporter.emitsXapi()` / `selectBaseLibraries()` |
| Identity config in `<head>` | `window.exeXapi` injected by `PageRenderer` (both multi-page and single-page heads) |
| Config source | `BaseExporter.buildXapiConfig()`, called by every web-family exporter |

The exporter injects, before the emitter script:

```html
<script>window.exeXapi={"odeId":"202604272111114JQLDV","packageTitle":"…","language":"en",
    "pageCount":4,"pageId":"page-3","pageTitle":"…"}</script>
<script src="libs/xapi/exe_xapi.js"> </script>
```

Beyond the identity keys, the config carries `pageCount` (above 1 the emitter
suppresses its page-local package verdict) and `pageId` / `pageTitle` (the page
identity no runtime event supplies).

The serialized config is **HTML-safe**: `PageRenderer.serializeForScript()` escapes
`<` (→ `\u003c`) plus U+2028/U+2029 before embedding, so a package title containing
`</script>` cannot break out of the inline `<script>` (no XSS).

The config shape is a single source of truth: the TypeScript type `XapiConfig`
(`src/shared/export/interfaces.ts`) declares **exactly** the keys the emitter reads
in `exe_xapi.js#_resolveConfig`. It has two groups of keys:

- **Identity keys** — `odeId`, `baseIri`, `activityId`, `packageTitle`, `language`.
  Populated by `Html5Exporter` / `PageExporter` from `meta` on every export.
- **Delivery keys** — `parentOrigin`, `actor`, `registration`. These are **opt-in
  and NOT populated by the default export pipeline**. Origin-restricted postMessage
  delivery (`parentOrigin`), a pre-resolved learner `actor`, and an attempt
  `registration` require runtime context the static exporter does not have (the
  embedding origin / LMS-provided learner). They are supplied at runtime by the
  embedding bridge (or by xAPI launch URL params; see §2.4) rather than baked into
  the export. When absent, the emitter broadcasts to `'*'` with an anonymous actor.

### 2.2 Identifiers (IRIs)

Stable, derived from the package `odeId` and per-iDevice `odeIdeviceId`
(see [ids.md](./ids.md)):

- Package activity: `https://exelearning.net/xapi/{odeId}`
- Per iDevice: `https://exelearning.net/xapi/{odeId}/idevice/{odeIdeviceId}`

When no `odeId` is available the emitter falls back to the document URL, so
statements stay structurally valid.

### 2.3 Statements

Fed from `gamification.track('answered', game)` (called by `sendScoreNew`, before
the SCORM gate) and the running aggregate (reusing the pure `getFinalScore`):

- **Per iDevice** — verb [`answered`](http://adlnet.gov/expapi/verbs/answered),
  object = per-iDevice IRI, `result.score = { scaled, raw, min: 0, max: 10 }`.
  Its context also carries the iDevice's effective configured weight, allowing a
  consumer to reconstruct the package result independently.
- **Package** — verb [`completed`](http://adlnet.gov/expapi/verbs/completed) plus
  [`passed`](http://adlnet.gov/expapi/verbs/passed) /
  [`failed`](http://adlnet.gov/expapi/verbs/failed) at the same ≥ 50 threshold,
  `result.score = { scaled, raw, min: 0, max: 100 }`.
- **Lifecycle (generic xAPI, not cmi5)** —
  [`initialized`](http://adlnet.gov/expapi/verbs/initialized) emitted once per page
  load and [`terminated`](http://adlnet.gov/expapi/verbs/terminated) once on
  `pagehide`/`unload`, both against the package Activity and only when a transport
  is available. They carry no `result`.

  A multi-page package emits one pair **per page visited**, not one per attempt: each
  page is a separate document with its own JavaScript context and no shared state, so
  no page can know whether it is the first or the last. Consumers must treat these as
  page-level audit events and must not read a `terminated` as the end of an attempt.
  This departs from the cmi5 reading of the same verbs — cmi5 requires exactly one
  pair per session — which is why the emitter states it is not cmi5.

Each statement also includes richer metadata:

- `object.definition` with a stable `type` IRI
  (`…/activities/assessment` for the package, `…/activities/cmi.interaction` for
  an iDevice) and a localized `name` language map using the package `language`.
- `context.registration` when a registration value is available, from the launch
  URL (`registration=`) **or** the injected config (`window.exeXapi.registration`).
- `context.contextActivities.parent` linking each iDevice statement to the package
  Activity.
- `context.extensions` with eXeLearning metadata, each key present only when its
  value is available (no invented data), under stable IRIs:
  - `https://exelearning.net/xapi/extensions/package-id`
  - `https://exelearning.net/xapi/extensions/idevice-id`
  - `https://exelearning.net/xapi/extensions/idevice-type`
  - `https://exelearning.net/xapi/extensions/page-id` (page rendering this document)
  - `https://exelearning.net/xapi/extensions/page-title` (page rendering this document)
  - `https://exelearning.net/xapi/extensions/page-count` (pages in the package)

Statement shape follows the xAPI Data spec:
<https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md>.

#### Multipage packages and the package result

**Multi-page packages emit no package-level verdict.** Each page is a separate
document with a fresh JavaScript context: it only knows the scores answered on that
page, so a page-local aggregate wearing the package Activity IRI would let one page
report `passed` and another `failed` for the same activity within one attempt.
`completed` and `passed`/`failed` are therefore emitted only when the package is a
single page (`window.exeXapi.pageCount === 1`, which the exporters inject). See
[ADR-2302-01](../architecture/adr/ADR-2302-01-suppress-multipage-package-verdicts.md).

For multipage packages, the per-iDevice `answered` statements are the grading-relevant
signal: each carries the stable `idevice-id`, the clamped 0–10 score and the package
and page identity. A consumer that needs a package-level result derives it from those
statements together with its own knowledge of the package — the reference consumer,
`mod_exelearning`, grades per iDevice against the roster it derives from the uploaded
package itself, so the wire carries no package-structural metadata from learners.

On **single-page** packages the emitted verdict is accurate for partial attempts too:
gradable iDevices seed the page aggregate at score 0 as they register (with their real
weight), so a learner who answers only the weight-25 iDevice of a 25/75 package is
reported as 25, not 100. The seeding is internal emitter state; nothing about
unanswered iDevices is emitted.

### 2.4 Transport (silent fall-through)

1. **`window.postMessage` to the parent** (default; for packages embedded in a
   host activity module). Message contract:

   ```js
   window.parent.postMessage({ type: 'exe-xapi-statement', statement }, targetOrigin);
   ```

   `targetOrigin` is the configured `parentOrigin` so the statement is delivered
   only to the intended host. It falls back to `'*'` **only** when no
   `parentOrigin` is configured (best-effort delivery); this is safe because the
   emitter never puts learner PII in a statement (anonymous account agent when
   none is supplied).

   Embedding platforms such as Moodle can consume these statements by adding a
   listener in the host activity module. In Moodle, a proper integration should
   validate the authenticated user/session, verify that the statement belongs to
   the current activity instance, and map accepted statements to Moodle events
   and/or gradebook updates — for example through a plugin xAPI handler. This
   host-side consumption is **not** implemented in this repository.

2. **LRS POST** when xAPI launch parameters are present in the URL
   (`endpoint`, `auth`, optional `actor`, `registration`):

   ```
   POST {endpoint}statements
   Authorization: {auth}
   X-Experience-API-Version: 1.0.3
   ```

   See <https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Communication.md>.

3. **No-op** when neither a parent window nor launch parameters exist (plain web
   / offline EPUB). All transport code is wrapped in `try/catch` so tracking can
   never break page rendering.

### 2.5 Notes

- The emitter debounces duplicate statements (same iDevice + same score, weight,
  and package order) and assigns each statement a UUID `id` for LRS idempotency.
- The package-level statement reuses `gamification.scorm.getFinalScore()` (a pure
  function) for the weighted total — single source of truth with SCORM.
- The `initialized`/`terminated` lifecycle statements are emitted at most once and
  are plain xAPI lifecycle statements. They are **not** cmi5: this emitter does
  not implement cmi5 launch, fetch token, `LaunchData`, `moveOn` rules, AU
  metadata, cmi5 context categories or cmi5 packaging.
- xAPI primer: <https://xapi.com/statements-101/>. Moodle xAPI subsystem
  reference: <https://moodledev.io/docs/apis/subsystems/xapi>.
