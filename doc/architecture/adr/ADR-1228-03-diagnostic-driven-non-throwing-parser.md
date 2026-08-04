---
id: ADR-1228-03
title: "Non-throwing parser with line-accurate diagnostics and stable codes"
status: Proposed
date: 2026-07-09
tracking_issue: 1228
legacy_id: ADR-0034
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
  - "@cristinavaldera"
  - "@mnarvaezm"
related:
  prs: [1999]
  changes: ["1228-unified-compact-activity-authoring-format"]
  adrs: [ADR-1228-01, ADR-1228-02]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-1228-03: Non-throwing parser with line-accurate diagnostics and stable codes

## Context

The activity authoring DSL (ADR-1228-01) is written by humans, often in bulk, one
item per line. Malformed input is therefore the normal case, not the exception:
a teacher will mistype an answer index, leave a blank empty, forget a `@type=`,
or paste text containing stray `#`/`@`. The sibling parsers in
`src/shared/parsers/` (idevice/theme/translation) are machine-input parsers and
signal failure by returning `null`/empty — adequate for well-formed config
files, but useless for telling an author *what* to fix and *where*.

For an interactive authoring format, the parser needs to (a) never crash the
caller on bad input, (b) report every problem, not just the first, (c) point at
the exact source line in bulk mode, (d) distinguish fatal problems from advisory
ones, and (e) expose machine-readable codes so a UI can localize messages,
group errors, or offer fixes without string-matching prose.

## Problem

How should the DSL parser report malformed input: by throwing, by returning
`null` like its sibling parsers, or by returning a structured, non-throwing
result carrying line-accurate diagnostics with stable codes and severities?

## Decision drivers

- **Never crash the caller.** Authoring UIs and batch importers must stay
  responsive on arbitrary user text.
- **Actionable feedback.** The author must learn what is wrong and on which
  line.
- **Report all problems at once**, so bulk authoring is not a slow one-error-
  per-run loop.
- **Severity distinction.** Some issues are fatal (no correct answer); some are
  advisory (unknown parameter kept in `extra`, empty alternative dropped).
- **Machine-readability.** A UI/i18n layer needs stable codes, not English
  prose, to render and localize messages.
- **Partial success in batches.** Valid lines should still yield items even when
  other lines fail.
- **Consistency with `AGENTS.md`:** pure, testable functions; no workarounds.

## Options considered

### Option 1: Throw on the first error

`parseUnifiedActivityLine` throws an `Error` when input is invalid.

- Pros: simple control flow; forces callers to handle failure.
- Cons: crashes bulk parsing at the first bad line; reports only one problem;
  loses line context unless manually attached; callers must wrap every call in
  try/catch; exceptions are a poor channel for *expected* user error.

### Option 2: Return `null`/empty like the sibling parsers

Match `idevice-parser`/`theme-parser` and return `null` (or an empty array) on
failure.

- Pros: consistent with existing shared parsers; trivial signature.
- Cons: gives the author no reason and no location; cannot express warnings vs
  errors; cannot express partial batch success; unsuitable for an interactive
  format.

### Option 3: Non-throwing structured result with diagnostics (chosen)

Return a result object `{ ok, item?, diagnostics[] }` (and a batch variant with
`items`, `results`, and aggregated `diagnostics`). Each diagnostic has a
`severity` (`error`/`warning`), a **stable machine-readable `code`**, a
human-readable `message`, and a 1-based `line` (in batch mode). The parser never
throws for malformed authoring text; it collects every problem, distinguishes
errors from warnings, and a `strict` mode can promote warnings to errors.

- Pros: never crashes; reports all problems with codes, severities, and line
  numbers; supports partial batch success; enables localization/grouping in a
  UI; testable by asserting on codes.
- Cons: a richer return type than the sibling parsers (a deliberate divergence);
  more code (diagnostic plumbing) and a documented catalogue of codes to keep
  stable.

## Evidence

- **Non-throwing structured result:** `UnifiedActivityParseResult`
  (`{ ok, item?, diagnostics }`) and the batch
  `UnifiedActivityParseBatchResult` (`{ ok, items, diagnostics, results }`) are
  defined in `src/shared/parsers/unified-activity-format.ts:144` and `:151`.
  `parseUnifiedActivityLine` returns the result object rather than throwing
  (`:764`).
- **Deliberate divergence from siblings, documented in code:** the module header
  states that, "Unlike the sibling parsers in this directory (which return
  `null`/empty on failure), this parser returns a result object carrying
  `diagnostics` … It never throws for malformed authoring text."
  (`src/shared/parsers/unified-activity-format.ts:12`).
- **Diagnostic shape with stable codes and severity:**
  `UnifiedActivityDiagnostic` carries `severity`, a "Stable machine-readable
  code, e.g. `ANSWER_INDEX_OUT_OF_RANGE`", `message`, and an optional 1-based
  `line` (`src/shared/parsers/unified-activity-format.ts:37`). Diagnostics are
  appended via `addDiagnostic` which stamps the current line
  (`:218`).
- **Errors vs warnings:** fatal codes (e.g. `NO_CORRECT_ANSWER`,
  `ANSWER_INDEX_OUT_OF_RANGE`, `UNMATCHED_BLANK`, `EMPTY_BLANK`,
  `AMBIGUOUS_TYPE`) block a result; advisory codes (`UNKNOWN_PARAM`,
  `INVALID_POINTS`, `EMPTY_ALTERNATIVE`, `UNKNOWN_ESCAPE`, `INVALID_PARAM_VALUE`)
  keep the item. The full catalogue is documented in
  `doc/elpx-format/idevices/unified-authoring-format.md:207`.
