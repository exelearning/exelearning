# Grading trace contract (v1)

FROZEN. Tier 1 (core recorder) writes this; Tier 2 (plugin replay) reads it.
Any change bumps `traceVersion`.

## File: `<scenario>.trace.json`

```jsonc
{
  "traceVersion": 1,
  "scenario": "multipage-weighted-25-75",
  "recordedFrom": {
    "repo": "exelearning",
    "ref": "<git sha>",            // which core build produced the package
    "exportFormat": "html5"        // html5 | scorm12 | scorm2004 | ims | epub3
  },

  "package": {
    "odeId": "…",                  // <odeIdentifier>; may be "" — record what it really is
    "pageCount": 2
  },

  // One entry per page of the export, in navigation order.
  // `ideviceNodes` is the ORDERED list of .idevice_node element ids as they appear
  // in that page's DOM — exactly what resolveObjectMap() reads. Index i => slot i+1.
  "pages": [
    { "index": 0, "url": "index.html",         "ideviceNodes": ["ide-a"] },
    { "index": 1, "url": "html/page-two.html", "ideviceNodes": ["ide-b"] }
  ],

  // Ordered SCORM API traffic as seen by the parent window.API, across ALL pages.
  // `page` is the index of the page that was loaded when the call happened.
  // Only calls the plugin's tracker cares about need to be replayed, but record ALL
  // of them: LMSInitialize / LMSSetValue / LMSGetValue / LMSCommit / LMSFinish.
  "scorm": [
    { "seq": 0, "page": 0, "method": "LMSInitialize", "args": [""] },
    { "seq": 1, "page": 0, "method": "LMSSetValue",
      "args": ["cmi.suspend_data", "1. \"A\"; Puntuación: 100%; Peso: 25%"] }
  ],

  // Ordered xAPI statements captured from the exe-xapi-statement postMessage envelope,
  // in emission order. Store the FULL statement object, untouched.
  "xapi": [
    { "seq": 0, "page": 0, "statement": { "verb": {}, "object": {}, "result": {} } }
  ],

  // THE ORACLE. Hand-computed in the scenario definition, never derived from the
  // code under test. A scenario whose `expected` is computed by the implementation
  // is worthless.
  "expected": {
    "perItem": { "ide-a": 100, "ide-b": 0 },   // objectid -> score 0..100
    "overall": 25,                              // weighted, 0..100
    "weights": { "ide-a": 25, "ide-b": 75 },
    "note": "getFinalScore largest-remainder: (100*25 + 0*75)/100 = 25"
  }
}
```

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
`scenario | expected.overall | scorm.overall | xapi.overall | expected.perItem vs each`.
That table IS the deliverable.

## Notes / gotchas baked in

- The suspend_data slot index is PAGE-LOCAL (`common.js` `$('.idevice_node').index()+1`),
  so slots collide across pages. `pages[].ideviceNodes` is what resolves them.
- The producer rewrites the WHOLE lmsData map on every score, so `suspend_data`
  carries stale entries from previously visited pages. Do not "clean" the recorded
  values — that staleness is the defect under test.
- Weight reaches the wire ONLY inside suspend_data. xAPI statements carry no weight.
- `odeId` is often "" for in-code fixtures; the emitter then falls back to the served
  URL for its base IRI. Record the real value, do not fabricate one.
