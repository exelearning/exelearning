---
id: ADR-2209-02
title: "Track SCORM 1.2 page completion through a central activity registry"
status: Proposed
date: 2026-08-04
tracking_issue: 2209
legacy_id: ADR-0043
deciders:
  - "@erseco"
related:
  prs: []
  changes: []
  adrs: [ADR-2209-01]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5"
---

# ADR-2209-02: Track SCORM 1.2 page completion through a central activity registry

## Context

A SCORM 1.2 package built by eXeLearning has one SCO per page, and a page can
carry any number of iDevices: several graded quizzes, a presentation, an
exploration activity, or any mix of them. SCORM 1.2 gives that SCO exactly one
status element, `cmi.core.lesson_status`, drawn from
`passed | completed | failed | incomplete | browsed | not attempted` (ADL,
*SCORM Version 1.2 — The SCORM Run-Time Environment*, §3.4.4; the LMS must
refuse `"not attempted"` from a SCO, *SCORM 1.2 Conformance Requirements* 1.6.5).

Before this decision, the runtime introduced by
[ADR-2209-01](ADR-2209-01-scorm12-runtime-rewrite.md) decided that single status from
one boolean:

```js
policy.setHasScoredActivities(isSCORM);   // exe_export.js, unloadPage(isSCORM)
// on exit: hasScoredActivities ? 'incomplete' : 'completed'
```

`isSCORM` is computed in `public/app/common/exe_export.js` by scanning the
page's iDevices for a truthy `isScorm` flag. It answers "does this page contain
any activity that saves a score", and nothing else. Consequences:

- A page whose quizzes the learner **finished and passed** was still reported
  `incomplete` on exit, because the flag never changes.
- Pass/fail was decided elsewhere and inconsistently: the gamification helper in
  `public/app/common/common.js` wrote `cmi.core.lesson_status` directly, as
  `passed` when its aggregate reached 50 and `failed` otherwise, on **every**
  score update — including while other activities on the page were still
  untouched (`showFinalScore`, before this change). So a page could be reported
  `failed` after the learner had answered one of three quizzes.
- Per-activity state existed, but only as a side effect: `registerActivity`
  stored `index. "title"; Score: N%; Weight: N%` records in `cmi.suspend_data`,
  keyed by the activity's **positional index on the page**, with no completion
  flag and no version tag.
- A presentation-only iDevice had no way to say "I am not something the learner
  can complete", so any policy richer than the boolean risked leaving such pages
  permanently `incomplete`.

## Problem

How should a SCORM 1.2 SCO that contains several heterogeneous iDevices decide
the single `cmi.core.lesson_status` value it reports, and where should that
decision live?

## Decision drivers

- **Correctness of the reported status.** A page whose required activities are
  all finished must not be reported `incomplete`; a page whose required
  activities are pending must not be reported `passed` or `failed`.
- **Separation of concerns.** SCORM communication, eXeLearning activity
  aggregation, completion policy and pass/fail policy are four different things
  and were entangled in two files.
- **Explicitness.** Policy must not be inferred from incidental iDevice
  properties (`gameOver`, `gameStarted`) that mean different things in different
  iDevices.
- **Backward compatibility.** `cmi.suspend_data` already carries a payload
  format used by published packages, and `setPageHasScoredActivities()` is
  called by `exe_export.js` in every package.
- **Adoptability.** ~30 iDevice export runtimes would have to adopt any new API;
  it must be small enough that the shared gamification helper can adopt it once
  on their behalf.
- **SCORM 1.2 constraints.** One status element; `cmi.suspend_data` is
  CMIString4096; the LMS refuses `"not attempted"` from a SCO.

## Options considered

### Option 1: Keep the boolean and fix the worst symptom

Make `showFinalScore` stop writing `failed` prematurely, and let the exit policy
keep using `hasScoredActivities`. Rejected: it leaves the core defect (a
completed page reported `incomplete`) untouched, and it keeps the pass/fail
decision in the gamification helper, where it cannot see the other activities.

### Option 2: Derive completion from the existing `cmi.suspend_data` records