- **Multiple problems reported, not just the first:** e.g. `parseSelection`
  accumulates `EMPTY_QUESTION`, `TOO_FEW_OPTIONS`, `EMPTY_OPTION`, and index
  errors before returning (`src/shared/parsers/unified-activity-format.ts:571`).
- **Strict mode promotes warnings to errors:** unknown params/escapes become
  errors under `strict`
  (`src/shared/parsers/unified-activity-format.ts:397` and `:234`), verified by
  the "strict mode" tests (`src/shared/parsers/unified-activity-format.spec.ts:450`).
- **Line-accurate batch diagnostics and partial success:**
  `parseUnifiedActivityLines` stamps 1-based line numbers (honoring
  `lineOffset`), skips blank/`//`/`# ` comment lines, and returns valid items
  even when others fail
  (`src/shared/parsers/unified-activity-format.ts:822`). Verified by
  "preserves 1-based line numbers in diagnostics"
  (`src/shared/parsers/unified-activity-format.spec.ts:558`), "returns partial
  successes alongside diagnostics" (`:571`), and "applies the lineOffset option"
  (`:583`).
- **Codes are asserted directly in tests** via a `hasCode` helper
  (`src/shared/parsers/unified-activity-format.spec.ts:22`), confirming the codes
  are treated as a stable contract, not incidental strings.
- **No-throw on adversarial input:** very long input, script-like text,
  Unicode/emoji, and unmatched markers all return diagnostics rather than
  throwing (`src/shared/parsers/unified-activity-format.spec.ts:392`, `:465`).

## Decision

We will make the DSL parser **non-throwing** and have it return a **structured
result carrying diagnostics** (Option 3). Every diagnostic has a `severity`
(`error`/`warning`), a **stable machine-readable `code`**, a human-readable
`message`, and — in batch mode — a **1-based `line`**. The single-line parser
returns `{ ok, item?, diagnostics }`; the batch parser returns aggregated
`items`, per-line `results`, and all `diagnostics`, yielding partial success. A
`strict` option promotes warnings to errors. This is a deliberate, documented
divergence from the `null`-returning sibling parsers.

## Consequences

### Positive

- Callers (authoring UI, batch importer, CLI) never have to try/catch DSL input
  and can render precise, per-line feedback.
- Stable codes let a UI localize, group, and act on diagnostics without parsing
  English prose.
- Bulk authoring surfaces all problems at once and still imports the valid
  lines.
- The error/warning split lets tolerant parsing coexist with a `strict` gate.

### Negative

- The return type is richer and different from the sibling parsers, a small
  inconsistency callers must be aware of.
- The set of diagnostic codes is now a public contract: renaming or removing a
  code is a breaking change for any code/localization that keys off it.
- More plumbing (diagnostic collection, line stamping) than a `null` return.

### Neutral

- Warnings never block a result unless `strict`/`allowUnknownParams` is set;
  tolerant-by-default is intentional.
- Unknown parameters are preserved in `params.extra` rather than dropped, so no
  authoring intent is silently lost.

## Risks

- **Code churn:** if diagnostic codes are renamed casually, downstream
  UI/i18n/tests break. Mitigated by treating the catalogue in
  `unified-authoring-format.md` and the `hasCode` test assertions as a contract.
- **Diagnostic overload:** a badly malformed line could emit many diagnostics.
  Acceptable — completeness is the goal — but a UI may want to cap display.
- **Severity miscategorization:** classifying an issue as warning when it should
  block (or vice versa) could mislead authors. Mitigated by per-code tests
  asserting `ok` and severity together.

## Validation

- Every documented code is exercised by a test asserting both `ok` and the code
  (`src/shared/parsers/unified-activity-format.spec.ts`).
- Batch line numbering, `lineOffset`, comment/blank skipping, and partial
  success are covered by the `parseUnifiedActivityLines` block
  (`src/shared/parsers/unified-activity-format.spec.ts:551`).
- Success criterion: no input causes a thrown exception; every failing example
  yields at least one `error` diagnostic with the expected `code` and (in batch)
  the correct `line`, at ≥ 90% patch coverage (`AGENTS.md`).

## Follow-up work

- When the DSL is wired into the authoring UI (the shared `getTabIA` tab in
  `public/app/common/common_edition.js` and each iDevice's own `insertQuestions`
  handler, e.g. `public/files/perm/idevices/base/form/edition/form.js`), surface
  diagnostics inline with their line numbers and localize messages by `code`
  (i18n via `_()` / `c_()`), tracked in the change design.
- Keep the diagnostic-code catalogue in
  `doc/elpx-format/idevices/unified-authoring-format.md` in sync with the parser
  as codes are added.

## References

- Issue #1228; PR #1999; the change design.
- ADR-1228-01 — Adopt a custom compact line-based DSL for activity authoring.
- ADR-1228-02 — Separate a pure normalized parser from iDevice adapters.
- `src/shared/parsers/unified-activity-format.ts` and
  `src/shared/parsers/unified-activity-format.spec.ts`.
- `doc/elpx-format/idevices/unified-authoring-format.md` (Diagnostics section).
- Sibling parsers for contrast: `src/shared/parsers/idevice-parser.ts`,
  `src/shared/parsers/theme-parser.ts`,
  `src/shared/parsers/translation-parser.ts`.
