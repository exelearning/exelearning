# ProseMirror Editor Dialogs & TinyMCE-parity (Link / Image / Table / Math) — Design

**Date:** 2026-06-06
**Status:** Approved design, pending implementation plans (per phase)
**Area:** `public/app/prosemirror/` (collaborative-editing iDevice editor, classic + modern toolbars)

## Summary

Replace the editor's JS `prompt()` dialogs with proper eXeLearning modal dialogs and
move the vanilla ProseMirror editor toward TinyMCE feature parity, starting with the
four explicitly-requested capabilities: **link editing, image properties, table
insert/edit, and MathJax equations**. A reusable dialog framework underpins all of
them and is used by **both** the classic (`ProseMirrorToolbar`) and modern
(`ProseMirrorModernToolbar` + plugins) toolbars.

This is the first deliverable of a larger parity effort; remaining TinyMCE features
(font family/size, color pickers, charmap, definition lists, and eXe-specific plugins
like mindmap/mermaid/abcmusic) are out of scope here and will be separate efforts.

## Goals

- A reusable `ProseMirrorDialog.openForm({ title, fields }) → Promise<values|null>`
  helper that renders a declarative form inside an eXe modal and returns the values.
- A **link** dialog (URL + "browse" via Media Library, link text, target, title).
- **Image** properties editing (source via Media Library, alt, title, width, height,
  alignment/class) reached through a contextual mini-toolbar on a selected image.
- **Table** insert dialog (rows, cols, header row) + a contextual table-editing
  toolbar (add/delete row·column, merge/split, header, cell background, properties,
  delete table) + a table-properties dialog.
- **Math** node + equation dialog wrapping **edicuatex**, with MathJax rendering in
  the editor; export already renders via `LatexPreRenderer`.
- All `prompt()` calls for link/table/image/math removed from both toolbars.

## Non-Goals

- No new runtime dependencies (reuse the bundled `prosemirror-tables`, the eXe modal
  system, edicuatex, and `exe_math`/MathJax already in the app).
- No replacement of TinyMCE for other (non-collaborative) iDevices.
- Not in this deliverable: font family/size dropdowns, fore/back color pickers,
  charmap, anchor, abbreviation, definition lists, blockquote-and-cite, templates,
  and the eXe-specific embed plugins (mindmap, mermaid, abcmusic, rssfeed, hangman,
  tooltips, effects). These are later parity work.

## Existing building blocks (from exploration)

- **eXe modal framework:** `window.eXeLearning.app.modals` with a base `Modal` and
  `ModalConfirm` (`show({ title, body, contentId, confirmExec, cancelExec, ... })`,
  `setBody(html)`). `app.modals.filemanager.show({ onSelect, accept })` is the Media
  Library; `onSelect` receives `{ assetUrl, blobUrl, asset }`.
- **Schema (`ProseMirrorSchema.js`)** already supports: `image` attrs (src, alt,
  title, width, height, class, data-asset-src, data-asset-id); `link` mark attrs
  (href, target, rel, title); full `prosemirror-tables` nodes with `background` /
  `borderColor` cell attributes. There is **no** `math` node yet.
- **prosemirror-tables** bundled commands available on `window.ProseMirrorBundle`:
  `tableEditing`, `columnResizing`, `addRow/ColumnBefore/After`, `deleteRow/Column`,
  `mergeCells`, `splitCell`, `setCellAttr`, `toggleHeaderRow/Column/Cell`,
  `deleteTable`, `isInTable`, `CellSelection`, `TableMap`.
- **Math:** `app/common/edicuatex/index.html` is a standalone LaTeX editor (TinyMCE
  opens it in a modal and gets LaTeX back). `app/common/exe_math/` loads MathJax.
  LaTeX convention: inline `\( … \)`, block `\[ … \]`; rendered as
  `<span class="exe-math-rendered" data-latex="…" data-display="inline|block">`.
- Both classic and modern toolbars currently use `prompt()` for these inserts.

## Architecture (Approach A — `ProseMirrorDialog` helper)

New vanilla browser files under `public/app/prosemirror/`, loaded by
`YjsLoader.loadProseMirror()` (no build step).

| File | Responsibility |
|---|---|
| `ProseMirrorDialog.js` | `openForm({ title, fields, submitLabel })` → builds form HTML from a declarative field list (`text`, `number`, `select`, `checkbox`, `textarea`, `color`, `media`), opens it via eXe `ModalConfirm`, wires `media` fields to `app.modals.filemanager`, resolves with `{ name: value }` (or `null` on cancel). The single dialog primitive used everywhere. |
| `ProseMirrorLinkDialog.js` | Builds the link field set, reads the current `link` mark for editing, applies/updates/removes the mark. |
| `ProseMirrorImageTools.js` | Contextual mini-toolbar shown when an `image` node is selected (Edit / align), and the image-properties form (alt, title, width, height, alignment/class, replace source). |
| `ProseMirrorTableTools.js` | Insert-table dialog; contextual table toolbar (row/col/merge/header/cell-bg/props/delete) shown when the selection is inside a table; table-properties dialog. Uses the bundled table commands. |
| `ProseMirrorMathDialog.js` | Opens edicuatex in a modal iframe, receives LaTeX (postMessage), inserts/edits a `math` node; triggers MathJax render. |
| `ProseMirrorSchema.js` | **Modify:** add an inline+block-capable `math` node (`data-latex`, `data-display`) with `toDOM`/`parseDOM` matching the `exe-math-rendered` convention. |
| `ProseMirrorCommands.js` | **Modify:** add helpers used by the dialogs (apply/remove link mark with attrs, insert table, set cell attr, insert/replace math node). |
| `ProseMirrorToolbar.js` (classic) | **Modify:** replace the `prompt()`-based `_showLinkDialog/_showTableDialog/_showImageDialog/_showMathDialog` with the new dialog modules. |
| `ProseMirrorModernToolbar.js` + the modern plugins | **Modify:** wire the link button, the Insert dropdown's image/table/math items, and the contextual image/table toolbars to the new dialog modules. |
| `prosemirror.css` | **Modify:** styles for the contextual image/table toolbars (the dialog forms reuse eXe modal styles). |

