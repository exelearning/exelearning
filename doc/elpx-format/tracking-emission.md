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