Reuse the `index. "title"; Score…` records as the state model. Rejected: they
carry no completion flag (a score of 0 is indistinguishable from "not started"),
they are keyed by a positional index that changes when the page is edited, they
are unversioned, and the format is a localized human-readable string whose
parser is a regular expression over translated labels.

### Option 3 (chosen): A central activity registry with an explicit descriptor

Introduce a registry layer that every activity declares itself to, and derive
the status from its aggregate.

## Decision

Add `exe-scorm12-activities.js` as a runtime layer between the client and the
policy. It performs **aggregation only**: it never talks to the LMS and holds no
policy.

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
scorm.activities.summary();
```

1. **Identity is the iDevice node id**, not a positional index, so editing the
   page does not reassign a learner's stored progress.
2. **Registration is idempotent.** Re-registering an id updates the declaration
   and keeps the progress already reported, so a re-rendered iDevice never
   resets state. An id that reports before it registers is registered on the
   fly.
3. **Every flag is explicit.** The registry never inspects `gameOver` or any
   other iDevice-specific property. `public/app/common/common.js` bridges the
   game iDevices onto it (`reportActivity`), deriving `evaluable` and
   `completionRequired` from the iDevice's own `isScorm` flag and passing
   `completed` explicitly from the call site. The bridge reports
   `completed: true` when the game is over **or** the learner submitted their
   score by hand (`sendScoreNew(auto=false)`): submitting is the learner's
   explicit act of finishing the attempt, and it is the only completion signal
   games without a game-over state can give — without it, such an activity
   would hold its page at `incomplete` forever. This is a deliberate product
   policy, recorded here rather than implied by the code.
4. **The registry is the single owner of `cmi.suspend_data`.** When the SCORM
   1.2 runtime is present, every `common.js` helper that used to read or write
   the legacy line format directly goes through the registry instead
   (`buildLmsDataFromRegistry()` presents it in the legacy shape so the
   historical `getFinalScore` weighting stays single-source). Two writers
   alternating formats — the registry's `exe12/…` at exit, `common.js`'s line
   format mid-session — would silently overwrite each other and corrupt
   resumes. The legacy paths remain only where the runtime is absent (SCORM
   2004, packages exported before the rewrite).
5. **Presentation-only and exploration activities never block completion.**
   They register with `completionRequired: false`. Of the two policies the
   alternative would allow — "do not block" versus "must report a viewed
   state" — we choose "do not block", because it requires no change from
   iDevices that have no notion of completion at all.
6. **The policy layer maps the aggregate onto the single status element:**

   | Registry state | `cmi.core.lesson_status` | `cmi.core.exit` |
   |---|---|---|
   | No required evaluable activity | `completed` | `""` |
   | At least one required activity incomplete | `incomplete` | `suspend` |
   | All required complete, no threshold in force | `completed` | `""` |
   | All required complete, aggregate ≥ threshold | `passed` | `""` |
   | All required complete, aggregate < threshold | `failed` | `""` |

7. **The success threshold** is `cmi.student_data.mastery_score` when the LMS
   publishes one (it is optional in SCORM 1.2, so a "not implemented" answer is
   normal and not an error), otherwise **50** — the threshold eXeLearning game
   iDevices have always applied. `policy.setSuccessThreshold(null)` drops the
   pass/fail distinction and reports completion only.
8. **The policy corrects only its own verdict.** A terminal status is
   preserved — with one exception: when the policy itself wrote it during this
   session and the decision afterwards returns to
   `required-activities-pending` — a *required* activity registering late
   (deferred iDevice initialisation) **or** a replay reporting
   `completed: false` for an activity that had been complete — the page
   demonstrably is not finished, so the policy downgrades its own verdict back
   to `incomplete` (and the exit becomes `suspend`). Ownership is claimed only
   by successfully *writing* a status —
   merely agreeing with a stored value never claims it, so a terminal status
   restored from a previous attempt, or written explicitly by content, is
   never downgraded. The correction runs when an activity registers and
   before every mid-session persist (`reconcilePendingActivities()`), so a
   `hidden` commit never freezes a stale terminal verdict alongside a
   registry with pending required work; reconciliation acts only on pending
   work and never emits a transient passed/failed verdict while a page is
   still registering. Movement *between* terminal statuses (a retried failed
   activity now passing) is always allowed, and `cmi.core.exit` is always
   computed from the status the LMS actually stored, never from a decision
   the LMS rejected.
9. **The score stays single-source, inside the registry.** The registry's
   `summary()` owns the historical weighting algorithm published packages
   depend on (weights scaled to integers summing to 100 by largest-remainder
   rounding); `common.js`'s `getFinalScore()` delegates to it whenever the
   runtime is present. The displayed score, the recorded
   `cmi.core.score.raw`, the in-session status decision and the exit decision
   therefore all read the same number — a second algorithm could disagree
   near the mastery threshold (100/49/0 at equal weights: 50.17 historically,
   49.67 as an exact mean) and flip a passed page to failed at exit.
10. **`setPageHasScoredActivities()` remains the fallback.** When no iDevice
   registers, the page-level flag decides exactly as before, so content that
   predates the registry is unaffected.
11. **The registry persists itself into `cmi.suspend_data`** in a versioned
    format, migrating the previous one:

    ```
    exe12/1|<uri-encoded id>;<flags>;<answered>;<total>;<score>;<weight>;<min>;<max>|…
    ```

    - `flags` is a bit set (`1` evaluable, `2` completion-required, `4`
      completed); `score` is the activity's last reported score in its own
      `min`–`max` scale and is **empty** while the activity has produced no
      score. As currently implemented, the registry's aggregate counts an
      evaluable activity with an empty score as **0 with its full weight**
      (`normalizedScore()` maps `null` to 0), so a page with one required
      activity answered at 100 and another never touched reports
      `cmi.core.score.raw = 50` once the first score is published. A consumer
      that grades per record (the Moodle plugin's `exe12/` parsers) must
      mirror that rule or document the divergence — `moodle-mod_exelearning`
      PR #105 currently drops such records and grades the same page 100. The
      weight an unscored evaluable activity should carry is an open product
      decision that this ADR records but does not settle.
    - Version-tagged; a payload from a newer runtime is ignored, not misread.
    - An unversioned payload is parsed as the legacy line format into a
      **pending pool**, keyed by page position — outside the main registry,
      where it neither weighs nor blocks completion. A live registration that
      knows both the position and the stable id claims its record
      (`register(id, {legacyIndex: n})`), inheriting only the score: the
      legacy format carries **no completion flag**, so completion is never
      inferred from it — the live iDevice decides. Titles are dropped — they
      are not needed for aggregation and they are the largest field in a
      size-constrained element. Unclaimed pool entries round-trip through the
      versioned payload as three-field records (`position;score;weight`), so
      an exit before every iDevice initialised does not wipe migrated
      progress.
    - The serialised registry is written not only at exit but also on
      `visibilitychange → hidden` and on a persisted `pagehide` (bfcache
      entry), so a page killed without a further event can still restore its
      activity state.
    - Bounded to the SCORM 1.2 CMIString4096 limit. When the payload would
      overflow, the unclaimed legacy pool is dropped first, then activities
      that do not block completion, then the most recently registered ones —
      each compaction is logged; the records that decide the status survive.
    - Malformed, truncated or foreign payloads are ignored rather than thrown
      inside a learner's session.
    - Only identifiers, flags, counters, scores and weights are stored — no
      learner names and no learner responses.

## Evidence

- Single status element and its vocabulary: ADL, *SCORM Version 1.2 — The SCORM
  Run-Time Environment*, §3.4.4 (`cmi.core.lesson_status`); the LMS must refuse
  `"not attempted"` from a SCO: *SCORM 1.2 Conformance Requirements* 1.6.5.
- `cmi.suspend_data` is CMIString4096, maximum 4096 characters: *Conformance
  Requirements* 2.3/2.4 and 10.8.
- `cmi.student_data.mastery_score` is optional and may be blank: *Conformance
  Requirements* 7.2.*, as corrected by ADL, *The SCORM Addendums Version 2.0*,
  Addendum 17.
- The previous premature pass/fail write: `showFinalScore` in
  `public/app/common/common.js` at commit `183162773`, which wrote
  `cmi.core.lesson_status` on every score update.
- The previous positional-index payload: `registerActivity` /
  `convertToLineFormat` / `parseActivity` in the same file.
- The boolean completion input: `setHasScoredActivities` in
  `public/app/common/scorm/scorm12/exe-scorm12-policy.js` and its caller
  `initScorm()` in `public/app/common/exe_export.js`, at the same commit.

## Consequences

### Positive

- A page whose required activities are finished is reported `completed`,
  `passed` or `failed` rather than always `incomplete`.
- Pass/fail can no longer be decided while required activities are pending; the
  invariant is asserted directly in
  `public/app/common/scorm/scorm12/exe-scorm12-invariants.test.js`.
- SCORM communication, aggregation, completion policy and pass/fail policy are
  four separate, separately testable units.
- Activity state survives a resumed attempt through a versioned, bounded,
  migratable `cmi.suspend_data` payload instead of an unversioned localized
  string.
- Presentation-only iDevices have a documented way not to block completion.

### Negative

- Newly exported SCORM 1.2 packages write a different `cmi.suspend_data` format.
  A learner resuming an attempt started in an older package is migrated on
  entry; the reverse (opening a new payload with an old package) is not
  supported, and the old parser will simply find no records.
- A migrated activity restores its score but **not** its completion (the legacy
  format never stored one), so a learner resuming a legacy attempt on a page
  with required activities must re-complete them before the page reports
  `completed`/`passed` — inventing completion from a non-zero score would be
  wrong in both directions (a finished activity scored 0, a half-done one with
  points).
- The registry is a SCORM 1.2 runtime layer, so every consumer in `common.js`
  must feature-detect it. HTML5/EPUB exports and SCORM 2004 packages keep the
  previous behaviour.
- One more layer in the assembled `libs/SCOFunctions.js`.

### Neutral

- The default success threshold of 50 preserves the behaviour game iDevices
  already had; the change is *when* the decision is taken, not the number.
- Already-exported packages carry their own runtime copy and are unaffected.

## Risks

- **Third-party iDevices** that never call the gamification helper will not
  register, so their pages fall back to the page-level flag. That is the
  previous behaviour, not a regression, but such pages do not benefit from the
  new policy.
- **`cmi.suspend_data` pressure.** A page with very many activities can exceed
  4096 characters; compaction then drops non-required records. The behaviour is
  deterministic and logged, but a learner's stored per-activity scores can be
  lost in that extreme case.
- **Completion semantics of a game.** `completed` is reported when the iDevice
  says its game is over or the learner submitted a score by hand. An iDevice
  that never reaches either state keeps its page `incomplete` — which is the
  intended meaning, but it makes a buggy iDevice visible as a stuck page.

## Validation

- `public/app/common/scorm/scorm12/exe-scorm12-activities.test.js` — registry
  semantics, aggregation and weighting, serialisation round-trip, legacy
  migration, compaction, malformed payloads.
- `public/app/common/scorm/scorm12/exe-scorm12-policy.test.js` — the full
  activity matrix required by the completion policy: no iDevices, unstarted,
  partially answered, completed passing, completed failing, mixed, two
  completed, quiz plus presentation, presentation-only, suspended and reopened,
  retry after failure, review mode, browse mode, score exactly at the threshold,
  an activity that reports no completion flag, dynamic registration, duplicate
  registration and corrupt state.
- `public/app/common/scorm/scorm12/exe-scorm12-invariants.test.js` — pass/fail
  is never decided before required activities finish; duplicate activity events
  do not corrupt the aggregate; reordering independent content events does not
  change the persisted result.
- `public/app/common/common.test.js` — the `common.js` bridge, including its
  behaviour when the registry is absent.

## References

- [ADR-2209-01](ADR-2209-01-scorm12-runtime-rewrite.md) — the runtime this layer joins.
- [doc/development/scorm12-runtime-contract.md](../../development/scorm12-runtime-contract.md) §9.
- ADL, *SCORM Version 1.2 — The SCORM Run-Time Environment* (2001-10-01).
- ADL, *SCORM Version 1.2 Conformance Requirements*.
- ADL, *The SCORM Addendums Version 2.0* (2002-01-04).
