---
tracking_issue: 2210
title: "Independent SCORM 1.2 contract tests with scorm-again"
status: draft
date: 2026-08-18
authors:
  - "@erseco"
reviewers:
  - "@ignaciogros"
  - "@mnarvaezm"
implementation_prs: [2299]
related_adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-fable-5"
---

# Independent SCORM 1.2 contract tests with scorm-again — research

## Question under investigation

Issue #2210: the SCORM 1.2 runtime rewrite proposed in PR #2209 is tested
against a project-owned fake LMS that was developed from the same contract as
the runtime itself, so a defect shared by both sides of those tests would be
invisible. This work executes one shared, independently grounded contract
suite against **both** content-side runtimes —

- **legacy**: `public/app/common/scorm/SCORM_API_wrapper.js` +
  `SCOFunctions.js` — the SCORM 1.2 runtime shipped before #2209. Since
  #2209 the SCORM 1.2 exporter no longer packages this pair (the SCORM 2004
  exporter still does); the legacy variant certifies it as a frozen
  reference;
- **rewrite**: the in-tree SCORM 1.2 runtime of PR #2209,
  `public/app/common/scorm/scorm12/` (the vendored pipwerks wrapper plus the
  five layers the exporter assembles into `libs/SCOFunctions.js`) —

with [`scorm-again`](https://github.com/jcputney/scorm-again) 3.3.0 (a
test-only dependency) as an independently implemented LMS-side `window.API`,
and answers: what does each runtime get wrong, which implementation is closer
to correct SCORM 1.2 behavior, and which defects could be fixed on `main`
without adopting the whole rewrite?

### Scope

This suite is a **SCORM 1.2 oracle only**: both drivers run under
scorm-again's `Scorm12API`, so it says nothing about SCORM 2004 behavior —
the legacy variant binds `API` and speaks `LMSInitialize`/`LMSFinish`, never
the `API_1484_11` surface the same pair exposes inside SCORM 2004 packages.
The legacy driver and its deviation ledger belong to whichever PR next
modifies or deletes `SCOFunctions.js` / `SCORM_API_wrapper.js`: rewrite both
if the pair changes, delete both if the pair goes (the stale-deviation guard
is keyed on the variant, so a deleted variant would leave dead records that
fail nothing). The rewrite variant is the one with lasting regression value.

## Method

### Harness

`public/app/common/scorm/contract/` contains:

