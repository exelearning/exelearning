---
id: ADR-2190-01
title: "Preserve malformed iDevice properties on import"
status: Proposed
date: 2026-08-15
tracking_issue: 2190
deciders:
  - "@erseco"
reviewers:
  - "@erseco"
related:
  prs: []
  changes: []
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-fable-5"
---

# ADR-2190-01: Preserve malformed iDevice properties on import

## Context

An `.elpx` package stores each activity's configuration as JSON inside
`<jsonProperties>`. Historic builds could persist a corrupted payload (#2177:
a save-time regex ate escape backslashes), and externally produced or manually
edited packages can carry unparseable payloads too. The editor already handles
a malformed payload that is *present in the document*: it renders the retained
HTML, blocks editing, and keeps the raw value (`malformedJsonPropertiesRaw`,
#2178), and the write boundary rejects invalid new writes (#2179).

The importer, however, replaced any payload it could not parse with `{}`
(`src/shared/import/ElpxImporter.ts`, issue #2190), destroying the only copy of
the activity's data before that machinery could see it. The page still looked
intact because the retained `htmlView` rendered, so the loss went unnoticed
until the activity was opened or exported.

## Problem

When an imported `<jsonProperties>` payload cannot be parsed, should the
importer normalize it (empty object), attempt to repair it, or preserve it
verbatim — and how does a preserved payload survive the save/export cycle?

## Decision drivers

- Data integrity: an author's activity data must never be silently destroyed.
- No pretend-parsing: guessing at broken JSON can corrupt data further.
- Security: the raw payload is untrusted input.
- The workarea already detects and isolates malformed payloads (#2178).
- Authors need to know which activities are affected (console-only warnings
  are invisible to them).

## Options considered

### Option 1: Keep replacing with `{}`

Simple, but permanently destroys data and hides the loss behind the retained
HTML. This is the reported defect.

### Option 2: Heuristic repair of the payload

Attempting to re-escape quotes or truncate to the last valid prefix produces a
payload that parses but no longer says what the author wrote, and a wrong guess
is indistinguishable from correct data afterwards. Rejected: preservation beats
pretend-parsing.

### Option 3: Preserve the raw payload verbatim (chosen)

Store the unparseable string unchanged in the Y.Doc `jsonProperties` field,
report the affected activities to the caller, and write the same raw string
back to `content.xml` on export.

## Evidence

- `src/shared/import/ElpxImporter.ts` (before this change) logged
  `Invalid JSON for <id>, using empty object` and dropped the payload; fixture
  `test/fixtures/damaged-trueorfalse-json.elpx` (#2178) reproduces it.
- Issue #2190 documents a user project in which all 17 interactive iDevices
  lost their configuration this way.
- The workarea half already exists and is E2E-covered: a raw malformed value in
  the component map renders safely, blocks editing, and survives edit attempts
  (`test/e2e/playwright/specs/malformed-idevice-json.spec.ts`, #2178/#2194).

## Decision

The importer preserves an unparseable `<jsonProperties>` payload verbatim:

- `ElpxImporter` stores the raw string unchanged in the component's
  `jsonProperties` field (bypassing content transforms, which cannot run on a
  string that does not parse) and reports the affected activities in
  `ElpxImportResult.malformedProperties`.
- The workarea shows the report to the author (damaged-activities notice,
  sharing one dialog with the missing-files notice from #2223); the existing
  #2178 machinery blocks editing so the payload cannot be overwritten.
- The export path (`YjsDocumentAdapter` → `OdeXmlGenerator`/`ComponentExporter`)
  carries the raw payload through as `malformedProperties` and writes it back
  inside CDATA (`escapeCdata` keeps the XML well-formed), so a save or export
  round-trips the damaged data instead of normalizing it to `{}`.

The raw payload is never parsed leniently, never rendered as HTML and never
evaluated: rendering continues to use the retained `htmlView` through the
existing sanitization boundaries, and exports of the *rendered* HTML treat the
activity as having no properties.

## Consequences

### Positive

- Importing a damaged project no longer destroys data; re-exporting yields a
  package that still carries the original payload for recovery or repair.
- Authors are told which activities are affected instead of a console warning.

### Negative

- A damaged activity remains non-functional until recreated — by design, since
  only the author can say what the payload meant.
- In merge-mode imports, an embedded `ideviceId` inside a malformed payload
  cannot be rewritten to a regenerated component id (it cannot be parsed).

### Neutral

- `content.xml` may now contain CDATA that is not valid JSON. This was already
  true of externally produced packages; the importer and editor both treat that
  state explicitly.

## Risks

- Downstream code that assumes `jsonProperties` always parses would fail — the
  known consumers (workarea render/edition, export adapter) were hardened in
  #2178/#2194 or updated here, and regression tests cover both halves.

## Validation

- `src/shared/import/ElpxImporter.spec.ts` — raw payload preserved byte for
  byte, affected activities reported, valid siblings untouched, and an
  import → export → import round-trip keeps the payload.
- `src/shared/export/adapters/YjsDocumentAdapter.spec.ts`,
  `src/shared/export/generators/OdeXmlGenerator.spec.ts`,
  `src/shared/export/exporters/ComponentExporter.spec.ts` — export side.
- `public/app/workarea/project/damagedPropertiesNotice.test.js`,
  `public/app/workarea/project/projectManager.test.js` — the notice.
- `test/e2e/playwright/specs/malformed-idevice-json.spec.ts` — full flow in a
  real browser.

## Follow-up work

- `public/app/yjs/ComponentImporter.js` (single `.idevice`/`.block` re-import)
  still replaces an unparseable payload with `{}`; it should adopt the same
  preservation rule.

## References

- Issue [#2190](https://github.com/exelearning/exelearning/issues/2190)
- Issue [#2177](https://github.com/exelearning/exelearning/issues/2177),
  PR [#2178](https://github.com/exelearning/exelearning/pull/2178),
  PR [#2179](https://github.com/exelearning/exelearning/pull/2179),
  PR [#2194](https://github.com/exelearning/exelearning/pull/2194)
- Issue [#2223](https://github.com/exelearning/exelearning/issues/2223),
  PR [#2224](https://github.com/exelearning/exelearning/pull/2224)
  (missing-files import notice this change shares a dialog with)
