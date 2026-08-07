---
id: ADR-1858-01
title: "Restore File Attachment as a JSON api-v3 Media-Library-backed iDevice"
status: Proposed
date: 2026-07-09
tracking_issue: 1858
legacy_id: ADR-0035
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
  - "@cristinavaldera"
  - "@mnunezcedec"
related:
  prs: [2011]
  changes: ["1858-file-attachment-restoration"]
  adrs: [ADR-1858-02, ADR-1858-03, ADR-1858-04]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-1858-01: Restore File Attachment as a JSON api-v3 Media-Library-backed iDevice

## Context

eXeLearning 2.x shipped a "File Attachments" iDevice that let authors attach one
or more downloadable files (worksheets, PDFs, spreadsheets, archives) to a page.
The rewrite to the Bun/Elysia/Yjs stack in eXeLearning 4.0 dropped this iDevice:
there is no `file-attachment` type under `public/files/perm/idevices/base/`, and
legacy `FileAttachIdevice` / `FileAttachIdeviceInc` / `AttachmentIdevice`
components were remapped to plain `text` on import, silently degrading the
download list into inert HTML. Issue #1858 tracks this as a feature-request
regression.

The modern architecture already provides the building blocks a restored iDevice
needs: a Media Library / File Manager modal (`eXeLearning.app.modals.filemanager`)
for selecting and uploading files, an `AssetManager` (reachable via
`eXeLearning.app.project._yjsBridge.assetManager`) that owns binary assets and
mints stable `asset://<uuid>.<ext>` references, and a JSON iDevice contract
(`component-type: json`, `api-version: 3.0`) used by `casestudy`,
`image-gallery`, `magnifier`, and others. Restoring the feature should reuse
those primitives rather than reintroduce a bespoke upload/storage path.

## Problem

How should the File Attachment feature be reintroduced on the 4.x stack — as what
kind of iDevice, backed by what storage, and using which authoring surface — so
that authors can attach downloadable files again without inventing a parallel
asset pipeline?

## Decision drivers

- **Feature parity** with eXeLearning 2.x (multiple files, per-file description,
  instructions, downloadable links).
- **Reuse the existing asset pipeline** (Media Library + AssetManager) rather
  than duplicating upload/storage logic — single source of truth (AGENTS.md §1).
- **Fit the established JSON iDevice contract** so preview, export, collaboration
  and legacy import all work through existing plumbing.
- **Client-is-source-of-truth** architecture: state lives in the Y.Doc, binaries
  live in the Media Library.
- **Maintainability**: no framework, vanilla JS in `public/files/perm/idevices/`.
- **Testability**: colocated Vitest specs plus a Playwright flow.

## Options considered

### Option 1: Restore as a JSON (`api-version 3.0`, `component-type json`) iDevice backed by the Media Library (chosen)

A new `file-attachment` iDevice under
`public/files/perm/idevices/base/file-attachment/` with edition + export JS/CSS,
an export HTML template, and a `config.xml` declaring the JSON contract. Files are
selected/uploaded through the existing File Manager modal (or a native
`<input type=file>` fallback), stored as `asset://` references, and rendered from
`jsonProperties` at view time.

- Pros: reuses the Media Library and AssetManager; fits the same edit → save →
  export path as other JSON iDevices; state travels in the Y.Doc for collab and
  ELPX round-trips; no new server endpoints.
- Cons: requires wiring the iDevice against internal AssetManager APIs that have
  no dedicated change event (worked around by observing the shared Yjs map — see
  ADR-1858-04).

### Option 2: Keep mapping legacy attachments to `text` (status quo)

Leave the 4.0 behaviour in place.

- Pros: zero work.
- Cons: this *is* the regression in #1858 — download semantics, per-file
  metadata, and the "attach a file" authoring affordance are all lost; new
  authors cannot create attachment lists at all.

### Option 3: Reuse the existing `download-source-file` iDevice

Route attachments through the `download-source-file` type.

- Pros: an existing "download" iDevice.
- Cons: semantic mismatch — `download-source-file` renders a fixed descriptive
  table plus a button that downloads the whole exported `.elpx` source package,
  entirely into `htmlView` with no JSON state and no notion of multiple
  author-chosen files (see `doc/elpx-format/idevices/catalog.md`). It cannot
  represent an arbitrary list of attachments.

### Option 4: Store uploaded binaries inline in `jsonProperties` (base64)

Embed file bytes directly in the component state.

- Pros: self-contained component.
- Cons: bloats the Y.Doc and every snapshot; defeats asset de-duplication;
  contradicts the asset architecture (binaries belong in the Media Library, not
  in document state). Rejected — see ADR-1858-02 for the reference model chosen
  instead.

## Evidence

