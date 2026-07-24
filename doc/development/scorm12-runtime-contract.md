# SCORM 1.2 runtime contract

This document records the **public contract** between exported SCORM 1.2 content
and the SCORM runtime scripts that ship inside every SCORM 1.2 package
(`libs/SCORM_API_wrapper.js` and `libs/SCOFunctions.js`). It was extracted by
auditing every consumer in this repository before the runtime rewrite
(see [ADR-0001](../architecture/adr/ADR-0001-scorm12-runtime-rewrite.md)) and is
the specification the project-owned runtime in
`public/app/common/scorm/scorm12/` implements.

Anything listed here is load-bearing: exported packages, the
[moodle-mod_exelearning](https://github.com/exelearning/moodle-mod_exelearning)
plugin and third-party content authored against previous eXeLearning releases
call these symbols. Removing or renaming any of them breaks published content
silently.

## 1. Package layout contract

A SCORM 1.2 package contains exactly two runtime scripts, loaded in this order
from every page's `<head>`:

```html
<script src="libs/SCORM_API_wrapper.js"></script>
<script src="libs/SCOFunctions.js"></script>
```

(`../libs/…` on non-index pages.) These two **paths and names are frozen**:

- iDevice export runtimes lazy-load them by literal path when the head copy is
  missing (`public/files/perm/idevices/base/*/export/*.js`, e.g. `form.js`
  `loadSCORM_API_wrapper()` / `loadSCOFunctions()`, and the game bootstrap in
  `public/app/common/common.js` `initGame()` via
  `$game.scormAPIwrapper` / `$game.scormFunctions`).
- The Moodle plugin injects exactly these two `<script>` tags into served
  content (`classes/local/scorm/scorm_injector.php`).

The lazy-load gates are `typeof pipwerks === 'undefined'` (wrapper) and
`typeof scorm === 'undefined'` (SCOFunctions), therefore:

- `libs/SCORM_API_wrapper.js` **must define the global `pipwerks`**.
- `libs/SCOFunctions.js` **must define the global `scorm`** (plus the page
  globals in section 3) and must be self-contained given `pipwerks`.

## 2. Lifecycle wiring emitted by the exporter

`Scorm12Exporter` (via `PageRenderer`) marks pages with
`<body class="exe-export exe-scorm exe-scorm12">` and historically emitted:

- `onload="loadPage()"` on `<body>` (kept),
- `onunload="unloadPage()" onbeforeunload="unloadPage()"` on `<body>`
  (**removed by the rewrite**; the runtime now owns end-of-session handling via
  `pagehide`/`visibilitychange` — see ADR-0001).

Independently, `libs/exe_export.js` (shipped in every export) runs on every
page with the `exe-scorm` body class:

1. Polls until `typeof window.scorm !== 'undefined' && typeof window.loadPage
   === 'function'` (both globals are load gates and part of the contract).
2. Scans the page's iDevices to compute `isSCORM` — `true` when at least one
   activity on the page reports SCORM score saving (`isScorm` flag in iDevice
   options/JSON data).
3. Calls `window.loadPage()`.
4. Legacy behavior: registers `window.addEventListener('unload', () =>
   window.unloadPage(isSCORM))`. With the rewritten runtime it instead hands
   the flag to the runtime (`window.exeScorm12.setPageHasScoredActivities(isSCORM)`)
   and registers no unload listener; the legacy branch is kept for SCORM 2004
   packages and previously exported packages.

Note that `loadPage()` can therefore run **twice** (body `onload` attribute and
`exe_export.js`), in either order. It must be idempotent.

## 3. Global functions (page lifecycle contract)

Defined by `libs/SCOFunctions.js`. "Effect" describes the observable SCORM 1.2
data-model traffic (the new runtime reproduces the effects, not the legacy
implementation).

| Global | Signature | Called by | Effect on the SCORM 1.2 session |
|---|---|---|---|
| `loadPage()` | `() => void` | `<body onload>`, `exe_export.js` `initScorm()` | `LMSInitialize("")`; then entry status policy: read `cmi.core.lesson_status`; `""`/`"not attempted"` → set `"incomplete"`; any other value preserved (never downgraded). Starts the session-time clock. Idempotent. |
| `unloadPage(isSCORM)` | `(boolean?) => void` | legacy `unload` listener in old packages; kept callable | Ends the session once: if no terminal status (`completed`/`passed`/`failed`) was recorded, sets `cmi.core.lesson_status` to `"completed"` (`isSCORM` falsy — a page without scored activities is completed by viewing it) or `"incomplete"` (`isSCORM` true). Then writes `cmi.core.exit`, `cmi.core.session_time`, `LMSCommit("")`, `LMSFinish("")`. No-op if the session already ended. |
| `doQuit()` | `() => void` | legacy content | Ends the session once (exit policy + session time + commit + finish), without changing `cmi.core.lesson_status`. |
| `doBack()` | `() => void` | legacy content | Same observable effect as `doQuit()`. |
| `doContinue(status)` | `(string) => void` | legacy content | If `cmi.core.lesson_mode` is not `review`/`browse`, sets `cmi.core.lesson_status` to `status` (must be valid SCORM 1.2 vocabulary), then ends the session once. |
| `startTimer()` | `() => void` | legacy content | Restarts the session-time clock. |
| `computeTime()` | `() => void` | legacy content | Writes elapsed time to `cmi.core.session_time` (`HHHH:MM:SS.SS`). |
| `goBack()` / `goForward()` | `() => void` | legacy content | Inert compatibility stubs (log a warning). The legacy implementation depended on the non-standard `nav.event` element and only ever worked on Moodle 1.9; SCORM 1.2 exports hide in-content navigation (`hideNavigation`), so nothing generated by this exporter calls them. |
| `setComplete()` | `() => void` | packages exported with the inline fallback runtime | `cmi.core.lesson_status = "completed"`, `LMSCommit("")`. |
| `setIncomplete()` | `() => void` | packages exported with the inline fallback runtime | `cmi.core.lesson_status = "incomplete"`, `LMSCommit("")`. |
| `setScore(score, maxScore?, minScore?)` | `(number\|string, …) => void` | packages exported with the inline fallback runtime | Writes `cmi.core.score.raw` (and `.max`/`.min` when provided) as strings, then `LMSCommit("")`. **Note the legacy argument order: `(score, max, min)`.** |

`setComplete`/`setIncomplete`/`setScore` only ever existed in the exporter's
inline fallback runtime (`Scorm12Exporter.getScoFunctions()`), not in the
shipped `SCOFunctions.js`; they are kept because packages that shipped the
fallback exist in the wild and the new runtime replaces both variants.

The inline fallback itself is removed from the SCORM 1.2 path: it was a
divergent twin of the real runtime (its wrapper lacked `SetScoreMax`, which
verified callers require — see section 4), so a fallback package silently
misbehaved in an LMS. A SCORM 1.2 export now fails loudly when the runtime
files cannot be fetched. The SCORM 2004 exporter and its fallback are
untouched.

## 4. The `scorm` global (facade contract)

`window.scorm` is the object iDevices and games talk to. Verified direct
callers (in-repo):

| Member | Called from | Notes |
|---|---|---|
| `scorm.init()` | `common.js` `initGame()`, game/quiz iDevices (`trueorfalse.js`, `form.js`, …) | Must return **truthy when the session is already initialized** (the legacy fork changed pipwerks' "already active → false" to `true`; iDevice code gates SCORM setup on it). |
| `scorm.set(el, value)` / `scorm.get(el)` | `common.js` fallback branch, iDevices | Generic data-model access. |
| `scorm.save()` / `scorm.quit()` | legacy content, `form.js` (`endScorm`, currently inert) | Commit / terminate. `quit()` must be idempotent. |
| `scorm.SetScoreMax(n)` / `scorm.SetScoreMin(n)` | `common.js` `initGame()`, game iDevices | Feature-detected (`typeof … === 'function'`) with `scorm.set('cmi.core.score.max', …)` fallback — must exist to take the primary branch. |
| `scorm.GetLearnerName()` | `$exeDevices.iDevice.gamification.scorm.getUserName()` | Reads `cmi.core.student_name`. Feature-detected. |
| `scorm.GetScoreRaw()` | `$exeDevices.iDevice.gamification.scorm.getPreviousScore()` | Reads `cmi.core.score.raw`. Feature-detected. |

In addition, the legacy wrapper exposed the following eXe extension methods on
the same object since 2021. They are retained as part of the facade because
third-party/authored content may call any of them (all are thin, validated
mappings onto the SCORM 1.2 data model; SCORM 2004-only concepts degrade to
their documented 1.2 behavior):

`isAvailable()`, `GetDataModelVersion()`, `GetCompletionStatus()`,
`SetCompletionStatus(status)`, `SetCompletionScormActivity(status)`,
`GetExit()`, `SetExit(exit)`, `GetInteractionValue(key)`,
`SetInteractionValue(key, value)`, `GetLearnerId()`, `GetLearnerName()`,
`GetMode()`, `SetMode(mode)`, `GetScoreMax()`, `SetScoreMax(n)`,
`GetScoreMin()`, `SetScoreMin(n)`, `GetScoreRaw()`, `SetScoreRaw(n)`,
`SetScoreScaled()` (no-op in 1.2), `GetSessionTime()`, `SetSessionTime(t)`,
`GetSuccessStatus()` (reads `cmi.core.lesson_status` in 1.2),
`SetSuccessStatus(status)` (validated no-op in 1.2 — `cmi.core.lesson_status`
is the single status element and success writes were never applied by the
legacy wrapper either).

The facade also exposes `version` (`"1.2"`) and `connection` (the pipwerks
connection object, so `scorm.connection.isActive` keeps working).

**The extension methods must also exist on `pipwerks.SCORM` itself.** Verified
callers hit them on the pipwerks object directly, not through the facade:

- `geogebra-activity.js` calls `pipwerks.SCORM.SetScoreMax('100')` /
  `SetScoreMin('0')` **unguarded** — a missing method is an uncaught
  `TypeError`.
- `form.js`, `trueorfalse.js` and `scrambled-list.js` feature-detect
  `SetScoreMax` but their fallback branch calls the very same method, so the
  guard is decorative and the requirement is real.

Because the vendored upstream wrapper must stay byte-identical, the adapter
layer attaches these methods to `pipwerks.SCORM` at runtime (additive only —
no upstream member is replaced).

## 5. The `pipwerks` global

Game score persistence in `common.js` (`$exeDevices.iDevice.gamification.scorm`)
bypasses the facade and calls the wrapper directly once the session is active:

- `pipwerks.SCORM.get('cmi.suspend_data')` / `pipwerks.SCORM.set('cmi.suspend_data', …)`
- `pipwerks.SCORM.get('cmi.core.score.raw')` / `pipwerks.SCORM.set('cmi.core.score.raw', …)`
- `pipwerks.SCORM.set('cmi.core.lesson_status', 'passed' | 'failed')`
- gate: `typeof pipwerks !== 'undefined' && pipwerks.SCORM`

The vendored upstream pipwerks wrapper satisfies this surface unmodified: its
`data.get`/`data.set` operate once `connection.isActive` is true, and the
project client layer initializes that same connection.

## 6. Expected session sequence (normal page view)

```
LMSInitialize("")
LMSGetValue("cmi.core.lesson_status")           → entry policy
[LMSSetValue("cmi.core.lesson_status", "incomplete")]   (only when "" / "not attempted")
… content traffic (scores, suspend_data, explicit status) …
-- end of session (controlled navigation, doQuit/doContinue, or pagehide) --
[LMSSetValue("cmi.core.lesson_status", …)]      (exit completion policy, only if no terminal status)
LMSSetValue("cmi.core.exit", "suspend" | "")
LMSSetValue("cmi.core.session_time", "HHHH:MM:SS.SS")
LMSCommit("")
LMSFinish("")
```

`visibilitychange → hidden` triggers `LMSCommit("")` only; the session stays
usable. After `LMSFinish` every further runtime call is rejected locally and
reported to the console — nothing is forwarded to the LMS.

## 7. Verified consumer inventory (sources)

- `src/shared/export/exporters/Scorm12Exporter.ts` — head scripts, body class,
  `onLoadScript`/`onUnloadScript`, fallback inline runtime.
- `src/shared/export/renderers/PageRenderer.ts` — `onload`/`onunload`/
  `onbeforeunload` body attribute emission.
- `public/app/common/exe_export.js` — `loadScorm()`/`initScorm()` polling gate,
  `isSCORM` computation, `loadPage()`/`unloadPage(isSCORM)` invocation.
- `public/app/common/common.js` — `initGame()` SCORM bootstrap, gamification
  helpers (`getUserName`, `getPreviousScore`, `getActivityScore`,
  `getTotalScore`, `createScoreScormHtml`, `updateScormNew`, `sendScoreNew`)
  and their direct `pipwerks.SCORM` traffic.
- `public/files/perm/idevices/base/*/export/*.js` — per-iDevice
  `loadSCORM_API_wrapper`/`loadSCOFunctions` lazy-loaders and
  `scorm.init`/`SetScoreMax`/`SetScoreMin` usage (e.g. `form.js`,
  `trueorfalse.js`, and the game iDevices through `initGame()`).
- `moodle-mod_exelearning` — `assets/scorm/*` copies (functionally identical to
  this repo's legacy files) and `classes/local/scorm/scorm_injector.php`.
- Real exported package fixtures under `test/fixtures/export/*_scorm/`.

Symbols that appear SCORM-related but are **not** part of this contract:
iDevice-internal methods that happen to share names (`$form.setScore`,
`$periodicTable.setCompleteScore`, `$exeDevices.iDevice.gamification.scorm.*`
helper names such as `registerActivity`/`sendScoreNew`/`endScorm` — these live
in `common.js`, travel with the package, and call the contract surface above).
