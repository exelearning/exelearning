---
id: ADR-1831-01
title: "Learner interaction owns the SCO status, not the page lifecycle"
status: Proposed
date: 2026-08-24
tracking_issue: 1831
deciders:
  - "@mnarvaezm"
reviewers: []
related:
  prs: []
  changes: []
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5"
---

# ADR-1831-01: Learner interaction owns the SCO status, not the page lifecycle

## Context

Every page of a SCORM export is a SCO. Its status (`cmi.core.lesson_status` in SCORM 1.2;
`cmi.completion_status` + `cmi.success_status` in 2004) is what an LMS shows in its index and what
teachers read as evidence of progress.

Until this decision, three separate mechanisms wrote that status without the learner having done
anything:

1. The vendored pipwerks wrapper ships `handleCompletionStatus: true`. Right after `LMSInitialize`,
   `connection.initialize()` rewrites `not attempted` to `incomplete` and commits. Opening a page
   marked it as started.
2. `unloadPage()` wrote `completed` whenever it believed the page carried no evaluable iDevices. Its
   only signal was the `isSCORM` flag computed by a DOM scan that runs on a timer, plus a raw
   `suspend_data` emptiness check, so a page whose scan had not finished was written as content-only.
3. `LMSFinish` itself. Moodle promotes any SCO still in `not attempted` to `completed` inside
   `StoreData` when `storetotaltime` is true, which is exactly the finish call. Closing the session
   was therefore a status change even when the SCO wrote nothing.

Seven code paths open the SCORM session — `loadPage`, `initGame` and the `window.scorm.init()` of
`adaptative-quiz`, `form`, `trueorfalse`, `interactive-video` and `scrambled-list` — so the first
mechanism could not be neutralised per caller.

## Problem

Who is allowed to write the SCO status of a page: the page lifecycle (load, unload, tab visibility,
session close), or the learner's interaction with the SCORM iDevices on it?

## Decision drivers

- **Truthfulness of the record.** A status is evidence about a learner. It must never claim work the
  learner did not do, and the mark a teacher reads must match the score the learner actually has.
- **Single ownership.** Two writers for one value produce races that only reproduce on real LMSs.
- **LMS conformance.** SCORM 1.2 forbids writing `not attempted` to `cmi.core.lesson_status`; Moodle
  answers error 405. "Not attempted" can only be expressed by not writing.
- **Reversibility.** A previous, broader attempt at this (five fixes, 2026-08-24) was reverted after
  an undiagnosed regression in the LMS score menu, so the blast radius must stay small.
- **Backward compatibility.** Packages exported before this change carry `suspend_data` without the
  per-iDevice state field.

## Options considered

### Option 1: Keep lifecycle writes, only stop the initialize-time one

Turn off `handleCompletionStatus` and leave everything else. Small and safe.

- Pro: no change to session closing; zero risk to the paths that already work.
- Con: does not solve the reported behaviour. A visited-but-untouched page still ends as `completed`,
  because Moodle promotes it on `LMSFinish`.

### Option 2: Never close the session

`unloadPage` commits but never calls `LMSFinish`, on any page.

- Pro: no LMS-side promotion anywhere.
- Con: this is the change that was reverted on 2026-08-24. It also strands genuinely finished
  attempts and loses total-time accumulation on every page, not just untouched ones.

### Option 3: Learner interaction owns the status; the lifecycle closes the session only when there was interaction

The status is written exclusively by the iDevices. The page lifecycle reads it. A page whose SCORM
iDevices the learner never started is left entirely alone — no status, no `session_time`, no commit,
no `LMSFinish`. Content-only pages keep completing on exit.

- Pro: it is the only option that keeps an untouched page genuinely "not attempted".
- **Con: it does not work.** Implemented and tested against the real package, it breaks all saving.
  Leaving the session open means the next SCO's `LMSInitialize` is refused with error 101, after
  which the wrapper never sets `connection.isActive` and every `LMSSetValue`/`LMSGetValue`/
  `LMSCommit` in the rest of the package is silently dropped. See Evidence.

### Option 4: Learner interaction owns the status; the session always closes, and an untouched page is recorded as incomplete

Same as option 3, except the session is always terminated, and a scored page the learner never
started has `incomplete` written immediately before `LMSFinish` — for the single purpose of denying
Moodle the chance to promote it to `completed`.

