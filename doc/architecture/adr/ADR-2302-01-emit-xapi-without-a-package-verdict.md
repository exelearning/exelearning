---
id: ADR-2302-01
title: "Emit xAPI as an analytics feed with no package verdict"
status: Proposed
date: 2026-08-20
tracking_issue: 2302
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
related:
  prs: [2302]
  changes: []
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Codex, Claude Code"
  model: "GPT-5.6-sol, claude-opus-5"
---

# ADR-2302-01: Emit xAPI as an analytics feed with no package verdict

## Context

Every export format ships the xAPI emitter (`public/app/common/xapi/exe_xapi.js`, injected through
`BASE_LIBRARIES` in `src/shared/export/constants.ts`). Until this change the emitter also tried to be
a grading authority: on every answer it recomputed a package-level `completed` + `passed`/`failed`
pair from the scores it had seen, against the package's Activity IRI.

That aggregate cannot be right on a multipage export. Each page is a separate HTML document with a
fresh JavaScript context, so the emitter's state only ever holds the scores answered on the current
page. Two pages of a single attempt could emit `passed` (raw 100) and `failed` (raw 40) for the same
activity — a self-contradicting record for any consumer. On a single-page package the same aggregate
normalized over the *answered* subset only, so a learner who answered just the weight-25 iDevice of a
25/75 package was reported as `passed` with raw 100.

The verdict also had no consumer. The reference consumer, `mod_exelearning`, does not ingest xAPI
statements for grading; it grades from its own channel against the roster it derives from the
uploaded package. No other component in this repository reads a package-level statement.

## Problem

Should the emitter report a package-level result at all, and if not, what is it for?

## Decision drivers

- **Correctness over coverage.** A verdict no page can compute is worse than no verdict.
- **No consumer, no feature.** Machinery kept "in case someone needs it" is machinery nobody tests
  against a real requirement.
- **The wire must not carry package structure authored by a learner.** Anything the emitter reports
  is sent from a learner's browser; a package result derived there is learner-authored.
- **Identity is the exporter's job.** Only the export pipeline knows the package and page identity;
  the runtime tracker never has it.

## Options considered

### Option 1: Keep the verdict, suppress it only on multipage packages

Inject a `pageCount` and skip `completed`/`passed`/`failed` when it exceeds 1. Fixes the
contradicting-verdict defect but keeps the whole aggregate (`_state`, seeding of unanswered
iDevices, a weighted total, a pass threshold) alive for the single-page case, plus a config key and a
`page-count` extension threaded through six exporters — for a verdict nothing consumes.

### Option 2: Carry the page-local aggregate across documents

Persist the aggregate in `sessionStorage` so a multipage package can emit a verdict again. Rejected:
it is per-origin and per-tab (absent in sandboxed iframes and in `file://` SCORM players), it
survives across attempts, and the verdict would still be a learner-authored reconstruction of
package structure.

### Option 3: Emit no package verdict at all (chosen)

Reduce the emitter to what a single page can honestly observe.

## Evidence

- `public/app/common/xapi/exe_xapi.js` — each exported page loads the emitter as its own script in
  its own document; the emitter holds no cross-document state, so its aggregate is page-local by
  construction.
- `src/shared/export/exporters/{Html5,Scorm12,Scorm2004,Ims,Epub3,Page}Exporter.ts` — before this
  change only `Html5Exporter` and `PageExporter` passed an `xapi` config to the renderer. The other
  four loaded the emitter with no identity at all, so `_resolveConfig()` fell back to the per-page
  document URL as the activity IRI and emitted no `package-id` extension.
- `src/shared/export/renderers/PageRenderer.ts` — the emitter `<script>` tag was emitted
  unconditionally, including from the print preview, whose exporter never copies the file.
- xAPI Data spec (<https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md>) — `result.score`
  declaring `min`/`max` must contain a `raw` inside that range and a `scaled` in `[-1,1]`; the
  emitter advertised 0..10 while forwarding an unclamped `game.scorerp`.
