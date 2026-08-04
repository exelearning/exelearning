---
id: ADR-1228-01
title: "Adopt a custom compact line-based DSL for activity authoring"
status: Proposed
date: 2026-07-09
tracking_issue: 1228
legacy_id: ADR-0032
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
  - "@cristinavaldera"
  - "@mnarvaezm"
related:
  prs: [1999]
  changes: ["1228-unified-compact-activity-authoring-format"]
  adrs: [ADR-1228-02, ADR-1228-03]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-1228-01: Adopt a custom compact line-based DSL for activity authoring

## Context

Authoring assessment iDevices (multiple-choice, true/false, fill-in-the-blank,
flashcards) in eXeLearning is a per-item, form-driven task. Each question is
entered field by field through the iDevice editor UI, and every activity type
uses a different storage shape. The four storage patterns are documented in
`doc/elpx-format/idevices/patterns.md` (Standard JSON, URI-encoded JSON,
embedded JSON `<script>`, and `htmlView`-only), and the concrete per-type
runtime models differ substantially — for example `form` questions are stored as
`questionsData` JSON entries, while `flipcards` (Memory cards) stores
URI-encoded card objects inside a `*-DataGame js-hidden` div.

Issue [#1228](https://github.com/exelearning/exelearning/issues/1228) asks for a
single, compact, human-writable text format so that a teacher (or an AI
generator, or a migration script) can author many activities at once by typing
plain lines, rather than filling one editor form per question. The issue
proposes a line-based syntax using `#` as a field separator plus optional
`@key=value` parameters, with worked examples for each activity kind.

The work must respect the project constraints in `AGENTS.md`: no removal of
existing features, no compatibility shims, a single source of truth, and pure
testable functions. Whatever format is chosen must be an *authoring/import*
convenience layered on top of the existing iDevice models — it must not become a
second canonical storage format, and existing `.elp`/`.elpx` import/export must
be unchanged.

## Problem

What textual authoring representation should eXeLearning adopt to let users
express several activity kinds (selection, true/false, fill-in-the-blank,
flashcard) in one compact, copy-pasteable form — and should it be an existing
standard format or a purpose-built domain-specific language (DSL)?

## Decision drivers

- **Compactness / low ceremony.** The primary use case is typing many items
  quickly; one line per item with minimal punctuation is the goal stated in
  #1228.
- **Human writability by non-programmers.** Educators, not just developers, must
  be able to author it without a schema reference open.
- **Expressiveness across four heterogeneous activity kinds** without forcing a
  separate mini-language per kind.
- **Unambiguous, escapable syntax.** Natural question text routinely contains
  `#`, `@`, `<script>`, accents, and emoji; the format must carry them literally.
- **Deterministic parsing** that can be implemented as pure functions with full
  unit-test coverage (`AGENTS.md` Definition of Done: patch coverage ≥ 90%).
- **No new canonical storage type.** The format is an input convenience only.
- **Maintainability for a small team**; the syntax must be documented in one
  place and stay stable.

## Options considered

### Option 1: Adopt an existing markup/data format (Markdown-quiz, GIFT, Aiken, Moodle XML, YAML/JSON)

Reuse a known quiz interchange format such as Moodle **GIFT**, **Aiken**, Moodle
**XML**, or a structured **YAML/JSON** schema.

- Pros: no new grammar to invent; some ecosystem familiarity; JSON/YAML have
  off-the-shelf parsers.
- Cons: GIFT and Aiken are quiz-specific and do not cover flashcards or the
  eXeLearning parameter set (hint/explain/feedback/points/tags/difficulty);
  their escaping and answer-encoding rules would still have to be mapped onto
  eXeLearning's iDevice models, so a bespoke adapter layer is unavoidable
  regardless. YAML/JSON are verbose and ceremony-heavy for the "type many items
  fast" use case — the opposite of the #1228 goal — and are error-prone to hand-
  write (indentation, quoting). Moodle XML is machine-oriented, not something a
  teacher types by hand. None of them natively expresses eXeLearning's
  single/multiple selection inference or `@@blank@@` cloze markers.

### Option 2: One separate mini-format per activity kind

Give each activity kind its own syntax (e.g. a cloze-only syntax, a separate
flashcard syntax).

- Pros: each syntax can be maximally tuned to its kind.
- Cons: four grammars to document, learn, parse, and test; no shared parameter
  handling; contradicts the "unified format" ask in #1228 and the single-source-
  of-truth principle in `AGENTS.md`.

### Option 3: A purpose-built compact line-based DSL (chosen)

A single line-based DSL: a **payload** of `#`-separated fields followed by zero
or more `@key=value` **parameters**, with a small, well-defined escaping scheme
and per-kind field conventions. Activity kind is chosen by an explicit `@type=`
(with input aliases) or inferred from the payload shape. Blanks are marked
`@@answer@@` for the fill-in-the-blank kind.

- Pros: one grammar covers all four kinds; extremely compact (one line per
  item); a shared parameter section serves every kind; escaping and blank
  markers are designed around real educational text; parsing is a deterministic
  pure function; the format is decoupled from storage so no new canonical type
  is introduced.
- Cons: it is a bespoke syntax users and tools must learn; ambiguities
  (e.g. a leading digit meaning "answer index" vs "boolean") must be resolved by
  documented rules; a full parser and test suite must be written and maintained.

## Evidence

- The concrete grammar, escaping table, `@type` aliases, and type-detection
  rules are specified in
  `doc/elpx-format/idevices/unified-authoring-format.md` (added on this branch).
- The parser implementing the DSL is
  `src/shared/parsers/unified-activity-format.ts`. It defines the four kinds as
  `UnifiedActivityKind = 'selection' | 'truefalse' | 'fillblank' | 'flashcard'`
  and the payload/parameter split in `parseUnifiedActivityLine`
  (`src/shared/parsers/unified-activity-format.ts:764`).
- The `@type` alias table (`selection`/`select`/`mc`/`multiple-choice`,
  `truefalse`/`tf`, `fillblank`/`cloze`/`fill`,
  `flashcard`/`flipcard`/…) is `TYPE_ALIASES`
  (`src/shared/parsers/unified-activity-format.ts:167`).
- The escaping scheme (`\#`, `\@`, `\|`, `\\`, `\n`, `\t`) is `ESCAPE_MAP`
  (`src/shared/parsers/unified-activity-format.ts:162`); unknown escapes are
  preserved literally rather than dropped.
- The worked examples from #1228 are exercised as tests: the multiple-choice
  example (`src/shared/parsers/unified-activity-format.spec.ts:58`), the
  true/false example (`:161`), the fill-in-the-blank example (`:218`), and the
  flashcard example (`:285`).
- Robustness/expressiveness is covered by the "robustness and security" and
  "adversarial regressions (issue #1228 review)" test blocks
  (`src/shared/parsers/unified-activity-format.spec.ts:392` and `:465`),
  including script-like text kept literal, Unicode/emoji, and 10,000-character
  input.
- The format is explicitly documented as an authoring/import layer, "NOT the
  canonical iDevice storage model", in the parser module header
  (`src/shared/parsers/unified-activity-format.ts:11`) and in the doc's opening
  note (`doc/elpx-format/idevices/unified-authoring-format.md:7`).
- The existing per-iDevice storage patterns this DSL layers on top of are
  catalogued in `doc/elpx-format/idevices/patterns.md` and
  `doc/elpx-format/idevices/catalog.md`.

## Decision

We will adopt a **purpose-built compact line-based DSL** for activity authoring
(Option 3): a `#`-separated payload plus optional `@key=value` parameters, one
logical line per activity item, covering selection, true/false,
fill-in-the-blank, and flashcard kinds through a single grammar with a shared
escaping scheme and parameter set. The DSL is an authoring/import convenience
only; it introduces no new canonical iDevice storage type and leaves existing
`.elp`/`.elpx` import/export unchanged.

## Consequences

### Positive

- One grammar expresses all four activity kinds; teachers and generators author
  many items with one line each.
- The syntax is tuned to educational text: `#`/`@` escaping, `@@blank@@`
  markers, and a single shared parameter section.
- Because the DSL is decoupled from storage, it can target multiple existing
  iDevices (see ADR-1228-02) without becoming a second source of truth.
- Deterministic, pure-function parsing enables high unit-test coverage.

### Negative

- It is a bespoke syntax with a learning curve; users need the documentation
  (`unified-authoring-format.md`) to author confidently.
- Some rules are non-obvious by design (leading digit = answer index in
  selection vs boolean in true/false; pure-digit answer spec = compact indexes),
  and must be taught, not guessed.
- eXeLearning now owns and must maintain a grammar, a parser, and its docs.

### Neutral

- The DSL does not aim to be a general interchange format; it is not
  round-trip-lossless against every iDevice model (see "Known limitations" in
  the doc).
- Adopting a bespoke DSL over GIFT/Aiken means no automatic interoperability
  with Moodle question banks; this was not a goal of #1228.

## Risks

- **Ambiguity confusion:** users may be surprised by type inference (e.g. a
  two-field line is `AMBIGUOUS_TYPE`, flashcards are never inferred). Mitigated
  by requiring explicit `@type=` in ambiguous cases and by clear diagnostics
  (ADR-1228-03).
- **Scope creep:** pressure to make the DSL express every iDevice could turn it
  into a de-facto storage format. Mitigated by the explicit "authoring only,
  not canonical storage" boundary and the adapter layer (ADR-1228-02).
- **Documentation drift:** as new parameters/kinds are added, the single
  grammar doc must stay in sync with the parser. Mitigated by colocated tests
  that encode the documented behaviour.

## Validation

- The four #1228 worked examples parse to the expected normalized model
  (`src/shared/parsers/unified-activity-format.spec.ts`).
- Adversarial inputs (`@@x=5@@`, escaped separators, digit-leading `@8am=`,
  script-like text) behave as documented
  (`src/shared/parsers/unified-activity-format.spec.ts:465`).
- Success criterion for the DSL choice: a teacher can author each kind in one
  line matching the examples in
  `doc/elpx-format/idevices/unified-authoring-format.md`, and the parser is
  covered to the project's ≥ 90% patch-coverage gate (`AGENTS.md`).
- Follow-up review once the format is wired into the authoring UI (currently a
  documented follow-up, not implemented on this branch).

## Follow-up work

- Wire the DSL into the bulk-question authoring UI: the shared AI-questions tab
  `getTabIA` (in `public/app/common/common_edition.js`) and each activity
  iDevice's own `insertQuestions` handler (e.g.
  `public/files/perm/idevices/base/form/edition/form.js`), tracked in the
  "Known limitations" section of
  `doc/elpx-format/idevices/unified-authoring-format.md` and in the change design.
- Consider optional importers from GIFT/Aiken *into* this DSL if Moodle
  interoperability is later requested (not in scope for #1228).

## References

- Issue #1228 — a unified format using separators and optional parameters.
- PR #1999 — feat(parsers): add unified compact activity authoring format.
- the change design — Unified compact activity authoring format.
- ADR-1228-02 — Separate a pure normalized parser from iDevice adapters.
- ADR-1228-03 — Non-throwing parser with line-accurate diagnostics.
- `doc/elpx-format/idevices/unified-authoring-format.md`
- `doc/elpx-format/idevices/patterns.md`, `doc/elpx-format/idevices/catalog.md`
- `src/shared/parsers/unified-activity-format.ts`,
  `src/shared/parsers/unified-activity-format.spec.ts`
