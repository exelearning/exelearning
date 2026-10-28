---
id: ADR-2473-01
title: Import single iDevice content (.idevice files) into an existing block
status: Proposed
date: 2026-09-27
tracking_issue: 2473
deciders: ["@franmate"]
reviewers: ["@erseco", "@ignaciogros", "@eXeLearningProject"]
related:
  prs: [2474]
  changes:[]
  adrs: ["ADR-2193-01"]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "GLM"
  model: "GLM-5.3-Flash"
---

# ADR-2473-01: Import single iDevice content (.idevice files) into an existing block

## Context

eXeLearning already exports and imports whole projects as `.elp`/`.elpx`
archives through `ElpxImporter`, with runtime-specific decompression limits
defined in the shared `src/shared/import/importPolicy.ts` module (see
ADR-2193-01). Individual blocks can also be exported as `.block`/`.idevice`
files — ZIP archives containing a `content.xml` in the same ODE format, plus
referenced assets — via `ComponentExporter`.

Until now, importing a `.idevice` file had a single global entry point that
created a **new** block appended to the end of the current page. Reusing a
shared `.idevice` inside a specific target block required importing it globally
and then manually moving or dragging the resulting iDevice into the desired
block (issue #2473).

`ComponentImporter` (`public/app/yjs/ComponentImporter.js`) is the counterpart
on the import side. It already supported `importComponent(file, targetPageId)`,
which creates a *new* block on a page from a `.block` file.
`importIdeviceIntoBlock(file, pageId, blockId)` extends it to insert the
component(s) from a `.idevice` file into the `components` array of an
*existing* block, instead of creating a new one. It is wired into the UI
through `IdeviceBlockNode.importIdeviceFileIntoBlock` and a dedicated "Import
content" button (`addBehaviourImportIdeviceButton`) on the block's action menu
(PR #2474).

The button is labelled **"Import iDevice"**

`ComponentImporter` unzips untrusted, user-supplied ZIP data
(`fflate.unzipSync`) and must not let a hostile archive exhaust memory. The
shared `importPolicy.ts` module exposes a distinct, component-scoped limits
tier, `COMPONENT_IMPORT_LIMITS`, alongside `CONSERVATIVE_ZIP_LIMITS` /
`DESKTOP_ZIP_LIMITS`. That tier is re-exported through the importers bundle
(`src/shared/import/index.ts`) as
`window.ExeImportPolicy.COMPONENT_IMPORT_LIMITS`, and `ComponentImporter`
consumes it via `resolveComponentLimits()`. `ComponentImporter` therefore runs
a **four-layer** guard on both `importComponent` and `importIdeviceIntoBlock`:

1. `validateCompressedSize(file)` rejects the file outright if its raw
   (compressed) size exceeds `maxFileBytes` (50 MiB in the shared tier),
   before it is read into memory at all.
2. `validateZipPreflight(uint8Data)` inspects the ZIP **central directory**
   (declared metadata only, no inflation) through
   `window.ExeImportPolicy.inspectZipArchive`, then runs
   `assertInspectionWithinLimits(inspection, limits, 'Component file')`
   against `COMPONENT_IMPORT_LIMITS`. An archive whose declared cumulative
   size (or, in principle, per-entry size or entry count) exceeds the tier is
   rejected *before* `unzipSync` is called. This is the same machinery
   `ElpxImporter` uses (ADR-2193-01); when the bundle is not loaded the
   preflight degrades to a no-op and the extraction filter plus the backstop
   still enforce the cumulative cap.
3. `unzipSync` is called with a `filter` built by `createDeclaredSizeFilter`,
   which runs **before each entry is inflated** and is handed that entry's
   *declared* uncompressed size (`info.originalSize`) by fflate. The filter
   accumulates a running total and, once it would exceed `maxTotalBytes`
   (200 MiB in the shared tier), returns `false` for that entry and every
   subsequent one — fflate then skips inflating (and allocating the output
   buffer for) the rejected entries entirely, and the violation is recorded
   on a shared `{ error }` object the caller checks right after `unzipSync`
   returns. This layer is the primary guard against a hostile archive that
   understates its central-directory sizes; the preflight cannot catch that
   case, because it trusts the same declared metadata.
4. As a backstop, `validateUncompressedSize(zip)` sums the *actual*
   decompressed `byteLength` of the entries fflate did inflate and rejects
   again if that total exceeds `maxTotalBytes` — this catches the case where
   an entry's declared size in the central directory understates its real
   inflated size (fflate still never allocates past the declared size per
   entry, so this backstop only ever sees bounded, already-capped output).

This matches the *shape* and, for the cumulative cap, the *strength* of
`ElpxImporter`'s defence (reject before an entry is fully inflated, not
after). The remaining differences versus `ElpxImporter` are deliberate and
documented in `COMPONENT_IMPORT_LIMITS` (ADR-2473-01):
`maxEntryBytes` equals `maxTotalBytes` (no additional per-entry constraint)
and `maxEntries` is `Number.MAX_SAFE_INTEGER` (no entry-count cap), because a
per-component budget is not a per-project budget.

## Problem

How do we let a user import a previously exported iDevice (`.idevice`, a ZIP
containing `content.xml` with one or more `odeComponent` entries) into a
specific, already-existing block, so that:

- the smaller, more frequently-used `.idevice`/single-component entry point
  gets ZIP-bomb protection that rejects before an entry is fully inflated,
  matching the shape (and, for the cumulative cap, the strength) of the
  protection already established for whole-project import (ADR-2193-01),
  while any remaining gap (no per-entry cap, no entry-count cap) is
  explicitly accepted and documented in the shared limits tier;
- importing the same file twice (or two collaborators importing concurrently)
  never collides on component identifiers inside the shared Yjs document;
- the insertion into the target block's `components` array is atomic from the
  point of view of other collaborators;
- asset references embedded in the component's HTML and JSON properties
  resolve correctly in the destination document, not the source one; and
- failures (bad ZIP, missing `content.xml`, malformed XML, missing target page
  or block) are reported to the user instead of silently corrupting the
  block?

## Decision drivers

- Collaboration safety: all document mutation must happen inside a single Yjs
  transaction, using the document's own `clientID`, so collaborators see one
  atomic change instead of partial state.
- No ID collisions: a `.idevice` file can be imported more than once, so
  component IDs embedded in the file cannot be trusted as unique inside the
  live document; every inserted component must get a fresh ID.
- Reuse over duplication: the parsing of `odeComponent` /
  `odeComponentsProperties` / `jsonProperties` and the asset-reference
  rewriting must stay compatible with the format already used by
  `importComponent` (new-block import) and `ComponentExporter`.
- Resource exhaustion: a `.idevice` file is user-supplied input and must not
  be allowed to exhaust browser memory, regardless of how its protection
  compares to `ElpxImporter`'s.
- Minimal surface change: add the new capability to the existing
  `ComponentImporter` class rather than introducing a second importer class
  for what is, structurally, the same file format at a smaller scope.
- Terminology clarity: "iDevice" already denotes two different things in
  eXeLearning (a block/box container, and a JavaScript component type); the
  UI label for this action must not reinforce that ambiguity or collide with
  a possible future "import iDevice-as-component" action.
- Component-level budgets are not project-level budgets: `.idevice` import is
  a repeatable, per-click action inside an already-open, collaboratively
  synced document, unlike `ElpxImporter`'s "open a whole project" entry point,
  which is typically invoked once per session. Any future limits for
  `ComponentImporter` must be set for that usage pattern and must not simply
  inherit `importPolicy.ts`'s project-level caps (see Risks).

## Options considered

### Option 1: Extend `ElpxImporter` / reuse `importPolicy.ts`'s numeric project caps end-to-end

Give `ComponentImporter.importIdeviceIntoBlock` the *numeric values* of
`importPolicy.ts`'s `CONSERVATIVE_ZIP_LIMITS` (500 MiB total / 200 MiB per
entry / 10 000 entries), the way `ElpxImporter` does, without introducing a
separate tier. Rejected: those limits were sized for "open one whole project
per session", not for a button a user can click repeatedly inside an
already-open, collaboratively synced document. Raising `ComponentImporter`'s
cap from 200 MiB to 500 MiB would not violate `importPolicy.ts` on any single
call, but would let repeated `.idevice` imports push several times that amount
of decompressed data into one live Yjs document per session, which then
propagates to every connected collaborator. The chosen approach (Option 2)
reuses `importPolicy.ts`'s *machinery* (preflight, structured errors, shared
validation) under a distinct, smaller, component-scoped limits tier — not its
project-scoped numeric values.

