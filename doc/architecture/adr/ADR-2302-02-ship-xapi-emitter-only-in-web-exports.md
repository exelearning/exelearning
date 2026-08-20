---
id: ADR-2302-02
title: "Ship the xAPI emitter only in web exports"
status: Proposed
date: 2026-08-19
tracking_issue: 2302
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
related:
  prs: [2302]
  changes: []
  adrs: [ADR-2302-01]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-5"
---

# ADR-2302-02: Ship the xAPI emitter only in web exports

## Context

`libs/xapi/exe_xapi.js` was listed in `BASE_LIBRARIES`, so every export format carried it, and
`PageRenderer` emitted its `<script src>` tag outside the `if (xapi)` guard in both head paths. Presence of
the emitter was therefore unconditional and independent of whether the format could use it.

Its two transports are `window.postMessage` to a parent window and a direct POST to an LRS when
`endpoint=`/`auth=` launch parameters are present. Neither is an ADL-defined xAPI transport: xAPI requires
authenticated HTTP, and the xAPI SCORM Profile requires an LRS endpoint plus an actor. The postMessage
bridge is a proprietary channel that borrows xAPI vocabulary.

`mod_exelearning` is the only consumer. It selects its grading channel purely by probing the extracted
package for the emitter file, and when it finds it, it puts the package's own SCORM runtime into inert
mode: `window.API` still answers so the iDevices run, but no score is ever posted.

## Problem

Which export formats should carry the xAPI emitter?

## Decision drivers

- A format that already has an authoritative scoring channel should not gain a second one.
- Presence of the emitter must follow one rule, not a per-format list that can drift.
- The only consumer must keep working without changes.
- Bytes and runtime work spent on a channel that cannot deliver are waste.

## Options considered

### Option 1: Keep the emitter in every format

- **Pros:** uniform contract; no capability is withdrawn; a SCORM package could in principle also feed an LRS.
- **Cons:** creates dual authority in SCORM and IMS packages with no rule for which wins; makes a genuine
  SCORM export uploaded to `mod_exelearning` grade over xAPI while its own runtime is silenced; ships a
  channel into EPUB3 where neither transport can ever exist.

### Option 2: Withhold only the injected config

- **Pros:** smallest diff.
- **Cons:** does not work. The loader tag is emitted outside the config guard, so the emitter still loads and
  still runs; it merely loses its package identity and falls back to the document URL. This is the
  half-measure the project philosophy forbids, and it is the state the code was already in.

### Option 3: Ship the emitter only in the web export family

- **Pros:** one rule — a format carries the emitter only when it has no scoring runtime of its own; removes
  dual authority; the consumer's existing probe resolves correctly with no change on its side.
- **Cons:** withdraws the theoretical direct-to-LRS capability from SCORM, IMS and EPUB3 packages.

## Evidence

- `emit()` is not gated by `_hasTransport()` — only `_emitInitialized` and `_emitTerminated` are — so a
  format with no reachable transport still builds a full statement graph per answer and discards it
  ([`public/app/common/xapi/exe_xapi.js`](../../../public/app/common/xapi/exe_xapi.js)).
- SCORM 1.2's scoring channel is `cmi.core.score.raw` with `cmi.core.lesson_status`; SCORM 2004's is
  `cmi.score.scaled` with the completion and success status, which drive sequencing and rollup. The emitter
  cannot write either.
- Neither SCORM nor the ADL xAPI SCORM Profile defines a precedence rule when a package carries both
  channels. cmi5 resolves the same question in the other direction: supplementary statements are recorded
  but excluded from session management and satisfaction rules, and `score` is confined to the authoritative
  statements. One narrow authoritative channel plus optional non-authoritative telemetry is the endorsed
  shape.
- IMS Content Packaging defers runtime communication and data models out of scope; EPUB3 defines no scoring
  or tracking mechanism and makes scripting optional.
- No exporter populates `parentOrigin`, so statements are broadcast to `'*'` with an anonymised actor.
- `exe-xapi-statement` has exactly one consumer across the ecosystem, and it serves the web export.

## Decision

The xAPI emitter ships only in the **web export family**: `Html5Exporter` and everything that inherits from
it as a web export — `ElpxExporter`, `PageElpxExporter`, `PageExporter` — plus the editor preview. SCORM 1.2,
SCORM 2004, IMS Content Package, EPUB3 and the print preview ship neither the file, the loader tag, nor the
config.

The rule is expressed once, as `BaseExporter.emitsXapi()`, defaulting to `false`. `Html5Exporter` overrides it
to `true`; `Scorm12Exporter`, `Scorm2004Exporter` and `ImsExporter` — which subclass `Html5Exporter` for its
rendering, not for its channel — override it back to `false`. `BaseExporter.selectBaseLibraries()` is the
single point where the file is dropped, which also removes it from the SCORM/IMS `<file>` manifests and the
EPUB OPF, because those entries are generated by the same loops that copy the bytes.

`PageRenderer` now emits the loader tag only inside the `if (xapi)` guard, in both head paths. The injected
config becomes the one switch for the emitter.

## Consequences

### Positive

- A SCORM or IMS package uploaded to `mod_exelearning` grades through its own runtime, with no plugin change.
- Dual authority disappears from the three formats that had a standard channel of their own.
- The print preview stops requesting a file its exporter never copies.
- SCORM, IMS and EPUB3 packages lose the per-answer statement construction that had nowhere to go.

### Negative

- SCORM, IMS and EPUB3 packages can no longer post to an LRS via launch parameters. No consumer used this.
- Three exporters carry an explicit `emitsXapi(): false`, so a future exporter subclassing `Html5Exporter`
  inherits `true` and must opt out deliberately. A test pins the exact set.

### Neutral

- The emitter, its test suite and the whole `XapiConfig` plumbing stay; this scopes them rather than removing
  them.
- Package size drops by roughly 34 kB for the affected formats, which is not the reason for the decision.

## Risks

- Packages already extracted by `mod_exelearning` keep the channel they were extracted with until re-uploaded,
  because the probe reads the extracted files. An activity holding both a pre-change and a post-change attempt
  can mix channels, and the plugin's aggregation is channel-blind.
- Whether the plugin's SCORM path grades a genuinely multipage SCORM upload correctly was not confirmed by
  execution. SCORM and IMS exports render with navigation hidden, so pages beyond the first are normally
  unreachable there, but a theme or an in-content link could expose them.
- The static-mode distribution reaches the emitter through base-library seeding plus path probing rather than
  an explicit entry, so changes to that seeding could drop it from web exports too. A test pins its presence.

## Validation

- `BaseExporter` tests cover `emitsXapi()` defaulting to false, `selectBaseLibraries()` dropping the emitter
  without mutating the shared map, and returning the input untouched when there is nothing to drop.
- `constants` tests assert the emitter is absent from `BASE_LIBRARIES` and present in `WEB_EXPORT_LIBRARIES`.
- `PageRenderer` tests assert both head paths emit the loader only alongside the config.
- Exporter tests assert presence for HTML5, ELPX and single-page, and absence — in the HTML and in the
  generated package, with the emitter seeded into the provider mock so the assertion is not vacuous — for
  SCORM 1.2, SCORM 2004, IMS, EPUB3 and the print preview.

## References

- [ADR-2302-01](ADR-2302-01-suppress-multipage-package-verdicts.md)
- [PR #2302](https://github.com/exelearning/exelearning/pull/2302)
- [xAPI 1.0.3 data specification](https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md)
- [`doc/elpx-format/tracking-emission.md`](../../elpx-format/tracking-emission.md)
