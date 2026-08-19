---
id: ADR-2209-01
title: "Rewrite the SCORM 1.2 content runtime with clean AGPL provenance"
status: Proposed
date: 2026-07-24
tracking_issue: 2209
legacy_id: ADR-0001
deciders:
  - "@erseco"
related:
  prs: []
  changes: []
  adrs: [ADR-2209-02]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-fable-5"
---

# ADR-2209-01: Rewrite the SCORM 1.2 content runtime with clean AGPL provenance

## Context

Every exported SCORM package ships two runtime scripts:
`libs/SCORM_API_wrapper.js` and `libs/SCOFunctions.js`
(`public/app/common/scorm/` in this repository, mirrored in
[moodle-mod_exelearning](https://github.com/exelearning/moodle-mod_exelearning)
`assets/scorm/`).

**Provenance.** `SCOFunctions.js` descends from ADL/CTC sample SCO code
(`iteexe` history). During the 2013 migration the original CTC license grant
was removed from the header, leaving only a warranty disclaimer plus a
CC BY-SA notice that names a *different* file (`SCOFunctions2004.js`). The
bundled `SCORM_API_wrapper.js` is a heavily modified fork of pipwerks 1.1.7
(2008, MIT) with eXe-specific additions, three of which are attributed to
Rustici Software under CC BY 3.0 (`convertTotalMiliSecondsSCORM12`,
`convertTotalMiliSecondsSCORM2004`, `ZeroPad`). eXeLearning distributes under
AGPL-3.0 and the Moodle plugin under GPL-3.0; the provenance of these files is
too ambiguous to keep distributing, and at ~250 + ~1700 lines a
specification-based rewrite is cheaper than establishing the license status of
each line.

**Technical defects (verified in the legacy code).**

- *Unload dependency:* the exporter emitted `onunload`/`onbeforeunload` body
  attributes and `exe_export.js` registered an `unload` listener. These events
  are unreliable (often not fired on mobile/tab-kill) and disable the
  back/forward cache.
- *Status downgrade on load:* `loadPage()` converted `not attempted` **and**
  `incomplete` to `unknown`, which the wrapper mapped to `not attempted` in
  SCORM 1.2 — erasing a learner's in-progress state on every page view
  (`SCOFunctions.js:74-86` + `SCORM_API_wrapper.js:1019`).
- *No 1.2 version pinning:* the wrapper auto-detected the API and preferred
  `API_1484_11`, so a 1.2 package launched in an LMS exposing both APIs bound
  to the SCORM 2004 API.
- *Non-idempotent finish:* nothing prevented double `LMSFinish` or data calls
  after termination beyond a scattered `exitPageStatus` flag.
- *Divergent inline fallback:* `Scorm12Exporter.getScormApiWrapper()` shipped
  a *different* minimal wrapper when the runtime files could not be fetched —
  one that lacked `SetScoreMax`/`SetScoreMin`, which game iDevices call
  (some unguarded, e.g. `geogebra-activity.js`), silently breaking scoring.

The full consumer contract extracted before the rewrite is recorded in
[doc/development/scorm12-runtime-contract.md](../../development/scorm12-runtime-contract.md).

## Problem

Can eXeLearning keep shipping a SCORM 1.2 content runtime whose license
provenance is defensible under AGPL-3.0/GPL-3.0 distribution, without breaking
the frozen contract that exported packages, iDevices, games and the Moodle
plugin depend on?

## Decision drivers

- License compliance for AGPL-3.0 (this repo) and GPL-3.0 (Moodle plugin).
- Zero breakage of the published-content contract (globals, file names, the
  `scorm`/`pipwerks` objects — see the contract document).
- Fix the verified lifecycle/status defects while touching only the 1.2 path.
- The SCORM 2004 exporter shares the same physical files
  (`fetchScormFiles()` ignored its version argument); its output must not
  change in this iteration.
- Testability: deterministic unit coverage against a fake LMS API.

## Options considered

### Option 1: Keep the current code and restore a license header

Rejected: a grant whose original terms cannot be established cannot be
restored; the ADL sample-code history shows conflicting Apache-2.0 vs
CC BY-NC-SA declarations, and the CC BY-SA notice in the file names a
different file. The technical defects would also remain.

### Option 2: Update from ADL upstream

Rejected: the ADL sample repositories are archived sample code with the same
license ambiguity, and they implement none of the eXe-specific behavior.

### Option 3: Replace the SCO layer with `scorm-again`

Rejected for the SCO side: `scorm-again` implements the **LMS-side** API
(`window.API`), the opposite architectural role from content-side SCO code.
It remains attractive as an independent LMS simulator for adversarial testing
(see follow-up work).

### Option 4 (chosen): Spec-based rewrite + vendored upstream pipwerks

Rewrite the SCO layer from the SCORM 1.2 Run-Time Environment specification
and the extracted contract document, under AGPL-3.0-or-later. Vendor the
upstream pipwerks wrapper (MIT, actively-published last release) unmodified.

## Evidence

- Legacy files: `public/app/common/scorm/SCOFunctions.js`,
  `public/app/common/scorm/SCORM_API_wrapper.js` (headers and defect line
  references above), at commit `0cc414b78`.
- Shared 1.2/2004 fetch:
  `src/shared/export/providers/FileSystemResourceProvider.ts:290` (version
  parameter ignored before this change).
- Consumer contract audit: doc/development/scorm12-runtime-contract.md
  (verified against `exe_export.js`, `common.js`, all
  `public/files/perm/idevices/*/export/*.js`, exporter templates and the
  Moodle plugin's `scorm_injector.php`).
- Upstream pipwerks: <https://github.com/pipwerks/scorm-api-wrapper>, commit
  `82e455b4032ee08febf64d2fa2bf1aacaebaa446` (v1.1.20180906, MIT), SHA-256
  recorded in THIRD-PARTY-NOTICES.md and asserted by
  `src/shared/export/utils/Scorm12Runtime.spec.ts`.

## Decision

We will:

1. **Vendor upstream pipwerks** byte-identical (MIT header intact) at
   `public/app/common/scorm/scorm12/vendor/pipwerks/SCORM_API_wrapper.js`,
   recorded in `THIRD-PARTY-NOTICES.md` with commit hash, retrieval date and
   SHA-256. The file must never be edited locally.
2. **Rewrite the SCO layer** as five small project-owned files under
   `public/app/common/scorm/scorm12/` (AGPL-3.0-or-later, SPDX headers):
   - `exe-scorm12-client.js` — SCORM 1.2-only communication: pins
     `pipwerks.SCORM.version = "1.2"` before API discovery, explicit error
     reporting via `LMSGetLastError`/`LMSGetErrorString`, an explicit session
     state machine (see §"Session state machine" below), local enforcement of
     the SCORM 1.2 read-only/write-only access rules, and the
     `cmi.core.session_time` formatter written from the spec
     (`HHHH:MM:SS.SS`, 4-digit hour field, clamped at `9999:59:59.99`) driven
     by a pausable session clock.
   - `exe-scorm12-activities.js` — the activity registry: aggregation only,
     no LMS traffic and no policy. Decided separately in
     [ADR-2209-02](ADR-2209-02-scorm12-activity-completion-registry.md).
   - `exe-scorm12-policy.js` — eXe completion policy: on load, empty/
     `not attempted` → `incomplete`, anything else preserved (never
     downgraded); on exit, the completion decision taken from the activity
     registry; explicit
     `setCompleted`/`setIncomplete`/`setPassed`/`setFailed`/`setScore`
     helpers with validated 0-100 bounds written as strings, and a structured
     score result that separates the mandatory `cmi.core.score.raw` from the
     optional bounds. `cmi.core.lesson_status` is the single status element —
     no SCORM 2004 completion/success separation.
   - `exe-scorm12-lifecycle.js` — the only layer that ends a session:
     `pagehide` with `persisted === false` → end it once; `pagehide` with
     `persisted === true` → persist without terminating (the page is entering
     the back/forward cache) and pause the clock; `pageshow` with
     `persisted === true` → resume; `visibilitychange` to hidden → write
     `cmi.core.session_time` and `LMSCommit`, never finish. **No**
     `unload`/`beforeunload` handlers anywhere; the exporter stops emitting
     `onunload` attributes for 1.2 pages.
   - `exe-scorm12-adapter.js` — the only file defining globals: the legacy
     page functions, the `scorm` facade, and *additive* extension methods on
     `pipwerks.SCORM` (verified callers such as `geogebra-activity` invoke
     them on the pipwerks object directly), plus a shim that routes
     `pipwerks.SCORM.quit()` through the lifecycle layer.
3. **Keep the in-package layout frozen at two files.** The exporter assembles
   `libs/SCOFunctions.js` by concatenating the five layers in load order
   (`src/shared/export/utils/Scorm12Runtime.ts`) and ships the vendored
   wrapper verbatim as `libs/SCORM_API_wrapper.js`. iDevices, games and the
   Moodle plugin hard-code exactly these two paths (lazy-loaders), so the
   two-file package keeps every consumer — including the plugin's injector —
   working without changes.
4. **Touch only the 1.2 path.** `fetchScormFiles(version)` becomes
   version-aware in both providers; `'2004'` keeps returning the legacy pair
   and `Scorm2004Exporter` is untouched, so 2004 output is byte-for-byte
   unchanged.
5. **Remove the 1.2 inline fallback runtime.** A SCORM 1.2 export now fails
   loudly when the runtime files cannot be fetched instead of shipping a
   divergent, broken runtime.

### Session state machine

A boolean "terminated" flag cannot distinguish a termination that succeeded
from one that failed, so a second call after a failed `LMSFinish` would report
success. The client layer therefore models the session explicitly:

```
idle ──initialize──▶ active ──terminate──▶ finish_attempted ──▶ finished
                                                             └─▶ finish_failed
```

- `LMSFinish` is attempted at most once for the page's lifetime, and the guard
  is raised *before* the call, so a re-entrant termination cannot start a
  second one.
- Once a finish has been attempted, no LMS call is forwarded, whatever the
  outcome — the API adapter is gone either way.
- A failed finish stays failed. Later calls replay the recorded result and the
  original LMS error stays available through `client.getFinishReport()`. It is
  never retried during page teardown, where a retry cannot succeed.
- The client issues `LMSCommit("")` and `LMSFinish("")` as two separate calls
  rather than through the wrapper's `connection.terminate` (which folds both
  into one boolean), so the report always distinguishes a failed commit from a
  failed finish. A failed commit deliberately aborts the termination without
  attempting `LMSFinish`: the LMS could not persist the data, and finishing
  anyway would close an attempt whose stored state is unknown.
- The state is reconciled whenever `pipwerks.SCORM.connection.isActive` turns
  false outside the machine — legacy content holding a reference captured
  before the adapter's shim was installed — and the anomaly is reported once.

### Strict element access

SCORM 1.2 defines `cmi.core.exit`, `cmi.core.session_time` and every
`cmi.interactions.n.*` leaf as write-only (reading one is error 404), and a
list of elements as read-only (writing one is error 403). Several legacy
compatibility methods targeted exactly those elements. Keeping the method and
issuing the invalid call is the worst of both worlds: it produces console noise,
burns an LMS round trip and returns nothing useful.

The client layer therefore refuses those calls locally. A legacy getter for a
write-only element is answered from the runtime's own write cache; a legacy
setter for a read-only element becomes a documented no-op that reports. The
per-method classification is tabulated in the runtime contract, §4.

### Back/forward cache

An `unload` or `beforeunload` listener anywhere on the page makes it ineligible
for the back/forward cache, and the events do not fire reliably on mobile. The
rewrite removes them from the whole package — body attributes, the runtime,
`exe_export.js`, the xAPI emitter and around thirty iDevice export runtimes that
used jQuery `unload.<ns> beforeunload.<ns>` handlers, all now `pagehide`. A
scanner asserts the result on a real exported ZIP
(`test/helpers/unload-handler-scanner.ts`).

Because a page frozen into the cache can be evicted later without firing any
further event, all durable work happens synchronously inside the `pagehide`
handler; nothing is deferred.

## Consequences

### Positive

- Clean provenance: AGPL-3.0 project code + one MIT-vendored file with a
  recorded upstream hash (THIRD-PARTY-NOTICES.md); the exporter test asserts
  the shipped package is byte-identical to the repository copy. No ADL/CTC or
  CC-attributed code in the 1.2 package.
- The defects above are fixed, each covered by regression tests against a
  **strict** fake LMS that validates SCORM 1.2 access rules, vocabularies,
  ranges, array indices and error codes, and that can be configured to
  implement only the mandatory data model, a realistic optional subset, or all
  of it (439 Vitest tests across the runtime layers plus Bun
  assembly/integration specs).
- The runtime is provably free of unload-family handlers across the whole
  exported package, so SCORM 1.2 content is back/forward-cache friendly.
- A real exported SCO is executed against a strict parent `window.API` in the
  E2E suite, so the runtime contract is verified end to end rather than by
  inspecting the ZIP.
- Smaller runtime and a documented, test-frozen public contract.

### Negative

- Behavior changes for newly exported 1.2 packages (intended, documented):
  - in-progress state survives page reloads (no `unknown` downgrade);
  - persistence now keys on `pagehide`/`visibilitychange` instead of
    `unload` — on very old browsers without `pagehide` (pre-2010) the
    safety net does not fire (controlled navigation still persists);
  - `cmi.core.exit` is `""` after a terminal status and `"suspend"`
    otherwise (legacy wrote `suspend` or `""` depending on the call site);
  - `goBack`/`goForward` become inert stubs (their Moodle-1.9-only
    `nav.event` hack has been dead for years);
  - `SetMode()` and `SetSuccessStatus()` become documented no-ops, and
    `GetExit()`/`GetSessionTime()`/`GetInteractionValue()` answer from a local
    cache, because the SCORM 1.2 data model forbids the underlying call;
  - time spent while the page sits in the back/forward cache is not counted
    towards `cmi.core.session_time`;
  - a 1.2 export with missing runtime files fails instead of degrading.
- Around thirty iDevice export runtimes changed their jQuery
  `unload.<ns> beforeunload.<ns>` registrations to `pagehide.<ns>`. Those files
  ship in **every** export format, so HTML5 and EPUB exports get the same
  change. The handler bodies are untouched; only the event they listen to
  changes, and `pagehide` fires in every case `unload` did.
- `exe_export.js` and `exe_xapi.js` also moved from `unload` to `pagehide`.
  Both ship in SCORM 2004 packages too, where the effect is nil: 2004 pages
  still carry `onunload`/`onbeforeunload` body attributes, so they are never
  cached, `pagehide` fires immediately before `unload`, and the legacy
  `unloadPage()` is guarded to run only once.
- Two runtime implementations coexist until the 2004 path is migrated or
  removed (legacy files remain untouched for 2004).

### Neutral

- Already-exported packages are unaffected (they carry their own runtime
  copy).
- `exe_export.js` hands the scored-activities flag to the new runtime when
  present and keeps the legacy bridge otherwise, so one file serves both
  package generations.

## Risks

- Third-party content calling an undocumented legacy symbol not in the
  contract audit. Mitigated by keeping the full documented wrapper extension
  surface and the complete legacy global set as thin adapters.
- LMSes with unusual API discovery. Mitigated by using upstream pipwerks
  discovery (more battle-tested than the 2008 fork, including the Plateau
  special case) plus explicit 1.2 pinning.

## Validation

- Unit: `public/app/common/scorm/scorm12/*.test.js` (Vitest, strict fake LMS,
  order-sensitive call-log assertions with literal spec-derived values). The
  fake is itself pinned to the specification by
  `fake-scorm12-api.test.js`, and the runtime suite runs against the
  `minimal`, `intermediate` and `complete` LMS conformance profiles.
- Invariants: `exe-scorm12-invariants.test.js` runs deterministic and
  seeded-random event sequences over the public surface and asserts that
  `LMSInitialize`/`LMSFinish` reach the LMS at most once, that nothing is sent
  after a finish attempt, that a terminal status is never downgraded, that
  pass/fail is never decided before the required activities finish, and that
  reordering independent content events does not change the persisted result.
- Assembly/vendoring: `src/shared/export/utils/Scorm12Runtime.spec.ts`
  (byte-identical wrapper, SHA-256 against THIRD-PARTY-NOTICES.md).
- Integration: `test/integration/export/scorm12-exporter.spec.ts` (real
  export pipeline: runtime files present and assembled in load order,
  vendored wrapper byte-identical, no legacy runtime, and a whole-package scan
  proving there is no `unload`/`beforeunload` handler in any HTML or JS file,
  for a minimal package, the real ELPX fixture and a ten-iDevice matrix) and
  the untouched `scorm2004-exporter.spec.ts` guarding the 2004 path.
- E2E: `test/e2e/playwright/specs/scorm12-sco-runtime.spec.ts` exports a real
  project, serves the extracted package over HTTP and runs the SCO in an
  iframe below a parent page exposing a strict `window.API`, then drives the
  lifecycle and asserts the recorded call order and the stored data model.
  Passes on the `chromium` and `firefox` projects.
- Real-LMS smoke testing (Moodle) is follow-up work below. Neither Moodle nor
  `scorm-again` compatibility has been tested.

### Limits of the E2E harness

Real back/forward cache entry and restore cannot be exercised in Playwright:
its Chromium reports the embedder-level opt-out `BackForwardCacheDisabledForDelegate`,
which no launch flag overrides, and in Firefox `page.goBack()` after a cache
entry hangs and leaves the Page object desynchronised. `document.visibilityState`
is likewise always `'visible'` for a Playwright page in every engine. The E2E
spec therefore dispatches `PageTransitionEvent`s carrying the real `persisted`
flag — which is exactly what the runtime branches on — and overrides the
visibility getter while it dispatches `visibilitychange`; the full semantics are
asserted at unit level through the layers' dependency-injection hooks. WebKit is
not covered because this repository configures only the `chromium`, `firefox`
and `static` Playwright projects.

## Follow-up work

1. Adversarial test harness using `scorm-again` as an independent LMS-side
   runtime and second oracle.
2. Coordinated `moodle-mod_exelearning` update: replace
   `assets/scorm/SCORM_API_wrapper.js` with the vendored pipwerks file and
   `assets/scorm/SCOFunctions.js` with the assembled runtime; define a
   synchronization mechanism (versioned artifact, checksum, or sync script)
   replacing manual copies. The plugin's `scorm_injector.php` needs no
   change (same two script tags).
3. Staged SCORM 2004 deprecation and eventual removal of
   `Scorm2004Exporter` and the legacy files.
4. Automated Moodle integration testing (completion, grade, resume) for
   exported packages. If that testing shows Moodle-specific window flags
   (e.g. `mod_scorm_is_window_closing`) are still needed, add them then —
   not preemptively.
5. Legal review of the remaining legacy files while they still ship for the
   2004 path.

## References

- SCORM 1.2 Run-Time Environment specification (ADL), CMITimespan and
  `cmi.core.*` data model.
- doc/development/scorm12-runtime-contract.md
- THIRD-PARTY-NOTICES.md
- <https://github.com/pipwerks/scorm-api-wrapper> @ `82e455b4032e`
- <https://github.com/exelearning/iteexe> (historical provenance, read-only)
- <https://github.com/exelearning/moodle-mod_exelearning>
  (`assets/scorm/`, `classes/local/scorm/scorm_injector.php`)
