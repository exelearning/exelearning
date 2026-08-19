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
    "ideviceOrderOffset":2,"pageCount":4,"pageId":"page-3","pageTitle":"…"}</script>
<script src="libs/xapi/exe_xapi.js"> </script>
```

Beyond the identity keys, the config carries `ideviceOrderOffset` (iDevices rendered on
the preceding pages, the base of the package-global `idevice-order`), `pageCount`
(above 1 the emitter suppresses its page-local package verdict) and `pageId` /
`pageTitle` (the page identity no runtime event supplies).

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

  `initialized` is deferred to DOM-ready plus a macrotask, because it carries the
  page's [iDevice census](#the-idevice-census) and the iDevices have to register
  first. Answering flushes it synchronously, so `initialized` always precedes the
  first `answered`.

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
  - `https://exelearning.net/xapi/extensions/idevice-order` (answered statements only)
  - `https://exelearning.net/xapi/extensions/idevice-weight` (answered statements only)
  - `https://exelearning.net/xapi/extensions/page-id` (page rendering this document)
  - `https://exelearning.net/xapi/extensions/page-title` (page rendering this document)
  - `https://exelearning.net/xapi/extensions/page-count` (pages in the package)
  - `https://exelearning.net/xapi/extensions/idevice-census` (`initialized` + `terminated`)

Statement shape follows the xAPI Data spec:
<https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md>.

#### The iDevice census

A consumer that only sees `answered` statements sees only what the learner answered,
never the full set of gradable iDevices. Normalizing over that subset inflates a
partial attempt: a learner who answers only the weight-25 iDevice of a 25/75 package
scores 100 instead of 25. The unanswered iDevices emit nothing at all, so the
denominator has to be published separately.

Every page therefore declares its gradable iDevices as they initialize, answered or
not, and publishes them under `https://exelearning.net/xapi/extensions/idevice-census`, on that
page's `initialized` statement and again on its `terminated`:

```json
"https://exelearning.net/xapi/extensions/idevice-census": [
  { "idevice-id": "IDEVICE-A", "idevice-weight": 25, "idevice-order": 1 }
]
```

The extension **key** is a full IRI, as xAPI requires for the keys of the extensions
map. The keys **inside** each entry are short names: xAPI imposes no constraint on the
interior of an extension value, and nesting IRIs there is unidiomatic — profiles expand
short names through a JSON-LD `@context` instead.

Rules a consumer can rely on:

- Entries are sorted by `idevice-order` and use the **same** `idevice-id`,
  `idevice-weight` and `idevice-order` values that the matching `answered` statement
  carries — one `effectiveWeight()` applied to one live options object feeds both, so
  the two can never disagree.
- An iDevice whose package-global order cannot be resolved is **omitted** rather than
  published with a false order, exactly as it is kept out of the package aggregate.
- The census covers **one page**. A consumer assembles the package denominator from
  the pages it has seen; `page-count` says how many there are in total. Because the
  census is package metadata rather than learner data, it only has to be collected
  once ever, by any learner, and then applies to every attempt.
- A page with no gradable iDevices still emits `initialized` with an empty census,
  which is how a consumer distinguishes "this page has nothing to answer" from "this
  page was never opened".
- The census is published **twice per page**: on `initialized`, as early as possible,
  and again on `terminated`. `initialized` is flushed on a macrotask just after
  DOM-ready, which a gradable iDevice normally beats because it registers from a
  DOM-ready handler that runs inside the same dispatch; but there is no marker in the
  exported document identifying a gradable iDevice, so the expected count is unknowable
  and the flush cannot wait for a complete set. Page unload is by definition after every
  registration, so the `terminated` copy is the complete one. A consumer should take the
  union, or simply the larger of the two.

#### Reconstructing the weighted package score

The `idevice-weight` extension is a JSON number containing the effective configured
iDevice weight in eXeLearning weight points. Authoring uses a 1–100 percentage
scale, but the values are relative: package scoring normalizes all current
iDevice weights to a total of 100. Missing, zero, or non-numeric weights have an
effective value of 1, and values outside the supported range are clamped to
1–100. Non-evaluable iDevices do not emit `answered` statements and therefore do
not carry this extension.

For example, an answered statement can contain:

```json
{
  "verb": { "id": "http://adlnet.gov/expapi/verbs/answered" },
  "object": { "id": "https://exelearning.net/xapi/PKG1/idevice/IDEVICE-A" },
  "result": {
    "score": { "scaled": 0.8, "raw": 8, "min": 0, "max": 10 },
    "success": true,
    "completion": true
  },
  "context": {
    "extensions": {
      "https://exelearning.net/xapi/extensions/package-id": "PKG1",
      "https://exelearning.net/xapi/extensions/idevice-id": "IDEVICE-A",
      "https://exelearning.net/xapi/extensions/idevice-type": "quiz",
      "https://exelearning.net/xapi/extensions/idevice-order": 1,
      "https://exelearning.net/xapi/extensions/idevice-weight": 25
    }
  }
}
```

To reconstruct current package state, consumers should group statements by
attempt/registration and package, then retain the latest `answered` statement
for each stable `idevice-id`. A later answer replaces that iDevice's prior score;
answer history must not be summed.

Then add every iDevice in the [census](#the-idevice-census) that has no `answered`
statement, with a score of 0 and its published weight. Skipping this step is what
inflates a partial attempt. Then apply the same steps as
`gamification.scorm.getFinalScore()`, **in this order**:

1. **Sort** the latest statements by the numeric, 1-based `idevice-order`, which
   is the package render order across all pages. This order is the deterministic
   tie break in step 3, so it must be applied before it.
2. **Scale** each record: the score onto 0–100 (`result.score.scaled × 100`, which
   is what the reference consumer reads; `raw × 10` is equivalent since the emitter
   clamps onto its declared 0–10 scale) and clamp the weight onto 1–100.
3. **Normalize the weights to 100 integer points, before applying them.** Scale
   each weight by `100 / Σweights`, take the floor, and distribute the remaining
   `100 − Σfloors` points one at a time to the largest fractional remainders,
   resolving equal remainders by the package order from step 1.
4. **Apply** the apportioned integer weights: `Σ(score × points) / 100`, rounded
   to two decimals.

Normalizing after multiplying instead — that is, a plain continuous weighted mean
— agrees on tie-free inputs but diverges by up to a normalized point when
remainders tie. For weights 25 and 75 with scores 100 and 40, both give
`(100 × 25 + 40 × 75) / 100 = 55`; for three equal weights with scores 100, 0 and
0, the contract gives `34` (the first iDevice in package order receives the extra
point) while a continuous mean gives `33.33`.

Because every per-iDevice statement contains its stable identity, score, weight
and package-global order, this reconstruction works across multi-page
publications even though each page has a separate JavaScript context.

**Multi-page packages emit no package-level verdict.** Each page only knows the
scores answered on that page, so a page-local aggregate wearing the package
Activity IRI would let one page report `passed` and another `failed` for the same
activity within one attempt. `completed` and `passed`/`failed` are therefore
emitted only when the package is a single page (`window.exeXapi.pageCount === 1`,
which the exporters inject). For every other package the reconstruction above is
the authority. See
[ADR-2302-01](../architecture/adr/ADR-2302-01-expose-xapi-weight-and-order.md).

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