- Pro: saving works everywhere, and a page the learner never did is never reported as done.
- Con: "not attempted" cannot survive the visit. It is the closest achievable state.

## Evidence

- `public/app/common/scorm/SCORM_API_wrapper.js` `connection.initialize()`: the
  `handleCompletionStatus` branch rewrites `not attempted` / `unknown` to `incomplete`. Inherited
  from the pipwerks 1.1.7 import.
- Moodle `mod/scorm/datamodels/scorm_12.js` (verified against `MOODLE_405_STABLE`, identical in
  `MOODLE_500_STABLE`):
  - L38-39, L73: `cmi.core.lesson_status` validates against a vocabulary that excludes
    `not attempted`; writing it returns error 405.
  - L621-634 `StoreData(cmi, storetotaltime)`: with `storetotaltime` true — i.e. from `LMSFinish` —
    `if (lesson_status == 'not attempted') lesson_status = 'completed'`.
  - `LMSCommit` also refreshes the table of contents, so committing is enough to update the index;
    finishing is not required for that.
- Moodle `mod/scorm/module.js` L199: Moodle never calls `LMSFinish` itself; it replaces the iframe
  and relies on the package. A session left open is not an error condition for the player.
- Moodle `mod/scorm/locallib.php` L1664: the index shows the "suspended" icon when the SCO is
  incomplete and `cmi.core.exit == 'suspend'`. `connection.terminate()` writes that exit value on its
  own, so not terminating also avoids falsely flagging an untouched page as suspended.
- `public/app/common/common.js` `registerActivity` inscribes every evaluable iDevice into
  `suspend_data` with state 0 on page load. The presence of entries is therefore not evidence of
  interaction; only states 1 (started) and 2 (finished) are.
- **Withholding `LMSFinish` breaks the whole package.** Reproduced by running the real exported
  package (`test-scorm-1831_scorm`) in a browser against an API that answers 101 to a second
  `LMSInitialize`, as an LMS must. Opening a scored page without touching it and moving on gives:

  ```
  Initialize                     <- SCO 2 (scored page), learner does not touch it
  Set cmi.suspend_data ... Estado: 0
                                 <- learner leaves: no LMSFinish, session stays open
  Initialize REJECTED 101        <- SCO 3, three times (loadPage, initGame, the iDevice)
  ```

  `pipwerks.SCORM.connection.isActive` then stays `false` on SCO 3, and `data.get`/`data.set`/
  `data.save` all begin with `if (scorm.connection.isActive)`, so every later write is dropped
  without an error the learner or the author can see. One untouched page poisons the rest of the
  package: nothing saves and every SCO reads "not attempted".

## Decision

We will make learner interaction the sole owner of the SCO status.

1. The wrapper ships `handleCompletionStatus: false`. Opening a page writes nothing.
2. The status is written only from the iDevice path, and **it tracks the score, not whether the
   activity is finished**. From the moment the learner starts, the page carries the verdict its
   weighted average implies and keeps updating it on every save: `failed` under 50, `passed` at 50
   or above. Starting therefore reads `failed` with 0 until the answers lift the average, and
   restarting a finished activity drops it back to `failed` with 0. `incomplete` means one thing
   only: the learner never started. The same rule applies to a page with several scored iDevices —
   the average spans all of them, so those not yet attempted count as 0 and hold the page at
   `failed` until enough work accumulates.
3. `showFinalScore` writes nothing when the page aggregates to state 0. "Not attempted" is the
   absence of a write.
4. `unloadPage` never writes the status of a page whose SCORM iDevices the learner used. **The
   session is always terminated**, on every page: a SCO that does not terminate blocks the next
   one. When no evaluable iDevice was started, `incomplete` is written immediately before
   `LMSFinish`, for the single purpose of denying Moodle the promotion to `completed`. The
   `visibilitychange` / `freeze` / bfcache commits are still skipped for an untouched page, so
   switching tabs writes nothing.
5. A page with no evaluable iDevices keeps being marked `completed` on exit, so a course built from
   content pages can still complete.