### `ProseMirrorDialog.openForm` contract

```
openForm({
  title: string,
  submitLabel?: string,
  fields: Array<{
    name: string, type: 'text'|'number'|'select'|'checkbox'|'textarea'|'color'|'media',
    label: string, value?: any, options?: [{value,label}], accept?: 'image'|'audio'|'video',
    min?: number, max?: number, placeholder?: string,
  }>,
}) → Promise<Record<string, any> | null>
```

- Builds a `<div class="pm-dialog-form">` of labelled fields; a `media` field renders
  a text input + "Browse" button that opens the Media Library and fills the value with
  the chosen asset URL (and stashes `data-asset-id`/blob for the caller).
- Opens via `app.modals.confirm.show({ title, body, confirmExec, cancelExec })`.
- On confirm, collects field values and resolves; on cancel/close, resolves `null`.

### Contextual toolbars (image / table) — modern editor

The modern editor has no menubar, so element-specific actions appear as small
floating toolbars driven by the selection:

- **Image:** when a `NodeSelection` on an `image` is active, show
  `.prosemirror-image-toolbar` near the image with: Edit properties, align left/center/right.
- **Table:** when the selection is inside a table (`isInTable`), show
  `.prosemirror-table-toolbar` with: add row above/below, add col left/right, delete
  row/col, toggle header row, merge/split cells, cell background, table properties,
  delete table.

Both are implemented as ProseMirror plugins (like the block menu / floating toolbar),
added to the modern chrome via `addPlugins`/`removePlugins` and removed cleanly in
classic mode. In the classic toolbar these same actions remain available through its
existing Table menu (now backed by the new dialogs where a dialog is needed).

### Math node + edicuatex + MathJax

- Schema `math` node: `inline: true` variant for inline and a block wrapper for
  display math; attrs `{ latex, display }`; `toDOM` →
  `<span class="exe-math-rendered" data-latex data-display>` (so export/`LatexPreRenderer`
  and the existing MathJax pipeline render it consistently); `parseDOM` matches the
  same span and the raw `\(…\)` / `\[…\]` delimiters where feasible.
- `ProseMirrorMathDialog` loads edicuatex into a modal iframe (URL
  `app/common/edicuatex/index.html`), passes any existing LaTeX, and on confirm
  receives LaTeX via `postMessage`; inserts/replaces the `math` node at the selection.
- After insertion (and on editor load), MathJax (`exe_math` loader) typesets the
  `.exe-math-rendered` spans inside the editor.

## Data flow

1. A toolbar button (or Insert item, or contextual toolbar action) calls the relevant
   dialog module.
2. The module reads current state (e.g. existing link mark / image attrs / table
   context), calls `ProseMirrorDialog.openForm(...)` (or the edicuatex modal), and on
   confirm dispatches a ProseMirror transaction via `ProseMirrorCommands`/bundled
   table commands onto the shared `EditorView`. Yjs collaboration is unaffected.

## Testing

- Every new `.js` gets a matching `.test.js` (Vitest + happy-dom, ≥80%). The eXe
  modal and Media Library are stubbed on `window.eXeLearning.app.modals`; edicuatex
  postMessage is stubbed.
- Browser verification at the end of each phase: dialogs open as real eXe modals
  (no `prompt()`), values apply correctly, contextual toolbars appear/disappear with
  selection, math renders, and switching classic↔modern stays clean (no leaks).
- `make fix` clean.

## Phasing (each phase = its own implementation plan)

- **Phase A — Dialog framework + Link.** `ProseMirrorDialog` + `ProseMirrorLinkDialog`;
  migrate link in both toolbars; remove the link `prompt()`s.
- **Phase B — Image.** `ProseMirrorImageTools`: contextual image toolbar + properties
  dialog; wire Insert→Image to optionally open properties; replace image `prompt()`.
- **Phase C — Table.** Insert-table dialog + contextual table toolbar + properties;
  replace table `prompt()`s; back the classic Table menu with the new dialogs.
- **Phase D — Math.** `math` schema node + `ProseMirrorMathDialog` (edicuatex) +
  MathJax rendering in the editor; replace the math `prompt()`.

## Risks / notes

- Contextual toolbars must reposition on selection/scroll and be removed cleanly on
  mode switch (reuse the floating-toolbar plugin pattern and its listener cleanup).
- Adding a `math` node changes the schema; existing collaborative docs are early-dev
  (no migration needed), but the node must round-trip through HTML import/export and
  the Yjs binding.
- edicuatex runs in an iframe; the postMessage channel/origin must be handled safely
  (same-origin app asset).
- The eXe `ModalConfirm` is a shared singleton; dialogs must set/clear their
  `confirmExec`/`cancelExec` so they don't leak handlers between opens.
