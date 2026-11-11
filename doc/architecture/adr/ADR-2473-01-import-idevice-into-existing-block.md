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

eXeLearning exports and imports blocks and iDevices as `.block`/`.idevice` ZIP files through `ComponentExporter` and `ComponentImporter`. Until now, importing a `.idevice` always created a new block at the end of the page, so a teacher who wanted a shared activity inside a particular block had to import it globally and then drag it into place (issue #2473).

`ComponentImporter.importIdeviceIntoBlock(file, pageId, blockId)` appends the file's component(s) to an existing block instead, exposed as an **Import iDevice** entry in the block's action menu. The existing `importComponent(file, targetPageId)`, which imports a `.block` as a new block, keeps its behaviour. The file is untrusted ZIP data unzipped synchronously with `fflate.unzipSync`; `importPolicy.ts` already holds the limits used by whole-project import (ADR-2193-01), and this ADR adds a smaller tier for this action.

## Problem

How should a `.idevice` file be imported into an existing block so that the Yjs mutation is grouped for collaborators, ids cannot collide, asset references resolve in the destination document, memory exhaustion and UI freezes are less likely, and failures are handled without falsely reporting success or encouraging duplicate retries?

## Decision drivers

- **Collaboration safety.** The insertion must be grouped in a single Yjs transaction, with component preparation completed beforehand.
- **No id collisions.** A file can be imported twice; ids inside it cannot be trusted.
- **Reuse over duplication.** Parsing and asset rewriting stay compatible with `importComponent` and `ComponentExporter`.
- **Resource protection.** Reduce the risk of memory exhaustion and UI-thread freezes when processing untrusted archives, while documenting the limits of synchronous decompression.
- **Component budgets are not project budgets.** This is a repeatable action in a shared document, not a once-per-session project open.
- **Backward compatibility.** Preserve the existing import path and its acceptance policy.
- **No HTML injection through the error channel.** The file is untrusted, and the import error path reaches a sink that uses `innerHTML`.

## Options considered

**Option 1 — reuse the numeric project caps.** Give the new path the values of `CONSERVATIVE_ZIP_LIMITS` (500 MiB total, 200 MiB per entry, 10 000 entries). Pro: no second tier. Con: sized for "open one project per session"; clicked repeatedly in a shared document, it would push several times that data into the live Yjs document.

**Option 2 — reuse the machinery under a component-scoped tier (chosen).** Run the same preflight as `ElpxImporter`, then a declared-size filter and a backstop, against `COMPONENT_IMPORT_LIMITS`. Pro: same machinery and structured `ZipLimitError`; a budget sized for the usage. Con: a second tier to keep in sync.

**Option 3 — round-trip the file through the server.** Pro: server-side validation. Con: the rest of the editing flow is client-side and offline-capable; this would be the only import that fails without connectivity.

## Evidence

Facts refer to the PR head after review #2474, by function name. Exact message strings, cleanup timing and the fflate measurement live in the tests and the PR description.

- **Tier.** `COMPONENT_IMPORT_LIMITS` in `src/shared/import/importPolicy.ts`: `maxFileBytes` 50 MiB, `maxTotalBytes` 200 MiB, `maxEntryBytes` equal to the total (no extra per-entry cap), `maxEntries` 10 000, the same value as the project tiers.
- **Guard order.** `readComponentZip(file, { withLimits })` runs `validateCompressedSize`, `validateZipPreflight`, `unzipSync` with `createDeclaredSizeFilter`, and `validateUncompressedSize`. The entry count is checked during preflight when the policy is available, and again by the filter, so the cap also applies in degraded mode. `validateZipPreflight` and the filter trust the central directory; an archive that understates its sizes is bounded per entry by fflate and, in total, by the backstop after inflation.
- **Two flows, two policies.** `importIdeviceIntoBlock` uses `withLimits: true`; `importComponent` keeps `withLimits: false` and its historical unlimited behaviour (review #2474, point 5).
- **No HTML injection.** `parseComponentXml` returns the generic `"The component XML is not valid"` and logs the parser's `textContent` to `console.error`. Interpolating it would reach `modals.alert.show({ body })` → `Modal.setBody` `innerHTML = body` (`modal.js:411`) and execute an attribute such as `<img src=x onerror=…>` from a malformed `.idevice` (review #2474, point 1). The sink itself is tracked in #2653.
- **Ids.** `generateId('idevice')` replaces `comp.id` and `comp.ideviceId`, and reaches `properties.ideviceId` only when that value equalled the original id. `generateId` mirrors `src/shared/ids.ts` by hand (#1782).
- **Insertion.** Component Y.Maps are built before the transaction; one `ydoc.transact(..., ydoc.clientID)` re-resolves **both the page and the block**, creates `components` if absent and pushes them. Re-resolving the page, not only the block, closes the race a deleted page would otherwise leave open (review #2474, point 2). Orders are `max existing order + 1 + i`, the rule `moveComponentToBlock` uses; `findBlockInArray` matches either `id` or `blockId`, because the two fields can diverge (review #2474, point 7).
- **Assets.** User data is validated before any asset is stored; assets are extracted and `{{context_path}}` references converted before the component Y.Maps are built, because the maps copy the strings at build time. A storage failure returns before the Y.Doc is touched, so the user can retry. A page or block deleted *while* the assets are being stored leaves them unreferenced; closing that needs an asset-deletion API in `AssetManager` (review #2474, point 4).

## Decision

We will import a `.idevice` file into the block the user chose, grouping the Yjs mutation in a single transaction, with these rules:

1. **Size protection applies to this path only.** `importComponent` stays unlimited for now; hardening it is out of scope and needs its own design discussion (review #2474, point 5, see Follow-up work).
2. **The entry count is capped at 10 000** in the preflight and in the filter, because `unzipSync` is synchronous and many tiny entries can freeze the editor. The preflight picks the message from `ZipLimitError.details.kind`, so an entry-count rejection says `"too many entries"` (review #2474, point 3).
3. **Every component gets a fresh id**, and the nested `ideviceId` is rewritten only when it tracked the original one-for-one.
4. **Component maps are prepared before the transaction**, which groups the insertion for Yjs observers; there is no explicit rollback strategy for exceptions.
5. **The transaction re-resolves the page and the block**, so a collaborator deleting either while the file is read causes a clean `"Target block not found"` instead of a silent write into a detached subtree (review #2474, point 2).
6. **Orders follow `max existing order + 1 + i`**, not the array length.
7. **Assets are extracted before the component Y.Maps are built**, so the `{{context_path}}` conversion reaches the Y.Doc. A failure before or during extraction stores nothing; a failure after extraction leaves assets unreferenced (review #2474, point 4, see Follow-up work).
8. **Untrusted text from the file is not interpolated into user-facing messages.** The malformed-XML error is a generic string; the parser's detail goes to `console.error` (review #2474, point 1). The import handler in `blockNode.js` applies the same rule at the display layer: its `catch` shows a fixed message (`"An error occurred while importing the component."`) instead of `error.message` and logs the detail to `console.error`, so whatever the importer returns in `error` never reaches `modals.alert.show({ body })` on this flow (review #2474, point 1; sink tracked in #2653).
9. **The pre-existing `importComponent` flow keeps its historical, unlimited behaviour.** This is deliberate, documented here, and pinned by four compatibility tests in `ComponentImporter.test.js`; the shared `readComponentZip(file, { withLimits })` helper makes the future hardening a one-line flip (review #2474, point 5).

## Consequences

### Positive

- A single activity moves between blocks, pages or projects without an extra block.
- The insert is grouped for Yjs observers, and ids are fresh.
- Failures a user could act on wrongly are mitigated: user-data failures happen before any asset is stored, a storage failure is reported before the Y.Doc is touched (safe to retry), and a retry after a refresh failure is discouraged by the UI, reducing duplicate content.
- A collaborator deleting the page or block while the file is read produces a clean error rather than a silent write into a detached subtree.
- A malformed `content.xml` cannot inject HTML into the error modal.
- The entry-count cap reduces the risk of UI-thread freezes from archives with many entries; it does not guarantee that synchronous decompression cannot block the editor (see Risks).
- The existing `.block` import path retains its historical policy; shared preparation changes may still affect both flows and are covered by compatibility tests.

### Negative

- **The two import flows have different protection.** `.idevice`-into-block is guarded; `.block`-into-page accepts any size. Deliberate, pinned by four compatibility tests.
- No per-entry cap (`maxEntryBytes == maxTotalBytes`); weaker than the project tiers.
- Two local constants and `generateId` duplicate shared code and are kept in sync by hand.
- The extraction runs before the insert, so a concurrent deletion leaves assets unreferenced (see Follow-up work).
- The export button in `blockNode.js` has the same `isAvalaibleOdeComponent(...).then(...)` shape without a `.catch`; pre-existing and out of scope (review #2474, point 6).
- The `Modal.setBody` `innerHTML = body` sink (#2653) remains; this PR closes the only route from file content to it.

### Neutral

- Both flows share `readComponentZip`, `parseComponentXml`, `regenerateComponentIds` and `createComponentYMap`; a change to any of them affects both.

## Risks

### Accepted for this change

- **Unguarded `.block` import.** Likelihood medium, severity medium: a large or hostile `.block` is unzipped without limits. Accepted to avoid regressions (review #2474, point 5).
- **No per-entry cap.** A single entry may declare up to just under the cumulative cap.
- **No per-session budget.** Limits are per call, so repeated imports into a synced document are unbounded in total.
- **File type by name only.** A renamed `.block` imports all its components into the block.
- **Residual `innerHTML` sink.** The `modals.alert.show({ body })` → `Modal.setBody` path (#2653) remains; this PR closes the route from file content, but a future caller could reopen it.

### Needs investigation

- **Peak memory under a hostile archive.** The post-decompression check cannot prevent a peak that has already happened, and `unzipSync` is synchronous. No measurement is recorded; a systematic check belongs with the fflate pinning test.
- **Behaviour of Yjs when an exception interrupts the insertion.** The transaction groups the insertion, but the ADR does not claim, and the tests do not yet establish, whether Yjs reverts the changes pushed before an exception.

## Validation

- `ComponentImporter.test.js` covers the guard order, invalid ZIPs and malformed XML, page and block resolution, fresh ids, sparse orders, `clientID` transaction, no asset extraction on user-data failures, no write when a component fails to build, preflight and tier resolution, a forged central directory, the re-resolved page, `findBlockInArray` with divergent ids, and real fflate against the vendored bundle.
- `blockNode.test.js` covers availability refusal and rejection, one-shot input cleanup, empty and detached inputs, two independent clicks, refresh-failure reporting, the fixed import-error message on every failure path, and a regression test in which an importer error containing `<img src=x onerror=…>` never reaches the alert body (#2653).
- `importPolicy.spec.ts` pins `COMPONENT_IMPORT_LIMITS` and keeps the project tiers untouched.
- `test/e2e/import-content-into-block.spec.ts` covers no new block, image resolved, menu entry visible, and invalid ZIP showing "Import error" with the project unchanged.
- Compatibility: four tests in `ComponentImporter.test.js` pin the unlimited `importComponent` flow.
- Not covered yet: the file-type-by-name-only case, a peak-memory measurement, and the Yjs document state after an insertion throws.

## Follow-up work

- **Asset cleanup for the mid-import deletion case.** Needs an asset-deletion API in `AssetManager` that reports which asset ids an import created and deletes them if the insert is refused. Out of scope (review #2474, point 4).
- **Apply the component limits to `importComponent`.** Exit criterion: a corpus of existing `.block` files must import identically with `withLimits: true` and `withLimits: false` before the flip. Out of scope (review #2474, point 5).
- **Add a `.catch` to the export button in `blockNode.js`.** Out of scope (review #2474, point 6).
- **Fix the `Modal.setBody` `innerHTML = body` sink (#2653).**
- **Measure peak memory under a hostile archive** and decide whether synchronous decompression needs a worker; observe and document the Yjs behaviour when an insertion throws.
- **Make `ComponentExporter` fail** instead of producing a file the importer rejects, and stop swallowing asset errors. Candidate for its own ADR.

## References

- [ADR-2193-01](ADR-2193-01-runtime-specific-elpx-import-limits.md) — the `importPolicy.ts` model reused here
- [ADR-2190-01](ADR-2190-01-preserve-malformed-idevice-properties-on-import.md) — malformed iDevice properties on import
- `public/app/yjs/ComponentImporter.js` and `ComponentImporter.test.js`
- `public/app/workarea/project/idevices/content/blockNode.js` and `blockNode.test.js`
- `public/app/yjs/YjsStructureBinding.js` — `moveComponentToBlock`
- `src/shared/import/importPolicy.ts` and `importPolicy.spec.ts`
- `src/shared/export/exporters/ComponentExporter.ts`
- `src/shared/ids.ts`
- `public/libs/fflate/fflate.umd.js` — generated from npm, not committed
- `test/e2e/import-content-into-block.spec.ts`
- Issue #2473; PR #2474; issues #1991, #1782 and #2653
