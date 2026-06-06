# ProseMirror "Modern" Editor Mode — Design

**Date:** 2026-06-06
**Status:** Approved design, pending implementation plan
**Area:** `public/app/prosemirror/` (collaborative-editing iDevice editor)

## Summary

Add a Lexical-Playground-style editing experience to the vanilla ProseMirror
editor used by the `collaborative-editing` iDevice, selectable via a
**classic / modern** toggle:

- **classic** — the current TinyMCE-style multi-row toolbar
  (`ProseMirrorToolbar.js`), unchanged. Gains a single new "Modo moderno" item
  in its **Utilidades** menu.
- **modern** — a compact single-row toolbar + a Notion/Lexical-style block
  insert menu (`+` with "Filter blocks…" and a `⠿` drag handle) + a floating
  toolbar that appears on text selection. Gains a "Modo clásico" entry to switch
  back.

The toggle is a **per-user preference** persisted in `localStorage`
(`exe.pm.editorMode`), **default `modern`**. The toggle swaps the entire editing
experience; the block menu and floating toolbar exist **only in modern mode**.

Visuals integrate with the **eXeLearning teal theme** (accent `#047857`), not a
pixel clone of the Lexical Playground.

This rebuilds — in vanilla ProseMirror, with no new dependencies — UX that the
removed React Lexical Playground previously provided.

## Goals

- A compact, modern toolbar that fits eXe's look.
- A `+` block-insert menu with a filter and a drag handle for reordering.
- A floating selection toolbar for inline formatting.
- A user-level classic/modern toggle, modern by default, that never loses editor
  content when switched.
- Leave the classic toolbar behaviour untouched (zero regression risk for it).

## Non-Goals

- No replacement of TinyMCE for other (non-collaborative) iDevices.
- No new runtime dependencies (no tiptap, no `prosemirror-menu` — the latter is
  archived/unmaintained).
- No pixel-perfect clone of the Lexical Playground.
- No per-project / collaborative sharing of the mode preference (it is local to
  the user/browser).

## Architecture (Approach A — modular vanilla plugins)

All files are plain browser JS under `public/app/prosemirror/`, loaded directly
by `YjsLoader.loadProseMirror()` (no build step), consistent with the existing
ProseMirror integration files.

| File | Responsibility |
|---|---|
| `ProseMirrorEditorMode.js` | Mode controller. Reads/writes the `localStorage` preference (default `modern`); mounts the classic or modern "chrome" onto a `ProseMirrorEditor`; exposes the toggle; cleans up via `destroy()`. |
| `ProseMirrorModernToolbar.js` | Compact single-row toolbar (teal theme): block-type, B/I/U, inline code, link, text color, highlight, alignment, an **Insert** dropdown (image/media/table/hr…), and a small menu containing "Modo clásico". |
| `ProseMirrorBlockMenu.js` | ProseMirror plugin: gutter `+` and `⠿` drag handle by the active block; `+` opens a filterable "Filter blocks…" popup (Paragraph, H1–H3, Bullet/Ordered List, Table, Quote, Code, Image, Media, Horizontal rule…). |
| `ProseMirrorFloatingToolbar.js` | ProseMirror plugin: on a non-empty text selection, shows a floating bar (B/I/U, link) above the selection. |
| `ProseMirrorCommands.js` | Small shared command helpers (`toggleMark`, `setBlockType`, list/wrap, insert image/media node, etc.) so classic and modern toolbars don't duplicate logic. |

**Unchanged:** `ProseMirrorToolbar.js` (classic) except for **one** new
"Modo moderno" item added to its Utilidades menu that calls the mode controller.

`ProseMirrorEditor.js` gains a small method to **remove** the mode-specific
plugins (block menu, floating toolbar) when switching to classic — a plugin
reconfigure to complement the existing `addPlugins()`.

### Component contracts

- `ProseMirrorEditorMode.mount(editor, { toolbarHost, onMediaLibrary, onModeChange? }) → { mode, setMode(mode), toggle(), destroy() }`
  - On mount: read preference, build classic or modern chrome.
  - `setMode`/`toggle`: persist, tear down current chrome (toolbar DOM +
    reconfigure plugins), build the other. Editor content is preserved.
- `ProseMirrorModernToolbar({ editor, container, onMediaLibrary, onSwitchToClassic }) → { destroy() }`
- `proseMirrorBlockMenuPlugin(options) → Plugin` and
  `proseMirrorFloatingToolbarPlugin(options) → Plugin` — standard PM plugins
  added/removed via the editor's reconfigure path.

## Data flow

1. **Mount:** `collaborative-editing.js` calls
   `ProseMirrorEditorMode.mount(editor, { toolbarHost, onMediaLibrary })`
   instead of constructing `ProseMirrorToolbar` directly.
2. **Preference:** read from `localStorage['exe.pm.editorMode']`, default
   `'modern'`.
3. **Toggle:** user clicks "Modo moderno" (classic Utilidades) or "Modo clásico"
   (modern menu) → controller persists the new value, tears down current chrome,
   builds the other.
4. **Editing:** the compact toolbar, block menu, and floating toolbar all
   dispatch transactions on the same `EditorView`. The Yjs `ySyncPlugin` /
   collaboration binding is never removed, so collaborative content and the
   document are preserved across a toggle.

## Integration points

- `public/files/perm/idevices/base/collaborative-editing/edition/collaborative-editing.js`
  — swap `new ProseMirrorToolbar(...)` for `ProseMirrorEditorMode.mount(...)`;
  store the returned handle and call `destroy()` on teardown.
- `public/app/yjs/yjs-loader.js` (`loadProseMirror`) — load the new modules
  (sequential where dependencies require: `ProseMirrorCommands.js` before the
  toolbars; `ProseMirrorIcons.js` stays first).
- `public/app/prosemirror/prosemirror.css` — add teal-themed styles for
  `.prosemirror-modern-toolbar`, `.prosemirror-block-menu`,
  `.prosemirror-floating-toolbar`.

## Testing

- Every new `.js` gets a matching `.test.js` (vitest + happy-dom), ≥80% coverage
  per project rules.
  - `ProseMirrorEditorMode`: default mode, get/set/persist, toggle re-mount,
    `destroy()`.
  - `ProseMirrorModernToolbar`: renders controls; commands dispatch onto the view.
  - `ProseMirrorBlockMenu`: filter narrows the list; inserting each block type
    produces the right node.
  - `ProseMirrorFloatingToolbar`: shows only on non-empty selection; applies marks.
  - `ProseMirrorCommands`: each helper toggles/sets correctly.
- Update `collaborative-editing.test.js` mocks for the new `mount` path.
- Browser verification at the end of each phase using the live dev environment.

## Phasing (each phase independently testable and shippable)

1. **Core:** `ProseMirrorCommands` + `ProseMirrorEditorMode` +
   `ProseMirrorModernToolbar` + classic Utilidades "Modo moderno" item + iDevice
   integration + CSS. Outcome: compact bar + working classic/modern toggle.
2. **Block menu:** `ProseMirrorBlockMenu` (`+` insert; drag-reorder is an
   optional sub-step within this phase).
3. **Floating toolbar:** `ProseMirrorFloatingToolbar`.

## Risks / notes

- Toggling must reconfigure EditorState plugins without disturbing the Yjs
  collaboration plugins. Mitigation: keep collaboration plugins separate and only
  add/remove the mode-specific plugins.
- `ProseMirrorToolbar.js` is already large (~1600 lines); the modern UI lives in
  new focused files rather than extending it.
- The mode preference is browser-local; a user on a different machine starts at
  the default (`modern`). This is intentional (Non-Goals).
