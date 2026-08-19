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
  tool: "Codex"
  model: "GPT-5"
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

Add a numeric `weight` context extension to each evaluable `answered` statement.

- **Pros:** small, additive, standards-compliant, and sufficient for an order-independent weighted mean.
- **Cons:** it cannot exactly reproduce the current largest-remainder calculation when fractional remainders tie,
  because statement arrival order is answer order rather than publication render order.

### Option 3: Add the effective weight and deterministic package-global order

Add numeric `weight` and `idevice-order` context extensions. Consumers retain the latest answer by stable
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

- `https://exelearning.net/xapi/extensions/weight`: the effective relative scoring weight after applying the existing
  fallback and 1–100 clamp.
- `https://exelearning.net/xapi/extensions/idevice-order`: the 1-based iDevice position in deterministic publication
  render order.

Consumers reconstruct current state by scoping statements to the package or registration, retaining the latest
`answered` statement for each `idevice-id`, sorting those records by `idevice-order`, and applying eXeLearning's
documented largest-remainder normalization to score and weight. `idevice-id`, not `idevice-order`, remains the stable
replacement identity.

Package-level `completed`, `passed`, and `failed` statements remain lifecycle and result summaries. The existing
Activity IDs, result score fields, verbs, transports, and xAPI 1.0.3 version remain unchanged. Non-evaluable iDevices
do not gain an `answered` emission path.

## Consequences

### Positive

- Consumers can reproduce current weighted results from per-iDevice events across multipage publications.
- Re-answering is sequence-independent: the latest statement replaces the same stable iDevice entry.
- Existing consumers can ignore both additive extensions.
- No browser persistence or new server protocol is required.

### Negative

- Consumers seeking exact parity must implement the documented largest-remainder normalization and order tie-break.
- The public extension contract and its edge-case semantics must remain documented and tested.

### Neutral

- Publication order is deterministic within an export but can change after author reordering and re-export.
- Package-level scores continue to reflect the emitter's current in-memory state; this decision makes them non-exclusive
  rather than removing them.

## Risks

- A consumer may use a simple continuous weighted mean and differ by a normalized percentage point in tie cases.
  Documentation and the equal-remainder regression test make the required algorithm explicit.
- A consumer may sum answer history. The contract explicitly defines replacement by latest `idevice-id`, and tests
  cover repeated answers.
- A new export path could omit the page order offset. Exporter and multipage Playwright coverage verify injected offsets
  for the HTML publication path.

## Validation

- Unit tests assert numeric extension values, effective zero/missing-weight behavior, stable identity, re-answering,
  duplicate suppression, and unchanged package statements.
- A three-iDevice test delivers statements out of publication order and verifies exact largest-remainder parity.
- A two-page Playwright regression verifies separate page contexts, local numbering reset, distinct global order, and
  independent reconstruction of the 25/75 weighted score of 55.
- Exporter tests verify per-page offset injection, and existing xAPI suites verify backward-compatible statement fields.

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
