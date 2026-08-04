---
id: ADR-1228-02
title: "Separate a pure normalized parser from iDevice adapters, mapping onto existing iDevice models"
status: Proposed
date: 2026-07-09
tracking_issue: 1228
legacy_id: ADR-0033
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
  - "@cristinavaldera"
  - "@mnarvaezm"
related:
  prs: [1999]
  changes: ["1228-unified-compact-activity-authoring-format"]
  adrs: [ADR-1228-01, ADR-1228-03]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-1228-02: Separate a pure normalized parser from iDevice adapters, mapping onto existing iDevice models

## Context

ADR-1228-01 adopts a compact line-based DSL for authoring activities. The DSL must
ultimately produce data that existing iDevices can render. But eXeLearning's
activity iDevices do not share a storage shape: as documented in
`doc/elpx-format/idevices/patterns.md`, `form` questions live as `questionsData`
JSON entries (Standard JSON, Pattern 1), `trueorfalse` is also Pattern 1 but
with its own question shape, and `flipcards` (Memory cards) stores URI-encoded
card objects in a `*-DataGame js-hidden` div (Pattern 2). The runtime field
names are idiosyncratic — for example the `form` iDevice reads a question-level
hint from a field named `suggestion`, and stores selection options as
`[isCorrect, text]` tuples; the `flipcards` editor URI-encodes card text with a
specific `encodeURIComponentSafe` rule.

If the parser emitted iDevice-specific structures directly, it would (a) bake
one iDevice's field names into the grammar, (b) be hard to unit-test in
isolation, and (c) have to be rewritten to support a second target iDevice. This
conflicts with `AGENTS.md` principles: single source of truth, extract testable
pure functions, no workarounds.

## Problem

Should the DSL parser produce iDevice-specific data structures directly, or
should it produce a neutral normalized model that separate adapter functions
then map onto each concrete iDevice — and how should authoring parameters be
mapped so they land only in real iDevice fields?

## Decision drivers

- **Testability.** A parser that returns a plain normalized model can be tested
  without any iDevice runtime.
- **Single source of truth.** The mapping to each iDevice's idiosyncratic fields
  should live in exactly one place per target.
- **No invented fields.** Parameters must map only to fields the target iDevice
  actually reads; a parameter without a home must not fabricate storage.
- **Multiple targets from one input.** One DSL item (e.g. true/false) may map to
  more than one iDevice (`trueorfalse` game and a `form` `true-false` question).
- **Determinism.** Adapter output must be stable and comparable in tests
  (no random ids, no time-dependent values).
- **Separation of concerns.** Parsing/validation is independent from
  storage-shape knowledge, so each can evolve separately.

## Options considered

### Option 1: Parser emits iDevice structures directly

`parseUnifiedActivityLine` returns, say, a `form` `questionsData` entry.

- Pros: fewer types; one fewer hop.
- Cons: couples the grammar to one iDevice's field names; a second target
  (flipcards, trueorfalse game) forces either branching inside the parser or a
  rewrite; parser unit tests must assert on iDevice-specific encodings
  (`<u>answer</u>`, URI-encoding), mixing concerns; violates single-source-of-
  truth because iDevice knowledge leaks into the parser.

### Option 2: Parser plus a single "god" converter with per-type branches

Keep a normalized model but funnel all conversion through one large function.

- Pros: one entry point.
- Cons: one function accreting every iDevice's encoding rules is hard to test
  granularly and hard to review; adding a target means editing a hotspot.

### Option 3: Pure normalized parser + small per-target adapter functions (chosen)

The parser returns a neutral `UnifiedActivityItem` (a discriminated union over
the four kinds) carrying validated fields and a normalized `params` object.
Separate, small **adapter** functions convert a normalized item into one
concrete iDevice structure each. Parameters are mapped to real iDevice fields
only; parameters without a target survive in the normalized model but are not
invented into iDevice fields.

