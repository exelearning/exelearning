---
id: ADR-0037
title: "Remap legacy File Attachment iDevices to file-attachment instead of text"
status: Proposed
date: 2026-07-09
deciders:
  - "@erseco"
reviewers:
  - "@ignaciogros"
  - "@cristinavaldera"
  - "@mnunezcedec"
related:
  issues: [1858]
  prs: [2011]
  sdds: [SDD-0009]
  adrs: [ADR-0035, ADR-0036, ADR-0038]
supersedes: []
superseded_by: []
ai_assistance:
  tool: "Claude Code"
  model: "claude-opus-4-8"
---

# ADR-0037: Remap legacy File Attachment iDevices to file-attachment instead of text

## Status

Proposed

## Context

Legacy eXeLearning 2.x/3.x packages (`.elp` / `contentv3.xml`) represent file
attachments with the Python-era classes
`exe.engine.fileattachidevice.FileAttachIdevice`,
`exe.engine.fileattachidevice.FileAttachIdeviceInc`, and
`exe.engine.attachmentidevice.AttachmentIdevice`. On the 4.x import path these
were caught by the generic text-based iDevice list and converted to `text`,
throwing away the download semantics, the per-file description, and the attachment
structure — the very regression ADR-0035 restores the iDevice for.

The importer already has a handler-registry pattern: `LegacyHandlerRegistry`
selects a handler by legacy class name (first match wins, `DefaultHandler` last),
each handler declares a `getTargetType()` and extracts modern
`jsonProperties`/`htmlView`. A `LEGACY_TYPE_MAP` provides the class→type mapping
used for normalization, and `LegacyXmlParser` keeps a separate `textBasedIdevices`
list that force-routes certain classes to `text`. Now that a real
`file-attachment` iDevice exists, legacy attachments must land on it.

## Problem

Which modern iDevice type should legacy `FileAttachIdevice` /
`FileAttachIdeviceInc` / `AttachmentIdevice` components import as, and where in the
import pipeline must that mapping be changed so they no longer degrade to `text`?

## Decision drivers

- **Do not lose existing content** (AGENTS.md philosophy): imported attachments
  must keep their files, instructions and per-file descriptions.
- **Feature parity with the restored iDevice** (ADR-0035): imported state must
  match the `file-attachment` JSON shape (ADR-0036).
- **Single, unambiguous mapping**: the class must not be simultaneously claimed by
  the `text` path and a dedicated handler.
- **Preserve legacy author intent**: the legacy per-file description was shown as
  the download link label, so it should map to the modern attachment title.

## Options considered

### Option 1: Dedicated `FileAttachHandler` mapping to `file-attachment` (chosen)

Add a `FileAttachHandler` that `canHandle()` any class containing
`FileAttachIdevice` or `AttachmentIdevice`, returns `getTargetType() ===
'file-attachment'`, and builds `{ intro, showDescriptions, attachments }` from the
legacy XML. Register it *before* `FreeTextHandler`, add the three classes to
`LEGACY_TYPE_MAP` as `file-attachment`, and remove them from the
`LegacyXmlParser` `textBasedIdevices` list.

- Pros: faithful conversion (files, intro, showDesc, description→title); lands on
  the real iDevice; unit + integration tested.
- Cons: another handler to maintain; must keep the three routing points
  (registry order, `LEGACY_TYPE_MAP`, `LegacyXmlParser`) consistent.

### Option 2: Keep mapping to `text` (status quo)

Leave the legacy classes on the text path.

- Pros: no change.
- Cons: perpetuates the #1858 regression — attachments become inert HTML with no
  download links or structured metadata.

### Option 3: Map to `download-source-file`

Route legacy attachments to the existing `download-source-file` iDevice.

- Pros: an existing "download" type.
- Cons: semantic mismatch (that iDevice downloads the whole exported source
  package, htmlView-only, no per-file list) — same reason it was rejected for the
  authoring surface in ADR-0035.

## Evidence

All paths verified on the PR #2011 branch.

- Handler: `src/shared/import/legacy-handlers/FileAttachHandler.ts` —
  `canHandle()` returns true for names including `FileAttachIdevice` or
  `AttachmentIdevice`; `getTargetType()` returns `'file-attachment'`;
  `extractHtmlView()` returns `''` (JSON-only iDevice);
  `extractProperties()` returns `{ intro, showDescriptions, attachments }`;
  `toAttachment()` maps the legacy `fileDescription` (or display name) to the
  modern `title` and emits `url: "resources/<filename>"` (rewritten to `asset://`
  by the importer, per ADR-0036); `extractShowDesc()` defaults to `true`.