All paths verified on branch `1858-feature-request-regression-restore-the-file-attachment-idevice-removed-in-exelearning-40` (PR #2011).

- iDevice declaration: `public/files/perm/idevices/base/file-attachment/config.xml`
  — `<name>file-attachment</name>`, `<api-version>3.0</api-version>`,
  `<component-type>json</component-type>`,
  `<category>Information and presentation</category>`, `<downloadable>0</downloadable>`,
  edition/export JS+CSS filenames and
  `<export-template-filename>file-attachment.html</export-template-filename>`.
- Authoring code: `public/files/perm/idevices/base/file-attachment/edition/file-attachment.js`
  — `openFileManager()` calls `eXeLearning.app.modals.filemanager.show(...)`;
  `getAssetManager()` resolves `eXeLearning.app.project._yjsBridge.assetManager`;
  `uploadFile()` calls `assetManager.insertImage(file)`; `save()` returns
  `{ ideviceId, intro, showDescriptions, attachments }`.
- Export code: `public/files/perm/idevices/base/file-attachment/export/file-attachment.js`
  — `renderView(data, accesibility, template)` builds the download list from
  `jsonProperties` and injects it into `{content}`.
- Export template: `public/files/perm/idevices/base/file-attachment/export/file-attachment.html`.
- Icon: `public/files/perm/idevices/base/file-attachment/file-attachment-icon.svg`.
- JSON-only registration: `public/app/common/exe_export.js` adds `'file-attachment'`
  to the `jsonOnlyIdevices` array (so a legacy/empty `htmlView` still renders from
  JSON).
- Catalog/patterns docs: `doc/elpx-format/idevices/catalog.md` (new `file-attachment`
  row and `### file-attachment` section) and `doc/elpx-format/idevices/patterns.md`
  (adds `file-attachment` to the Standard JSON pattern list).
- Tests present on the branch:
  `public/files/perm/idevices/base/file-attachment/edition/file-attachment.test.js`
  (Vitest, authoring form/add/save/round-trip),
  `public/files/perm/idevices/base/file-attachment/export/file-attachment.test.js`
  (Vitest, render/escape/behaviour),
  `test/e2e/playwright/specs/idevices/file-attachment.spec.ts`
  (Playwright: add iDevice, upload via Media Library, save, download link renders
  in view and preview).

## Decision

We will restore File Attachment as a first-class JSON iDevice named
`file-attachment` (`api-version 3.0`, `component-type json`, category
"Information and presentation"), living at
`public/files/perm/idevices/base/file-attachment/`. Authors add files through the
existing Media Library / File Manager modal (with a native file-input fallback),
files are stored via the shared `AssetManager`, and the iDevice keeps its state in
`jsonProperties`. The reference/storage model is specified in ADR-1858-02, the legacy
import remap in ADR-1858-03, and the resilience/accessibility behaviour in ADR-1858-04.

## Consequences

### Positive

- Restores eXeLearning 2.x feature parity (multiple files, instructions,
  per-file title/description, download links) on the modern stack.
- Reuses the Media Library and AssetManager — no parallel upload/storage path and
  no new server endpoints.
- Behaves like every other JSON iDevice for preview, export, collaboration and
  ELPX round-trips.

### Negative

- Couples the iDevice to internal AssetManager/File Manager APIs
  (`_yjsBridge.assetManager`, `modals.filemanager`) that are not a formal public
  contract; changes there can ripple into this iDevice.
- The AssetManager exposes no dedicated "asset changed" event, forcing the
  edition code to observe the shared Yjs assets map (see ADR-1858-04).

### Neutral

- Adds a new entry to the iDevice catalog and to the `jsonOnlyIdevices` allow-list.
- The legacy `download-source-file` iDevice remains, now with no legacy class
  mapped to it (that mapping moves to `file-attachment` — see ADR-1858-03).

## Risks

- **Internal-API drift** (medium likelihood, medium severity): the iDevice depends
  on `eXeLearning.app.project._yjsBridge.assetManager` and
  `eXeLearning.app.modals.filemanager`. Mitigation: a native `<input type=file>`
  fallback in `openFileManager()`/`uploadFile()` and defensive null-checks
  (`getFileManager()`, `getAssetManager()`).
- **Feature-scope creep**: reviewers may expect drag-and-drop, folders, or size
  limits. Out of scope for the restoration; tracked separately if desired.

## Validation

- Vitest edition + export specs cover add/remove/reorder, save
  round-trip, and rendering.
- The Playwright spec `test/e2e/playwright/specs/idevices/file-attachment.spec.ts`
  drives the real Media Library upload and asserts a working download link in both
  the iDevice view and the preview panel.
- Manual check: the iDevice appears under "Information and presentation" in the
  iDevice picker and survives an ELPX export/import round-trip.

## Follow-up work

- Consider a formal AssetManager change-event API so iDevices no longer need to
  observe the raw Yjs map (see ADR-1858-04 follow-ups).
- Evaluate optional enhancements (drag-and-drop upload, per-attachment size
  display refinements) after the restoration lands.

## References

- Issue #1858 — File Attachment iDevice regression.
- PR #2011 — restore the File Attachment iDevice.
- the #1858 change design — File Attachment iDevice Restoration.
- ADR-1858-02, ADR-1858-03, ADR-1858-04 — sibling decisions.
- `doc/elpx-format/idevices/catalog.md`, `doc/elpx-format/idevices/patterns.md`,
  `doc/elpx-format/idevices/snippets.md`.
- `.agents/skills/idevice/SKILL.md` — iDevice authoring contract.
