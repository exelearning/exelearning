---
id: ADR-2302-01
title: "Expose xAPI weight and deterministic iDevice order"
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
  adrs: []
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Codex, Claude Code"
  model: "GPT-5.6-sol, claude-opus-5"
---

# ADR-2302-01: Expose xAPI weight and deterministic iDevice order

## Context

Published eXeLearning packages emit an xAPI `answered` statement for each evaluable iDevice. The statement already
contains the stable iDevice identifier and its score, while the configured iDevice weight is retained only in the
page-local `exe_xapi.js` state used to create package-level result statements. Each page in a multipage HTML export
loads a new JavaScript context, so that state is not restored after navigation
([`public/app/common/xapi/exe_xapi.js`](../../../public/app/common/xapi/exe_xapi.js),
[`src/shared/export/renderers/PageRenderer.ts`](../../../src/shared/export/renderers/PageRenderer.ts)).

The existing package score calculation normalizes relative weights with a largest-remainder allocation. Equal
fractional remainders are resolved by iDevice render order
([`public/app/common/common.js`](../../../public/app/common/common.js)). Therefore a stream containing only
`idevice-id`, score, and weight can reproduce the usual weighted mean, but it cannot always reproduce the exact
package result when normalized remainders tie.

## Problem

What additive xAPI contract should eXeLearning emit so an external consumer can reconstruct the same current weighted
package score from per-iDevice statements, including across pages and when an iDevice is answered again?

## Decision drivers

- Per-iDevice statements must be sufficient without relying on ephemeral page-local state.
- The reconstructed result must preserve the existing eXeLearning normalization and rounding semantics.
- Repeated answers must replace the contribution for the same stable iDevice rather than accumulate.
- Existing Activity IDs, standard score fields, verbs, and xAPI 1.0.3 consumers must remain compatible.
- The contract must use standards-compliant xAPI extension points and JSON values.
- SCORM, cmi5, and Moodle integration behavior are outside this decision.

## Options considered

### Option 1: Persist the page-local aggregate state

Store `_state` in browser storage, a parent window, or the xAPI State API and continue treating package-level result
statements as the aggregate authority.

- **Pros:** package-level calculation can retain results across page navigation.
- **Cons:** the event stream remains insufficient for independent consumers; browser storage introduces lifecycle and
  isolation concerns; and the xAPI State API would require a broader protocol and authentication design.

### Option 2: Add only the configured weight

Add a numeric `idevice-weight` context extension to each evaluable `answered` statement.

- **Pros:** small, additive, standards-compliant, and sufficient for an order-independent weighted mean.
- **Cons:** it cannot exactly reproduce the current largest-remainder calculation when fractional remainders tie,
  because statement arrival order is answer order rather than publication render order.

### Option 3: Add the effective weight and deterministic package-global order

Add numeric `idevice-weight` and `idevice-order` context extensions. Consumers retain the latest answer by stable
`idevice-id`, sort current records by `idevice-order`, and apply the existing normalization.

- **Pros:** sufficient for exact reconstruction across pages; deterministic when statement delivery order differs from
  publication order; additive for existing consumers; and requires no state persistence protocol.
- **Cons:** creates two durable extension semantics that consumers must understand, and re-exporting reordered content
  may assign a different order while preserving iDevice identity.

## Evidence

- The xAPI emitter initializes `_state` when the page script is evaluated and does not restore it from local storage,
  session storage, cookies, URL state, parent communication, or the xAPI State API
  ([`public/app/common/xapi/exe_xapi.js`](../../../public/app/common/xapi/exe_xapi.js)).
- Multipage rendering injects and loads the emitter independently in each generated document
  ([`src/shared/export/renderers/PageRenderer.ts`](../../../src/shared/export/renderers/PageRenderer.ts)).
- Runtime tracking already provides the configured `game.weighted` value and stable DOM-derived iDevice identifier at
  statement construction time ([`public/app/common/common.js`](../../../public/app/common/common.js)).
- `getFinalScore` defaults invalid or zero weights to 1, clamps them to 1–100, apportions integer percentage points by
  largest remainder, and rounds the result to two decimals
  ([`public/app/common/common.js`](../../../public/app/common/common.js)).
