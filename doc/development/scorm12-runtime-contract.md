# SCORM 1.2 runtime contract

This document records the **public contract** between exported SCORM 1.2 content
and the SCORM runtime scripts that ship inside every SCORM 1.2 package
(`libs/SCORM_API_wrapper.js` and `libs/SCOFunctions.js`). It was extracted by
auditing every consumer in this repository before the runtime rewrite
(see [ADR-2209-01](../architecture/adr/ADR-2209-01-scorm12-runtime-rewrite.md)) and is
the specification the project-owned runtime in
`public/app/common/scorm/scorm12/` implements. The activity completion model it
refers to is decided in
[ADR-2209-02](../architecture/adr/ADR-2209-02-scorm12-activity-completion-registry.md).

Anything listed here is load-bearing: exported packages, the
[moodle-mod_exelearning](https://github.com/exelearning/moodle-mod_exelearning)
plugin and third-party content authored against previous eXeLearning releases
call these symbols. Removing or renaming any of them breaks published content
silently.

Throughout, each rule is labelled with where it comes from:

| Label | Meaning |
|---|---|
| **[SCORM]** | Required by the SCORM 1.2 Run-Time Environment specification or its Conformance Requirements. |
| **[BROWSER]** | Required by, or chosen because of, browser page-lifecycle behaviour. |
| **[LEGACY]** | Required for compatibility with content eXeLearning already published. |
| **[POLICY]** | An eXeLearning product decision that SCORM 1.2 does not dictate. |

Primary sources for every **[SCORM]** rule: ADL, *SCORM Version 1.2 — The SCORM
Run-Time Environment* (2001-10-01), §3.3–§3.4; ADL, *SCORM Version 1.2
Conformance Requirements*; ADL, *The SCORM Addendums Version 2.0* (2002-01-04),
which corrects several error codes printed in the RTE. Where the RTE and the
Conformance Requirements disagree, the Conformance Requirements win — they are
what the ADL Conformance Test Suite asserts.

## 1. Package layout contract

A SCORM 1.2 package contains exactly two runtime scripts, loaded in this order
from every page's `<head>`:

```html
<script src="libs/SCORM_API_wrapper.js"></script>
<script src="libs/SCOFunctions.js"></script>
```

(`../libs/…` on non-index pages.) These two **paths and names are frozen**
**[LEGACY]**:

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

`libs/SCOFunctions.js` is assembled by
`src/shared/export/utils/Scorm12Runtime.ts` from five source layers, in load
order. Four of them are **required**; `exe-scorm12-activities.js` is optional,
and the adapter's install guard says so explicitly. That is a tolerance, not a
shipped configuration: a host that assembles the runtime without the registry
still gets a working runtime (`exe-scorm12-policy.js` degrades to its
page-level fallback), but eXeLearning's own SCORM exports always ship all five,
and so does the Moodle plugin — `moodle-mod_exelearning` PR #105 vendors the
complete assembled file, byte-identical to the exporter's output (§12).

| Layer | Responsibility |
|---|---|
| `exe-scorm12-client.js` | LMS communication, session state machine, session clock. Holds no policy. |
| `exe-scorm12-activities.js` | Activity registry and aggregation. Talks to no one — pure data. |
| `exe-scorm12-policy.js` | eXeLearning status, completion, success and score policy. |
| `exe-scorm12-lifecycle.js` | Browser lifecycle; the only place that terminates the session. |
| `exe-scorm12-adapter.js` | The legacy globals, the `scorm` facade, the `pipwerks.SCORM` augmentation. The only layer that creates globals. |

## 2. Lifecycle wiring emitted by the exporter

`Scorm12Exporter` (via `PageRenderer`) marks pages with
`<body class="exe-export exe-scorm exe-scorm12">` and historically emitted:

- `onload="loadPage()"` on `<body>` (kept),
- `onunload="unloadPage()" onbeforeunload="unloadPage()"` on `<body>`
  (**removed by the rewrite**; the runtime owns end-of-session handling via
  `pagehide`/`pageshow`/`visibilitychange`) **[BROWSER]**.

Independently, `libs/exe_export.js` (shipped in every export) runs on every
page with the `exe-scorm` body class:

1. Polls until `typeof window.scorm !== 'undefined' && typeof window.loadPage
   === 'function'` (both globals are load gates and part of the contract).
2. Scans the page's iDevices to compute `isSCORM` — `true` when at least one
   activity on the page reports SCORM score saving (`isScorm` flag in iDevice
   options/JSON data).
3. When the runtime is present (`window.exeScorm12.setPageHasScoredActivities`
   is a function), hands the flag to it **before** calling `loadPage()`
   (`window.exeScorm12.setPageHasScoredActivities(isSCORM)`), so the entry
   policy that `loadPage()` applies already knows whether scored iDevices exist
   (a presentation iDevice may have registered on jQuery ready). It registers
   no lifecycle listener of its own.
4. Calls `window.loadPage()`. For SCORM 2004 packages and packages exported
   before the rewrite (no runtime present) it calls `loadPage()` first and then
   falls back to a `pagehide` listener calling `window.unloadPage(isSCORM)` —
   skipped when `event.persisted === true`, because a page frozen into the
   back/forward cache may be restored intact and ending the LMS session then
   would close an attempt the learner has not left.

Note that `loadPage()` can therefore run **twice** (body `onload` attribute and
`exe_export.js`), in either order. It must be idempotent **[LEGACY]**.

### 2.1 No unload-family handlers anywhere in the package **[BROWSER]**

A newly exported SCORM 1.2 package contains **zero** `unload` / `beforeunload`
handlers — not in body attributes, not in inline scripts, not in the runtime
libraries, not in the iDevice JavaScript copied into it. Registering one makes
the page ineligible for the back/forward cache, which the runtime depends on,
and the events are unreliable on mobile.

This is enforced, not merely intended:
`test/helpers/unload-handler-scanner.ts` scans every HTML/JS/XML entry of a real
exported ZIP for handler *registrations* (attribute, property assignment,
`addEventListener`, jQuery `on`/`one`/`bind`, jQuery shorthand, including
combined namespaced event strings), and
`test/integration/export/scorm12-exporter.spec.ts` asserts the result is empty
for a minimal package, for the real ELPX fixture and for a package containing
ten SCORM-capable iDevice types.

The scanner has exactly one allowlist entry, `libs/jquery/jquery.min.js`: the
vendored jQuery contains `t.addEventListener("unload", M)` inside Sizzle's
`setDocument`, guarded by `r.msMatchesSelector && … && t.top !== t`.
`msMatchesSelector` exists only on Internet Explorer and legacy Edge, so on
every engine that implements a back/forward cache the expression short-circuits
and no listener is ever registered. The entry is an exact path, never a pattern.

## 3. Global functions (page lifecycle contract)

Defined by `libs/SCOFunctions.js`. "Effect" describes the observable SCORM 1.2
data-model traffic (the new runtime reproduces the effects, not the legacy
implementation).

| Global | Signature | Called by | Effect on the SCORM 1.2 session |
|---|---|---|---|
| `loadPage()` | `() => void` | `<body onload>`, `exe_export.js` `initScorm()` | Opens the session as a SCO through `exeScorm12.session.open({ ownsLifecycle: true })`: `LMSInitialize("")`, then the entry policy (§6), the session clock and the lifecycle listeners. Idempotent. **The first successful open decides who owns the page lifecycle**: when a host opened the session first declining ownership (`session.open({ ownsLifecycle: false })`, the Moodle plugin), a later `loadPage()` installs no lifecycle and re-runs nothing; when the SCO opened first, a later host open does not uninstall it. |
| `unloadPage(isSCORM)` | `(boolean?) => void` | legacy `pagehide` bridge in old packages; kept callable | Ends the session once, applying the completion rule (§7). No-op if the session already ended. |
| `doQuit()` | `() => void` | legacy content | Ends the session once (exit policy + session time + commit + finish), without applying the completion rule. |
| `doBack()` | `() => void` | legacy content | Same observable effect as `doQuit()`. |
| `doContinue(status)` | `(string) => void` | legacy content | If `cmi.core.lesson_mode` is not `review`/`browse`, sets `cmi.core.lesson_status` to `status` (must be a value a SCO may write), then ends the session once. |
| `startTimer()` | `() => void` | legacy content | Restarts the session clock, dropping the time already counted. |
| `computeTime()` | `() => void` | legacy content | Writes elapsed time to `cmi.core.session_time` (`HHHH:MM:SS.SS`). |
| `goBack()` / `goForward()` | `() => void` | legacy content | Inert compatibility stubs (log a warning). The legacy implementation depended on the non-standard `nav.event` element and only ever worked on Moodle 1.9; SCORM 1.2 exports hide in-content navigation, so nothing generated by this exporter calls them. |
| `setComplete()` | `() => void` | packages exported with the inline fallback runtime | `cmi.core.lesson_status = "completed"`, `LMSCommit("")`. |
| `setIncomplete()` | `() => void` | packages exported with the inline fallback runtime | `cmi.core.lesson_status = "incomplete"`, `LMSCommit("")`. |
| `setScore(score, maxScore?, minScore?)` | `(number\|string, …) => void` | packages exported with the inline fallback runtime | Writes `cmi.core.score.raw` (and `.max`/`.min` when provided), then `LMSCommit("")` **if the required raw score was accepted** (§8). **Note the legacy argument order: `(score, max, min)`.** |

`setComplete`/`setIncomplete`/`setScore` only ever existed in the exporter's
inline fallback runtime (`Scorm12Exporter.getScoFunctions()`), not in the
shipped `SCOFunctions.js`; they are kept because packages that shipped the
fallback exist in the wild and the new runtime replaces both variants
**[LEGACY]**.

The inline fallback itself is removed from the SCORM 1.2 path: it was a
divergent twin of the real runtime (its wrapper lacked `SetScoreMax`, which
verified callers require — see §4), so a fallback package silently misbehaved in
an LMS. A SCORM 1.2 export now fails loudly when the runtime files cannot be
fetched. The SCORM 2004 exporter and its fallback are untouched.

## 4. The `scorm` global (facade contract)

`window.scorm` is the object iDevices and games talk to. Verified direct
callers (in-repo):

| Member | Called from | Notes |
|---|---|---|
| `scorm.init()` | `common.js` `initGame()`, game/quiz iDevices (`trueorfalse.js`, `form.js`, …) | Must return **truthy when the session is already initialized** (the legacy fork changed pipwerks' "already active → false" to `true`; iDevice code gates SCORM setup on it) **[LEGACY]**. |
| `scorm.set(el, value)` / `scorm.get(el)` | `common.js` fallback branch, iDevices | Generic data-model access, filtered by the element access rules in §5. A `set()` on `cmi.core.lesson_status` routes through `policy.setContentStatus()`: the SCO-writable vocabulary is validated locally and the policy's session claim is released (§9.1). |
| `scorm.save()` / `scorm.quit()` | legacy content, `form.js` (`endScorm`, inert) | Commit / terminate. `quit()` routes through the lifecycle layer and is idempotent. |
| `scorm.SetScoreMax(n)` / `scorm.SetScoreMin(n)` | `common.js` `initGame()`, game iDevices | Feature-detected (`typeof … === 'function'`) with a `scorm.set('cmi.core.score.max', …)` fallback — must exist to take the primary branch. |
| `scorm.GetLearnerName()` | `$exeDevices.iDevice.gamification.scorm.getUserName()` | Reads `cmi.core.student_name`. Feature-detected. |
| `scorm.GetScoreRaw()` | `$exeDevices.iDevice.gamification.scorm.getPreviousScore()` | Reads `cmi.core.score.raw`. Feature-detected. |
| `scorm.activities` | `common.js` `reportActivity()` | The activity registry (§9). Absent in SCORM 2004 packages, so every caller feature-detects it. |

In addition, the legacy wrapper exposed eXe extension methods on the same
object since 2021. They are all retained, because third-party or authored
content may call any of them. **A compatibility method existing does not mean
the underlying LMS operation is valid in SCORM 1.2**, so each is classified:

| Kind | Meaning |
|---|---|
| **LMS call** | A legal SCORM 1.2 data model operation; reaches the LMS. |
| **local cache** | The element is write-only in SCORM 1.2, so reading it from the LMS would be error 404. Answered from what this runtime last wrote; no LMS traffic. |
| **no-op** | The element is read-only, or the concept does not exist in SCORM 1.2. The method stays callable and reports; no LMS traffic. |
| **central** | Routed through the lifecycle layer instead of acting directly. |

| Method | Kind | Behaviour |
|---|---|---|
| `isAvailable()` | no-op | Always `true` (legacy Flash handshake). |
| `GetDataModelVersion()` | LMS call | Reads `cmi._version`. |
| `GetCompletionStatus()` | LMS call | Reads `cmi.core.lesson_status`. |
| `SetCompletionStatus(status)` | LMS call | Writes `cmi.core.lesson_status`, but only values a SCO may write (§6), through `policy.setContentStatus()` — the write releases the policy's session claim (§9.1). |
| `SetCompletionScormActivity(status)` | LMS call | Alias of `SetCompletionStatus`. |
| `GetExit()` | **local cache** | `cmi.core.exit` is write-only **[SCORM]**; returns the last value this runtime wrote, `""` if none. |
| `SetExit(exit)` | LMS call | Writes `cmi.core.exit`; the SCORM 2004 value `"normal"` maps to `""`. |
| `GetInteractionValue(key)` | **local cache** for interaction leaves, LMS call for `cmi.interactions._count` / `._children` | Every `cmi.interactions.n.*` leaf is write-only in SCORM 1.2 **[SCORM]**. |
| `SetInteractionValue(key, value)` | LMS call | Writes the element. |
| `GetLearnerId()` / `GetLearnerName()` | LMS call | Read `cmi.core.student_id` / `cmi.core.student_name`. |
| `GetMode()` | LMS call | Reads `cmi.core.lesson_mode`; answers `"normal"` when the LMS does not implement that optional element **[SCORM]**. |
| `SetMode(mode)` | **no-op** | `cmi.core.lesson_mode` is read-only **[SCORM]**; the legacy setter could only ever have produced error 403. Warns and makes no LMS call. |
| `GetScoreMax()` / `GetScoreMin()` | LMS call | Read the optional bounds; `""` when the LMS does not implement them. |
| `SetScoreMax(n)` / `SetScoreMin(n)` | LMS call | Write the optional bounds; `false` may simply mean "not implemented". |
| `GetScoreRaw()` / `SetScoreRaw(n)` | LMS call | Read/write `cmi.core.score.raw`. |
| `SetScoreScaled()` | **no-op** | SCORM 2004 concept; no scaled score exists in 1.2. |
| `GetSessionTime()` | **local cache** | `cmi.core.session_time` is write-only **[SCORM]**. |
| `SetSessionTime(t)` | LMS call | Writes a CMITimespan. |
| `GetSuccessStatus()` | LMS call | Reads `cmi.core.lesson_status` (the single status element in 1.2). |
| `SetSuccessStatus(status)` | **no-op** | Success and completion are one element in SCORM 1.2. Parity with the legacy wrapper, which never wrote a success status in 1.2 either. Use `SetCompletionStatus('passed'\|'failed')`. |
| `scorm.quit()` | **central** | Delegates to the lifecycle layer's single finalization. |

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
layer attaches these methods to the `pipwerks.SCORM` **object** at runtime
(additive only — no upstream member is replaced). The one exception is
described in §10.

## 5. SCORM 1.2 element access rules enforced by the runtime **[SCORM]**

The client layer refuses locally the calls SCORM 1.2 forbids, so a legacy
compatibility method can never turn into an invalid LMS call:

| Rule | Elements | Behaviour |
|---|---|---|
| Write-only: reading is error 404 | `cmi.core.exit`, `cmi.core.session_time`, every `cmi.interactions.n.*` leaf | `client.getValue()` returns the local write cache; no `LMSGetValue` is sent. |
| Read-only: writing is error 403 | `cmi._version`, `cmi.core.student_id`, `cmi.core.student_name`, `cmi.core.credit`, `cmi.core.entry`, `cmi.core.total_time`, `cmi.core.lesson_mode`, `cmi.launch_data`, `cmi.comments_from_lms`, `cmi.student_data.*` | `client.setValue()` returns `false` with error code 403 and sends nothing. |
| Keyword: writing is error 402 | anything ending in `._children` / `._count`, plus `cmi._version` | Same, with error code 402. |
| Optional elements | `cmi.core.score.min`, `cmi.core.score.max`, `cmi.core.lesson_mode`, `cmi.student_data.mastery_score`, `cmi.objectives.*`, `cmi.interactions.*`, `cmi.student_preference.*`, `cmi.comments*` | Probed through `client.getOptionalValue()`, which reports `supported: false` for error 401 instead of logging a failure. Probing is expected of a SCO. |

Failures are never swallowed: every LMS-level failure is reported to the
console with the operation, the element name and the LMS error code and string
from `LMSGetLastError`/`LMSGetErrorString`. Diagnostics never include learner
names, responses, scores or suspend data.

## 6. Entry policy

Applied once, immediately after `LMSInitialize`. It is idempotent: a second
call — a host opening the session after `loadPage()`, or the reverse — reads and
writes nothing, and a call without an open session applies nothing and does not
count as applied.

1. Read `cmi.core.lesson_status`. `""` or `"not attempted"` → write
   `"incomplete"`; any other value is preserved — a status is never downgraded
   **[POLICY]**. (The legacy runtime converted `incomplete` to `unknown`, which
   the wrapper mapped to `not attempted`, erasing progress on every page view.)
2. Probe the optional `cmi.student_data.mastery_score`. When the LMS publishes
   one in 0–100 it becomes the success threshold; otherwise the eXeLearning
   default of 50 stays in force **[POLICY]**.
3. Restore the activity registry from `cmi.suspend_data` (§9).

`"not attempted"` is never written by the runtime: SCORM 1.2 requires the LMS to
refuse that value from a SCO **[SCORM]**.

## 7. Browser lifecycle **[BROWSER]**

The runtime registers exactly three listeners and no unload-family handler:

| Event | Condition | Action |
|---|---|---|
| `visibilitychange` | `document.visibilityState === 'hidden'` | Persist: reconcile the lesson status against the registry (see §9.1), write the registry into `cmi.suspend_data` and the elapsed `cmi.core.session_time`, then `LMSCommit("")`. **Never finishes.** The learner may come back, and SCORM 1.2 has no concept of a hidden SCO. |
| `pagehide` | `event.persisted === false` (or absent) | Full end of session: exit policy → `cmi.core.session_time` → `LMSCommit` → `LMSFinish`, exactly once. |
| `pagehide` | `event.persisted === true` | The page is being frozen into the back/forward cache. Persist (same sequence as `hidden`) and **pause the session clock**; do **not** terminate — the page may be restored intact. |
| `pageshow` | `event.persisted === true` | Restored from the cache. Resume the session clock. Nothing is re-initialized: the LMS session was never closed. |

Why the split matters: a document frozen into the back/forward cache can be
evicted later with **no further event of any kind**. All durable work therefore
happens synchronously inside the `pagehide` handler; nothing is deferred to a
later event.

`pagehide` fires *before* `visibilitychange → hidden` during an unload (WHATWG
"unload a Document" fires `pagehide` at step 10 and updates visibility at step
11), and neither event alone is sufficient — `visibilitychange` does not fire on
unload when the document was already hidden, and `pagehide` does not fire on a
mobile app switch. Both handlers are therefore idempotent and gated by the same
state machine.

**Known limitation.** If a mobile browser kills a hidden page without firing
`pagehide`, the session data is committed but `LMSFinish` is never sent; the LMS
closes the attempt by its own timeout. Committing on `visibilitychange → hidden`
is the mitigation, and it is why that handler exists.

### 7.1 Session timing **[POLICY]**

`cmi.core.session_time` is the total duration of the current session, not a
delta, and SCORM 1.2 requires the LMS to overwrite rather than accumulate
repeated writes **[SCORM]**. The runtime therefore always writes the total, and
repeated hidden/visible cycles can never double count.

| Moment | Clock |
|---|---|
| `loadPage()` succeeds | starts |
| `visibilitychange → hidden` | keeps running (the learner may still be reading) |
| `pagehide` persisted=true | pauses — frozen time is not learning time |
| `pageshow` persisted=true | resumes |
| `startTimer()` | restarts, dropping the time already counted (legacy semantics) |
| end of session | the total is written one last time |

## 8. Score writes **[SCORM] + [POLICY]**

`cmi.core.score.raw` is mandatory in SCORM 1.2; `cmi.core.score.min` and
`cmi.core.score.max` are optional, and an LMS may accept the raw score while
answering 401 "not implemented" for the bounds **[SCORM]**.

`policy.setScoreDetailed(raw, min, max)` therefore returns a structured result:

```js
{
    valid: true,                 // the triplet passed validation
    problem: null,               // or 'raw-out-of-range', 'min-above-raw', …
    required: { element: 'cmi.core.score.raw', attempted: true, written: true, errorCode: 0 },
    optional: [ { element: 'cmi.core.score.min', written: false, unsupported: true, errorCode: 401 }, … ],
    requiredWritten: true,
    optionalFailures: ['cmi.core.score.min'],
    ok: false                    // the legacy boolean: every attempted write succeeded
}
```

`policy.setScore()` still returns the boolean, and `setScore()` (the page
global) commits whenever `requiredWritten` is true — a score the LMS recorded is
never lost because an optional element is missing.

Validation before any write **[POLICY]**: raw, min and max must be numbers in
0–100, and `min ≤ raw ≤ max` must hold. SCORM 1.2 only constrains the range; the
consistency requirement is eXeLearning's, because an inconsistent triplet is a
content bug and recording it would store a meaningless score.

The optional bounds are written through `client.setOptionalValueDetailed()`
(the write-side mirror of `getOptionalValue()`): a 401 answer is a conforming
LMS skipping an optional element, so nothing is logged for it — the report
still records `unsupported: true`. Every other error code is reported as
usual.

When the mandatory `cmi.core.score.raw` write itself fails (a broken LMS —
the triplet was already validated), the completion policy still decides and
records `cmi.core.lesson_status` **[POLICY]**: completion is not held hostage
by score storage, SCORM 1.2 does not make the status depend on a stored
score, and this matches the pre-rewrite behaviour. The failure stays visible
in `setScoreDetailed()`'s report (`requiredWritten: false`).

## 9. Activity registry and completion policy

Full rationale: [ADR-2209-02](../architecture/adr/ADR-2209-02-scorm12-activity-completion-registry.md).

`window.scorm.activities` (`exeScorm12.activities`) tracks every activity on the
page. It performs **aggregation only** — it never talks to the LMS and holds no
policy:

```js
scorm.activities.register('idevice-node-id', {
    evaluable: true,          // produces a score
    completionRequired: true, // must be finished for the page to be complete
    completed: false,
    answered: 2, total: 5,
    score: 40,                // in the activity's own scale
    minimumScore: 0, maximumScore: 100,
    weight: 1
});
scorm.activities.update('idevice-node-id', { completed: true, score: 80 });
scorm.activities.summary();   // { total, evaluable, required, requiredCompleted,
                              //   hasRequired, allRequiredComplete, answered,
                              //   questions, score }
```

Registration is idempotent: re-registering an id updates the declaration and
keeps the progress already reported, so a re-rendered iDevice never resets the
learner's state. Every flag is explicit — nothing is inferred from incidental
iDevice properties such as `gameOver`.

`common.js` bridges eXeLearning's game iDevices onto it
(`$exeDevices.iDevice.gamification.scorm.reportActivity`), declaring
`evaluable`/`completionRequired` from the iDevice's own `isScorm` flag and
passing `completed` explicitly from the call site.

### 9.1 Completion and success mapping **[POLICY]**

SCORM 1.2 has a single status element, so eXeLearning's separate notions of
completion and success collapse onto `cmi.core.lesson_status`:

| Registry state | `cmi.core.lesson_status` | `cmi.core.exit` |
|---|---|---|
| No required evaluable activity | `completed` (the page is completed by being viewed) | `""` |
| At least one required activity still incomplete | `incomplete` | `suspend` |
| All required complete, no success threshold in force | `completed` | `""` |
| All required complete, aggregate ≥ threshold | `passed` | `""` |
| All required complete, aggregate < threshold | `failed` | `""` |

- **Presentation-only and exploration activities never block completion.** They
  register with `completionRequired: false`. This is the chosen policy of the
  two the requirement allowed; it means such an iDevice does not need to report
  a "viewed" state to let the page complete.
- **A manually submitted score counts as completing the activity** **[POLICY]**.
  The gamification bridge reports `completed: true` when the game is over *or*
  the learner pressed the send-score button (`sendScoreNew(auto=false)`).
  Submitting is the learner's explicit act of finishing the attempt, and it is
  the only completion signal games without a game-over state can give — without
  it, such an activity would hold its page at `incomplete` forever. An iDevice
  with a richer notion of completion can report `completed` itself through
  `scorm.activities.update()`.
- **One aggregation algorithm** **[POLICY]**. The registry's
  `summary().score` is the historical eXeLearning weighting (weights scaled to
  integers summing to exactly 100 by largest-remainder rounding, then a
  weight-scaled sum). `common.js`'s `getFinalScore()` delegates to it whenever
  the runtime is present, so the displayed score, the recorded
  `cmi.core.score.raw`, the in-session status decision and the exit decision
  all read the same number. Two algorithms (the historical one in-session, an
  exact weighted mean at exit) could disagree near the mastery threshold —
  e.g. 100/49/0 at equal weights is 50.17 historically but 49.67 exactly —
  and flip a passed page to failed on the way out.
- **The policy may correct its own verdict, never someone else's.** A terminal
  status the policy wrote during this session is downgraded back to
  `incomplete` whenever the decision returns to `required-activities-pending`
  — a *required* activity registering afterwards (deferred iDevice
  initialisation) **or** a replay reporting `completed: false` for an activity
  that had been complete — because the page demonstrably is not finished. A
  terminal status restored from a previous attempt, or written explicitly by content
  (`setComplete()`, `SetCompletionStatus()`), is never downgraded — and
  merely *agreeing* with a stored status never claims it: ownership is taken
  only when the policy successfully writes the value itself, and the explicit
  content entry points (`setCompleted()`, `setPassed()`, `setFailed()`,
  `setIncomplete()`, `doContinue(status)`, `SetCompletionStatus()`,
  `scorm.set('cmi.core.lesson_status', …)`,
  `pipwerks.SCORM.set('cmi.core.lesson_status', …)`,
  `pipwerks.SCORM.status('set', …)`) *clear* the claim — even when they
  repeat the value the policy last wrote, ratifying a verdict makes it
  content's. The correction
  runs at two moments (`policy.reconcilePendingActivities()`): when an
  activity registers, and before every mid-session persist — so a page killed
  right after a `hidden` commit never leaves the LMS holding a stale terminal
  verdict alongside a registry with pending required work. Reconciliation
  only acts when required work is pending; it never emits a transient
  passed/failed verdict while a page is still registering its activities.
- **`cmi.core.exit` follows the status the LMS actually stored.** If the LMS
  rejects the status write at exit, the exit value is computed from the value
  still in force (typically `suspend`), never from the decision the LMS
  refused — reporting a normal end for a still-incomplete attempt would close
  it prematurely.
- The success threshold is `cmi.student_data.mastery_score` when the LMS
  publishes one, otherwise **50**, which is the threshold eXeLearning game
  iDevices have always applied. `policy.setSuccessThreshold(null)` disables the
  pass/fail distinction entirely, leaving completion only.
- The **exit policy** never downgrades: a terminal status (`passed`,
  `completed`, `failed`) already recorded is preserved.
- The **in-session re-evaluation** (`policy.recordActivityOutcome()`, called by
  `common.js` after each score update) may move *between* terminal statuses, so
  a learner who retries a failed activity and passes ends up `passed`. It never
  replaces a terminal status with a non-terminal one.
- Pages whose iDevices never register fall back to the page-level
  `setPageHasScoredActivities(isSCORM)` flag: a scored page stays `incomplete`,
  an unscored page is `completed`. This is the pre-registry behaviour and keeps
  content that predates the registry working.

### 9.2 `cmi.suspend_data` payload **[SCORM] + [POLICY]**

The registry serialises itself into `cmi.suspend_data`:

```
exe12/1|<uri-encoded id>;<flags>;<answered>;<total>;<score>;<weight>;<min>;<max>|…
```

- **Single owner**: on a SCORM 1.2 page the registry is the *only* writer of
  `cmi.suspend_data`. Every `common.js` helper that used to read or write the
  legacy line format directly (`registerActivity`, `updateActivity`,
  `sendScoreNew`, `showFinalScore`, `createScoreScormHtml`,
  `getActivityScore`) goes through the registry when the runtime is present
  (`buildLmsDataFromRegistry()` presents it in the legacy shape for display
  code; the aggregate itself always comes from the registry's `summary()` —
  see §9.1). Two writers alternating formats would
  corrupt each other's view on resume. The legacy code paths remain for SCORM
  2004 packages and packages exported before the rewrite, where the runtime is
  absent.
- **Field semantics**: `flags` is a bit set — `1` evaluable, `2`
  completion-required, `4` completed. `score` is the activity's last reported
  score in its own scale (`min`–`max`), and it is **empty** when the activity
  has not produced a score yet (`activity.score === null`). An empty `score`
  on an evaluable record therefore means: the activity is registered and
  gradable, it has produced no score, and — **as currently implemented** — the
  SCO's own aggregate (`summary().score`, the value written to
  `cmi.core.score.raw` once any activity has scored) counts it as **0 with its
  full weight** (`exe-scorm12-activities.js` `normalizedScore()` /
  `aggregateScore()`). A page with two equally weighted required activities,
  one answered at 100 and one never touched, therefore reports
  `cmi.core.score.raw = 50`. A consumer that grades per record from this
  payload must either mirror that rule or document that its aggregate is not
  the SCO's `score.raw`: `moodle-mod_exelearning` PR #105 currently drops such
  records (`js/scorm_tracker.js` `decodeExe12Record`,
  `classes/local/track.php::decode_exe12_record`) and would grade the same page
  100. Whether an unscored evaluable activity should weigh 0, its full weight,
  or be excluded is an **open product decision**; this bullet records the
  current behaviour, not a resolution.
- **Versioned**: the `exe12/<version>` header. A payload from a newer runtime is
  ignored rather than misread.
- **Migrated through a pending pool**: an unversioned payload is parsed as the
  legacy line format (`3. "Title"; Score: 40%; Weight: 1%` joined by `.\t`)
  written by eXeLearning releases before this layer existed. Those records are
  identified by **page position**, which is not a stable id, so they go into a
  pending pool — outside the main registry, where they neither weigh nor block
  completion — until a live registration that knows both the position and the
  stable id claims them (`register(id, {legacyIndex: n})`, wired by
  `common.js`'s `reportActivity`). Only the score is inherited: the legacy
  format carries **no completion flag**, so completion is never inferred from
  it (a finished activity scored 0 and a half-done one with points are
  indistinguishable) — the live iDevice decides. Unclaimed pool entries
  round-trip through the versioned payload as three-field records
  (`position;score;weight`), so an exit before every iDevice initialised does
  not wipe migrated progress; titles are dropped.
- **Bounded**: SCORM 1.2 sizes the element as CMIString4096 **[SCORM]**. The
  payload always fits: when it would overflow, activities that do not block
  completion are dropped first, then the most recently registered ones, and the
  compaction is logged. The records that decide the lesson status survive.
- **Robust**: malformed, truncated or foreign payloads are ignored instead of
  throwing inside a learner's session; a mixed payload keeps its readable
  records.
- **Minimal**: only identifiers, flags, counters, scores and weights are
  stored. No learner names and no learner responses.

## 10. Centralized finalization

Exactly one code path terminates a SCORM 1.2 session: `lifecycle.finish()`.
Everything else routes through it — `unloadPage()`, `doQuit()`, `doBack()`,
`doContinue()`, `scorm.quit()`, the `pagehide` handler, and (see below)
`pipwerks.SCORM.quit()`.

`lifecycle.finish()` raises its guard *before* any LMS traffic, so two lifecycle
paths racing each other cannot both finalize; the second replays the recorded
result. The guard is only raised when there is something to finalize: legacy
content calling `doQuit()` from a script that runs before the body `onload`
handler must not consume the one-shot latch, or the page would never send
`LMSFinish` at all. iDevices report state, score and activity completion; they
never own session finalization.
`$exeDevices.iDevice.gamification.scorm.endScorm()` is a documented no-op for
exactly this reason.

The client layer's session state machine backs this up:

```
idle ──initialize──▶ active ──terminate──▶ finish_attempted ──▶ finished
                                                             └─▶ finish_failed
```

- `LMSFinish` is attempted **at most once** for the page's lifetime.
- No LMS call is forwarded once a finish has been attempted, whatever its
  outcome — the API adapter is gone either way **[SCORM]**.
- A failed finish stays failed: later calls replay the recorded result and the
  original LMS error is preserved in `client.getFinishReport()`. It is never
  retried during page teardown, where a retry cannot succeed.
- The client issues `LMSCommit("")` and `LMSFinish("")` **as separate calls**
  (not through the wrapper's `connection.terminate`, which folds both into one
  boolean), so `getFinishReport()` always distinguishes a failed commit from a
  failed finish: `{commitAttempted, commitSucceeded, finishAttempted,
  finishSucceeded}`. When the commit fails, `LMSFinish` is deliberately not
  attempted — SCORM 1.2 requires pending data to be persisted before the
  session ends ([CR] 6.7), and finishing anyway would close an attempt whose
  stored state is unknown.
- Any termination attempt — successful or not — also clears
  `pipwerks.SCORM.connection.isActive`, so a direct pipwerks consumer sees
  the same closed session the state machine enforces instead of writing into
  an attempt whose stored state is unknown (eXeLearning policy, matching the
  no-retry rule above).

**External status writes.** The wrapper's own public helpers can write
`cmi.core.lesson_status` directly: `pipwerks.SCORM.set` is the wrapper's alias
of `data.set`, and `pipwerks.SCORM.status('set', …)` targets the element by
name. The adapter rebinds both on the runtime object (the vendored file is
never modified) so a lesson_status write routes through
`policy.setContentStatus()` — validated locally and releasing the policy's
session claim like every other content entry point; every other element flows
through the kept native write. `pipwerks.SCORM.data.set()` itself stays
native: it is the wrapper's internal engine (this runtime's client writes
through it) and is **below the supported surface** — calling it directly
bypasses eXeLearning's policy and is not supported.

**External termination.** Legacy content may call
`pipwerks.SCORM.quit()` or `pipwerks.SCORM.connection.terminate()` directly. The
adapter replaces both entry points on the runtime object with a shim that calls
`lifecycle.finish(false)`, carrying the untouched original on
`terminate.exeScorm12Native` so the client layer still reaches the real
`LMSFinish` exactly once. The vendored *file* is never modified. As a
belt-and-braces measure the client also reconciles its state whenever
`pipwerks.SCORM.connection.isActive` turns false behind its back — a page
holding a reference captured before the shim was installed — and reports it once.

## 11. Expected session sequence (normal page view)

```
LMSInitialize("")
LMSGetValue("cmi.core.lesson_status")               → entry policy
[LMSSetValue("cmi.core.lesson_status", "incomplete")]   (only when "" / "not attempted")
LMSGetValue("cmi.student_data.mastery_score")       → optional success threshold
LMSGetValue("cmi.suspend_data")                     → restore the activity registry
… content traffic (scores, suspend_data, explicit status) …
-- visibilitychange → hidden (any number of times) --
[LMSGetValue("cmi.core.lesson_status")]             (reconcile, only with required work pending)
[LMSSetValue("cmi.core.lesson_status", "incomplete")]   (only when correcting the policy's own stale verdict)
[LMSSetValue("cmi.suspend_data", …)]                (only when activities are registered)
LMSSetValue("cmi.core.session_time", "HHHH:MM:SS.SS")
LMSCommit("")
-- end of session (pagehide, doQuit/doContinue, scorm.quit) --
[LMSSetValue("cmi.suspend_data", …)]                (only when activities are registered)
LMSGetValue("cmi.core.lesson_status")
[LMSSetValue("cmi.core.lesson_status", …)]          (completion policy, only if it changes)
LMSSetValue("cmi.core.exit", "suspend" | "")
LMSSetValue("cmi.core.session_time", "HHHH:MM:SS.SS")
LMSCommit("")
LMSFinish("")
```

After `LMSFinish` every further runtime call is rejected locally and reported to
the console — nothing is forwarded to the LMS.

## 12. Verified consumer inventory (sources)

- `src/shared/export/exporters/Scorm12Exporter.ts` — head scripts, body class,
  `onLoadScript`, runtime file assembly.
- `src/shared/export/renderers/PageRenderer.ts` — `onload`/`onunload`/
  `onbeforeunload` body attribute emission.
- `src/shared/export/utils/Scorm12Runtime.ts` — the canonical source-path list
  and the two frozen package files.
- `public/app/common/exe_export.js` — `loadScorm()`/`initScorm()` polling gate,
  `isSCORM` computation, `loadPage()` invocation, the legacy `pagehide` bridge.
- `public/app/common/common.js` — `initGame()` SCORM bootstrap, the gamification
  helpers (`getUserName`, `getPreviousScore`, `getActivityScore`,
  `getTotalScore`, `createScoreScormHtml`, `registerActivity`, `reportActivity`,
  `updateActivity`, `showFinalScore`, `endScorm`) and their `pipwerks.SCORM`
  traffic.
- `public/files/perm/idevices/base/*/export/*.js` — per-iDevice
  `loadSCORM_API_wrapper`/`loadSCOFunctions` lazy-loaders,
  `scorm.init`/`SetScoreMax`/`SetScoreMin` usage, and their `pagehide` handlers.
- `moodle-mod_exelearning` — three consumers, not one. (a) `assets/scorm/*`,
  a vendored copy of this repo's two package files that the plugin injects into
  extracted content. As of the plugin's PR #105 it is the complete five-layer
  `libs/SCOFunctions.js` plus the pipwerks wrapper, byte-identical to what
  `Scorm12Runtime.ts` assembles (the plugin's `assets/scorm/SOURCE` and
  `scorm_runtime_test.php` pin the digest, the layer order and the
  `eXeLearning-SCORM12-Runtime` stamp). It is still re-synced by hand and can
  lag or lead this repository — and it is injected into content exported by
  whichever eXeLearning release the author used — so treat it as a distinct
  consumer whose version may differ from the content around it, never as
  "identical by construction". (b) `classes/local/scorm/scorm_injector.php`,
  which injects the two script tags and opens the session itself: since #105
  through `exeScorm12.session.open({ ownsLifecycle: false })` — the plugin
  owns the page (several pages share one session and one `lesson_status`), so
  the SCO lifecycle must not be installed — falling back to
  `pipwerks.SCORM.init()` on a poller only for content whose runtime predates
  `session.open`. Plugin releases before #105 force-called
  `pipwerks.SCORM.init()` BEFORE the content's own `scorm.init()`; that is the
  host-side activation §4's adoption clause exists for. (c) The
  `cmi.suspend_data` parsers `js/scorm_tracker.js` (`parseSuspend`) and
  `classes/local/track.php::parse_suspend_data()`, which since #105 read both
  the versioned `exe12/` payload and the legacy line format of §9.2. Their
  per-record grading does not mirror the SCO's treatment of an empty `score`
  field (see §9.2, field semantics).
- Real exported package fixtures under `test/fixtures/export/*_scorm/`.

Symbols that appear SCORM-related but are **not** part of this contract:
iDevice-internal methods that happen to share names (`$form.setScore`,
`$periodicTable.setCompleteScore`, and the `$exeDevices.iDevice.gamification.scorm.*`
helper names — these live in `common.js`, travel with the package, and call the
contract surface above).

## 13. Test surface

| Suite | Covers |
|---|---|
| `public/app/common/scorm/scorm12/fake-scorm12-api.test.js` | The strict fake LMS itself: access rules, vocabularies, ranges, array indices, error codes, conformance profiles. |
| `public/app/common/scorm/scorm12/exe-scorm12-client.test.js` | API discovery, 1.2 pinning, element access rules, optional probing, the termination state machine, the session clock. |
| `public/app/common/scorm/scorm12/exe-scorm12-activities.test.js` | Registry semantics, aggregation, `suspend_data` serialisation, migration, compaction, corrupt payloads. |
| `public/app/common/scorm/scorm12/exe-scorm12-policy.test.js` | Entry/exit policy, structured score results, the completion matrix, thresholds, lesson modes. |
| `public/app/common/scorm/scorm12/exe-scorm12-lifecycle.test.js` | `pagehide`/`pageshow`/`visibilitychange` semantics, bfcache cycles, finalization races. |
| `public/app/common/scorm/scorm12/exe-scorm12-adapter.test.js` | Every legacy global and facade method, the compatibility kinds, centralized finalization. |
| `public/app/common/scorm/scorm12/exe-scorm12-adapter-guard.test.js` | The install guard: a missing required layer or wrapper disables the runtime loudly. |
| `public/app/common/scorm/scorm12/exe-scorm12-adapter-no-registry.test.js` | The tolerance for a runtime assembled without the activity registry (§1). |
| `public/app/common/scorm/scorm12/exe-scorm12-adapter-debug-tracing.test.js` | Upstream pipwerks debug tracing is switched off without modifying the vendored file. |
| `public/app/common/scorm/scorm12/exe-scorm12-invariants.test.js` | Deterministic and seeded event sequences asserting the runtime invariants. |
| `test/helpers/unload-handler-scanner.spec.ts` | The package scanner's detection and its allowlist. |
| `test/integration/export/scorm12-exporter.spec.ts` | Real export pipeline: runtime assembly order, vendored bytes, no unload handlers anywhere in the package. |
| `test/e2e/playwright/specs/scorm12-export-runtime.spec.ts` | The exported ZIP's runtime files, through the browser export pipeline. |
| `test/e2e/playwright/specs/scorm12-sco-runtime.spec.ts` | A real exported SCO executing against a strict parent `window.API`: the page lifecycle, multi-activity suspension/resume through the registry, and the `common.js` bridge driven against real exported iDevice nodes (register → auto/manual score → aggregate → status → finish). |

## 14. Explicitly not validated

The following are **not** covered by any test in this repository and no claim is
made about them:

- Compatibility with `scorm-again` or any other third-party LMS runtime.
- Behaviour inside Moodle, or the `moodle-mod_exelearning` plugin.
- Real back/forward cache entry and restore in a browser: Playwright's Chromium
  reports an embedder-level bfcache opt-out and Firefox's `page.goBack()` after
  a cache entry is unusable in tests, so the E2E harness dispatches
  `PageTransitionEvent`s with the real `persisted` flag and the semantics are
  asserted at unit level.
- WebKit/Safari: this repository configures only the `chromium`, `firefox` and
  `static` Playwright projects.
- Mobile browsers, and the case where a hidden page is killed without firing
  `pagehide`.
- SCORM 2004 behaviour beyond the shared-file changes: the 2004 exporter, its
  inline fallback and the legacy runtime files it ships (`SCOFunctions.js`,
  `SCORM_API_wrapper.js`) are untouched — but `exe_export.js` and the iDevice
  export runtimes are **shared** between formats, and their
  lifecycle handling moved from `unload` to `pagehide`. For 2004 packages the
  observable effect is nil in the tested engines (those pages still carry
  `onunload`/`onbeforeunload` body attributes, so they are never bfcached and
  `pagehide` fires immediately before `unload`), but no 2004-specific test
  asserts it.
