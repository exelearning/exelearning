---
id: ADR-0043
title: "Track SCORM 1.2 page completion through a central activity registry"
status: Proposed
date: 2026-08-04
deciders:
  - "@erseco"
reviewers: []
related:
  issues: []
  prs: []
  sdds: []
  adrs:
    - ADR-0001
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5"
---

# ADR-0043: Track SCORM 1.2 page completion through a central activity registry

## Status

Proposed

## Context

A SCORM 1.2 package built by eXeLearning has one SCO per page, and a page can
carry any number of iDevices: several graded quizzes, a presentation, an
exploration activity, or any mix of them. SCORM 1.2 gives that SCO exactly one
status element, `cmi.core.lesson_status`, drawn from
`passed | completed | failed | incomplete | browsed | not attempted` (ADL,
*SCORM Version 1.2 — The SCORM Run-Time Environment*, §3.4.4; the LMS must
refuse `"not attempted"` from a SCO, *SCORM 1.2 Conformance Requirements* 1.6.5).

Before this decision, the runtime introduced by
[ADR-0001](ADR-0001-scorm12-runtime-rewrite.md) decided that single status from
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
   `completed` explicitly from the call site.
4. **Presentation-only and exploration activities never block completion.**
   They register with `completionRequired: false`. Of the two policies the
   alternative would allow — "do not block" versus "must report a viewed
   state" — we choose "do not block", because it requires no change from
   iDevices that have no notion of completion at all.
5. **The policy layer maps the aggregate onto the single status element:**

   | Registry state | `cmi.core.lesson_status` | `cmi.core.exit` |
   |---|---|---|
   | No required evaluable activity | `completed` | `""` |
   | At least one required activity incomplete | `incomplete` | `suspend` |
   | All required complete, no threshold in force | `completed` | `""` |
   | All required complete, aggregate ≥ threshold | `passed` | `""` |
   | All required complete, aggregate < threshold | `failed` | `""` |

6. **The success threshold** is `cmi.student_data.mastery_score` when the LMS
   publishes one (it is optional in SCORM 1.2, so a "not implemented" answer is
   normal and not an error), otherwise **50** — the threshold eXeLearning game
   iDevices have always applied. `policy.setSuccessThreshold(null)` drops the
   pass/fail distinction and reports completion only.
7. **Two write paths, deliberately different.** The *exit* policy never
   downgrades: a terminal status already recorded is preserved. The *in-session*
   re-evaluation (`policy.recordActivityOutcome()`, called after each score
   update) may move between terminal statuses, so a learner who retries a failed
   activity and passes ends up `passed`; it never replaces a terminal status
   with a non-terminal one.
8. **The score stays single-source.** `common.js` keeps computing the aggregate
   with `getFinalScore()` — the weighting algorithm published packages depend on
   — and passes it to the policy, which records it *and* decides the status from
   the same number. The two can therefore never disagree.
9. **`setPageHasScoredActivities()` remains the fallback.** When no iDevice
   registers, the page-level flag decides exactly as before, so content that
   predates the registry is unaffected.
10. **The registry persists itself into `cmi.suspend_data`** in a versioned
    format, migrating the previous one:

    ```
    exe12/1|<uri-encoded id>;<flags>;<answered>;<total>;<score>;<weight>;<min>;<max>|…
    ```

    - Version-tagged; a payload from a newer runtime is ignored, not misread.
    - An unversioned payload is parsed as the legacy line format and migrated.
      Such a record counts as completed exactly when it carries a non-zero score
      (a fresh registration always seeded 0), and its title is dropped — it is
      not needed for aggregation and it is the largest field in a
      size-constrained element.
    - Bounded to the SCORM 1.2 CMIString4096 limit. When the payload would
      overflow, activities that do not block completion are dropped first, then
      the most recently registered ones, and the compaction is logged; the
      records that decide the status survive.
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

- [ADR-0001](ADR-0001-scorm12-runtime-rewrite.md) — the runtime this layer joins.
- [doc/development/scorm12-runtime-contract.md](../../development/scorm12-runtime-contract.md) §9.
- ADL, *SCORM Version 1.2 — The SCORM Run-Time Environment* (2001-10-01).
- ADL, *SCORM Version 1.2 Conformance Requirements*.
- ADL, *The SCORM Addendums Version 2.0* (2002-01-04).