- Registry: `src/shared/import/legacy-handlers/HandlerRegistry.ts` —
  `LEGACY_TYPE_MAP` maps `FileAttachIdevice`, `FileAttachIdeviceInc`,
  `AttachmentIdevice` → `'file-attachment'`; `FileAttachHandler` is registered in
  `init()` before `FreeTextHandler` and before `DefaultHandler`.
- Parser change: `src/shared/import/LegacyXmlParser.ts` — `FileAttachIdevice` and
  `AttachmentIdevice` were **removed** from the `textBasedIdevices` list, with a
  comment noting they are now handled by `FileAttachHandler`.
- Unit tests: `src/shared/import/legacy-handlers/HandlerRegistry.spec.ts`
  ("should map file attachment iDevices to file-attachment (not text)", and
  `getHandler` returns `FileAttachHandler` for `FileAttachIdeviceInc` /
  `AttachmentIdevice` with `getTargetType() === 'file-attachment'`);
  `src/shared/import/legacy-handlers/handlers.spec.ts` (`describe('FileAttachHandler')`
  covering `canHandle`, `getTargetType`, empty-content, and property extraction).
- Integration test: `test/integration/legacy-file-attachment.spec.ts` — builds a
  real legacy `.elp` with a `FileAttachIdeviceInc` (two files, one with a
  description) and asserts the imported component `type === 'file-attachment'`,
  `intro` preserved, `showDescriptions === true`, the described file's `title ===
  'Activity worksheet'`, the description-less file's `title === ''`, and both URLs
  rewritten to `asset://`. It also asserts import does not crash when the binaries
  are missing from the package.
- Catalog: `doc/elpx-format/idevices/catalog.md` — the legacy class→type table now
  maps all three classes to `file-attachment` (previously `text`).

## Decision

We will import legacy `FileAttachIdevice`, `FileAttachIdeviceInc` and
`AttachmentIdevice` components as the modern `file-attachment` iDevice via a
dedicated `FileAttachHandler`. The handler builds the JSON shape defined in
ADR-0036, mapping the legacy per-file description to the attachment `title` and
defaulting `showDescriptions` to `true`. The three classes are mapped in
`LEGACY_TYPE_MAP`, the handler is registered ahead of `FreeTextHandler`, and the
classes are removed from `LegacyXmlParser`'s `textBasedIdevices` list so they are
no longer routed to `text`.

## Consequences

### Positive

- Legacy attachment content survives import with files, instructions,
  visibility intent, and description→title mapping intact.
- Imported components use the restored iDevice and immediately benefit from its
  rendering, export rewrite, and resilience behaviour (ADR-0036, ADR-0038).
- Covered by unit + integration tests, reducing regression risk on future import
  changes.

### Negative

- The class→type mapping now lives in three coordinated places (handler order,
  `LEGACY_TYPE_MAP`, `LegacyXmlParser`); a future edit to one without the others
  could re-introduce the `text` fallback. Tests guard against this.

### Neutral

- The legacy `fileDescription` becomes the attachment `title` (not the
  `description`), matching how eXeLearning 2.x used it as the link label; the
  modern `description` field starts empty for imported files.

## Risks

- **Incomplete legacy-shape coverage** (medium likelihood, low severity): older
  variants store the file list under different keys or as a single resource.
  Mitigation: `extractFiles()` tries multiple strategies (`fileAttachmentFields`,
  a direct `FileField`/`AttachmentField` list, alternate key names, and a
  single-file fallback); `handlers.spec.ts` exercises these paths.
- **Silent `DefaultHandler` fallback** if the registry order regresses (low
  likelihood, medium severity). Mitigation: `HandlerRegistry.spec.ts` asserts the
  concrete handler and target type.

## Validation

- `HandlerRegistry.spec.ts` and `handlers.spec.ts` (Bun) contain the
  file-attachment assertions.
- `test/integration/legacy-file-attachment.spec.ts` exercises the real importer
  end-to-end.
- Manual check: open a real eXeLearning 2.x package containing a File Attachments
  iDevice and confirm it renders as a working attachment list rather than plain
  text.

## Follow-up work

- Gather additional real-world legacy `.elp` samples and extend
  `handlers.spec.ts`/the integration fixture if any legacy attachment shape is not
  yet covered.

## References

- Issue #1858, PR #2011, SDD-0009.
- ADR-0035 (iDevice restoration), ADR-0036 (reference model), ADR-0038
  (resilience/accessibility).
- `src/shared/import/legacy-handlers/FileAttachHandler.ts`,
  `src/shared/import/legacy-handlers/HandlerRegistry.ts`,
  `src/shared/import/LegacyXmlParser.ts`.
- `doc/elpx-format/idevices/catalog.md` (legacy class→type table).
- `.agents/skills/idevice/SKILL.md`.
