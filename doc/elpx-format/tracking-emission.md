# Tracking Emission: SCORM

Reference document for **how a published eXeLearning package reports learner
scores** to a host LMS.

- **SCORM 1.2/2004** — emitted only by SCORM exports, via the bundled SCORM API
  wrapper. This is the only tracking channel a published package has.

Scores come from a single source in `public/app/common/common.js` (the
`gamification` namespace), so the score math is never duplicated.

Related: [export-pipeline.md](./export-pipeline.md) ·
[libraries.md](./libraries.md) · [ids.md](./ids.md)

### Scope

- The package only **emits** SCORM calls. The host LMS is responsible for
  **authentication, learner identity, validation, storage and gradebook
  mapping**.
- **xAPI was retired** and is no longer emitted by any export format; see
  [ADR-2302-02](../architecture/adr/ADR-2302-02-xapi-retirement.md). It is not
  ruled out as a future capability, but a new implementation starts from a
  concrete consumer and an explicit statement/session contract rather than from
  the plumbing that was removed.
- **cmi5** is not implemented.

---

## 1. How SCORM is emitted

Score emission lives in `public/app/common/common.js` under
`$exeDevices.iDevice.gamification.scorm`. What it talks to depends on the
format: a SCORM 1.2 export carries the project's own runtime, a SCORM 2004
export still carries the legacy files.

| Piece | SCORM 1.2 | SCORM 2004 |
|---|---|---|
| Score logic | `gamification.scorm` in `public/app/common/common.js` | same |
| API wrapper (pipwerks) | `scorm12/vendor/pipwerks/SCORM_API_wrapper.js`, shipped verbatim | `public/app/common/scorm/SCORM_API_wrapper.js` |
| SCO lifecycle | `libs/SCOFunctions.js`, assembled by `src/shared/export/utils/Scorm12Runtime.ts` from the five layers in `public/app/common/scorm/scorm12/` | `public/app/common/scorm/SCOFunctions.js` |
| Injected for | SCORM exports only — `SCORM_LIBRARIES` + `getScormHeadScripts()` | same |
| Runtime gate | `$("body").hasClass("exe-scorm")` | same |

Flow, SCORM 1.2:

1. The exporter sets `body class="exe-scorm exe-scorm12"` and injects the two
   runtime scripts in `<head>` (`Scorm12Exporter.getScormHeadScripts()`).
2. `loadPage()` opens the session: `LMSInitialize`, the entry policy, the
   session clock and the lifecycle listeners.
3. Each gradable iDevice declares itself to the activity registry
   (`scorm.activities`) and reports through
   `gamification.scorm.sendScoreNew(auto, game)` as the learner answers.
4. The registry serialises itself into **`cmi.suspend_data`** in a versioned
   format — `exe12/1|<id>;<flags>;<answered>;<total>;<score>;<weight>;<min>;<max>|…`
   — and is that element's single owner.
5. The aggregate (the registry's `summary().score`, which `getFinalScore()`
   delegates to) is written to **`cmi.core.score.raw`**, and is **not written at
   all** while nothing has scored. The status is decided by the registry, not by
   the score alone: `incomplete` while any required activity is pending,
   `completed` when there is no required activity, and only once every required
   activity is complete does the threshold decide `passed` / `failed`. The
   threshold is `cmi.student_data.mastery_score` when the LMS publishes one,
   otherwise 50.

Full contract: [scorm12-runtime-contract.md](../development/scorm12-runtime-contract.md).
The completion model:
[ADR-2209-02](../architecture/adr/ADR-2209-02-scorm12-activity-completion-registry.md).

SCORM 2004 exports keep the previous behaviour — the legacy runtime files, the
line-format `cmi.suspend_data` (`<n>. "<title>"; Score: <s>%; Weight: <w>%`),
and `passed` when the total reaches 50, `failed` otherwise. The activity
registry is a SCORM 1.2 layer and is absent there.

Every `gamification.scorm.*` method early-returns when `pipwerks` is undefined,
so SCORM does nothing outside SCORM exports.