### Option 2: Reuse `importPolicy.ts` machinery under a distinct, component-scoped tier (chosen)

`ComponentImporter` consumes `COMPONENT_IMPORT_LIMITS` from the shared policy
(via `window.ExeImportPolicy`, see `resolveComponentLimits`) and runs the same
preflight `ElpxImporter` uses (`inspectZipArchive` +
`assertInspectionWithinLimits`), followed by its existing declared-size filter
and post-inflation backstop. The tier itself keeps the conservative
cumulative cap (200 MiB) and deliberately introduces no per-entry or
entry-count constraint (`maxEntryBytes == maxTotalBytes`,
`maxEntries = Number.MAX_SAFE_INTEGER`), matching the historical component
behaviour and the ADR-2473-01 rationale that a per-component budget is not a
per-project budget. When the policy bundle is not loaded, the preflight
degrades to a no-op and the extraction filter plus backstop still enforce the
same cumulative cap, so the component import path is safe in degraded mode
too. Chosen for this change.

### Option 3: Round-trip the file through the server to get back canonical JSON

Upload the `.idevice` file to a backend import endpoint and apply the returned
component JSON client-side. Rejected: the rest of the Yjs-based editing flow,
including whole-project import, is already client-side and offline-capable; a
mandatory server round-trip for this one action would be the only import path
that fails without connectivity, for no corresponding benefit.