- `fetch()` without `keepalive` is cancelled when the document unloads
  (<https://developer.mozilla.org/en-US/docs/Web/API/RequestInit#keepalive>), which is exactly when
  the `terminated` statement is sent.
- An `unload` listener disables the back/forward cache
  (<https://developer.mozilla.org/en-US/docs/Web/API/Window/unload_event>) — the same rule already
  applied to the SCORM 1.2 runtime in #2209.

## Decision

**The xAPI emitter is an analytics/LRS feed, not a grading channel. It emits no package-level
verdict.**

Per page it emits exactly:

1. `initialized` — once on load, when a transport is available.
2. `answered` — one per gradable iDevice reporting a score, carrying the stable `idevice-id`, the
   score clamped onto its declared 0..10 scale, and the package/page identity extensions.
3. `terminated` — once on `pagehide`.

`completed`, `passed` and `failed` are never emitted, and the emitter keeps no score aggregate. A
consumer that needs a package result derives it from the `answered` statements together with its own
knowledge of the package — which is what `doc/elpx-format/tracking-emission.md` tells consumers to
do. Grading authority stays with each format's own runtime (SCORM's `cmi.*`) or with the consumer's
server.

Alongside that reduction, the defects the emitter had regardless of the verdict are fixed:

- **Every format injects the identity config.** `BaseExporter.buildXapiConfig()` is the single source
  of the `window.exeXapi` shape and is called by `Html5Exporter`, `Scorm12Exporter`,
  `Scorm2004Exporter`, `ImsExporter`, `Epub3Exporter` and `PageExporter`, so no format loads an
  emitter with a document-URL identity.
- **The loader `<script>` is gated on that config being present**, so an exporter that bundles no
  emitter (the print preview) no longer requests one.
- **Statement hygiene:** the answered score is clamped onto 0..10; the LRS POST uses `keepalive` so
  the `pagehide`-time `terminated` survives document unload; the terminate hook binds `pagehide`
  only, never `unload`.
- **Page identity travels in the config** (`pageId`, `pageTitle`, surfaced as the `page-id` and
  `page-title` extensions), because only the exporter knows which page a document renders.

## Consequences

### Positive

- No statement the emitter sends can contradict another one: every statement reports something the
  emitting page actually observed.
- The wire carries no package-structural metadata authored by a learner, so "students never define
  package structure" holds by construction.
- Six exporters share one identity config, and statements from SCORM, IMS and EPUB packages are
  attributable to a package for the first time.
- The emitter loses its dependency on the score aggregator: `emit()` no longer reads
  `gamification.scorm.getFinalScore`, `ideviceNumber` or `weighted`.

### Negative

- Packages produce no attempt-level closure over xAPI. A consumer that previously read `completed`
  or `passed`/`failed` from a single-page package must now derive it from the `answered` statements.
- Single-page packages lose a verdict that was correct once unanswered iDevices were seeded. Nothing
  in this repository or in `mod_exelearning` consumed it.

### Neutral

- SCORM output is unchanged; SCORM packages keep grading through `cmi.*`.
- `initialized`/`terminated` remain generic xAPI lifecycle statements, one pair per page visited.
  They are not cmi5, and a `terminated` is not the end of an attempt.

## Risks

- An external LRS dashboard built on the `completed`/`passed`/`failed` verbs from a single-page
  eXeLearning package would stop receiving them. Low: the emitter shipped in v4.0.2 and the verdict
  was page-local (and, on multipage packages, self-contradicting) for its whole life.

## Validation

- `public/app/common/xapi/exe_xapi.test.js` pins the contract directly: across an answered sequence
  and a `pagehide`, no `completed`, `passed` or `failed` statement is ever emitted. It also pins the
  0..10 clamp at both ends, a single `initialized` and a single `terminated` per page, the LRS POST
  shape, and actor anonymization when broadcasting to `'*'`.
- `test/integration/export-unified.spec.ts` exports every format (HTML5, SCORM 1.2, SCORM 2004, IMS,
  EPUB3, ELPX, single-page ELPX, single page) and asserts each ships the emitter file, loads it, and
  injects `window.exeXapi` with the page identity.
- `src/shared/export/exporters/BaseExporter.spec.ts` pins the config shape;
  `PrintPreviewExporter.spec.ts` pins that a format bundling no emitter requests none.

## Follow-up work

- None. The consumer-side grading contract is tracked in `mod_exelearning`, not here.

## References

- [PR #2302](https://github.com/exelearning/exelearning/pull/2302)
- [`doc/elpx-format/tracking-emission.md`](../../elpx-format/tracking-emission.md)
- [xAPI Data spec](https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md)
- [xAPI Communication spec](https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Communication.md)
