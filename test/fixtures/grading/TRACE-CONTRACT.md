# Grading trace contract (v2)

Tier 1 (the core recorder, `test/e2e/playwright/specs/grading-matrix-recorder.spec.ts`)
writes this; Tier 2 (a plugin-side replay) reads it. Any change to the shape bumps
`traceVersion`; readers must refuse a version they do not know.

## File: `<scenario>.<engine>.trace.json`

One file per scenario **and per browser engine** (`chromium`, `firefox`, …). A trace
recorded in Gecko does not overwrite the Chromium one: the end-of-session path
(`pagehide` / `visibilitychange`, bfcache) does not fire on the same schedule in both, so
two engines are two pieces of evidence. v1 files have no engine segment (see
[Committed traces](#committed-traces)).

```jsonc
{
  "traceVersion": 2,
  "scenario": "m2-four-types-single-page",
  "engine": "chromium",              // Playwright `browserName` of the recording run

  "recordedFrom": {
    "repo": "exelearning",
    "ref": "<git sha>",              // the checkout that ran the recorder (informational)
    "exportFormat": "html5"          // html5 | scorm12 | scorm2004 | ims | epub3
  },

  // THE PACKAGE. `sha256` is the digest of the exported zip before any serve-time
  // patch — the one thing that says which bytes were driven, independent of `ref`.
  "package": {
    "odeId": "…",                    // <odeIdentifier>; may be "" — record what it really is
    "pageCount": 2,
    "sha256": "<hex>"
  },

  // THE RUNTIME the serving model injected — the plugin's own pair, not the export's.
  // `version` is the `eXeLearning-SCORM12-Runtime:` stamp of the served
  // SCOFunctions.js; null means the legacy pair, which carries no stamp.
  "runtime": {
    "sha256": "<hex of libs/SCOFunctions.js as served>",
    "version": "v0.0.0-alpha",       // or null
    "wrapperSha256": "<hex of libs/SCORM_API_wrapper.js as served>"
  },

  // HOW it was served. `injector` names the revision of the plugin's
  // scorm_injector.php that rewrote the pages: "main" (forces pipwerks.SCORM.init())
  // or "105" (exeScorm12.session.open({ ownsLifecycle: false }), with init() as a
  // two-second fallback). The rewritten runtime records nothing under "main".
  "servingModel": {
    "injector": "105",
    "injectorSource": { "repo": "…", "ref": "…", "commit": "<sha>", "file": "…" },
    "idevicePatch": ["idevices/form/form.js", "idevices/scrambled-list/scrambled-list.js"]
  },

  // Present only when the recorder changed the fixture before exporting it (v1 and
  // early v2 traces: `isTest: true` for trueorfalse). A recorder that exports the
  // fixture as authored omits it.
  "fixtureRepairs": { "isTest": true },

  // One entry per page of the export, in navigation order.
  // `ideviceNodes` is the ORDERED list of .idevice_node element ids as they appear
  // in that page's DOM — exactly what resolveObjectMap() reads. Index i => slot i+1.
  "pages": [
    { "index": 0, "url": "index.html",         "ideviceNodes": ["ide-a"] },
    { "index": 1, "url": "html/page-two.html", "ideviceNodes": ["ide-b"] }
  ],

  // What the driver did, per iDevice, in order — clicked answers, drops, sort order,
  // and the hits/of it was aiming for. Free-form per type; evidence, not replay input.
  "interactions": [],

  // Ordered SCORM API traffic as seen by the parent window.API, across ALL pages.
  // `page` is the index of the page whose document was really loaded when the call
  // happened (calls fired by unload handlers stay on the OLD page); `navPage` is the
  // index the driver had navigated to; `href` is the frame's location at the time.
  // Record ALL of LMSInitialize / LMSSetValue / LMSGetValue / LMSCommit / LMSFinish.
  "scorm": [
    { "seq": 0, "page": 0, "navPage": 0, "href": "…", "method": "LMSInitialize", "args": [""], "ret": "true" },
    { "seq": 1, "page": 0, "navPage": 0, "href": "…", "method": "LMSSetValue",
      "args": ["cmi.suspend_data", "exe12/1|ide-a;7;0;4;100;25;0;100"], "ret": "true" }
  ],

  // Ordered xAPI statements captured from the exe-xapi-statement postMessage envelope.
  // Always empty for packages built after xAPI was retired (ADR-2302-02); the lane is
  // kept so the recorded fixtures below stay readable under the same schema.
  // in emission order. Store the FULL statement object, untouched.
  "xapi": [
    { "seq": 0, "page": 0, "navPage": 0, "href": "…", "statement": { "verb": {}, "object": {}, "result": {} } }
  ],

  // The parent's cmi map when the run ended — what an LMS would have persisted.
  "finalCmi": { "cmi.suspend_data": "…", "cmi.core.score.raw": "25", "cmi.core.lesson_status": "failed" },

  // `console.error` texts and `pageerror: <message>` entries from the package frame.
  // A v2 recorder fails on any `pageerror:` entry, so a committed v2 trace has none.
  "consoleErrors": [],

  // THE ORACLE. Hand-computed in the scenario definition, never derived from the
  // code under test. A scenario whose `expected` is computed by the implementation
  // is worthless.
  "expected": {
    "policyId": "weighted-mean-v1",              // which rule `overall` follows (below)
    "perItem": { "ide-a": 100, "ide-b": 0 },     // objectid -> score 0..100
    "overall": 25,                                // 0..100 under `policyId`
    "weights": { "ide-a": 25, "ide-b": 75 },
    "ungraded": [],                               // iDevices deliberately never answered
    "note": "(100*25 + 0*75)/100 = 25"
  }
}
```

## Oracle policies

`expected.policyId` says which rule produced `expected.overall`, so a reader can tell a
changed oracle from a changed producer.

| policyId | overall | unanswered iDevice |
|---|---|---|
| `weighted-mean-v1` | Σ(perItem·weight) / Σ(weight) over every gradable iDevice | not exercised — every scenario answers every iDevice, `ungraded` is `[]` |
| `legacy-2025` | same formula | counted as 0 and included in Σ(weight) (`s6`: 31.25) |

The rule for an unanswered iDevice is an open product decision (audit FINAL.md B10):
core's `s6` oracle counts it as 0, the plugin's own `synthetic-stale-slot` fixture
(mod_exelearning#126) excludes it as `ungraded` (50), and `exelearning-matrix.spec.ts`
asserts a null raw score for it. Once decided, that rule gets its own `policyId`, the
`ungraded` list becomes load-bearing, and traces that exercise it are recorded under it.
Until then no v2 trace exercises the rule.

## Replay obligations (Tier 2)

**SCORM lane (Vitest).** Feed `scorm[]` in `seq` order into the real
`js/scorm_tracker.js` via `createScormApi()`. Before each call, point
`config.getScoringDocument` at a DOM built from `pages[call.page].ideviceNodes`
(that is what makes page navigation observable). Capture the POSTed bodies via
the `xhrFactory` stub. Assert the final accumulated `itemscores`.

**SCORM lane (PHPUnit).** Feed the itemscores the Vitest lane produced into
`track::ingest()`; assert `published_grade()` per item and for itemnumber 0.

**xAPI lane (PHPUnit).** Feed `xapi[].statement` into `ingestor::ingest()` in order;
assert the same outputs.

**The comparison.** For each scenario emit one row:
`scenario | policyId | expected.overall | scorm.overall | xapi.overall | expected.perItem vs each`.
That table IS the deliverable.

No consumer of these files exists in either repository today: mod_exelearning#126
replays its own three hand-authored traces from `tests/fixtures/traces/` and reads no
other directory. Only the contract is shared.

## Recording obligations (Tier 1)

A recorder that records nothing must not pass. The core recorder writes the trace, then
requires of it: at least one `LMSSetValue(cmi.suspend_data)`, a non-empty `finalCmi`, no
`pageerror:` entry, and `Number(finalCmi["cmi.core.score.raw"]) === expected.overall`.
It needs the plugin's runtime pair (`MOD_EXELEARNING_SCORM_ASSETS`) and skips, visibly,
without it. Record against a tree whose i18n bundles are built (`bun run bundle:i18n`);
an export with an empty `libs/common_i18n.js` throws `$exe_i18n is not defined` in every
page and fails the `pageerror` check.

**TODO — one v2 writer.** The core recorder
(`test/e2e/playwright/specs/grading-matrix-recorder.spec.ts`) writes v2. The secondary
serving evidence lane (`specs-moodle/exelearning-serving-matrix.spec.ts`) still emits its
own `traceVersion: 1` shape from an inline `fs.writeJson`, missing `engine`,
`package.sha256`, the `runtime` digests and `expected`. It already holds the inputs a v2
trace needs — a `BuiltPackage` from `loadHtml5PackageFromZip()` (with `zipSha256`) and a
`ServedRuntime` from `installMoodleServing()` — so the fix is to extract the recorder's
`writeTrace()` into a shared writer in `helpers/moodle-serving-model.ts` and have both
lanes call it. Deferred here to keep the change to the shared catalogue; not done as part
of N-13.

## Committed traces

The seven `<scenario>.trace.json` files in this directory are **v1 snapshots**, kept as
evidence of the traffic a pre-#2209 package produces — the traffic the plugin must keep
grading for every package already deployed. They are not the output of the current
recorder and must not be read as the oracle of the current runtime:

- Recorded from **pre-#2209 packages**: `recordedFrom.ref` is `64df99f22` (main,
  "EducaBlue style (#2258)") for `m2`, `m3`, `m3-control`, `m4`, and `642738cd0`
  (`hotfix/fix-xapi-multipage`) for `s2`, `s2-control`, `s6`. Their `suspend_data` is
  the legacy line format (`1. "Title"; Puntuación: 100%; Peso: 25%`), not `exe12/…`.
- Served with the **plugin-main injector** (`pipwerks.SCORM.init()`) and the legacy
  runtime pair; v1 has no `runtime`, `package.sha256`, `engine` or `injector` field, so
  none of that is recorded in the files themselves.
- Every one carries `pageerror: $exe_i18n is not defined` (recorded from a checkout
  without built i18n bundles); `s2-control` also carries `pageerror: score is not
  defined`, the trueorfalse defect main fixed in #2308.
- `m3`, `m3-control` and `m4` pin the legacy **stale-slot defect**: `finalCmi` holds
  `37.5`, `50` and `0` where `expected.overall` says `50`, `56.25` and `25`. That gap is
  the point of those files.
- **`s2`, `s2-control` and `s6` have no shipped producer.** Their `fixtureRepairs.balanceHtml`
  is set by no spec in this repository; they came from an unshipped variant of the
  recorder. `s2-control-istest-false` is explicitly a control recording, not a replay
  scenario.
- Their implicit oracle policy is `legacy-2025` (unanswered iDevices count as 0).

They are **not regenerated** here. Regenerating them means recording the four M
scenarios (and, if kept, a shipped producer for `s2`/`s6`) with the v2 recorder against
the #2209/#105 stack, per engine, after the unanswered-iDevice rule is decided — a
product decision and a Moodle environment, not a mechanical step. When that happens,
the v1 files stay as the legacy evidence they are, under names that say so.

## Changes from v1

- File name carries the engine.
- New: `engine`, `package.sha256`, `runtime{sha256,version,wrapperSha256}`,
  `servingModel.injector` + `injectorSource`, `expected.policyId`, `expected.ungraded`.
- `scorm[]` / `xapi[]` entries document `navPage` and `href` (v1 wrote them without
  saying so).
- `fixtureRepairs` is optional.

## Notes / gotchas baked in

- The suspend_data slot index is PAGE-LOCAL (`common.js` `$('.idevice_node').index()+1`),
  so slots collide across pages. `pages[].ideviceNodes` is what resolves them. The
  `exe12/…` format written from #2209 on is keyed by iDevice id instead — a v2 trace of
  the rewritten runtime carries that format, a v1 trace never does.
- The legacy producer rewrites the WHOLE lmsData map on every score, so `suspend_data`
  carries stale entries from previously visited pages. Do not "clean" the recorded
  values — that staleness is the defect under test.
- Weight reaches the wire ONLY inside suspend_data. xAPI statements carry no weight.
- `odeId` is often "" for in-code fixtures; the emitter then falls back to the served
  URL for its base IRI. Record the real value, do not fabricate one.