- Pros: parser is a pure function testable in isolation; each adapter is a
  small, single-responsibility, independently testable unit; one DSL kind can
  feed multiple adapters; adapters own (and document) each iDevice's field
  names in one place; no invented fields.
- Cons: an extra type layer (normalized model + adapter types); slightly more
  code and two test suites instead of one.

## Evidence

- **Normalized model:** the discriminated union `UnifiedActivityItem` and its
  members (`UnifiedSelectionItem`, `UnifiedTrueFalseItem`,
  `UnifiedFillBlankItem`, `UnifiedFlashcardItem`) plus the shared
  `UnifiedActivityParams` are defined in
  `src/shared/parsers/unified-activity-format.ts:48` and `:124`. The parser is a
  pure function `parseUnifiedActivityLine`
  (`src/shared/parsers/unified-activity-format.ts:764`) and its batch form
  `parseUnifiedActivityLines` (`:822`); neither imports any iDevice code.
- **Adapters** live in a separate module,
  `src/shared/parsers/unified-activity-adapters.ts`, which imports only *types*
  from the parser module (`src/shared/parsers/unified-activity-adapters.ts:25`)
  and contains no parsing logic:
  - `unifiedSelectionToFormQuestion` → `form` `questionsData`
    (`activityType: 'selection'`), options as `[isCorrect, text]` tuples
    (`:153`).
  - `unifiedTrueFalseToTrueOrFalseQuestion` → `trueorfalse` game question
    (`:168`) **and** `unifiedTrueFalseToFormQuestion` → `form` `true-false`
    question (`:178`) — one DSL kind, two targets.
  - `unifiedFillBlankToFormQuestion` → `form` `fill` question with blanks
    rendered as `<u>answer</u>` (alternatives `<u>|a|b|</u>`)
    (`:191`, `:205`).
  - `unifiedFlashcardToFlipCard` → `flipcards` card, front/back URI-encoded via
    a verbatim copy of the editor's `encodeURIComponentSafe`
    (`src/shared/parsers/unified-activity-adapters.ts:122`, `:248`).
  - `unifiedItemsToFormQuestionsData` batches selection/true-false/fill into
    `form` questions and reports skipped flashcards (`:261`).
- **No invented fields / real targets only:** the module header states adapters
  "never invent storage fields" and that `hint` maps to the iDevice
  `suggestion` field, *not* a `hint` field the `form` iDevice never reads
  (`src/shared/parsers/unified-activity-adapters.ts:14`). The parameter→field
  mapping table is in
  `doc/elpx-format/idevices/unified-authoring-format.md:172`.
- **Confirmed runtime targets exist:** `form`
  (`public/files/perm/idevices/base/form/edition/form.js`), `trueorfalse`
  (`public/files/perm/idevices/base/trueorfalse/edition/trueorfalse.js`), and
  `flipcards` (`public/files/perm/idevices/base/flipcards/edition/flipcards.js`
  — the `encodeURIComponentSafe` source mirrored by the adapter). The legacy
  handlers the catalog maps onto `form`/`trueorfalse` are
  `src/shared/import/legacy-handlers/MultichoiceHandler.ts` and
  `src/shared/import/legacy-handlers/TrueFalseHandler.ts`; the `catalog.md`
  change on this branch re-parents `MultichoiceIdevice`/`MultiSelectIdevice` to
  `form`.
- **Determinism:** adapters omit generated ids (the editors generate ids when
  missing) so output is stable; the flashcard percent-handling parity is
  asserted in
  `src/shared/parsers/unified-activity-adapters.spec.ts:149`, and the full
  adapter behaviour is covered by
  `src/shared/parsers/unified-activity-adapters.spec.ts` (selection, both
  true/false targets, fill `<u>` rendering, flipcard defaults, batch skip of
  flashcards).

## Decision

We will keep parsing and iDevice mapping in **two separate layers** (Option 3):

1. A **pure normalized parser** (`unified-activity-format.ts`) that validates
   input and returns an iDevice-agnostic `UnifiedActivityItem` with a normalized
   `params` object, importing no iDevice code.
