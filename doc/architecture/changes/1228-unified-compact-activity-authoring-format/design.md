---
tracking_issue: 1228
title: "Unified compact activity authoring format"
status: implemented
date: 2026-07-09
legacy_id: SDD-0008
authors:
  - "@erseco"
reviewers:
  - "@ignaciogros"
  - "@cristinavaldera"
  - "@mnarvaezm"
implementation_prs: [1999]
related_adrs: [ADR-1228-01, ADR-1228-02, ADR-1228-03]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# Unified compact activity authoring format — design

## Summary

This design adds a compact, line-based text format for authoring activity-like
iDevices in bulk — one line per item using `#` field separators and optional
`@key=value` parameters — proposed in issue
[#1228](https://github.com/exelearning/exelearning/issues/1228). A pure parser
turns each line into a normalized, iDevice-agnostic model; separate adapter
functions convert that model into the concrete data structures of existing
iDevices (`form`, `trueorfalse`, `flipcards`). It is an authoring/import
convenience only: it introduces no new canonical iDevice type and leaves
existing `.elp`/`.elpx` import and export untouched.

## Problem statement

Authoring assessment content in eXeLearning is a per-item, per-form task, and
every activity type stores its state differently (four content-storage patterns;
see `doc/elpx-format/idevices/patterns.md`). Teachers, migration scripts, and AI
generators need a fast way to express many questions at once in plain text,
without one editor form per question and without learning each iDevice's storage
shape. Malformed input is the norm for a human-typed bulk format, so authors
also need precise, per-line feedback rather than a silent failure or a crash.

## Goals

- A single line-based syntax that expresses four activity kinds: selection
  (single/multiple), true/false, fill-in-the-blank, and flashcard.
- A normalized, testable model decoupled from any specific iDevice.
- Deterministic adapters that map the model onto existing, confirmed iDevice
  storage shapes, writing only fields those iDevices actually read.
- Non-throwing parsing that reports every problem with a stable code, a
  severity, and (in bulk mode) a 1-based line number.
- No change to existing `.elp`/`.elpx` import/export; no new canonical iDevice
  type.
- Meet the `AGENTS.md` Definition of Done (lint clean, colocated unit tests,
  ≥ 90% patch coverage).

## Non-goals

- Wiring the format into the authoring UI (bulk-question insertion). Documented
  as a follow-up; not implemented on this branch.
- Becoming a lossless, round-trippable interchange format for every iDevice.
- Interoperability with external quiz formats (GIFT/Aiken/Moodle XML).
- Sanitizing authored HTML (sanitization stays in the iDevice render layer).
- Media-bearing flashcards (only simple text front/back cards are produced).

## Current state

- Shared parsers live in `src/shared/parsers/` and are re-exported from
  `src/shared/parsers/index.ts`. Existing siblings (`idevice-parser.ts`,
  `theme-parser.ts`, `translation-parser.ts`) signal failure by returning
  `null`/empty.
- Activity iDevices store state in the four patterns documented in
  `doc/elpx-format/idevices/patterns.md`; the type inventory and their handler
  mappings are in `doc/elpx-format/idevices/catalog.md`.
- The `form` iDevice (`public/files/perm/idevices/base/form/`) is the unified
  quiz container reading question-level hints from a `suggestion` field and
  storing selection options as `[isCorrect, text]` tuples; `trueorfalse`
  (`public/files/perm/idevices/base/trueorfalse/`) is the true/false game;
  `flipcards` (`public/files/perm/idevices/base/flipcards/`) is Memory cards,
  URI-encoding card text via `encodeURIComponentSafe`.
- The bulk-question authoring UI has a shared AI-questions tab `getTabIA` in
  `public/app/common/common_edition.js`, and each activity iDevice defines its
  own `insertQuestions` handler (e.g.
  `public/files/perm/idevices/base/form/edition/form.js`); neither consumes this
  format yet.

## Proposed design

Two layers, in two modules under `src/shared/parsers/`:

```
DSL line ──► parseUnifiedActivityLine ──► UnifiedActivityItem ──► adapter ──► iDevice data
 (text)        (pure, non-throwing)        (normalized model)     (per target)  (form / trueorfalse / flipcards)
                     │
                     └─► diagnostics[] { severity, code, message, line? }
```

1. **Parser** (`unified-activity-format.ts`): splits each line into a `#`
   payload and a trailing `@key=value` parameter section, resolves the activity
   kind (explicit `@type=` alias, `defaultType`, or shape inference), validates,
   and returns a normalized `UnifiedActivityItem` plus `diagnostics`. It never
   imports iDevice code and never throws (ADR-1228-03).
2. **Adapters** (`unified-activity-adapters.ts`): small per-target functions
   converting a normalized item into one concrete iDevice structure, importing
   only *types* from the parser (ADR-1228-02).

Design rationale is captured in ADR-1228-01 (why a bespoke DSL), ADR-1228-02 (why the
parser/adapter split), and ADR-1228-03 (why a non-throwing, diagnostic-driven
parser).

## User experience

On this branch the format is a developer/API surface (importable functions), not
a UI. The intended author-facing experience, once the UI follow-up lands, is:

- Paste multiple lines, one activity per line, e.g.:
  - Selection: `0#Capital of France?#Paris#Rome#Berlin`
  - Multiple: `012#Which are the three main axes?#…#…#…#…@explain=…`
  - True/false: `1#Is the Earth round?#True#False@hint=…@explain=…`
  - Fill-in-the-blank: `eXeLearning is a @@free@@ and open source editor…`
  - Flashcard: `Photosynthesis#…@type=flashcard`
- Blank lines, `//` comment lines, and `# ` (hash-space) comment lines are
  skipped by the batch parser.
- Each malformed line yields a diagnostic with a stable `code`, a `message`, a
  `severity`, and a 1-based `line`, so the UI can show inline, per-line errors
  and still import the valid lines (partial success).
- Full grammar, escaping, examples, parameters, and limitations are in
  `doc/elpx-format/idevices/unified-authoring-format.md`.

## Technical design

- **Payload / parameter split.** `findParamSectionStart` locates the first
  unescaped `@` that begins a *valid* `@key=` (letter-leading key). `@@…@@` blank
  regions are skipped so a blank answer may contain `=` (`@@x=5@@`), as can a
  parameter value. (`unified-activity-format.ts`.)
- **Kind resolution.** `resolveKind`: explicit `@type=` alias (`TYPE_ALIASES`) →
  `defaultType` option → inference (a valid `@@blank@@` ⇒ `fillblank`; 4 fields
  with a boolean first and literal `true`/`false` labels ⇒ `truefalse`; ≥ 3
  fields with a digit-leading first field ⇒ `selection`); otherwise
  `AMBIGUOUS_TYPE`. Flashcards are never inferred.
- **Per-kind builders.** `parseSelection`, `parseTrueFalse`, `parseFillBlank`,
  `parseFlashcard` validate and construct the normalized item, accumulating
  diagnostics.
- **Escaping.** `unescapeText` / `ESCAPE_MAP` handle `\#`, `\@`, `\|`, `\\`,
  `\n`, `\t`; unknown escapes are preserved literally with an `UNKNOWN_ESCAPE`
  warning (error under `strict`).
- **Parameters.** `parseParams` splits the parameter section, lowercases keys,
  rejects duplicates (`DUPLICATE_PARAM`), maps recognized keys
  (`RECOGNIZED_PARAMS`) via `assignRecognizedParam`, and preserves unknown keys
  in `params.extra` (`UNKNOWN_PARAM` warning; error under `strict` /
  `allowUnknownParams: false`).
- **Batch.** `parseUnifiedActivityLines` splits on `\r?\n`, skips blank/comment
  lines, stamps 1-based line numbers (`lineOffset`), and returns aggregated
  `items`, per-line `results`, and all `diagnostics` with partial success.
- **Adapters.** `unifiedSelectionToFormQuestion`,
  `unifiedTrueFalseToTrueOrFalseQuestion`, `unifiedTrueFalseToFormQuestion`,
  `unifiedFillBlankToFormQuestion`, `unifiedFlashcardToFlipCard`, and the batch
  `unifiedItemsToFormQuestionsData` map onto the confirmed iDevice models; they
  omit generated ids for deterministic output and write only real fields (e.g.
  `hint` → `suggestion`).

## Data model

The normalized model is a discriminated union (`unified-activity-format.ts`):

- `UnifiedActivityItemBase`: `{ kind, params, raw, line? }`.
- `UnifiedSelectionItem`: `{ question, options[], correctIndexes[] (0-based,
  sorted, deduped), selectionType: 'single'|'multiple' }`.
- `UnifiedTrueFalseItem`: `{ statement, answer: boolean }`.
- `UnifiedFillBlankItem`: `{ tokens: (text|blank)[], blanks: string[][] }`.
- `UnifiedFlashcardItem`: `{ front, back }`.
- `UnifiedActivityParams`: normalized `hint`, `explain`, `feedback`, `points`,
  `difficulty`, `tags[]`, `selection`, `shuffle`, `caseSensitive`, `strict`,
  `lang`, plus `extra: Record<string,string>` for unknown keys.
- `UnifiedActivityDiagnostic`: `{ severity, code, message, line? }`.

Adapter output types (`unified-activity-adapters.ts`): `FormSelectionQuestion`,
`FormTrueFalseQuestion`, `FormFillQuestion` (`form` `questionsData` entries),
`TrueOrFalseQuestion` (`trueorfalse` game), and `FlipCard` (`flipcards` card).
These mirror existing iDevice shapes; no new persisted schema, Yjs shape, DB
table, or ELP/ELPX field is introduced.

## Migration and compatibility

- Existing `.elp`/`.elpx` import and export are unchanged; legacy iDevice
  handlers remain the source of truth for legacy XML.
- The parser/adapters are additive, importable functions; nothing calls them in
  a user-facing flow yet, so there is no runtime behaviour change on this branch
  and nothing to roll back beyond removing the modules.
- The only doc-model change on this branch is `catalog.md` re-parenting
  `MultichoiceIdevice`/`MultiSelectIdevice` to the `form` iDevice, aligning the
  catalog with the selection adapter target (documentation only).

## Security and privacy

- **Threat model.** Input is untrusted author/generator text that may contain
  HTML, scripts, `#`/`@`, control characters, and very long strings. The parser
  runs client- or server-side depending on the eventual caller.
- **No code execution / no crashes.** The parser treats all input as data and
  never throws; script-like text is preserved as literal content
  (`unified-activity-format.spec.ts` "robustness and security"). Very long input
  (10,000 chars) is handled without crashing.
- **Sanitization is deliberately out of scope here.** Adapter output
  `baseText`/`question` is HTML and is **not** sanitized by this layer;
  sanitization remains the responsibility of the iDevice render layer, as
  elsewhere in the codebase (documented in
  `src/shared/parsers/unified-activity-adapters.ts` header and
  `unified-authoring-format.md`). **Residual risk:** a caller that renders
  adapter output directly, bypassing the iDevice render/sanitize path, could
  introduce XSS; any UI integration (follow-up) must route through the existing
  sanitizer. This SDD does not add a new sanitizer and makes no new security
  guarantee.
- No secrets, auth, PII, or filesystem paths are involved; the parser is pure
  string processing with no I/O.

## Accessibility

Not applicable to the parser/adapter layer (no UI on this branch). When the
authoring UI follow-up lands, per-line diagnostics should be surfaced
accessibly (associated with the offending line, announced to assistive tech),
and any new controls must meet the project's keyboard/focus/contrast
expectations. Tracked with the UI follow-up.

## Internationalization

- The parser emits English `message` strings paired with **stable, locale-
  independent `code`s**; a UI/i18n layer should localize by `code` rather than
  by matching prose (`_()` / `c_()`), so no user-facing translated strings are
  added on this branch.
- Authored content itself is language-agnostic; the optional `@lang` parameter
  records a language hint on the item.
- No files under `translations/` are added or modified (per `AGENTS.md`).

## Performance

- Parsing is linear in input length; each line is scanned a small constant
  number of times (parameter-boundary scan, field split, unescape). The
  10,000-character test confirms no pathological blowup.
- The batch parser is O(total characters); it holds parsed items and diagnostics
  in memory, appropriate for typical bulk-authoring sizes.
- No profiling hooks are added; the layer is pure and cheap relative to
  export/save flows.

## Testing strategy

- **Unit (backend, `bun test`).** Colocated specs:
  - `src/shared/parsers/unified-activity-format.spec.ts` — grammar, all four
    kinds, escaping, parameters, type detection, strict mode, robustness/
    security, the four #1228 worked examples, adversarial regressions, and the
    batch API (line numbers, `lineOffset`, comment skipping, partial success).
  - `src/shared/parsers/unified-activity-adapters.spec.ts` — each adapter's exact
    iDevice encoding, `suggestion`-not-`hint`, fill `<u>` gaps, flipcard
    URI-encoding parity, defaults, and batch flashcard-skip.
- **Coverage.** New `.ts` files ship with colocated `*.spec.ts` in the same PR;
  target ≥ 90% patch coverage per `AGENTS.md`.
- **Integration / E2E.** None required on this branch: the format has no
  user-visible flow yet. A Playwright spec under
  `test/e2e/playwright/specs/` is required when the authoring-UI follow-up lands
  (per `AGENTS.md` for user-visible behavior).

## Rollout plan

1. **Phase 1 (this branch, PR #1999 — done):** land the parser, adapters,
   re-exports (`src/shared/parsers/index.ts`), and documentation. No user-facing
   wiring; additive only.
2. **Phase 2 (follow-up, related PR #2149):** wire the format into the
   bulk-question authoring UI (the shared `getTabIA` tab in
   `public/app/common/common_edition.js` and the per-iDevice `insertQuestions`
   handlers, e.g. `public/files/perm/idevices/base/form/edition/form.js`),
   surface per-line diagnostics, and add the required E2E coverage. This SDD does
   not assert Phase 2 behaviour;
   contents of PR #2149 are outside this branch and are referenced only as the
   tracked follow-up.

## Risks and mitigations

- **DSL learning curve / inference surprises** (leading digit meaning, never-
  inferred flashcards). Mitigation: explicit `@type=` guidance and clear
  `AMBIGUOUS_TYPE` diagnostics; documented in `unified-authoring-format.md`.
- **Twin drift** between adapters and live editors (`encodeURIComponentSafe`,
  `<u>` fill encoding). Mitigation: adapter tests pin the encodings; extract a
  shared helper as follow-up (ADR-1228-02).
- **Diagnostic-code contract churn.** Mitigation: treat the code catalogue and
  `hasCode` assertions as a contract; keep the doc in sync.
- **Unsanitized adapter HTML rendered off the iDevice path.** Mitigation: route
  any UI integration through the existing iDevice sanitizer (see Security).

## Open questions

- Should the answer-index syntax gain an explicit form for options at index ≥ 10
  beyond the comma/pipe workaround (`0,12`)? (Documented limitation.)
- Which additional iDevices, if any, warrant adapters (only when a real target
  is confirmed, to avoid inventing storage)?
- Where should bulk authoring live in the UI, and how are diagnostics surfaced
  and localized? (Resolved by the Phase 2 follow-up.)

## ADRs required or referenced

| Decision | ADR | Status |
|---|---|---|
| Adopt a custom compact line-based DSL for activity authoring | ADR-1228-01 | Proposed |
| Separate a pure normalized parser from iDevice adapters, mapping onto existing iDevice models | ADR-1228-02 | Proposed |
| Non-throwing parser with line-accurate diagnostics and stable codes | ADR-1228-03 | Proposed |

## Evidence

Operational documentation added/updated on this branch (linked, not duplicated
here):

- `doc/elpx-format/idevices/unified-authoring-format.md` — grammar, escaping,
  `@type` aliases, type detection, parameters, iDevice mapping, diagnostics, API,
  known limitations, migration notes.
- `doc/elpx-format.md` — links the new authoring-format doc from the ELPX index.
- `doc/elpx-format/idevices/catalog.md` — updated handler mapping
  (`MultichoiceIdevice`/`MultiSelectIdevice` → `form`).
- `doc/elpx-format/idevices/patterns.md` — the four content-storage patterns the
  adapters target.
- `llms.txt` — indexes the new authoring-format doc.

Code and tests (verified present on this branch):

- Parser: `src/shared/parsers/unified-activity-format.ts`
  (`parseUnifiedActivityLine` line 764; `parseUnifiedActivityLines` line 822;
  diagnostic type line 37; result types lines 144–160).
- Adapters: `src/shared/parsers/unified-activity-adapters.ts` (lines 153, 168,
  178, 205, 248, 261).
- Re-exports: `src/shared/parsers/index.ts:54` (parser) and `:74` (adapters).
- Parser tests: `src/shared/parsers/unified-activity-format.spec.ts` (593 lines;
  #1228 examples at 58/161/218/285; adversarial block at 465; batch block at
  551).
- Adapter tests: `src/shared/parsers/unified-activity-adapters.spec.ts`
  (194 lines).
- Confirmed iDevice targets:
  `public/files/perm/idevices/base/form/edition/form.js`,
  `public/files/perm/idevices/base/trueorfalse/edition/trueorfalse.js`,
  `public/files/perm/idevices/base/flipcards/edition/flipcards.js`.
- Legacy handlers referenced by the catalog mapping:
  `src/shared/import/legacy-handlers/MultichoiceHandler.ts`,
  `src/shared/import/legacy-handlers/TrueFalseHandler.ts`.
- Follow-up wiring targets: the shared `getTabIA` tab in
  `public/app/common/common_edition.js` and the per-iDevice `insertQuestions`
  handlers (e.g. `public/files/perm/idevices/base/form/edition/form.js`).

## Acceptance criteria

- [x] The four #1228 worked examples parse to the expected normalized model.
- [x] Each kind maps to its documented iDevice structure via exactly one adapter
      (`suggestion` written, not `hint`; fill blanks as `<u>answer</u>`;
      flipcard text URI-encoded).
- [x] The parser never throws; malformed input yields diagnostics with stable
      `code`s, `severity`, and (in batch) 1-based `line`s, with partial success.
- [x] Unknown parameters/escapes are preserved (not dropped) and reported;
      `strict` promotes them to errors.
- [x] Existing `.elp`/`.elpx` import/export behaviour is unchanged; no new
      canonical iDevice type is introduced.
- [x] New `.ts` files ship with colocated `*.spec.ts`; lint clean per
      `AGENTS.md`.
- [ ] (Follow-up) Authoring UI consumes the format with inline per-line
      diagnostics and an E2E spec.

## Implementation checklist

- [x] Implement `unified-activity-format.ts` (parser + normalized model +
      diagnostics + batch).
- [x] Implement `unified-activity-adapters.ts` (per-target adapters + batch).
- [x] Re-export both from `src/shared/parsers/index.ts`.
- [x] Colocated unit tests for parser and adapters.
- [x] Author `unified-authoring-format.md` and link it from `elpx-format.md`,
      `catalog.md`, and `llms.txt`.
- [ ] (Follow-up) Wire into the shared `getTabIA` tab (`common_edition.js`) and
      the per-iDevice `insertQuestions` handlers with diagnostics surfacing and
      E2E coverage.
- [ ] (Follow-up) Extract a shared `encodeURIComponentSafe` / fill-gap helper to
      remove the adapter/editor twin.

## References

- Issue #1228 — a unified format using separators and optional parameters.
- PR #1999 — feat(parsers): add unified compact activity authoring format.
- PR #2149 — related authoring-UI follow-up (outside this branch).
- ADR-1228-01, ADR-1228-02, ADR-1228-03.
- `doc/elpx-format/idevices/unified-authoring-format.md`, `doc/elpx-format.md`,
  `doc/elpx-format/idevices/catalog.md`,
  `doc/elpx-format/idevices/patterns.md`, `llms.txt`.
- `src/shared/parsers/unified-activity-format.ts`,
  `src/shared/parsers/unified-activity-adapters.ts`,
  `src/shared/parsers/index.ts`, and their colocated `*.spec.ts`.