## Evidence

- `ComponentImporter.importIdeviceIntoBlock(file, pageId, blockId)`
  (`public/app/yjs/ComponentImporter.js`) rejects a file whose name does not
  end in `.idevice` (case-sensitive comparison is avoided via
  `toLowerCase()`), rejects a file over `maxFileBytes` before reading it, and
  reports `fflate library not loaded`, `Invalid ZIP file: …`,
  `No content.xml found in component file`, `XML parsing error: …`,
  `Invalid component file: missing odeComponentsResources marker`, and the
  preflight's `Component file expands beyond the allowed size (…)` as
  distinct, specific failures rather than a generic error. `importComponent`
  (whole-block import) follows the identical size-check sequence.
- `resolveComponentLimits()` reads
  `window.ExeImportPolicy.COMPONENT_IMPORT_LIMITS` and validates its shape
  (`maxFileBytes`, `maxTotalBytes`, `maxEntryBytes` numbers, `maxEntries`
  integer) before returning it; otherwise it falls back to the local
  `MAX_COMPONENT_FILE_BYTES` / `MAX_COMPONENT_UNCOMPRESSED_BYTES` constants
  (documented in-code as a degraded-mode fallback that must be kept in sync).
  This is how `ComponentImporter` reaches the shared tier without importing
  `importPolicy.ts` directly (it is a plain browser script).
- `validateZipPreflight(uint8Data)` calls
  `window.ExeImportPolicy.inspectZipArchive(uint8Data, 'Component file')`
  followed by `assertInspectionWithinLimits(inspection, limits, 'Component
  file')`, and converts a `ZipLimitError` into a user-facing message; any
  other inspection failure falls through to `unzipSync`'s own error. When
  `window.ExeImportPolicy` is absent or lacks the two functions, it returns
  `null` and lets the extraction filter plus backstop enforce the cumulative
  cap. Both `importComponent` and `importIdeviceIntoBlock` call it before
  `unzipSync`.
- `createDeclaredSizeFilter(violation)` returns a closure passed as the
  `filter` option to `fflate.unzipSync`. fflate calls it once per entry,
  before inflating that entry, with an `info.originalSize` taken from the
  ZIP's declared (central-directory) size; the closure accumulates a running
  total and, once it would exceed `maxTotalBytes`, sets `violation.error` and
  returns `false` for that entry and every one after it (an early
  `if (violation.error) return false` short-circuits the rest of the archive
  once tripped). The caller checks `violation.error` immediately after
  `unzipSync` returns.
