---
id: ADR-2473-01
title: "Import iDevice into an existing block"
status: Proposed
date: 2026-09-27
tracking_issue: 2473
deciders:
  - "@franmate"
reviewers:
  - "@erseco"
  - "@ignaciogros"
  - "@eXeLearningProject"
related:
  prs: [2474]
  changes: []
  adrs: [ADR-2193-01, ADR-2190-01]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "GLM"
  model: "GLM-5.3-Flash"
---

# ADR-2473-01: Import iDevice into an existing block

## Context

eXeLearning exports blocks and iDevice content as `.block`/`.idevice` ZIP files
through `ComponentExporter` and imports them through `ComponentImporter`. Until
now, importing a `.idevice` always created a **new** block at the end of the
page: a teacher who wanted a shared activity inside a particular block had to
import it globally and then drag it into place (issue #2473).

`ComponentImporter.importIdeviceIntoBlock(file, pageId, blockId)` inserts the
file's content into an *existing* block instead. The `.idevice` format is a ZIP
archive whose `content.xml` can carry **one or more** `odeComponent` entries;
the new action inserts all of them, which is why the ADR speaks of
`component(s)`. It is exposed by `IdeviceBlockNode.importIdeviceFileIntoBlock`
and an **Import iDevice** entry in the block's action menu. The existing
`importComponent(file, targetPageId)`, which imports a `.block` file as a new
block, keeps its behaviour.

The file is untrusted ZIP data unzipped synchronously with `fflate.unzipSync`.
`importPolicy.ts` already holds the limits used by whole-project import
(ADR-2193-01); this ADR adds a smaller tier for this action.

## Problem

How should a `.idevice` file be imported into an existing block so that the
Yjs mutation is grouped for collaborators, ids cannot collide, asset references
resolve in the destination document, memory exhaustion and UI freezes are less
likely within the limits of the validation strategy, and failures are handled
without falsely reporting success or encouraging duplicate retries?

## Decision drivers

- **Collaboration safety.** The insertion must be grouped in a single Yjs
  transaction, with component preparation completed beforehand and the absence
  of an explicit rollback strategy documented.
- **No id collisions.** A file can be imported twice; ids inside it cannot be
  trusted.
- **Reuse over duplication.** Parsing and asset rewriting stay compatible with
  `importComponent` and `ComponentExporter`.
- **Resource protection.** Reduce the risk of memory exhaustion and UI-thread
  freezes when processing untrusted archives, while documenting the limits of
  synchronous decompression.
- **Component budgets are not project budgets.** This is a repeatable action in
  a shared document, not a once-per-session project open.
- **Backward compatibility.** Preserve the existing import path and its
  acceptance policy; apply the new component-scoped limits only to the new
  import-into-block action.

## Options considered

**Option 1 — reuse the numeric project caps.** Give the new path the values of
`CONSERVATIVE_ZIP_LIMITS` (500 MiB total, 200 MiB per entry, 10 000 entries).
Pro: no second tier. Con: sized for "open one project per session"; clicked
repeatedly in a shared document, it would push several times that data into the
live Yjs document, replicated to every collaborator.

**Option 2 — reuse the machinery under a component-scoped tier (chosen).** Run
the same preflight as `ElpxImporter`, then a declared-size filter and a
backstop, against `COMPONENT_IMPORT_LIMITS`. Pro: same machinery and structured
`ZipLimitError`; a budget sized for the usage. Con: a second tier to keep in
sync, and a local fallback copy of its numbers.

**Option 3 — round-trip the file through the server.** Pro: server-side
validation. Con: the rest of the editing flow is client-side and
offline-capable; this would be the only import that fails without connectivity.

## Evidence

Facts refer to commit `f9ddf3ca80c25ecc2abf8b26119462830ffbe62c`, by function
name. Operational details (exact message strings, input cleanup timing, the
fflate measurement) live in the tests and the PR description.

- **Tier.** `COMPONENT_IMPORT_LIMITS` in `src/shared/import/importPolicy.ts`:
  `maxFileBytes` 50 MiB, `maxTotalBytes` 200 MiB, `maxEntryBytes` equal to the
  total (no extra per-entry cap), `maxEntries` 10 000, the same value as the
  project tiers.
- **Guard order.** `readComponentZip(file, { withLimits })` runs
  `validateCompressedSize`, `validateZipPreflight`, `unzipSync` with
  `createDeclaredSizeFilter`, and `validateUncompressedSize`. The entry count is
  checked during preflight when the policy is available, and again by the
  declared-size filter. The filter therefore enforces the entry cap even when
  `window.ExeImportPolicy` is not loaded and preflight returns `null`.
- **Limits of the strategy.** `validateZipPreflight` and
  `createDeclaredSizeFilter` trust the central directory; an archive that
  understates its declared sizes is only bounded per entry by fflate and, in
  total, by `validateUncompressedSize` **after** the bytes have been inflated.
  The backstop therefore cannot prevent a peak that has already happened.
- **Two flows, two policies.** `importIdeviceIntoBlock` calls it with
  `withLimits: true`; `importComponent` calls it with `withLimits: false`, with
  a comment that this flow keeps its historical unlimited behaviour.
- **Messages.** `validateZipPreflight` turns any `ZipLimitError` into the size
  message; only the filter has its own "too many entries" message.
  `validateZipPreflight` is shared by every importer, so this message is the
  same for all of them; this change does not alter it.
- **fflate and understated sizes.** A single forged central-directory size was
  measured against fflate 0.8.3: a deflated entry is truncated without error,
  a stored entry is returned whole. The comment above
  `MAX_COMPONENT_UNCOMPRESSED_BYTES` says fflate never grows past the declared
  size, which holds for deflate only. Pinned by a test against the vendored
  bundle.
- **Ids.** `generateId('idevice')` replaces `comp.id` and `comp.ideviceId`; it
  reaches `properties.ideviceId` only when that value equalled the original id.
  `generateId` mirrors `src/shared/ids.ts` by hand (#1782).
- **Insertion.** The component Y.Maps are built before the transaction; one
  `ydoc.transact(..., ydoc.clientID)` looks up the block, creates `components`
  if absent and pushes them. Orders are `max existing order + 1 + i`, the rule
  `moveComponentToBlock` in `public/app/yjs/YjsStructureBinding.js` uses.
- **Assets.** `extractAssetsFromZip` runs after the page, the block and the
  parsed components are resolved; `{{context_path}}` references are converted
  afterwards by `applyAssetReferencesToComponents`. Asset storage is outside
  the Yjs transaction.
- **UI.** The import handler checks `isAvalaibleOdeComponent(this.blockId,
  null)` like the other box-menu actions, uses a one-shot hidden `.idevice`
  input, and, if the page refresh fails after a successful import, says the
  content was imported and must not be retried.
- **File type by name only.** The handler accepts the file by its `.idevice`
  extension; a `.block` file renamed to `.idevice` is imported as well.
- **Export.** `ComponentExporter` does not compare its archive with any limit,
  and `addComponentAssetsToZip` catches every error with `console.warn`.

## Decision

We will import a `.idevice` file into the block the user chose, grouping the
Yjs mutation in a single transaction, with these rules:

1. **Size protection applies to this path only.** `importComponent` stays
   unlimited for now; this preserves its existing acceptance policy in this
   change. Hardening that path is a separate change with its own exit criterion
   (see Follow-up work).
2. **The entry count is capped at 10 000** in the preflight and in the filter,
   because `unzipSync` is synchronous and many tiny entries can freeze the
   editor.
3. **Every component gets a fresh id**, and the nested `ideviceId` is rewritten
   only when it tracked the original one-for-one.
4. **Component maps are prepared before the transaction.** The transaction
   groups the insertion for Yjs observers, but this code does not implement an
   explicit rollback strategy for exceptions. Asset extraction and storage
   remain outside the transaction.
5. **Orders follow `max existing order + 1 + i`**, not the array length.
6. **Assets are extracted last**, after the page, block and components are
   resolved. The order reduces the probability of orphaned assets when the
   page or the block is missing; it is not a guarantee that no orphan can
   remain (see Risks).
7. **A successful insertion is not reported as a failed import** when the
   subsequent page refresh fails. The UI reports that the content was imported
   and instructs the user not to retry, reducing the risk of duplicate content.
8. **The block availability check and the label follow the other box-menu
   actions.** The entry is "Import iDevice" because the file type is
   `.idevice`. The ambiguity with the block and the component type is accepted
   until an "import iDevice as component" action exists.
9. **Both flows share their preparation** (reading the ZIP, parsing
   `content.xml`, regenerating ids), so a fix reaches both.

## Consequences

### Positive

- A single activity moves between blocks, pages or projects without an extra
  block.
- The insert is grouped for Yjs observers, and ids are fresh.
- The two failure modes a user could act on wrongly are mitigated: the
  operation order reduces the probability of orphaned assets, and a retry
  after a refresh failure is discouraged by the UI, reducing the risk of
  duplicate content.
- The entry-count cap reduces the risk of UI-thread freezes caused by archives
  with many entries. It does not guarantee that synchronous decompression
  cannot block the editor or exhaust memory (see Risks).
- The existing `.block` import path retains its historical policy and intended
  behaviour; shared preparation changes may still affect both flows and are
  covered by compatibility tests.

### Negative

- **The two import flows have different protection.** `.idevice`-into-block is
  guarded; `.block`-into-page (`importComponent`) accepts any size.
- No per-entry cap (`maxEntryBytes == maxTotalBytes`); weaker than the project
  tiers.
- Two local constants and `generateId` duplicate shared code and are kept in
  sync by hand.
- With the policy bundle loaded, an archive over the entry cap shows the size
  message (see Evidence). The message comes from shared machinery; this change
  does not alter it.

### Neutral

- The two flows share `readComponentZip`, `parseComponentXml`,
  `regenerateComponentIds` and `createComponentYMap`; a change to any of them
  affects both.

## Risks

### Accepted for this change

- **Unguarded `.block` import.** Likelihood medium, severity medium: a large or
  hostile `.block` is unzipped without limits. Accepted to avoid regressions;
  the first follow-up, with an exit criterion.
- **No per-entry cap.** Accepted scope choice: a single entry may declare up to
  just under the cumulative cap.
- **No per-session budget.** Likelihood medium, severity medium: limits are per
  call, so repeated imports into a synced document are unbounded in total.
- **File type by name only.** Likelihood low, severity low: a renamed `.block`
  imports all its components into the block.

### Known defects that require correction

- **Wrong message for the entry cap, from shared machinery.** Likelihood
  certain with the bundle loaded, severity low: `validateZipPreflight` turns
  every `ZipLimitError` into the size message, so an archive rejected for its
  entry count reads as a size problem. The defect lives in the shared
  `importPolicy.ts` preflight and affects every importer that uses it; this
  change does not introduce it, but makes it observable on the component path.
- **Limit drift.** Likelihood medium, severity low: no test keeps the local
  fallback constants equal to the tier.

### Robustness improvements that can wait

- **Truncated deflate entries.** Likelihood low, severity low: a forged archive
  that understates an entry's size is truncated without an error, giving a
  corrupt asset or a failed XML parse in a file the user chose.
- **Concurrent `order`.** Likelihood low, severity low: two clients importing
  into the same block at once can compute the same value; `max + 1` fixes sparse
  orders, not concurrency.
- **Export asymmetry.** Likelihood medium, severity low: the exporter can
  produce a file the importer rejects and drops asset errors silently.

### Needs investigation

- **Peak memory under a hostile archive.** Likelihood unknown, severity unknown:
  the validation layers check compressed size and declared archive metadata
  before decompression, then validate the extracted result. The
  post-decompression check cannot prevent a memory peak that has already
  occurred, and the current strategy does not establish a hard bound on peak
  memory under hostile input. `unzipSync` is synchronous, so a blocking
  decompression is possible within the limits the layers allow. No measurement
  of peak memory is recorded. The fflate measurement covers one case (a single
  forged declared size); a systematic check belongs with the fflate pinning
  test.
- **Residual orphaned assets.** Likelihood low, severity low: the operation
  order reduces the probability, but a failure after extraction still leaves
  assets stored. Closing it needs `AssetManager` rollback that reports which
  asset ids an import created.
- **Behaviour of Yjs when an exception interrupts the insertion.** Likelihood
  unknown, severity low: the transaction groups the insertion for observers,
  but the ADR does not claim, and the tests do not yet establish, whether Yjs
  reverts the changes pushed before an exception. The tests below are intended
  to observe the real behaviour and bound the risk, not to assert an automatic
  rollback.

## Validation

- `ComponentImporter.test.js`: invalid ZIPs, missing or malformed `content.xml`,
  with and without an asset manager, page and block resolution, fresh ids,
  consecutive and sparse orders, `odeComponentsProperties` preservation (#1991),
  `clientID` transaction, no asset extraction when the target or components are
  missing, no write when a later component fails to build, preflight outcomes,
  tier resolution, a forged central directory rejected before `unzipSync`, real
  fflate against the vendored bundle.
- Compatibility: `importComponent` still imports a 60 MiB file and a 201 MiB
  declared entry, with no filter and no preflight.
- `blockNode.test.js`: availability refusal, one-shot input cleanup, empty file
  list, detached input, two independent clicks.
- `importPolicy.spec.ts`: pins `COMPONENT_IMPORT_LIMITS` and keeps the project
  tiers untouched.
- `test/e2e/import-content-into-block.spec.ts`: no new block, image resolved,
  menu entry visible, invalid ZIP shows "Import error" and leaves the project
  unchanged.
- Manual, by `@cristinavaldera` on the preview: components import into the
  target box without an extra one.
- Not covered yet: fallback constants equal to the tier, the layer order as a
  contract, the entry-cap message with the bundle loaded, the
  file-type-by-name-only case, a peak-memory measurement for a hostile archive,
  and the behaviour when insertion throws after one or more components have
  been pushed, including the resulting Yjs document state.

## Follow-up work

- Apply the component limits to `importComponent`. Exit criterion: a corpus of
  existing `.block` files (the test fixtures plus a sample of user-reported
  files) must import identically with `withLimits: true` and
  `withLimits: false` before the flip. The check belongs in the PR that flips
  it, with a compatibility note; "a one-line change" understates the work.
- Map `ZipLimitError.details.kind` to specific messages in
  `validateZipPreflight`. Shared machinery used by every importer
  (`ElpxImporter` included); it belongs in its own change with a compatibility
  note and tests covering each `kind`, not in this PR.
- Fix the comment about fflate and the declared size; add the tests listed
  above.
- Make `ComponentExporter` fail instead of producing a file the importer would
  reject, and stop swallowing asset errors. A candidate for its own ADR.
- Preserve an unparseable `jsonProperties` payload on import (ADR-2190-01).
- `AssetManager` rollback; check the file type by content.
- Detect truncated deflate entries.
- Observe and document the behaviour of Yjs when an exception interrupts the
  insertion, so the ADR can state the real guarantee instead of bounding it.
- Measure peak memory under a hostile archive and document the result; decide
  whether the synchronous decompression needs a worker.
- A per-session or per-document import budget.
- Deduplicate `generateId` (#1782).

## References

- [ADR-2193-01](ADR-2193-01-runtime-specific-elpx-import-limits.md) — the
  `importPolicy.ts` model reused here
- [ADR-2190-01](ADR-2190-01-preserve-malformed-idevice-properties-on-import.md)
  — malformed iDevice properties on import
- `public/app/yjs/ComponentImporter.js` and `ComponentImporter.test.js`
- `public/app/workarea/project/idevices/content/blockNode.js` and
  `blockNode.test.js`
- `public/app/yjs/YjsStructureBinding.js` — `moveComponentToBlock`
- `src/shared/import/importPolicy.ts` and `importPolicy.spec.ts`
- `src/shared/export/exporters/ComponentExporter.ts`
- `src/shared/ids.ts`
- `public/libs/fflate/fflate.umd.js` — generated from npm, not committed
- `test/e2e/import-content-into-block.spec.ts`
- Issue #2473; PR #2474; issues #1991 and #1782
