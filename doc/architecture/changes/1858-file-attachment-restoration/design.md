---
tracking_issue: 1858
title: "File Attachment iDevice Restoration"
status: implemented
date: 2026-07-09
legacy_id: SDD-0009
authors:
  - "@erseco"
reviewers:
  - "@ignaciogros"
  - "@cristinavaldera"
  - "@mnunezcedec"
implementation_prs: [2011]
related_prs: [2149]
related_adrs: [ADR-1858-01, ADR-1858-02, ADR-1858-03, ADR-1858-04]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# File Attachment iDevice Restoration — design

> Historical record. This document was written as `SDD-0009` and is preserved
> whole as the design record for the [#1858](https://github.com/exelearning/exelearning/issues/1858)
> change. See [`doc/architecture/changes/README.md`](../README.md) for the
> current change-document model.

## Summary

eXeLearning 2.x let authors attach one or more downloadable files to a page. The
4.0 rewrite dropped this iDevice and remapped legacy attachments to plain `text`,
losing the download links and per-file metadata (issue #1858). This SDD describes
the restoration of a first-class `file-attachment` JSON iDevice on the
Bun/Elysia/Yjs stack: authors add files through the existing Media Library, files
are stored as stable `asset://` references in `jsonProperties`, and each
attachment renders as an accessible download link in the editor, preview, and
every export target. Legacy `FileAttachIdevice` / `FileAttachIdeviceInc` /
`AttachmentIdevice` components now import as this iDevice instead of `text`.

## Problem statement

Educators who relied on the File Attachments iDevice have no way to attach
downloadable files in eXeLearning 4.x, and their existing courses lose that
content on import (it becomes inert `text`). The fix must restore the authoring
capability *and* migrate legacy content, without inventing a second asset pipeline
alongside the Media Library.

## Goals

- Restore an authoring iDevice for one-or-more downloadable file attachments with
  optional instructions and per-file title/description.
- Reuse the Media Library / AssetManager for file selection, upload and storage.
- Store attachments as stable `asset://` references that resolve correctly in
  editor, preview, collaboration, ELPX round-trip, and export.
- Import legacy `FileAttachIdevice` / `FileAttachIdeviceInc` / `AttachmentIdevice`
  as the restored iDevice, preserving files, instructions and descriptions.
- Fail safe on missing/renamed assets; be keyboard- and screen-reader-accessible;
  escape author-controlled fields.
- Ship with colocated unit tests, an integration test, and a Playwright E2E spec.

## Non-goals

- Drag-and-drop upload, upload size limits/quotas, or folder organization.
- A new server-side upload or storage endpoint (the Media Library already owns
  this).
- Changes to the shared HTML sanitizer or to the `download-source-file` iDevice.
- Reworking the AssetManager's event model (only observing what exists today).

## Current state

- **Before this work**: no `file-attachment` iDevice exists under
  `public/files/perm/idevices/base/`; `src/shared/import/LegacyXmlParser.ts` listed
  `FileAttachIdevice` and `AttachmentIdevice` in its `textBasedIdevices` array, and
  `src/shared/import/legacy-handlers/HandlerRegistry.ts` mapped the three legacy
  classes to `text` — the regression captured in #1858.
- **Existing plumbing reused**: the JSON iDevice contract
  (`component-type: json`, `api-version: 3.0`) shared by `casestudy`,
  `image-gallery`, `magnifier`, etc.; the Media Library modal
  (`eXeLearning.app.modals.filemanager`); the `AssetManager`
  (`eXeLearning.app.project._yjsBridge.assetManager`) and its `asset://`
  references; the export rewrite in
  `src/shared/export/renderers/IdeviceRenderer.ts`; and the import rewrite in
  `src/shared/import/ElpxImporter.ts` (`convertAssetPathsInObject` /
  `findAssetUrlForPath`).

## Proposed design

Add a `file-attachment` JSON iDevice and route legacy attachments to it.

```
Authoring (public/files/perm/idevices/base/file-attachment/edition/file-attachment.js)
  Add file → Media Library modal (or native <input> fallback)
           → AssetManager mints asset://<uuid>.<ext>
  save() → jsonProperties { ideviceId, intro, showDescriptions, attachments[] }

State (Y.Doc, per component)
  jsonProperties.attachments[i] = { url: asset://<uuid>.<ext>,
                                    filename, mimeType, size, title, description }

Rendering (public/.../export/file-attachment.js)
  renderView()      → build download list HTML from jsonProperties into template
  renderBehaviour() → editor/preview: resolve asset:// → blob: via AssetManager
  export pipeline   → IdeviceRenderer rewrites asset://uuid.ext → content/resources/…

Legacy import (src/shared/import/legacy-handlers/FileAttachHandler.ts)
  FileAttachIdevice/Inc, AttachmentIdevice
    → getTargetType() 'file-attachment'
    → { intro, showDescriptions, attachments[] }, url = resources/<file>
    → ElpxImporter rewrites resources/<file> → asset://
```

The reference/storage model is specified in ADR-1858-02; the legacy remap in
ADR-1858-03; the resilience/accessibility behaviour in ADR-1858-04; the overall
iDevice-restoration decision in ADR-1858-01.

## User experience

- **Author**: adds the "File attachment" iDevice from the "Information and
  presentation" category. An empty state reads "No files attached yet." Clicking
  **Add file** opens the Media Library to select or upload files; each selected
  file appears as a row showing an extension-labelled icon and filename. A
  collapsible per-row "Title and description" panel (collapsed by default) lets the
  author override the label and add a description. Rows can be reordered (up/down)
  and removed. A collapsible "Instructions" TinyMCE panel and a "Show file
  descriptions to learners" toggle control the presentation. If a referenced file
  is renamed in the Media Library the row updates live; if it is deleted the row is
  flagged missing with a re-add prompt.
- **Learner (export/preview)**: sees optional instructions followed by a list of
  download links, each with a file-type icon, a label (author title or filename), a
  meta line (filename · size when known), and an optional description. A
  screen-reader announces "Download <label>". A missing asset renders as a
  non-clickable "File unavailable" placeholder rather than a broken link.

## Technical design

Files added under `public/files/perm/idevices/base/file-attachment/`:

- `config.xml` — declares `name file-attachment`, `api-version 3.0`,
  `component-type json`, category "Information and presentation",
  `downloadable 0`, edition/export JS+CSS, and
  `export-template-filename file-attachment.html`.
- `edition/file-attachment.js` — `init` → `createForm`/`observeAssetChanges`;
  `openFileManager`/`uploadFile`/`addAttachmentFromAsset`; `save` →
  `{ ideviceId, intro, showDescriptions, attachments }`; row reconciliation
  (`refreshRowFromAsset`, `setRowMissing`); `escapeHtml`/`escapeAttr`.
- `edition/file-attachment.css`, `export/file-attachment.css`.
- `export/file-attachment.js` — `renderView` (build list into `{content}`),
  `renderBehaviour` (resolve `asset://`→`blob:` in editor/preview),
  `getFileCategory`/`getFileIconSvg`/`formatFileSize`/escaping.
- `export/file-attachment.html` — template with the `{content}` marker.
- `file-attachment-icon.svg` — picker icon.

Registration/wiring changes:

- `public/app/common/exe_export.js` — `'file-attachment'` added to
  `jsonOnlyIdevices` (renders from JSON even with an empty `htmlView`).
- `src/shared/import/legacy-handlers/FileAttachHandler.ts` — new handler.
- `src/shared/import/legacy-handlers/HandlerRegistry.ts` — `LEGACY_TYPE_MAP`
  entries and registration order (before `FreeTextHandler`).
- `src/shared/import/LegacyXmlParser.ts` — legacy attachment classes removed from
  `textBasedIdevices`.

## Data model

`jsonProperties` (stored per component in the Y.Doc; `htmlView` is empty for this
JSON-only iDevice):

```json
{
  "ideviceId": "20251027202947FILEAT",
  "intro": "<p>Download the materials below.</p>",
  "showDescriptions": true,
  "attachments": [
    { "url": "asset://<uuid>.pdf", "filename": "worksheet.pdf",
      "mimeType": "application/pdf", "size": 123456,
      "title": "Activity worksheet", "description": "Print before class." }
  ]
}
```

- `url` is the stable Media Library reference (`asset://<uuid>.<ext>`); the binary
  asset is the source of truth (ADR-1858-02).
- `filename`/`mimeType`/`size` are a display + fallback snapshot; `size`/`mimeType`
  may be `0`/empty when the source does not provide them.
- On export, `url` is rewritten to `content/resources/<exportPath>`. The full
  shape is documented in `doc/elpx-format/idevices/snippets.md`.

## Migration and compatibility

- Legacy `FileAttachIdevice` / `FileAttachIdeviceInc` / `AttachmentIdevice` import
  as `file-attachment` (ADR-1858-03); the legacy per-file `fileDescription` maps to
  the attachment `title`, `introHTML` to `intro`, `showDesc` to `showDescriptions`
  (default `true`).
- Legacy `resources/<filename>` paths are rewritten to `asset://` by
  `ElpxImporter.convertAssetPathsInObject` once the binary is registered; import
  does not crash when the binary is absent (filename/title are preserved).
- No forward rollback concern: the iDevice is additive. Projects saved with a
  `file-attachment` component opened in a build without the iDevice would fall back
  to the generic JSON-render path, but this is the same-version target.

## Security and privacy

- Threat model: attachment `title`, `description`, `filename` and the icon label
  are author- or legacy-file-controlled. Both the edition and export renderers
  apply `escapeHtml`/`escapeAttr` to these fields, so they are not an HTML/script
  injection vector.
- `intro` is authored via TinyMCE and emitted as raw HTML (consistent with other
  rich-text iDevice fields); its sanitization is delegated to the project's shared
  HTML sanitizer, not re-asserted by this iDevice. Residual risk: a gap in that
  shared sanitizer would surface here as elsewhere.
- The persisted `url` is expected to be an `asset://` reference minted by the
  AssetManager; the export rewrite only transforms `asset://`/`resources` forms. A
  hand-edited or hostile ELPX could carry a different scheme in `url` that would be
  emitted as an `href` — the normal Media Library flow never produces this, but the
  iDevice does not itself enforce a scheme allow-list on `url`. See ADR-1858-04 for
  the full residual-risk statement.
- No new PII, secrets, auth surface, or server endpoints are introduced; file
  storage remains the existing per-project Media Library asset store.

## Accessibility

- Export link text carries a visually hidden "Download" prefix (`exe-sr-only`);
  decorative icons use `aria-hidden`; links use the `download` attribute; CSS
  provides `:focus`/`:focus-visible` styles.
- Authoring controls: reorder/delete buttons have `aria-label`; the collapsible
  title/description panel uses `aria-expanded`; the instructions textarea has an
  `aria-label`.
- Icons are dependency-free inline SVG (no icon font), so they render in every
  export target. Details in ADR-1858-04.

## Internationalization

- Edition strings use `_()` (e.g. `_('Add file')`, `_('Instructions')`,
  `_('The attached file is missing. Re-add it from the Media Library.')`).
- Export/content strings are resolved at runtime from the `$exe_i18n` bundle
  (shipped as `libs/common_i18n.js`) through a local
  `translate(key, englishFallback)` helper — e.g.
  `translate('download', 'Download')`, `translate('fileUnavailable', 'File unavailable')`,
  `translate('noFilesAttached', 'No files attached.')`. The editor-only `c_()`/`_()`
  helpers do not exist in an exported site and must not be called from export code;
  the keys themselves are declared with `c_()` in
  `public/app/common/common_i18n.js`, which is resolved at build time. Details in
  ADR-1858-04.
- Per project policy, no `translations/**` files are added or edited by this
  work; string extraction is handled by a separate process (AGENTS.md §7.4).

## Performance

- State stays small: only references + a metadata snapshot live in the Y.Doc;
  binaries live once in the Media Library (no base64 bloat, ADR-1858-02).
- Rendering is linear in the number of attachments; no per-attachment network
  calls beyond the AssetManager blob resolution already used for images.
- The edition observer reconciles rows on Media Library asset-map changes; the
  observer self-detaches on teardown to avoid leaks (ADR-1858-04).

## Testing strategy

- **Unit (Vitest, frontend)**:
  `public/files/perm/idevices/base/file-attachment/edition/file-attachment.test.js`
  (initial render, add/remove/reorder, collapsible details, save round-trip,
  missing-asset flagging, escaping, native-upload fallback) and
  `.../export/file-attachment.test.js` (renderView, escaping, accessible
  "Download" prefix, missing-asset placeholder, category/size helpers,
  renderBehaviour blob resolution).
- **Unit (Bun, backend)**:
  `src/shared/import/legacy-handlers/HandlerRegistry.spec.ts` (mapping + handler
  selection) and `src/shared/import/legacy-handlers/handlers.spec.ts`
  (`FileAttachHandler` extraction).
- **Integration (Bun)**: `test/integration/legacy-file-attachment.spec.ts` — real
  `ElpxImporter` over a synthetic legacy `.elp`, asserting type, intro,
  description→title, `asset://` rewriting, and crash-free missing-binary import.
- **E2E (Playwright)**:
  `test/e2e/playwright/specs/idevices/file-attachment.spec.ts` — add iDevice,
  upload via Media Library, save, download link renders in view and preview, and
  rename/delete sync.
- Patch coverage ≥ 90% per AGENTS.md §5.3.

## Rollout plan

- Single feature branch / PR (#2011): iDevice files, registration/wiring, legacy
  handler, and all tests land together (new code ships with tests, AGENTS.md §1).
- No feature flag; the iDevice is additive and appears in the picker on merge.

## Risks and mitigations

- **Internal-API drift** (AssetManager / File Manager): mitigated by a native
  file-input fallback and defensive null-checks (ADR-1858-01).
- **Missing asset-change event**: mitigated by observing the shared Yjs assets map
  with a self-detaching observer (ADR-1858-04); flagged as follow-up for a formal API.
- **Legacy-shape coverage gaps**: mitigated by multi-strategy extraction in
  `FileAttachHandler.extractFiles()` plus unit + integration tests (ADR-1858-03).
- **Broken export links if the export-path map lacks the UUID**: mitigated by the
  same map used for image export and by the missing-asset placeholder (ADR-1858-02,
  ADR-1858-04).

## Open questions

- Should a formal `AssetManager` change-event API replace the raw Yjs-map
  observation? (Broader than this feature.)
- Should `url` carry an explicit scheme allow-list at render time, or continue to
  rely on the Media Library flow + shared sanitizer?
- Should an automated accessibility assertion (axe) be added to the E2E spec?

## ADRs required or referenced

| Decision | ADR |
|---|---|
| Restore File Attachment as a JSON api-v3 Media-Library-backed iDevice | [ADR-1858-01](../../adr/ADR-1858-01-restore-file-attachment-as-json-idevice.md) |
| Store attachments as stable `asset://` references with render-at-view-time export rewrite | [ADR-1858-02](../../adr/ADR-1858-02-use-asset-uri-references.md) |
| Remap legacy File Attachment iDevices to `file-attachment` instead of `text` | [ADR-1858-03](../../adr/ADR-1858-03-remap-legacy-file-attachments.md) |
| Missing-asset resilience and accessibility strategy for attachments | [ADR-1858-04](../../adr/ADR-1858-04-fail-safe-accessible-attachment-rendering.md) |

## Evidence

Implemented on the PR #2011 branch (paths verified to exist):

- iDevice: `public/files/perm/idevices/base/file-attachment/config.xml`,
  `edition/file-attachment.js`, `edition/file-attachment.css`,
  `export/file-attachment.js`, `export/file-attachment.css`,
  `export/file-attachment.html`, `file-attachment-icon.svg`.
- Wiring: `public/app/common/exe_export.js` (`jsonOnlyIdevices`);
  `src/shared/import/legacy-handlers/FileAttachHandler.ts`;
  `src/shared/import/legacy-handlers/HandlerRegistry.ts`;
  `src/shared/import/LegacyXmlParser.ts`.
- Asset pipeline reused: `src/shared/export/renderers/IdeviceRenderer.ts`
  (`asset://` → `content/resources/…` rewrite),
  `src/shared/export/interfaces.ts` (preview vs export contract),
  `src/shared/import/ElpxImporter.ts` (`convertAssetPathsInObject` /
  `findAssetUrlForPath`), `public/app/yjs/ComponentImporter.js` (browser twin).
- Tests: `.../edition/file-attachment.test.js`, `.../export/file-attachment.test.js`,
  `src/shared/import/legacy-handlers/HandlerRegistry.spec.ts`,
  `src/shared/import/legacy-handlers/handlers.spec.ts`,
  `test/integration/legacy-file-attachment.spec.ts`,
  `test/e2e/playwright/specs/idevices/file-attachment.spec.ts`.
- Operational docs (existing; linked, not duplicated here):
  [`doc/elpx-format/idevices/catalog.md`](../../../elpx-format/idevices/catalog.md)
  (catalog row + legacy class→type table),
  [`doc/elpx-format/idevices/snippets.md`](../../../elpx-format/idevices/snippets.md)
  (`## file-attachment` JSON shape),
  [`doc/elpx-format/idevices/patterns.md`](../../../elpx-format/idevices/patterns.md)
  (Standard JSON pattern list).

## Acceptance criteria

- [x] A `file-attachment` iDevice appears under "Information and presentation" and
      lets an author add multiple files via the Media Library.
- [x] Attachments persist as `asset://<uuid>.<ext>` references with a metadata
      snapshot in `jsonProperties`; `htmlView` is empty.
- [x] The exported/previewed output renders one accessible download link per
      attachment (with `download` attribute and screen-reader "Download" prefix).
- [x] Legacy `FileAttachIdevice` / `FileAttachIdeviceInc` / `AttachmentIdevice`
      import as `file-attachment`, preserving files, intro, `showDesc`, and
      description→title.
- [x] A missing asset renders a safe placeholder (edition warning / export "File
      unavailable"), and import does not crash on missing binaries.
- [x] Author-controlled fields are escaped in edition and export.
- [x] Unit, integration, and E2E tests exist and cover the above.

## Implementation checklist

- [x] Add `file-attachment` iDevice (config, edition, export, template, icon, CSS).
- [x] Register in `jsonOnlyIdevices` (`public/app/common/exe_export.js`).
- [x] Store/resolve attachments as `asset://` references (ADR-1858-02).
- [x] Add `FileAttachHandler` and remap legacy classes; remove them from
      `textBasedIdevices` (ADR-1858-03).
- [x] Implement missing-asset resilience + accessibility + escaping (ADR-1858-04).
- [x] Add edition/export Vitest specs, handler Bun specs, integration spec, and
      Playwright spec.
- [x] Update operational docs (`catalog.md`, `snippets.md`, `patterns.md`).

## References

- Issue #1858 — File Attachment iDevice regression.
- PR #2011 — restore the File Attachment iDevice.
- ADR-1858-01, ADR-1858-02, ADR-1858-03, ADR-1858-04.
- `doc/elpx-format/idevices/catalog.md`, `doc/elpx-format/idevices/snippets.md`,
  `doc/elpx-format/idevices/patterns.md`.
- `AGENTS.md` (Definition of Done, §7.1/§7.3/§7.4/§7.9),
  `.agents/skills/idevice/SKILL.md`, `.agents/skills/exporter/SKILL.md`.