- `validateUncompressedSize(zip)` iterates the ZIP entries fflate *did*
  inflate and accumulates their actual `byteLength`, returning an error if
  that total still exceeds `maxTotalBytes` — a backstop for an archive whose
  central directory understates an entry's real inflated size, which the
  declared-size filter alone could not catch.
- `findPage(pageId)` matches a page by its `id` field, falling back to
  `pageId`, by scanning the navigation array; there is no id-based block
  lookup fallback at this call site beyond `findBlockInArray(blocksArray,
  blockId)`.
- `generateId('idevice')` is called unconditionally for every imported
  component, replacing both `comp.id` and `comp.ideviceId`, and the generated
  id is also propagated into `comp.properties.ideviceId` **only** when that
  nested value previously equalled the component's original id — an
  `ideviceId` embedded in `jsonProperties` that already diverged from the
  component's own id is left untouched. The generator's doc comment flags it
  as a manual mirror of `src/shared/ids.ts::generateId` that must be kept in
  sync by hand (issue #1782).
- Asset handling has two independent code paths: `convertAssetPaths` rewrites
  legacy/new-format `asset://uuid…` URLs using `this.assetMap` built from
  `assetManager.extractAssetsFromZip(zip)`, while `parseComponentFromXml` and
  `convertAssetPathsInObject` separately rewrite `{{context_path}}`
  references (in both `htmlView` and `jsonProperties`) through
  `assetManager.convertContextPathToAssetRefs`. Both paths are gated on
  `this.assetManager` being present; without an asset manager, import still
  succeeds and asset references are left as-is.
- `parseComponentStructureProperties` reads `<odeComponentsProperty>`
  key/value pairs from `<odeComponentsProperties>` (distinct from
  `jsonProperties`) and `createComponentYMap` stores them in the component's
  own `properties` Y.Map, matching the full-page import path so visibility,
  "teacher only" and custom CSS classes survive a re-import (issue #1991).
- The insertion itself happens inside `ydoc.transact(() => { … },
  ydoc.clientID)`: it looks up `blocksArray`/`blockMap` inside the callback,
  lazily creates the block's `components` Y.Array if absent, assigns
  `order = componentsArray.length` per inserted component, and sets an
  `inserted` flag used afterwards to distinguish "target block not found"
  from a genuine success.
- `src/shared/import/importPolicy.ts` exports
  `CONSERVATIVE_ZIP_LIMITS` / `DESKTOP_ZIP_LIMITS`,
  `COMPONENT_IMPORT_LIMITS`, `getZipLimitsForRuntime`, `validateZipLimits`,
  `assertInspectionWithinLimits` and the `ZipLimitError` family.
  `ComponentImporter` reaches `inspectZipArchive`,
  `assertInspectionWithinLimits`, `ZipLimitError` and
  `COMPONENT_IMPORT_LIMITS` through `window.ExeImportPolicy`, the namespace
  `src/shared/import/index.ts` publishes (`window.ExeImportPolicy` and
  `window.SharedImporters.importPolicy`).
- `public/app/workarea/project/idevices/content/blockNode.js` wires the
  feature through `IdeviceBlockNode.importIdeviceFileIntoBlock` (resolves the
  Yjs bridge's document manager and asset manager, instantiates
  `window.ComponentImporter`, calls `importIdeviceIntoBlock`, preloads
  assets, refreshes the page, alerts on error) and
  `addBehaviourImportIdeviceButton` (one-shot hidden
  `<input type="file" accept=".idevice">`, removed on `cancel` and on
  `change` before awaiting the import).
- The test suite pins this contract.
  `public/app/yjs/ComponentImporter.test.js` covers the preflight
  (`validateZipPreflight`) in its three outcomes, the shared tier
  (`resolveComponentLimits`, `validateCompressedSize`,
  `createDeclaredSizeFilter`, `validateUncompressedSize`), the layer ordering
  (a forged central-directory declared size must reject before
  `window.fflate.unzipSync` is ever called), real fflate integration against
  the vendored `public/libs/fflate/fflate.umd.js` bundle, Yjs atomicity
  (`runs the insertion inside a Yjs transaction with the doc clientID`),
  fresh component IDs, preservation of `odeComponentsProperties`, and every
  error path of `importIdeviceIntoBlock`.
  `public/app/workarea/project/idevices/content/blockNode.test.js` covers
  `addBehaviourImportIdeviceButton` and `importIdeviceFileIntoBlock`.
  `src/shared/import/importPolicy.spec.ts` pins `COMPONENT_IMPORT_LIMITS`
  (50 MiB compressed / 200 MiB cumulative, no additional per-entry or
  entry-count cap, still a valid `ZipDecompressionLimits`, still smaller than
  the conservative project total).
  `test/e2e/import-content-into-block.spec.ts` (Playwright) exercises the
  flow end to end, including asset resolution and paint of the fixture's
  image (`img.complete && img.naturalWidth > 0`).

## Decision

We extend `ComponentImporter` with `importIdeviceIntoBlock`, which inserts a
`.idevice` file's component(s) into an existing block's Yjs `components`
array, following the same structural conventions already used by
`importComponent` for whole-block import:

- **Size/ZIP-bomb protection** is aligned with `ElpxImporter`'s machinery
  while keeping a distinct, component-scoped limits tier:
  - a cheap pre-read compressed-size cap (`validateCompressedSize`,
    `maxFileBytes` = 50 MiB in the shared tier);
  - a **central-directory preflight** (`validateZipPreflight`) that calls
    `window.ExeImportPolicy.inspectZipArchive` +
    `assertInspectionWithinLimits` before any inflation, reusing the same
    code path as whole-project ELPX import (ADR-2193-01);
  - a per-entry `unzipSync` filter that rejects before inflation once the
    *declared* cumulative size would exceed `maxTotalBytes`
    (`createDeclaredSizeFilter`, 200 MiB in the shared tier);
  - a post-hoc backstop over the actually inflated bytes
    (`validateUncompressedSize`) for archives whose declared sizes understate
    reality.

  The tier itself (`COMPONENT_IMPORT_LIMITS` in `importPolicy.ts`) keeps the
  conservative cumulative cap and deliberately introduces no per-entry or
  entry-count cap (`maxEntryBytes == maxTotalBytes`,
  `maxEntries = Number.MAX_SAFE_INTEGER`), because a per-component budget is
  not a per-project budget.
- **Identity** is never trusted from the file: `generateId('idevice')` is
  called for every inserted component regardless of what `odeIdeviceId` the
  archive carried, so repeated or concurrent imports cannot collide inside
  the live Yjs document. The generated id is propagated into
  `properties.ideviceId` only when that nested value tracked the original
  component id one-for-one, so a deliberately-diverging `ideviceId` already
  present in `jsonProperties` is preserved as opaque application data.
- **Atomicity** is delegated to Yjs: the block lookup, lazy
  `components`-array creation, and all component inserts happen inside one
  `transact` call using the document's own `clientID`.
- **Asset handling** reuses the two existing conversion paths
  (`convertAssetPaths` for `asset://` URLs, `assetManager
  .convertContextPathToAssetRefs` for `{{context_path}}` references in both
  HTML and JSON properties) rather than introducing a third asset-rewriting
  mechanism; both are no-ops when no `assetManager` is supplied.
- **Component-level structure properties** (`visibility`, `teacherOnly`,
  `cssClass`) are parsed separately from `jsonProperties` and stored in the
  component's dedicated `properties` Y.Map, matching the full-page import
  path, so a re-imported `.idevice` does not silently lose them (issue
  #1991).
- **UI entry point**: the block's action menu exposes an "Import iDevice"
  entry that opens a file picker restricted to `.idevice` files and imports
  the selected file into that block.
- **Error reporting**: every failure path returns a specific, user-facing
  `{ success: false, error }` result (bad extension, oversized file, invalid
  ZIP, missing `content.xml`, malformed XML, missing marker, missing page,
  missing block, unexpected exception) instead of a generic failure, which
  `IdeviceBlockNode.importIdeviceFileIntoBlock` surfaces as a translated
  alert.

## Consequences

### Positive

- Users can move a single iDevice between pages, blocks, or even different
  eXeLearning projects by exporting it as `.idevice` and importing it back,
  without the heavier whole-project ELP/ELPX flow or creating an extra,
  unwanted block.
- The new path is structurally consistent with the existing `importComponent`
  (whole-block) import: same size checks, same preflight, same
  asset-conversion functions, same structure-properties handling — no new
  code paths to maintain for those concerns.
- Collaborative editing stays consistent: the insertion is atomic and never
  reuses foreign component IDs that could collide with another collaborator's
  work.
- The feature degrades gracefully without an asset manager and fails with a
  specific, actionable message on every other error path.
- `.idevice`/`.block` import shares `importPolicy.ts`'s preflight machinery
  and structured `ZipLimitError`, so the shared tier is the single source of
  truth and the local constants are only a documented degraded-mode fallback.

### Negative

- `.idevice` import (and `.block`-into-page import, which shares the same
  size-check functions) applies weaker ZIP-bomb protection than whole-project
  ELPX import on two axes: no per-entry cap
  (`maxEntryBytes == maxTotalBytes`) and no entry-count cap
  (`maxEntries = Number.MAX_SAFE_INTEGER`). Both are deliberate and
  documented in `COMPONENT_IMPORT_LIMITS`; they are not omissions.
- `ComponentImporter` still carries two local constants
  (`MAX_COMPONENT_FILE_BYTES` = 50 MiB, `MAX_COMPONENT_UNCOMPRESSED_BYTES` =
  200 MiB) that duplicate the shared tier's numeric values. They are only
  used when `window.ExeImportPolicy` is unavailable, and are documented
  in-code as a degraded-mode fallback that must be kept in sync.
- `generateId('idevice')` duplicates `src/shared/ids.ts::generateId` by hand
  (already flagged in-code, issue #1782); the two must be kept in sync
  manually.

### Neutral

- The `.idevice`-into-existing-block path and the `.block`-into-new-block
  path (`importComponent`) share `validateCompressedSize`,
  `validateZipPreflight`, `validateUncompressedSize`, `parseBlockFromXml`,
  `parseComponentStructureProperties`, `convertAssetPaths`,
  `convertAssetPathsInObject`, `createComponentYMap` and `generateId`; a
  change to any of these affects both import flows identically.

## Risks

- **No per-entry cap**: a single entry can legitimately declare up to just
  under the full 200 MiB cumulative cap, so `ComponentImporter` does not
  separately bound how large any one entry is allowed to be the way
  `importPolicy.ts`'s project tiers do.
  `COMPONENT_IMPORT_LIMITS.maxEntryBytes` is set equal to `maxTotalBytes` on
  purpose (ADR-2473-01), so this is a known, accepted scope choice rather
  than a gap left by accident.
- **No entry-count cap**: an archive with a very large number of tiny entries
  is not rejected on count alone; only the cumulative declared-size total is
  checked, entry by entry, as `unzipSync` processes them.
  `COMPONENT_IMPORT_LIMITS.maxEntries` is `Number.MAX_SAFE_INTEGER` on
  purpose (ADR-2473-01).
- **Declared-size trust, bounded**: `createDeclaredSizeFilter` and
  `validateZipPreflight` both trust declared central-directory metadata
  (which is in principle attacker-controlled). The preflight catches a large
  declared size early; the filter catches it entry by entry before inflation;
  and `validateUncompressedSize` catches an archive that understates its real
  inflated size. An archive that understates its declared size can still only
  produce truncated, bounded output, because fflate never grows an entry's
  output buffer past its declared size — this is why the backstop is a
  meaningful layer rather than redundant with the filter.
- **Limit drift**: `ComponentImporter`'s local fallback constants and
  `importPolicy.ts`'s `COMPONENT_IMPORT_LIMITS` are maintained in two places.
  The in-code comments flag the fallback as degraded-mode-only, but no test
  yet enforces that a future change to the shared tier reaches the local
  constants.
- **No per-session / per-document cumulative budget**: every limit discussed
  in this ADR, on both the `ComponentImporter` and `importPolicy.ts` side, is
  enforced per individual import call, not across the lifetime of an editing
  session. Nothing stops a user from invoking "Import iDevice" repeatedly on
  the same open, Yjs-synced document, each import staying under the per-call
  cap but the cumulative total growing unbounded over the session. Because
  the imported content is replicated to every connected collaborator through
  Yjs sync, this is not just a local-memory concern: repeated imports can
  force every participant's client to materialise an arbitrarily large amount
  of data over time, with no limit tied to the document itself. This risk
  would get strictly worse, not better, if `ComponentImporter`'s per-call cap
  were simply raised to match `importPolicy.ts`'s project-level 500 MiB
  instead of being set — and kept — at a smaller, component-scoped value.

## Validation

- Unit tests: `public/app/yjs/ComponentImporter.test.js` covers invalid ZIPs,
  missing or malformed `content.xml`, import with and without an asset
  manager, target page/block resolution, multi-component import with fresh
  unique IDs and consecutive order, preservation of
  `odeComponentsProperties` (issue #1991), transaction/`clientID` usage, and
  the error-message / message-less exception fallback paths of
  `importIdeviceIntoBlock`. It also covers the preflight
  (`validateZipPreflight`) in its three outcomes — passes, rejects with the
  canonical message, and degrades to `null` when the policy bundle is absent
  or the inspection fails for a non-policy reason — and the shared tier
  (`resolveComponentLimits`) when the bundle exposes it, is absent, is
  incomplete, or is missing entirely. The layer-order contract is asserted by
  a test that forges the central-directory declared size of an honest small
  ZIP and verifies that `window.fflate.unzipSync` (the extraction step) is
  never called. A `real fflate integration (vendored bundle)` suite exercises
  the `unzipSync` filter against `public/libs/fflate/fflate.umd.js`, the
  exact binary the app loads at runtime.
- Unit tests:
  `public/app/workarea/project/idevices/content/blockNode.test.js` covers
  `IdeviceBlockNode.importIdeviceFileIntoBlock` (missing-bridge alert,
  constructor wiring, `pageId` resolution fallback to the selected navigation
  node, preload-then-refresh ordering, alerting on a failed
  import/preload/refresh) and `addBehaviourImportIdeviceButton` (one-shot
  input creation and removal on cancel/change, no-op on an empty file list,
  safe handling of an input already detached before `change`).
- Unit tests: `src/shared/import/importPolicy.spec.ts` pins
  `COMPONENT_IMPORT_LIMITS` at 50 MiB compressed / 200 MiB cumulative
  uncompressed, asserts that it introduces no additional per-entry or
  entry-count cap (`maxEntryBytes === maxTotalBytes`,
  `maxEntries === Number.MAX_SAFE_INTEGER`), that it is a valid
  `ZipDecompressionLimits` object, and that it stays smaller than the
  conservative project total while leaving the project tiers untouched.
- E2E test: `test/e2e/import-content-into-block.spec.ts` (Playwright)
  creates a project, adds a text iDevice, locates the block, and imports a
  fixture `.idevice` from the block's actions menu. It asserts the imported
  component is appended to the **same** block (no new block is created) and
  that the fixture's image asset is resolved and fully painted
  (`img.complete && img.naturalWidth > 0`), proving asset extraction and
  rendering ran end-to-end for this flow. A second test asserts that the
  "Import iDevice" menu item is genuinely visible to a user.
- Manual: tested by `@cristinavaldera` against the deployed preview
  (`https://2473-add-import-content-idev.exelearning.pages.dev`), confirming
  components import directly into the target box without creating an extra
  one.
- Not yet covered (gap identified while writing this ADR): a test asserting
  that the local fallback constants (`MAX_COMPONENT_FILE_BYTES`,
  `MAX_COMPONENT_UNCOMPRESSED_BYTES`) stay numerically equal to
  `COMPONENT_IMPORT_LIMITS`, and a test that asserts the layer order
  (compressed-size → preflight → declared-size filter → inflated-size
  backstop) as a contract beyond the individual per-layer tests.

## Follow-up work

- Resolve issue #1782 (deduplicate `generateId` between
  `public/app/yjs/ComponentImporter.js` and `src/shared/ids.ts`) so the two
  implementations cannot drift apart silently.
- Add a regression test asserting the layer order of `ComponentImporter`'s
  size checks (compressed-size → central-directory preflight → declared-size
  filter → inflated-size backstop), so a future refactor that reorders or
  removes a layer is caught explicitly rather than by a change in behaviour
  alone.
- Add a test that asserts the local fallback constants
  (`MAX_COMPONENT_FILE_BYTES`, `MAX_COMPONENT_UNCOMPRESSED_BYTES`) stay equal
  to the corresponding fields of `COMPONENT_IMPORT_LIMITS`, so the
  degraded-mode fallback cannot silently diverge from the shared tier.
- Investigate a per-session or per-document cumulative import budget for
  repeatable, in-place actions like "Import iDevice" (as opposed to the
  current per-call-only limits). Because imported content is replicated to
  every connected collaborator via Yjs sync, repeated imports today have no
  ceiling on how much data one editing session can push into a shared
  document over time, regardless of how conservatively any single import's
  limit is set. This is out of scope for this change and needs its own design
  (where to track the counter, whether it resets per session or persists with
  the document, how to surface the limit to the user).
- Consider whether `COMPONENT_IMPORT_LIMITS` should ever grow a per-entry or
  entry-count cap. The current absence is deliberate (ADR-2473-01), but if
  the component import surface expands (e.g. `.block` files with many
  entries), the trade-off should be revisited explicitly rather than by
  accident.

## References

**Source files:**

- `public/app/yjs/ComponentImporter.js` — `importComponent`,
  `importIdeviceIntoBlock`, `resolveComponentLimits`, `validateZipPreflight`,
  `validateCompressedSize`, `createDeclaredSizeFilter`,
  `validateUncompressedSize`, `findBlockInArray`.
- `public/app/yjs/ComponentImporter.test.js` — unit tests for the four-layer
  guard and `importIdeviceIntoBlock`.
- `public/app/workarea/project/idevices/content/blockNode.js` —
  `IdeviceBlockNode.importIdeviceFileIntoBlock`,
  `addBehaviourImportIdeviceButton`.
- `public/app/workarea/project/idevices/content/blockNode.test.js` — unit
  tests for the "Import iDevice" menu action and the block-level import flow.
- `src/shared/import/importPolicy.ts` — `COMPONENT_IMPORT_LIMITS`,
  `CONSERVATIVE_ZIP_LIMITS`, `DESKTOP_ZIP_LIMITS`, `getZipLimitsForRuntime`,
  `validateZipLimits`, `assertInspectionWithinLimits`, `ZipLimitError`.
- `src/shared/import/importPolicy.spec.ts` — unit tests pinning the component
  tier.
- `src/shared/import/index.ts` — publishes `window.ExeImportPolicy` and
  `window.SharedImporters.importPolicy`.
- `src/shared/ids.ts` — `generateId` (the source that
  `ComponentImporter.generateId` mirrors by hand; see issue #1782).
- `public/libs/fflate/fflate.umd.js` — the vendored fflate build whose
  `unzipSync` filter contract the importer relies on.
- `test/e2e/import-content-into-block.spec.ts` — Playwright end-to-end
  coverage of the "Import iDevice" flow.

**Tracking:**

- Issue #2473 — Add "Import content" (.idevice) option to the box menu.
- PR #2474 — feat(box): allow importing .idevice content directly into an
  existing box (branch
  `2473-add-import-content-idevice-option-to-the-box-menu`).
- Issue #1991 — component structure properties lost on re-import.
- Issue #1782 — `generateId` duplicated between `ComponentImporter.js` and
  `src/shared/ids.ts`.
- ADR-2193-01 — Runtime-specific ELP/ELPX decompression limits (the
  `importPolicy.ts` model this ADR reuses for its component-scoped tier).
