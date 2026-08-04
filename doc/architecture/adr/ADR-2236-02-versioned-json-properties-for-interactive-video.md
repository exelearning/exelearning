---
id: ADR-2236-02
title: "Store Interactive Video data as versioned JSON properties"
status: Proposed
date: 2026-07-09
tracking_issue: 2236
legacy_id: ADR-0002
deciders:
  - "@erseco"
reviewers:
  - "@mnunezcedec"
  - "@cristinavaldera"
related:
  prs: [2147]
  changes: ["2236-interactive-video-refactor"]
  adrs: [ADR-2236-01, ADR-2236-03]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-2236-02: Store Interactive Video data as versioned JSON properties

## Context

Legacy Interactive Video stored its authored data as a single JSON object
serialized into the **text content of `#exe-interactive-video-contents`** inside
`htmlView` ("Pattern 3", `doc/elpx-format/idevices/patterns.md`). The video URL
was **not** part of the JSON — it lived in a sibling
`<p id="exe-interactive-video-file"><a href>` — and interactions were keyed by
array index with integer-second times. This shape is implicit, hard to validate,
and hard to migrate. Modern JSON iDevices (`slide`, `trueorfalse`, `form`) store
their state as an object in `jsonProperties` (`component-type=json`) and render
via `renderView`.

## Problem

How should the authored state be stored so it is explicit, validatable,
migratable, exportable and safe for future sandboxing — and how do we keep
existing content working?

## Decision drivers

- Explicit, versioned, validatable state.
- A migration path from all legacy shapes without data loss.
- Compatibility: already-exported packages must keep working.
- Alignment with the existing JSON-iDevice export pipeline.

## Options considered

### Option 1: Keep the JSON-in-`htmlView` island (`component-type=html`)

Pros: no registration changes. Cons: implicit shape, video URL outside the JSON,
no versioning, index-keyed interactions; continues an error-prone pattern.

### Option 2: `component-type=json` with a versioned schema + on-open migration

Store the authored object in `jsonProperties`; render via
`renderView(jsonProperties, template)`; migrate legacy `htmlView` islands into the
versioned schema **once, on open**. Pros: explicit `schemaVersion`, stable
interaction ids, structured video descriptor, standard export path, testable
migration. Cons: requires registering the iDevice as JSON, an export template,
and migration logic.

## Evidence

- `config.xml`: `<component-type>json</component-type>`,
  `<api-version>3.0</api-version>`,
  `<export-template-filename>interactive-video.html</export-template-filename>`.
- Registration: `public/app/common/exe_export.js` (`jsonOnlyIdevices`),
  `src/shared/export/browser/idevice-config-browser.ts` (`jsonIdevices`).
- Schema + migration in the iDevice's TypeScript sources
  (`src/shared/schema.ts`: `SCHEMA_VERSION`, `hydrateDocument`, `normalizeV2`,
  `serializeDocument`; `src/shared/migration.ts`: `migrateLegacyToV2`,
  `readLegacyIsland`), covered by the colocated `schema.spec.ts` /
  `migration.spec.ts` (idempotency + lossless `unsupported` round-trips).
- Legacy import path: `src/shared/import/legacy-handlers/InteractiveVideoHandler.ts`.

## Decision

We will make the iDevice **`component-type=json`**: `save()` returns a declarative
object carrying an explicit `schemaVersion` stored in `jsonProperties`, export
renders via `renderView` + an export template, and a **bounded, idempotent,
lossless on-open migration** hydrates the current schema from the original
legacy shapes (the `htmlView` island, its `textTextarea` mirror, or a parsed
`slides` object). **Already-generated exports are not migrated** — they embed
the old runtime and keep working unchanged.

**Schema v2 is the only published versioned schema.** The supported inputs are
exactly:

- original legacy unversioned content → migrated **directly** to v2;
- schema v2 → normalized field by field (never cast);
- `schemaVersion > 2` → rejected as `unsupported-version` **without rewriting
  the stored payload**: the editor refuses to save (a save would destroy that
  content) and the runtime leaves the stored markup untouched.

`hydrateDocument(input: unknown)` returns a typed result
(`ok | unsupported-version | invalid`) so both surfaces make that call
explicitly rather than falling back silently.

## Consequences

### Positive

- Explicit, versioned, validatable state; stable interaction ids; standard JSON
  export pipeline; testable migration.
- One migration path to maintain (legacy → v2); no chain of intermediate steps.

### Negative

- Requires JSON registration, an export template, and migration logic to
  maintain.

### Neutral

- The rendered export still embeds a declarative JSON payload for the shipped
  runtime to read (see ADR-2236-03).

## Risks

- Migration bugs could drop author data. Mitigated by idempotency tests
  (`normalizeV2(normalizeV2(x)) == normalizeV2(x)`), lossless `unsupported`
  preservation, and round-trip fixtures under `src/test/fixtures/`.

## Validation

- `src/shared/schema.spec.ts` and `src/shared/migration.spec.ts` assert the
  direct legacy → v2 migration, v2 round-trips without data loss, idempotent
  normalization, and non-destructive rejection of `schemaVersion > 2`.
- E2E asserts a saved iDevice renders via `renderView` with the expected markers.

## Follow-up work

- Extend `InteractiveVideoHandler` coverage as new legacy fixtures surface.

## Amendment — schema consolidated at v2 (TypeScript refactor, 2026-07)

During review the schema went through unpublished intermediate shapes (a v1,
then a v3 that dropped per-interaction titles and replaced the poster with the
`cover` interaction). None of those intermediates ever shipped, so the
refactor to TypeScript consolidated everything into a **single published
schema v2** that already includes the final decisions: trueFalse `solution`,
cloze/dropdown `segments`, singleChoice first-correct-wins, no per-interaction
`title` (the cover keeps its own optional `title`), and the legacy opener/poster
re-created as the singleton `cover` interaction. The v1→v2→v3 chain migrations
were removed; the only migration is the direct legacy → v2 pipeline described
above.

The pre-release `contentBefore`/`contentAfter` rich-text fields were retired
from the model as well: content around the video belongs to sibling **Text
iDevices in the same block**. On `.elp`/`.elpx` import,
`src/shared/import/interactiveVideoContentSplit.ts` converts those fields into
such siblings (only when they carry real content) and strips them from the
stored jsonProperties, so re-exports never carry them again. The single
`.idevice`/`.block` import path applies the same shared transform.

## Amendment — the cover keeps a title field

The legacy opener had a required Title separate from its introduction. The
`cover` interaction therefore carries an optional `title` string, rendered as a
heading above the body, so the author can still edit it AS a title and the
interaction row can use it as its summary. The legacy migration puts the
opener's title in that field instead of inlining it in the body.

## References

- the change design — Interactive Video iDevice refactor.
- PR [#2147](https://github.com/exelearning/exelearning/pull/2147).
- Related: ADR-2236-01, ADR-2236-03.