2. A set of **small per-target adapter functions**
   (`unified-activity-adapters.ts`) that each map a normalized item onto one
   concrete, confirmed iDevice model (`form`, `trueorfalse`, `flipcards`),
   writing only fields those iDevices actually read and never inventing storage.

## Consequences

### Positive

- The parser is a self-contained pure function with isolated unit tests.
- Each iDevice's field-name idiosyncrasies (e.g. `suggestion`, `[isCorrect,
  text]`, URI-encoded card text) are encapsulated in one adapter and documented
  once.
- One DSL kind can drive multiple iDevices (true/false → game and form).
- Adding a new target iDevice means adding one adapter, not touching the parser
  or the grammar.
- Parameters without a real target field are preserved in the model but never
  fabricated into storage, avoiding dead fields.

### Negative

- More types and an extra module; two colocated test suites to maintain.
- Adapters duplicate small pieces of iDevice logic (e.g. `encodeURIComponentSafe`
  is reproduced verbatim), creating a twin that must be kept in sync with the
  editor if that rule ever changes.

### Neutral

- Adapters intentionally omit sanitization; `baseText`/`question` output is HTML
  and sanitization stays in the iDevice render layer, consistent with the rest
  of the codebase (see Security and privacy in the change design).
- Flashcards are skipped by the `form` batch adapter because the `form` iDevice
  has no flashcard activity type; this is reported, not silent.

## Risks

- **Twin drift:** the reproduced `encodeURIComponentSafe` and the `<u>answer</u>`
  fill encoding could diverge from the live editors. Mitigated by adapter unit
  tests that pin the expected encodings; a future refactor could extract the
  shared helper (follow-up).
- **Model/target mismatch:** if a target iDevice's storage shape changes, the
  corresponding adapter and its tests must be updated. Contained to one adapter.
- **Over-normalization:** a normalized field that no adapter consumes adds
  surface with no output. Accepted deliberately so the DSL can carry authoring
  metadata (tags, difficulty) even before a target exists.

## Validation

- Parser tests assert only on the normalized model, with no iDevice imports
  (`src/shared/parsers/unified-activity-format.spec.ts`).
- Adapter tests assert exact iDevice encodings and field selection, including
  that `suggestion` (not `hint`) is written and that flashcards are skipped by
  the `form` batch (`src/shared/parsers/unified-activity-adapters.spec.ts:59`,
  `:180`).
- Success criterion: each of the four kinds round-trips from a DSL line to the
  documented iDevice structure via exactly one adapter, at ≥ 90% patch coverage
  (`AGENTS.md`).

## Follow-up work

- Consider extracting the shared `encodeURIComponentSafe` and fill-gap encoding
  into a single helper imported by both the editor and the adapter to remove the
  twin (tracked with the DSL follow-ups in
  `doc/elpx-format/idevices/unified-authoring-format.md`).
- Add adapters for further iDevices only when a real target is confirmed
  (avoids inventing storage).

## References

- Issue #1228; PR #1999; the change design.
- ADR-1228-01 — Adopt a custom compact line-based DSL for activity authoring.
- ADR-1228-03 — Non-throwing parser with line-accurate diagnostics.
- `src/shared/parsers/unified-activity-format.ts`,
  `src/shared/parsers/unified-activity-adapters.ts`, and their `*.spec.ts`.
- `doc/elpx-format/idevices/patterns.md`,
  `doc/elpx-format/idevices/catalog.md`,
  `doc/elpx-format/idevices/unified-authoring-format.md`.
- `public/files/perm/idevices/base/form/edition/form.js`,
  `public/files/perm/idevices/base/trueorfalse/edition/trueorfalse.js`,
  `public/files/perm/idevices/base/flipcards/edition/flipcards.js`.
- `src/shared/import/legacy-handlers/MultichoiceHandler.ts`,
  `src/shared/import/legacy-handlers/TrueFalseHandler.ts`.