- Export navigation, blocks, and components have a deterministic render order, allowing each page to receive an offset
  without modifying the scoring function
  ([`src/shared/export/exporters/Html5Exporter.ts`](../../../src/shared/export/exporters/Html5Exporter.ts)).
- xAPI 1.0.3 permits IRI-keyed `context.extensions` with JSON values, and Statements remain immutable
  ([ADL xAPI 1.0.3 data specification](https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md)).
- Regression tests in PR [#2302](https://github.com/exelearning/exelearning/pull/2302) cover unequal weights,
  replacement by stable identity, equal-remainder ordering, page context reset, and package statements.

## Decision

Evaluable per-iDevice `answered` statements will add these numeric context extensions:

- `https://exelearning.net/xapi/extensions/idevice-weight`: the effective relative scoring weight after applying the
  existing fallback and 1–100 clamp.
- `https://exelearning.net/xapi/extensions/idevice-order`: the 1-based iDevice position in deterministic publication
  render order, page offset included.

Both keys are namespaced `idevice-*` like their siblings, because both describe the iDevice rather than the package.

Every format that ships the emitter injects the same runtime config, computed in one place by
`BaseExporter.buildXapiConfig()` and `BaseExporter.buildIdeviceOrderOffsets()`. Before this decision only the HTML5
exporter passed a config at all; the others left `window.exeXapi` undefined while still loading the emitter, which made
it fall back to the current document URL as the Activity IRI, so every page looked like a separate package and carried
no `package-id`.

**Which formats ship the emitter is decided separately, by [ADR-2302-02](ADR-2302-02-ship-xapi-emitter-only-in-web-exports.md):**
the web export family only. Withholding the config alone was rejected there as a half-measure — the loader tag was
emitted outside the config guard, so the emitter kept running and merely lost its identity.

Consumers reconstruct current state by scoping statements to the package or registration, retaining the latest
`answered` statement for each `idevice-id`, sorting those records by `idevice-order`, and applying eXeLearning's
documented largest-remainder normalization to score and weight. `idevice-id`, not `idevice-order`, remains the stable
replacement identity.

Package-level `completed`, `passed`, and `failed` statements are emitted **only for single-page packages**. A page can
only aggregate what was answered on that page, so on a multipage package that aggregate is a page-local verdict wearing
the package Activity IRI: two pages emit a `passed` and a `failed` for the same activity inside one attempt, and a
consumer reading them as authoritative records a self-contradicting result for a learner. The exporters therefore also
inject `pageCount`, and the emitter suppresses the package verdict when it exceeds 1. The reconstruction above is the
authority for those packages, which is exactly what these extensions exist for.

Each page also declares its gradable iDevices as they initialize, answered or not, and publishes them on that page's
`initialized` statement under `https://exelearning.net/xapi/extensions/idevice-census`, as entries of
`{ "idevice-id", "idevice-weight", "idevice-order" }`. Without it a consumer only ever sees what was answered and
normalizes over that subset, which inflates a partial attempt. The extension key is a full IRI as xAPI requires; the
keys inside each entry are short names, because xAPI constrains only the keys of the extensions map and nesting IRIs
inside a value is unidiomatic — profiles expand short names through a JSON-LD `@context` instead. `initialized` is
deferred to DOM-ready plus a macrotask so the census is populated, and an answer flushes it synchronously so it always
precedes the first `answered`. The census is published a second time on `terminated`: the deferred flush can only carry
what has registered by then, and page unload is by definition after every registration, so that copy is the complete
one. A consumer takes the union of the two.

**The census weight and the answered weight are the same number, by construction.** Both come from a single
`effectiveWeight()` in `exe_xapi.js`, applied to the same `game.weighted` on the same live object: iDevices pass one
options object to both `registerActivity()` and `sendScore()` (for example `identify.js:499` and `:1316` both pass
`mOptions`), and both paths are gated on the same `isScorm > 0`, so nothing can emit an `answered` without appearing in
the census. This matters because a consumer scores unanswered iDevices from the census and answered ones from their
statements: if the two weights could diverge, the same package would grade differently depending on the order in which
statements arrived, and nothing on either side could detect it. A parameterized regression pins the two values together.

The existing Activity IDs, result score fields, verbs, transports, and xAPI 1.0.3 version remain unchanged.
Non-evaluable iDevices do not gain an `answered` emission path. An iDevice whose package-global order cannot be
resolved (no `ideviceNumber`, or a node jQuery could not locate) still emits its `answered` statement but carries no
`idevice-order` and does not enter the order-sensitive package aggregate, so every statement feeding a verdict can be
placed by the consumer.

## Consequences

### Positive

- Consumers can reproduce current weighted results from per-iDevice events across multipage publications.
- Re-answering is sequence-independent: the latest statement replaces the same stable iDevice entry.
- Existing consumers can ignore both additive extensions.
- No browser persistence or new server protocol is required.

### Negative

- Consumers seeking exact parity must implement the documented largest-remainder normalization and order tie-break.
- The public extension contract and its edge-case semantics must remain documented and tested.
- Multipage packages no longer emit a package-level `passed`/`failed`. A consumer that read that verdict now has to
  reconstruct it; what it read before was wrong whenever the package spanned more than one page.
- SCORM, IMS and EPUB packages change their xAPI Activity IRI from the per-page document URL to the package IRI derived
  from `odeId`. This is what those formats already documented as their behavior, but it is an observable change.

### Neutral

- Publication order is deterministic within an export but can change after author reordering and re-export.
- Single-page package scores continue to reflect the emitter's current in-memory state, where that state is complete.
- SCORM packages are unaffected in their native grading: `cmi.core.score` is reported by the SCORM runtime, which the
  LMS persists across pages, independently of this xAPI contract.

## Risks

- A consumer may use a simple continuous weighted mean and differ by a normalized percentage point in tie cases.
  Documentation and the equal-remainder regression test make the required algorithm explicit.
- A consumer may sum answer history. The contract explicitly defines replacement by latest `idevice-id`, and tests
  cover repeated answers.
- A new export path could omit the page order offset. The offset and the config are built by shared `BaseExporter`
  helpers rather than per-exporter code, and every format has an exporter test asserting the injected offset and
  `pageCount`.

## Validation

- Unit tests assert numeric extension values, weight clamping at both ends, missing/zero/negative iDevice numbers,
  stable identity, re-answering, duplicate suppression, and the single-page/multipage verdict split. They call the
  shipped `gamification.scorm.getFinalScore` rather than a copy of it, so a change to the normalization fails them.
- A three-iDevice test delivers statements out of publication order and verifies exact largest-remainder parity.
- A two-page Playwright regression verifies separate page contexts, local numbering reset, distinct global order,
  reconstruction of the 25/75 weighted score of 55 through the shipped aggregator, and the absence of any page-local
  package verdict.
- Exporter tests verify per-page offset and `pageCount` injection for HTML5, SCORM 1.2, SCORM 2004, IMS and EPUB3;
  `BaseExporter` tests cover the prefix-sum offsets, including pages with undefined `blocks`/`components`.

## Follow-up work

- The Moodle integration may later aggregate `idevice-id + score + weight + idevice-order` server-side. That integration
  is intentionally not modified by PR [#2302](https://github.com/exelearning/exelearning/pull/2302).
- If eXeLearning introduces a different normalization algorithm in the future, update the extension documentation and
  version the consumer contract deliberately rather than changing these semantics silently.

## References

- [PR #2302](https://github.com/exelearning/exelearning/pull/2302)
- [xAPI 1.0.3 data specification](https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md)
- [`doc/elpx-format/tracking-emission.md`](../../elpx-format/tracking-emission.md)
- [`public/app/common/xapi/exe_xapi.js`](../../../public/app/common/xapi/exe_xapi.js)
- [`public/app/common/common.js`](../../../public/app/common/common.js)
- [`src/shared/export/exporters/Html5Exporter.ts`](../../../src/shared/export/exporters/Html5Exporter.ts)