- `scorm-again-lms.test-util.js` — builds a `Scorm12API` with a pinned
  conservative configuration, seeds a realistic LMS attempt state
  (`lesson_status "not attempted"`, `entry "ab-initio"`, learner identity,
  `lesson_mode "normal"`, credit), and wraps the API in a **recording facade**
  that journals every SCO-visible call with its arguments, its result, and
  the LMS error code immediately after the call. A minimal window tree exposes
  the facade the way a real LMS does (on the SCO frame's parent), because both
  runtimes discover the API by climbing `window.parent`/`window.top.opener`
  and never look at their own window. A named `profile` option selects the
  conservative oracle (default) or a Moodle-shaped one (see *LMS profiles*
  below); `scorm-again-lms.test.js` pins the harness itself.
- `scorm12-contract-scenarios.test-util.js` — 51 shared scenarios with the
  contract expectation of each, plus per-runtime **deviation records** for
  observed failures (each carrying a machine-readable `origin`:
  `runtime` / `page-wiring` / `content-layer`, so a defect in the runtime
  files is distinguishable from one in the exported page's wiring or in the
  shipped games layer).
- `scorm12-contract.legacy.test.js` / `scorm12-contract.rewrite.test.js` —
  one driver per runtime, in separate Vitest files because each variant owns
  the `pipwerks` global of its own wrapper.

Every scenario runs verbatim against both runtimes. Drivers reproduce each
variant's **production page wiring**, not an idealized calling convention:

- legacy: `<body onload="loadPage()" onbeforeunload="unloadPage()"
  onunload="unloadPage()">` (what `src/shared/export/renderers/PageRenderer.ts`
  emitted for SCORM 1.2 before #2209, and still emits for SCORM 2004 through
  `onUnloadScript`) plus `exe_export.js`'s
  `window.addEventListener('unload', () => unloadPage(isSCORM))` — i.e. the
  argument-less `unloadPage()` runs **before** the flagged call on every real
  page exit;
- rewrite: `loadPage()`, `exeScorm12.setPageHasScoredActivities(isSCORM)`,
  and session end on `pagehide` (`persisted=false`), with no unload-family
  attributes (the in-tree `Scorm12Exporter` / `exe_export.js` wiring since
  #2209).

Scenarios that want the runtime's best case call the runtime surface directly
(`unloadPageOnly(isSCORM)`, `doQuit()`, …) and say so — S14b exists precisely
to separate "runtime defect" from "exported-page wiring defect".

### Honest-failure mechanism

A deviation record never weakens the contract. For a runtime with a recorded
deviation the runner first proves the contract assertion **still fails**
(a stale record breaks the build; only assertion failures count — a harness
crash is rethrown), then asserts the precisely documented actual behavior
(a behavior change breaks the build too). Nothing is skipped; the suite is
green while every legacy failure stays visible, reproducible and
machine-readable in the scenario registry.

### Adversarial review

Before the results below were finalized, the suite itself was subjected to a
four-lens adversarial review (oracle independence, isolation/mechanics,
comparison fairness, completeness), with every medium/high finding
independently re-verified by a skeptical agent instructed to refute it —
several verdicts were settled by executing scratch probes against the real
runtimes. Confirmed findings led to: six added scenarios (S12b, S38, S39,
S42, E03, E04 — the completeness lens showed the rewrite's activity-registry
path and visibility-persistence path were previously unexercised), the
string-argument journaling that surfaced defect L9, the `origin` attribution,
a runner hardening (non-assertion errors are not absorbed by the deviation
guard), and several normative-wording corrections. Refuted findings (e.g.
"the exit-value records should be policy-differences", "the driver's
pagehide-only exit under-models production") are documented as resolved in
the review record and left the suite unchanged. A later independent review
of the PR (2026-08-27) reclassified E04 from `legacy-defect` to
`policy-difference` (P3 below): ignoring `cmi.student_data.mastery_score`
on the SCO side is spec-legal, and whether the SCO should apply it is an
open product decision (#2316).

### Oracle configuration

All `Scorm12API` settings are pinned explicitly (see
`CONTRACT_LMS_SETTINGS`), even where they match the library default, so a
future scorm-again default change cannot silently alter the oracle:
`autocommit: false`, `lmsCommitUrl: false`, `logLevel: 5`,
`mastery_override: false`, `score_overrides_status: false`,
`autoCompleteLessonStatus: false`, `selfReportSessionTime: false`,
`alwaysSendTotalTime: false`, `sendFullCommit: false`, `autoProgress: false`,
`strict_errors: true`. This is the "no LMS-side policy" configuration: the
LMS validates but never rewrites what the SCO reports.

### LMS profiles

`createContractLms({ profile })` names the LMS-side rules a scenario runs
under, so that "what the host does with the SCO's data" is an explicit,
reviewable choice instead of a per-scenario override:

- **`conservative`** (default) — the configuration above. Every scenario
  runs under it unless its `lmsOptions` say otherwise; nothing changed for
  the 49 scenarios that do.
- **`moodle`** — what Moodle's `mod_scorm` does to a SCORM 1.2 attempt,
  verified against `MOODLE_405_STABLE` (files cited in *Sources*):
  (a) a SCO write of `"not attempted"` is refused with 405 (`scorm_12.js`
  :38/:73 — scorm-again does the same natively); (b) a second
  `LMSInitialize` answers `"false"` with error 101 (`scorm_12.js` :172-195;
  native in scorm-again, journaled by the facade — S43 exercises it);
  (c) at `LMSFinish` an attempt still `"not attempted"` is stored as
  `"completed"` (`StoreData`, `scorm_12.js` :624-626) and an `"incomplete"`
  attempt with any stored `cmi.core.score.raw` is promoted to `"completed"`
  (`scorm_insert_track` under `forcecompleted`, `locallib.php` :463-481,
  passed from `datamodel.php` :70-71 — an activity setting whose site
  default is **0**, `settings.php` :105-106; the profile turns it on because
  it is the rule E05/E06 reason about); (d) `masteryoverride` (site default
  **1**, `settings.php` :115-116) — `passed`/`failed` by comparing
  `score.raw` with `cmi.student_data.mastery_score` at `LMSFinish`
  (`StoreData` :627-637), mapped to scorm-again's `mastery_override: true`,
  whose conditions match (`lesson_mode "normal"`, credit, both values
  present).

  Rules (c) are a post-`LMSFinish` hook in the recording facade, applied only
  after a *successful* finish (a 201-refused `LMSFinish` leaves the model
  alone). Two reasons: scorm-again has no setting for the promotion, and its
  `autoCompleteLessonStatus` cannot express the `"not attempted"` rule for an
  LMS-seeded attempt (observed choice 9 below). Applying them after the
  finish — when the SCO can no longer read anything — is also what an SCO
  observes of Moodle: the server-side rewrites of `scorm_insert_track` are
  never echoed back into a running session (Moodle applies them at every
  commit, but a single in-memory model cannot say "changed in the database,
  unchanged for the SCO"; the profile models the end-of-attempt state).
  Every LMS-side status change is reported in `handle.lmsRewrites` with the
  rule that produced it (`masteryoverride`, `forcecompleted`,
  `not-attempted-completed`, or `scorm-again-finish-default` for a rewrite the
  library made on its own), so a scenario can assert "the host had nothing
  to correct" rather than infer it.

  **Not modelled:** browse-mode `"browsed"`, the per-commit application of
  the promotion, Moodle's grading (`grademethod`), attempt/track persistence,
  the suspend/resume `entry` computation, and everything SCORM 2004. Real
  Moodle persistence and grading stay with the `mod_exelearning` package
  harness (#2310).

### Classification rules

`scorm-again` is **not** treated as the SCORM specification. Every contract
expectation is grounded in the SCORM 1.2 Run-Time Environment Book (ADL,
2001; §3.3 API / §3.4 data model) or in the documented eXe policy
(`doc/development/scorm12-runtime-contract.md` and ADR-2209-01/-02,
in-tree), and each failure is classified as:

| Classification | Meaning |
|---|---|
| `legacy-defect` / `rewrite-defect` | violates SCORM 1.2, contradicts the runtime's own explicit write/intent, or causes demonstrable data/behavior harm on a conformant LMS |
| `policy-difference` | a spec-legal alternative that only the documented eXe policy decides against |
| `scorm-again-difference` | an implementation choice of the oracle, not evidence about eXe |
| `spec-uncertain` | SCORM 1.2 does not decide the point |

### scorm-again 3.3.0 as an oracle — observed implementation choices

Empirically probed before writing assertions (these are documented so that no
test mistakes oracle behavior for the specification):

1. Non-empty parameters to `LMSInitialize`/`LMSCommit`/`LMSFinish` → error
   201 (normative per RTE §3.3.2.1/§3.3.3), but the pre-init return values of
   `LMSCommit`/`LMSFinish` are `"true"` despite the error state — assertions
   use error codes, not return values, where the oracle is lenient.
2. **Post-termination calls are accepted** (`LMSSetValue` after `LMSFinish`
   returns `"true"`, error 0); only re-`LMSInitialize` is refused (101).
   SCORM 1.2 assigns no error code to post-termination calls, so the
   runtime-side local guard is the only real protection — the suite asserts
   *no LMS traffic after finish* instead of an LMS error.
3. `cmi.suspend_data` longer than 4096 characters is accepted: scorm-again
   deliberately validates against `CMIString64000` (a documented spec
   deviation in its source), so the RTE's 4096 limit cannot be exercised
   through this oracle.
4. `cmi.core.exit = "normal"` is silently normalized to `""` instead of
   rejected with 405.
5. Skipped interaction indexes are refused with error **402** (SCORM 1.2
   names no code for this case; the "shall be added sequentially" rule binds
   the SCO).
6. `cmi.core.zip_code` (the RTE book's own 201 example) is answered with 401.
7. CMITimespan parsing is lenient (a 1-digit hour field is accepted), so the
   suite asserts the strict grammar on the runtime's *output* rather than
   relying on oracle rejection.
8. Reads of write-only elements answer `""` with 404; `renderCommitCMI(true)`
   exposes them for state inspection but normalizes some stored strings
   (session_time), so exact written values are asserted from the call journal.
9. `autoCompleteLessonStatus` never fires for an LMS-seeded attempt:
   `lmsInitialize` marks any pre-seeded `lesson_status` as "set by the
   module", and the finish-time defaulting only acts on an empty or
   not-set-by-module status. Moodle's `"not attempted"` → `"completed"`
   finish rule is therefore modelled by the `moodle` profile's hook, not by
   the setting (pinned in `scorm-again-lms.test.js`). Related: the
   `Scorm12API` constructor turns `mastery_override` **on** when the setting
   is omitted — one more reason every setting is pinned explicitly.

## Results

### Quantitative summary

```text
Total shared scenarios: 51 (each executed against both runtimes;
  49 under the conservative LMS profile, E06/E07 under the Moodle profile)

Legacy:  30 pass, 21 fail (21 documented deviation records)
         — 17 classified legacy-defect (10 distinct root causes)
         —  4 classified policy-difference (spec-legal alternatives)
Rewrite: 51 pass,  0 fail

Confirmed legacy-only defects: 17 scenario failures, 10 distinct root causes
  (by origin: 12 runtime, 3 exported-page wiring, 2 games layer)
  — 8 fail SCORM 1.2 itself (root causes L1, L5, L6, L7, L8, L9: the
    "not attempted" launch write S02/S03/S11/E01, session_time fraction
    S24, write-only read S30, dual-API binding S32, double-loadPage clock
    reset E01, numeric API arguments S18)
  — 9 fail the documented eXe policy or compatibility surface (root causes
    L2, L3, L4, L10: page wiring S14/S12, exit overwrite S13/S27/S33/S38,
    SetCompletionStatus vocabulary S16b, unanswered page scored 0/failed
    E05 and, seen from the Moodle side, E06)
Confirmed rewrite-only defects: 0
Confirmed defects shared by both: 0
Policy differences: 4 failing on legacy (E03 visibility persistence,
  S42 setComplete availability, E04 mastery score as a SCO-side threshold
  and E07, the same divergence seen from the Moodle side)
  + 3 non-failing mechanism differences
scorm-again implementation choices documented: 9
Spec-uncertain points encountered: 2 (post-termination error code,
  mastery override of a SCO-set status) — neither decides any scenario
```

What the contract assertions are: the 51 scenarios hold 174 static
assertions — **112** are SCORM 1.2 RTE requirements (lifecycle, parameters,
vocabularies, CMITimespan, read-only/write-only elements, interactions, API
binding, one initialization per launch), **44** are documented eXeLearning
policy (entry `incomplete`, `incomplete` until every required activity
finishes, mastery score / 50 threshold, exit `""`/`suspend`, no score for an
unanswered page, review-mode suppression, visibility persistence —
ADR-2209-01/-02; every such scenario says `eXe policy` in its `expectation`
— including the host-side view of two of them under the Moodle profile,
E06/E07), **15** are the eXe compatibility surface (page globals, pipwerks
extensions, facade), **1** is oracle-specific (S37's 402 for a skipped
interaction index) and **2** are harness guards (E06/E07 pin that they ran
under the Moodle profile). The policy
assertions certify #2209's status/exit model: if that model changes, they
and the legacy records whose contract is policy flip together, and the
stale-deviation guard keeps the suite red until the ledger is rewritten.

### Scenario table

| # | Scenario | Legacy | Rewrite | Expected behavior | Classification | Notes |
|---|---|---|---|---|---|---|
| S01 | `LMSInitialize("")` once on launch | PASS | PASS | one init, empty parameter, `"true"` (RTE §3.3.2.1) | both-pass | |
| S02 | first launch reaches `incomplete` without invalid writes | FAIL | PASS | eXe policy `incomplete`; SCO must never write `"not attempted"` (RTE §3.4.4) | legacy-only-fail | legacy writes `"not attempted"`, rejected 405; end state correct only on a strict LMS |
| S03 | resume preserves `incomplete` without invalid writes | FAIL | PASS | stored status never depends on LMS rejecting an invalid write | legacy-only-fail | same root cause as S02; lenient LMS would destroy progress |
| S04 | non-empty init parameter is 201; runtime always sends `""` | PASS | PASS | RTE §3.3.2.1/§3.3.3 | both-pass | oracle probe + call-journal assertion; the probe's return boolean is deliberately not pinned (spec-unstated) |
| S05 | non-empty commit parameter is 201; runtime always sends `""` | PASS | PASS | RTE §3.3.2.1/§3.3.3 | both-pass | |
| S06 | non-empty finish parameter is 201 and does not terminate | PASS | PASS | RTE §3.3.2.1/§3.3.3 | both-pass | |
| S07 | pre-init runtime ops produce no LMS traffic | PASS | PASS | 301 territory (RTE §3.3.3); local guard expected | both-pass | both guard via `connection.isActive` / client state |
| S08 | post-finish runtime ops produce no LMS traffic | PASS | PASS | RTE §3.3.2.1 "may no longer call"; no 1.2 error code exists | both-pass | scorm-again would accept the calls — runtime guard is the only protection |
| S09 | repeated quit/unload → exactly one LMSFinish | PASS | PASS | at-most-once termination | both-pass | |
| S10 | production page-exit sequence → one LMSFinish | PASS | PASS | at-most-once termination under real wiring | both-pass | |
| S43 | a second `LMSInitialize` is refused and the runtime keeps working | PASS | PASS | one initialization per launch (RTE §3.3.2.1); the LMS answers `"false"` + 101 (CTS/Moodle/oracle practice — the RTE names no code); a later write still lands, one successful finish | both-pass | oracle probe after `loadPage()`; both runtimes are unaffected because neither re-initializes and both keep their own session state |
| E01 | `loadPage()` runs twice on every exported page | FAIL | PASS | second call must not re-init, write invalid values, or reset the clock | legacy-only-fail | legacy repeats the `"not attempted"` write and restarts the timer (session under-reported: 30 s instead of 90 s) |
| S11 | entry writes exactly one `incomplete` | FAIL | PASS | single valid status write at entry | legacy-only-fail | legacy writes `["incomplete", "not attempted"]`, second rejected 405 |
| S12 | resumed `incomplete` survives scored page left unanswered | FAIL | PASS | progress never downgraded | legacy-only-fail | argument-less `unloadPage()` marks the page `completed` |
| S13 | unscored page: `completed` + exit `""` + one finish, commit before finish | FAIL | PASS | eXe policy terminal exit `""`; explicit commit precedes finish | legacy-only-fail | status ok; exit sequence `suspend → logout` (handleExitMode), final exit write lands after the last commit (spec-legal) |
| S14 | scored unanswered page: `incomplete` + `suspend` | FAIL | PASS | eXe policy | legacy-only-fail | page ends `completed` + `logout`; attempt can no longer resume |
| S14b | runtime-level `unloadPage(true)` alone keeps `incomplete` + `suspend` | PASS | PASS | best-case runtime call honors the scored flag | both-pass | proves S12/S14 come from the wiring + default-argument interplay |
| S12b | runtime-level `unloadPage(true)` on a resumed scored page | PASS | PASS | resumed progress survives the best-case runtime call | both-pass | resumed counterpart of S14b — the S12 failure is wiring-caused too |
| S15 | content-set `passed` survives page exit | PASS | PASS | terminal status never downgraded | both-pass | |
| S16 | all five SCO-writable statuses accepted via facade | PASS | PASS | RTE §3.4.4 vocabulary | both-pass | |
| S16b | all five statuses forwarded by `SetCompletionStatus` | FAIL | PASS | extension must not silently drop valid vocabulary | legacy-only-fail | legacy drops `passed` and `failed` (no case in its switch); silent data loss |
| S17 | invalid statuses never stored | PASS | PASS | closed, case-sensitive vocabulary (RTE §3.3.3/§3.4.4) | both-pass | legacy relies on LMS 405 for facade writes; rewrite refuses locally — both outcomes conformant |
| S18 | valid raw score stored, string arguments on the API wire | FAIL | PASS | CMIDecimal 0-100 (RTE §3.4.4); API arguments are strings | legacy-only-fail | end state correct, but legacy sends raw NUMBERS for score.raw/min/max (games layer + wrapper forward unconverted); scorm-again coerces silently |
| S19 | score.min stored | PASS | PASS | RTE §3.4.4 (LMS-optional element) | both-pass | |
| S20 | score.max stored | PASS | PASS | RTE §3.4.4 (LMS-optional element) | both-pass | |
| S21 | invalid scores (101, −5, text) never stored | PASS | PASS | 0-100 normalization; 405 | both-pass | end-state-only by design; legacy forwards the invalid writes and relies on LMS rejection, rewrite validates locally |
| S22 | 1h 1m 1.5s session accepted and accurate | PASS | PASS | CMITimespan matches elapsed (±20 ms) | both-pass | both emit `0001:01:01.50` |
| S23 | runtime emits only strict CMITimespan; LMS rejects malformed | PASS | PASS | RTE §3.4.5 grammar | both-pass | oracle itself is lenient — grammar asserted on runtime output |
| S24 | 30.04 s session reports its real duration | FAIL | PASS | value distortion is a defect even when the string is grammatically valid | legacy-only-fail | legacy emits `0000:00:30.4` = 30.4 s (unpadded hundredths, ×10 inflation) |
| S25 | 2 h session accurate | PASS | PASS | | both-pass | |
| S26 | quit of non-terminal session → exit `suspend` | PASS | PASS | eXe policy | both-pass | legacy passes coincidentally: handleExitMode rewrites `suspend` with `suspend` |
| S27 | quit of completed session → exit `""` | FAIL | PASS | eXe policy terminal exit `""`; `logout` ends the learner's LMS session (RTE §3.4.4) | legacy-only-fail | exit sequence `suspend → logout` |
| S28 | invalid exit vocabulary never reaches the LMS | PASS | PASS | RTE §3.4.4 vocabulary; 405 | both-pass | both validate locally |
| S29 | read-only write fails, value unchanged | PASS | PASS | 403 (RTE §3.3.3) | both-pass | legacy: LMS 403; rewrite: local refusal — both conformant outcomes |
| S30 | write-only read does not query the LMS | FAIL | PASS | SCO must not read write-only elements (404, RTE §3.4.4) | legacy-only-fail | legacy `GetExit()` sends the read, gets `""`/404, leaves error state dirty |
| S31 | unsupported element read → `""`, runtime keeps working | PASS | PASS | 201/401 + `""` (RTE §3.3.3) | both-pass | oracle answers 401 where the RTE example says 201 (documented) |
| S32 | dual-API window: 1.2 package binds `API` | FAIL | PASS | the 1.2 adapter is the object named `API` (RTE §3.3.6.1) | legacy-only-fail | legacy auto-detect prefers `API_1484_11` and speaks SCORM 2004 to it; the 1.2 API is never called |
| S33 | `doContinue("completed")`: status + one finish + exit `""` | FAIL | PASS | continue is a normal transition | legacy-only-fail | legacy writes exit `""` then handleExitMode overwrites with `logout` |
| S34 | facade get/set of representative RW elements | PASS | PASS | | both-pass | |
| S35 | `GetLearnerName`/`GetLearnerId` extensions | PASS | PASS | | both-pass | |
| E02 | content-written `suspend_data` survives session end | PASS | PASS | legacy-content compatibility | both-pass | with an empty activity registry the rewrite does not clobber a foreign payload |
| S36 | representative true-false interaction accepted | PASS | PASS | RTE §3.4.4 pp.3-48…3-56 | both-pass | |
| S38 | `doContinue` in review mode never rewrites a stored terminal status | FAIL | PASS | eXe policy: review/browse suppression; exit `""` | legacy-only-fail | suppression itself works on both; legacy exit again `["", "logout"]` (root cause L3) |
| S39 | mid-session `computeTime()`+`save()`: repeated session_time totals | PASS | PASS | LMS overwrites, never accumulates (RTE §3.4.4); each write is the running total | both-pass | first ~30 s, final ~90 s on both |
| S42 | `setComplete()` compat global stores + commits | FAIL | PASS | eXe compat surface | policy-difference | the global does not exist in the files shipped from main (only in the exporter's emergency fallback); rewrite defines it |
| E03 | hiding the tab persists progress without terminating | FAIL | PASS | eXe [BROWSER] policy: session_time write + commit on hidden, no finish/status/exit | policy-difference | legacy produces zero LMS traffic on hide — sessions are lost on mobile app-switch/kill; SCORM 1.2 does not mandate the persistence |
| E04 | completed scored activity below the LMS mastery score (80) with 70 | FAIL | PASS | eXe policy (ADR-2209-02): the published mastery_score is the SCO-side success threshold — attempt `failed`, exit `""`, raw stored | policy-difference | legacy games layer decides pass/fail at a hardcoded 50 and never reads mastery_score → stores `passed`; spec-legal (mastery_score is LMS data the LMS may apply — Moodle's default masteryoverride=1 does); exit `suspend → logout` (L3) |
| E05 | a page whose required activity was never answered publishes no score | FAIL | PASS | eXe policy: no `score.raw` write and `incomplete` — a 0 would read as "scored zero", and Moodle promotes any scored attempt to completed | legacy-only-fail | legacy games layer seeds the slot at 0 and takes the real-score write path → publishes `0` and records `failed` for an untouched page (L10) |
| E06 | Moodle profile: an unanswered scored page is not promoted to `completed` at `LMSFinish` | FAIL | PASS | eXe policy seen from the host: no `score.raw` write, so Moodle's `forcecompleted` promotion finds nothing — `incomplete` survives, no LMS rewrite, the attempt can resume | legacy-only-fail | legacy publishes `0` and writes `failed` itself (L10): nothing left to promote, but a merely-visited page is stored as a graded failed attempt instead of a resumable one |
| E07 | Moodle profile: the host's mastery verdict at `LMSFinish` agrees with the SCO's own (mastery 80, aggregate 70) | FAIL | PASS | eXe policy seen from the host: the SCO's last status write is already `failed`, Moodle's `masteryoverride` has nothing to rewrite, page feedback and LMS record agree | policy-difference | legacy writes `passed` (hardcoded 50); Moodle rewrites it to `failed` at `LMSFinish` — the record ends up right, the page's feedback did not (host-side view of E04 / P3) |
| S37 | invalid interaction values rejected, runtime survives | PASS | PASS | 405 for vocabulary; no 1.2 code for skipped indexes | both-pass | oracle's 402-for-skipped-index documented as its choice |

### The 21 legacy failures in detail

Ten distinct root causes plus four policy differences (two missing
capabilities and one threshold choice, seen from the SCO side and from the
host side) produce the 21 scenario failures.
For each:
operation, states, calls, result, expectation, and fixability
(**A** small/local, **B** moderate behavioral, **C** architectural,
**D** not a defect).

**L1 — every launch writes `"not attempted"` to the LMS**
(S02, S03, S11; also repeated in E01)
`loadPage()` reads the status and, for `"not attempted"`/`"incomplete"`,
calls `SetCompletionStatus("unknown")`; the wrapper's 1.2 branch maps
`"unknown"` → `"not attempted"` and writes it
(`SCOFunctions.js:74-86`, `SCORM_API_wrapper.js:1007-1031`). A SCO may never
set `"not attempted"` (RTE §3.4.4 SCO usage; Conformance Requirements 1.6.5) —
a strict LMS refuses with 405 and the attempt survives; a lenient LMS stores
it, so a fresh attempt shows "not attempted" forever and a **resumed attempt's
progress is silently destroyed**. This also explains real-world reports of
eXe 1.2 packages stuck at "not attempted" on permissive LMSes.
*Severity: high (data loss on lenient LMSes). Fix: A — drop the two
`Set…Status("unknown")` calls in the 1.2 path (the pipwerks auto-promotion
already sets `incomplete`); must be conditioned on version because
`SCOFunctions.js` is shared with SCORM 2004 exports, where `"unknown"` is a
valid completion_status. Regression risk: low.*

**L2 — the argument-less unload handler completes scored pages**
(S12, S14)
The exported page fires `unloadPage()` from the body
`onbeforeunload`/`onunload` attributes before `exe_export.js`'s
`unloadPage(isSCORM)` listener; the first call defaults `isSCORM` to `false`,
finds a non-terminal status and writes `completed` (+ a `passed`
success-status no-op); the correctly flagged call afterwards is inert
(`exitPageStatus` guard). A scored page with unanswered activities is
recorded `completed`, and a resumed `incomplete` attempt is upgraded to
`completed` on exit. S14b shows the runtime honors the flag when it actually
receives it — the defect is the wiring + default-argument interplay.
*Severity: high (wrong completion for scored content; destroys resume).
Fix: B — deliver the scored flag through page state instead of a call
argument (e.g. exe_export sets a global the argument-less `unloadPage()`
reads), or stop emitting the unload attributes for SCORM exports; both
touch `SCOFunctions.js`/`exe_export.js`/`PageRenderer.ts` and both SCORM
versions. Regression risk: medium (browser unload-event ordering).*

**L3 — `handleExitMode` overwrites the intended exit with `logout`**
(S13, S27, S33)
`doQuit()`/`doContinue()` write their exit value, but the vendored-wrapper
`connection.terminate()` re-writes `cmi.core.exit` because `SetExit()` never
primes the `data.exitStatus` cache the block consults
(`SCORM_API_wrapper.js:308-329`, `data.set` caches only lesson_status,
`:447-497`). Any terminal session ends with exit `"logout"` — which tells the
LMS the learner logged out entirely (RTE §3.4.4) — and `doContinue`'s
intentional `""` is overwritten too. eXe policy: terminal exit `""`.
*Severity: medium (valid vocabulary, wrong semantics; some LMSes end the
login session). Fix: A — prime `data.exitStatus` in `SetExit()` (1 line) so
the block stands down, plus choose the exit value by terminal state in
`doQuit()` (~6 lines). Regression risk: low.*

**L4 — `SetCompletionStatus` silently drops `passed`/`failed`**
(S16b)
The vocabulary switch has no case for `passed`/`failed`; both fall through
to `default: trace(...); return;` — no LMS write, no error to the caller
(`SCORM_API_wrapper.js:1015-1022`). Content reporting pass/fail through this
extension loses the result. (Today's games layer avoids it by writing
`cmi.core.lesson_status` directly, which is why the defect stayed hidden.)
*Severity: medium. Fix: A — add the two 1.2 cases (2 lines). Regression
risk: low.*

**L5 — session_time fraction distortion**
(S24)
`convertTotalMiliSecondsSCORM12` appends hundredths without zero-padding:
30.04 s → `"0000:00:30.4"`, which a conformant LMS must parse as 30.4 s —
tenfold inflation whenever hundredths < 10 (`SCORM_API_wrapper.js:850-856`).
Grammatically valid, so no LMS rejects it; the stored duration is simply
wrong.
*Severity: low. Fix: A — `ZeroPad(intHundredths, 2)` (1 line). Regression
risk: none.*

**L6 — `GetExit()` reads a write-only element from the LMS**
(S30)
`GetExit()` forwards `LMSGetValue("cmi.core.exit")`; the element is
write-only, so a conformant LMS answers `""` with error 404. The extension
can never return the real value and leaves the API error state at 404, which
later content error handling may misread.
*Severity: low. Fix: A — cache the last `SetExit()` value locally (~5
lines). Regression risk: low.*

**L7 — dual-API windows bind SCORM 2004**
(S32)
Nothing in the 1.2 package pins `pipwerks.SCORM.version`; the wrapper's
auto-detect prefers `API_1484_11` (`SCORM_API_wrapper.js:60-140`). In a
window exposing both API generations the 1.2 package binds the 2004 API and
speaks `Initialize`/`Terminate` to it — the SCORM 1.2 API is never called.
*Severity: low (rare launch environment, but a conformance failure when it
happens). Fix: A — the 1.2 exporter injects
`pipwerks.SCORM.version = "1.2"` before discovery (one line of head script);
it cannot go into the shared `SCOFunctions.js` because the same file serves
SCORM 2004 exports. Regression risk: low.*

**L8 — the double `loadPage()` resets the session clock**
(E01)
`<body onload="loadPage()">` and `exe_export.initScorm()` both call
`loadPage()` on every exported page. pipwerks refuses the second
`LMSInitialize`, but the second call repeats L1's invalid write and
unconditionally restarts `startTimer()`, so the reported `session_time`
covers only the time after the *last* `loadPage()` — 30 s instead of 90 s in
the scenario.
*Severity: medium (systematic under-reporting of session time). Fix: A/B —
make `loadPage()` idempotent (skip when the connection is already active,
~3 lines), or stop the double call in `exe_export.js`; both SCORM versions
are affected. Regression risk: low.*

**L9 — score values cross the LMS API boundary as raw numbers**
(S18)
The games layer passes numbers (`SetScoreMax(100)`, `SetScoreMin(0)`,
`set('cmi.core.score.raw', newFinalScore)` — `common.js:900-901, :1362`) and
the wrapper extensions forward them unconverted to `LMSSetValue`. The SCORM
1.2 API takes string arguments; scorm-again coerces silently, but stricter
LMS API adapters (the Java-bridge era in particular) have failed on
non-string values. The rewrite stringifies before the wire.
*Severity: low. Fix: A — `String(...)` in the wrapper's Set\* extensions
(~4 lines). Regression risk: none.*

**L10 — an unanswered page publishes `0` and `failed`**
(E05, E06; origin: content-layer)
The games layer has no notion of "not answered": `registerActivity` seeds
the activity's slot at zero and `showFinalScore` takes the same write path
as a real score, so a page the learner merely opened publishes
`cmi.core.score.raw = 0` and — being under the hardcoded threshold of 50 —
records `failed` before anything was attempted. `score.raw` cannot express
"not answered", so the grade is wrong and so is the completion state a host
derives from it (Moodle promotes an incomplete attempt to completed as soon
as any `score.raw` exists). The rewrite publishes no score for an unanswered
required activity and leaves the attempt `incomplete`. E06 checks the same
exit under the Moodle profile: the rewrite's attempt survives `LMSFinish`
as a resumable `incomplete` with no LMS-side rewrite, while legacy's
self-reported `failed` leaves Moodle's `forcecompleted` nothing to promote —
the untouched page is simply stored as a graded, failed attempt.
*Severity: medium (wrong grade and completion for untouched pages). Fix:
B — distinguish "not answered" from `0` in `common.js` (registration must
not seed a score; the final-score path must not fire for an unanswered
activity); shared with SCORM 2004 pages. Regression risk: medium. The
expected behavior (no score, `incomplete`) is eXe policy and is disputed by
the alternative "live verdict" semantics discussed in #2316.*

**P3 — the LMS-published mastery score is not applied by the SCO**
(E04, E07; classification: policy-difference, origin: content-layer)
The games layer decides pass/fail at a hardcoded threshold of 50
(`common.js:1362-1368`) and never reads `cmi.student_data.mastery_score`, so
an attempt scoring 70 against an LMS-published pass mark of 80 is recorded
`passed`. This is spec-legal: SCORM 1.2 defines `mastery_score` as
LMS-published data the *LMS* may use to override the status (RTE §3.4.4);
SCO-side use is optional, and Moodle's default `masteryoverride=1` corrects
the outcome LMS-side (the very rule this harness disables with
`mastery_override: false`). The rewrite adopts the published mastery score as
its success threshold (falling back to 50 when none is published) — the
documented eXe policy. Whether the SCO should apply it at all is an open
product decision (#2316); the record was reclassified from `legacy-defect`
after the PR review. E07 shows the same divergence from the host side: under
the Moodle profile `masteryoverride` rewrites legacy's `passed` to `failed`
at `LMSFinish` (journaled in `lmsRewrites`), so the LMS record is right while
the page's own feedback was not; the rewrite's final write is already
`failed` and Moodle has nothing to correct.
*Retrofit: B — read the optional element at game init in `common.js` with a
50 fallback (~8 lines); shared with SCORM 2004 pages.*

**P1 — no visibility persistence** (E03, classification: policy-difference)
Hiding the tab produces zero LMS traffic on legacy: there is no
`visibilitychange` surface at all, so on mobile app-switch/kill paths (where
no further page event may ever fire) the whole session — progress and
session_time — is lost. SCORM 1.2 does not require the persistence; the
documented eXe [BROWSER] policy does, and the rewrite implements it
(observed in E03: a running-total session_time write plus an `LMSCommit` on
hide, no finish, no status/exit writes, session fully usable afterwards).
*Retrofit onto legacy would be a C-class change — it is effectively the
rewrite's lifecycle layer.*

**P2 — the `setComplete`/`setIncomplete` compat globals do not exist**
(S42, classification: policy-difference)
The files shipped from `main` never define them (they appear only in
`Scorm12Exporter`'s emergency fallback runtime); content written against the
eXe compat surface that calls `setComplete()` throws a `ReferenceError` on a
main-exported package. The rewrite always defines both.
*Fix: A — add the two functions to `SCOFunctions.js` (~10 lines).*

### Rewrite-specific findings

The rewrite meets the contract in all 51 scenarios, including the
production-wiring scenarios that break legacy (its exporter drops the unload
attributes and hands the scored flag to the runtime), the dual-API discovery
trap (it pins the version before discovery), the registry-engaged completion
path with an LMS-published mastery score (E04, exercised through the
production content shapes), the unanswered-activity path (E05: no score
published, attempt left `incomplete`), both of those seen from the host side
under the Moodle profile (E06: nothing for `forcecompleted` to promote; E07:
Moodle's `masteryoverride` verdict agrees with the runtime's own), an LMS
refusing a second `LMSInitialize` (S43), the visibility-persistence path
(E03), and the legacy-content compatibility probes (E02: with an empty
activity registry it does not clobber a `suspend_data` payload written
directly by content; S16b: its `SetCompletionStatus` forwards the full
SCO-writable vocabulary).

No rewrite regression relative to legacy was observed in any scenario.

**Limitations** (what this suite does *not* show): these are unit-level
executions under happy-dom with a DI-injected clock and window tree — not a
real browser, not a real LMS. Registry internals (the weighted aggregation
algorithm, suspend_data compaction at the 4096 boundary, legacy payload
migration) are exercised end-to-end only through the single-activity flows
of E04 and E05; their combinatorial depth remains delegated to the rewrite's
colocated layer tests. Other areas this suite cannot independently exercise with scorm-again:
the bfcache pause/resume clock (needs real `pagehide`/`pageshow`
`persisted=true` semantics), commit-failure-aborts-finish (the conservative
scorm-again configuration cannot be made to fail `LMSCommit` without
patching the oracle), minimal-LMS 401 profiles (scorm-again implements the
full optional data model), and the RTE's 4096-character suspend_data limit
(scorm-again deliberately validates against 64000). Those remain covered by
the project-owned fake-LMS suites, which this work deliberately complements
rather than replaces.

### Policy and mechanism differences (not defects)

1. **Local refusal vs LMS refusal** (S17, S21, S28, S29): the rewrite
   validates read-only writes, score ranges, and vocabularies locally and
   never sends the invalid call; legacy forwards and relies on the LMS
   answering 403/405. Both end states are conformant; the rewrite's approach
   also works on lenient LMSes (which is exactly what L1/L2 show legacy
   depending on).
2. **Write-only read compatibility** (S30): the rewrite answers
   `GetExit()`/`GetSessionTime()` from a local write cache — an eXe
   compatibility policy, not a SCORM requirement.
3. **Session-time clamp**: legacy caps at `9999:99:99.99`, the rewrite at
   `9999:59:59.99`; both are inside the CMITimespan grammar
   (spec-irrelevant in practice).

## Correctable legacy issues (without adopting #2209)

L1, L3, L4, L5, L6, L7, L8, L9 and P2 are all **A-class fixes** (one to ~10
lines each) — but with a structural caveat this investigation surfaced:
`SCORM_API_wrapper.js` and `SCOFunctions.js` are packaged by **both** the
SCORM 1.2 and SCORM 2004 exporters (`Scorm2004Exporter.fetchScormFiles('2004')`
returns the same pair), so every fix in them must branch on
`pipwerks.SCORM.version` or move to version-specific injection, and must be
regression-tested against both export formats. L2 (scored-page completion)
and L10 (unanswered page scored `0`) are **B-class** fixes spanning
`SCOFunctions.js` / `exe_export.js` / `PageRenderer.ts` and `common.js`
respectively, and so is P3 (mastery score) should the product decide the SCO
must apply it; P1 (visibility persistence) is **C-class** — retrofitting it
is effectively adopting the rewrite's lifecycle layer. Since #2209 the pair
only ships inside SCORM 2004 packages, so any such fix is a SCORM 2004
change first. The contract suite added here would
verify all of these fixes scenario-by-scenario (the deviation records fail
loudly the moment the behavior improves, pointing at exactly which records
to delete).

## Issues to address in #2209 before merge

None found by this suite: no scenario fails on the rewrite. Two observations
worth carrying into the #2209 review anyway:

1. The rewrite's correctness on scored pages depends on the exporter-side
   wiring (`setPageHasScoredActivities` + no unload attributes) shipping
   together with the runtime — the runtime alone, driven through legacy
   wiring, would inherit L2. This is already how PR #2209 is structured; it
   should stay one unit.
2. E02 shows foreign `suspend_data` survives only while the activity registry
   is empty. Mixed content (old games layer + new runtime) is not a shipped
   combination, but third-party content that both registers activities and
   writes `suspend_data` directly would lose the direct write on the next
   persist. ADR-2209-02's single-owner policy documents this as intended —
   flagged here for visibility, classification `policy-difference`.

## Exported-package smoke test (Phase 2 — implemented)

`test/e2e/playwright/specs/scorm12-scorm-again-smoke.spec.ts` executes the
full production chain in a real browser — it is collected by the
`chromium`, `firefox` and `static` Playwright projects:

```text
real SCORM 1.2 export (SharedExporters.quickExport in the workarea)
  -> extracted package served under one origin (route interception)
    -> launcher page exposing scorm-again's browser build as window.API
      -> LMS-side CMI state inspected after launch and after exit
```

The launcher wraps `scorm-again/dist/scorm12.min.js` with the same
conservative settings, seed and journaling facade as the unit harness, so
the smoke reads identical evidence. Two tests assert the #2209 runtime
contract at package level:

- **Unscored page** (a Text iDevice; contract S01/S11/S13): package
  composition (entry page, manifest, `libs/SCORM_API_wrapper.js` and the
  assembled `libs/SCOFunctions.js`, and **no `scorm12/` path** — the
  assertion guards the `Scorm12Runtime` assembly and the ResourceFetcher
  per-version file list); exactly one `LMSInitialize("")`; one accepted
  `incomplete` status write at launch and no rejected write at all; strict
  CMITimespan `session_time` accepted; an explicit `LMSCommit` before exactly
  one `LMSFinish("")` and no call after it; `completed` with exit `""`.
- **Scored page left unanswered** (a true-or-false iDevice with
  `isScorm: 1`; contract S14/E05): the same launch assertions, then
  `incomplete` with exit `"suspend"`, no `score.raw` write, and the status
  never rewritten during the session. This is the first browser-level check
  of the scored-page exit under the real exported wiring
  (`exe_export.initScorm` → `setPageHasScoredActivities` → `pagehide`).

The smoke pins the runtime contract, not the oracle: a change to the entry,
status or exit policy must update the contract scenarios and the smoke
together.

## Recommendation

**Proceed with the rewrite (#2209) after its normal review, and use this
suite's deviation records as the acceptance list for any interim legacy
fixes.** The evidence: the rewrite meets the independently grounded contract
in 51/51 scenarios with zero regressions relative to legacy, while legacy
fails 21 scenarios — 8 against SCORM 1.2 itself (L1, L5–L9), 9 against the
documented eXe policy or compatibility surface (L2, L3, L4, L10) and 4
policy differences (P1–P3, with P3 seen from both the SCO and the Moodle
side); three of the defects (L1 destroying resumed
progress on lenient LMSes, L2 completing scored pages the learner never
finished, L10 grading an untouched page as `0`/`failed`) affect real
learner data. Most legacy defects are individually small fixes,
but they live in files shared with the SCORM 2004 export path and interact
(L1+L2+L8 all fire on every page exit), which is precisely the coupling the
rewrite removes — and the two capability gaps (visibility persistence,
compat globals) are only closed by the rewrite's architecture. If #2209
stalls, L1/L3/L4/L5/L10 are the highest-value targeted fixes to apply on
`main`, in that order.

## Sources

- ADL, *SCORM Version 1.2 — The SCORM Run-Time Environment* (2001-10-01),
  https://xml.coverpages.org/SCORM-12-RunTimeEnv.pdf
- Rustici Software, SCORM Run-Time Reference,
  https://scorm.com/scorm-explained/technical-scorm/run-time/run-time-reference/
- `doc/development/scorm12-runtime-contract.md`, ADR-2209-01, ADR-2209-02
  (in-tree since #2209)
- scorm-again 3.3.0, https://github.com/jcputney/scorm-again (source-level
  evidence: `error_codes.ts`, `regex.ts`, `default_settings.ts`,
  `cmi/scorm12/*`, `Scorm12API.ts`, `BaseAPI.ts`; plus the empirical probes
  described above)
- Moodle `MOODLE_405_STABLE`, https://github.com/moodle/moodle — the
  `moodle` LMS profile: `mod/scorm/datamodels/scorm_12.js` (`LMSInitialize`
  :172-195, `lesson_status` write format :38/:73, `StoreData` :621-647),
  `mod/scorm/locallib.php` (`scorm_insert_track` :452-481),
  `mod/scorm/datamodel.php` :70-71, `mod/scorm/settings.php`
  (`forcecompleted` :105-106, `masteryoverride` :115-116)