6. Whether a page carries evaluable iDevices is decided from three signals — the `isSCORM` DOM scan,
   the parsed `suspend_data` entries, and, when `common.js` is unavailable, raw `suspend_data`
   emptiness — because a false "content-only" verdict writes a status the learner never earned.

SCORM 2004 mirrors 1.2 rather than using its own split: 1.2 has a single `cmi.core.lesson_status`
where writing a verdict erases any notion of progress, so 2004 sets `completion_status` to
`completed` alongside the `success_status` verdict instead of keeping a progress state the 1.2
profile cannot express. `cmi.exit` still tracks whether the page is finished, so an unfinished page
stays resumable (`suspend`) even while it reports a verdict.

The suspend_data format stays owned by `common.js` (`parseSuspendData` / `getActivityState` /
`hasAttemptedActivity`); the SCO runtime consults it through those helpers.

## Consequences

### Positive

- Opening a page writes nothing at all: while the learner is on it, the LMS still reads
  "not attempted".
- The status becomes a single-writer value, so entering and leaving can no longer race the iDevices.
- A page the learner never did is never reported as `completed`.
- Every SCO terminates, so no page can block the next one from saving.

- **"Not attempted" does not survive the visit.** A scored page the learner opened and left is
  recorded as `incomplete`. Keeping it truly unattempted is not achievable in Moodle: the only way
  is to withhold `LMSFinish`, which breaks saving for the rest of the package.
- **A learner in progress shows as failed.** Removing the in-progress state is the price of a status
  that tracks the score. A teacher looking at the index mid-activity sees the "failed" icon for
  anyone still under the threshold.
- **On a page with several scored iDevices the failed state persists longer**, because the average
  counts the untouched ones as 0. A perfect result on a light iDevice cannot lift the page over the
  threshold on its own.

### Neutral

- Content-only pages are unchanged.
- Legacy `suspend_data` without the state field counts as attempted, so old packages keep closing
  their sessions exactly as before.

## Risks

- **An iDevice that auto-starts on load** would move its page to incomplete without interaction.
  `select-media-files` did exactly this for untimed activities with no access code and now passes an
  explicit `auto` flag. Any new auto-start path must do the same.
- **The interaction gate depends on `suspend_data` being readable.** If it cannot be parsed the
  runtime treats the page as attempted and finalizes as before, which is the safe direction.

## Validation

- Unit tests: `public/app/common/scorm/SCOFunctions.test.js` (the interaction gate over
  `unloadPage` and the lifecycle handlers), `public/app/common/scorm/SCORM_API_wrapper.test.js` (the
  shipped defaults), `public/app/common/common.test.js` (`hasAttemptedActivity`, `restartActivity`
  from state 0, `showFinalScore` writing nothing at state 0), and the SCO template sandboxes in
  `src/shared/export/exporters/Scorm12Exporter.spec.ts` / `Scorm2004Exporter.spec.ts`.
- `public/app/common/scorm/scorm-lms-flow.test.js` walks the learner journey with the real runtime
  files on top of an LMS that enforces the Moodle rules (405 on `not attempted`, 101 on a second
  `LMSInitialize`, promotion at `LMSFinish`) and asserts what was PERSISTED. It is the level that
  catches "nothing reaches the LMS", which per-call mocks cannot.
- Manual: a package with one content-only page, one page with a single SCORM iDevice and one with
  several, uploaded to Moodle in both 1.2 and 2004, walking the full path — visit without touching,
  start, answer, finish above and below 50, revisit — and confirming a later SCO still saves after
  an untouched page.

## Follow-up work

- Audit the remaining iDevices for auto-start paths that reach `restartActivity` without a learner
  action.

## References

- Issue [#1831](https://github.com/exelearning/exelearning/issues/1831)
- `public/app/common/scorm/SCOFunctions.js`, `public/app/common/scorm/SCORM_API_wrapper.js`,
  `public/app/common/common.js`, `public/app/common/exe_export.js`
- `src/shared/export/exporters/Scorm12Exporter.ts`, `src/shared/export/exporters/Scorm2004Exporter.ts`
- Moodle `mod/scorm/datamodels/scorm_12.js`, `mod/scorm/module.js`, `mod/scorm/locallib.php`
  (`MOODLE_405_STABLE`)
- SCORM 1.2 Run-Time Environment §3.4.4 (`cmi.core.lesson_status` vocabulary)
