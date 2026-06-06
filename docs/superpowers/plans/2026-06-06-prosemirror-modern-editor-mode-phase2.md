# ProseMirror Modern Editor Mode — Phase 2 (Block insert `+` menu + drag-reorder) Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax. This phase is UI-plugin work that requires live browser iteration; treat the code snippets as the intended shape and refine positioning/drag mechanics against the running editor.

**Goal:** In "modern" mode, add a Notion/Lexical-style gutter that shows a `+` (insert block) and a `⠿` (drag handle) next to the active block; `+` opens a filterable "Filter blocks…" popup that inserts a block, and `⠿` drags to reorder blocks.

**Architecture:** A single ProseMirror plugin `ProseMirrorBlockMenu` (vanilla, `window`-global) whose `view(editorView)` renders a floating gutter element positioned against the block under the cursor. The plugin is added to the editor only in modern mode by `ProseMirrorEditorMode`, via a new add/remove plugin path on `ProseMirrorEditor`. The classic Yjs collaboration plugins are never touched.

**Tech Stack:** Vanilla browser JS, ProseMirror via `window.ProseMirrorBundle` (`Plugin`, `PluginKey`, `EditorState`, `NodeSelection`, `Slice`, `Fragment`, etc.), `window.ProseMirrorCommands`, `window.ProseMirrorSchema`, Vitest + happy-dom.

**Spec:** `docs/superpowers/specs/2026-06-06-prosemirror-modern-editor-mode-design.md`
**Builds on:** Phase 1 (`docs/superpowers/plans/2026-06-06-prosemirror-modern-editor-mode-phase1.md`).

---

## Reference facts

- `ProseMirrorEditor` (`public/app/prosemirror/ProseMirrorEditor.js`) exposes `.view`, `.schema`, `.state`, `.addPlugins(plugins)` (appends + `reconfigure`). It stores added plugins in `this._additionalPlugins`. We will add `removePlugins(pluginsOrKeys)` and `hasPlugin(key)`.
- The schema's insertable block nodes (from `ProseMirrorSchema`): `paragraph`, `heading` (attr `level`), `bullet_list`, `ordered_list`, `blockquote`, `code_block`, `table`, `image`, `video`, `audio`, `horizontal_rule` (confirm exact node names by reading `ProseMirrorSchema.js`).
- `ProseMirrorEditorMode.mount` builds modern chrome; that is where the block-menu plugin must be added (and removed when switching to classic).
- Insert helpers live in `ProseMirrorCommands` (Phase 1). Extend it with `insertBlock(editor, nodeName, attrs)` that replaces the current empty block or inserts a new block at the selection.
- ProseMirror bundle exports needed: `Plugin`, `PluginKey`, `Decoration`, `DecorationSet`, `NodeSelection`, `Slice`, `Fragment`. Verify they are exported by `src/shared/prosemirror/browser/index.ts`; add any missing exports there and rebuild the bundle with `bun run bundle:prosemirror`.

---

## File structure (Phase 2)

| File | Create/Modify | Responsibility |
|---|---|---|
| `public/app/prosemirror/ProseMirrorEditor.js` | Modify | Add `removePlugins()` + `hasPlugin()` to support adding/removing mode plugins on toggle. |
| `public/app/prosemirror/ProseMirrorBlockMenu.js` | Create | The block-menu plugin: gutter `+`/`⠿`, "Filter blocks…" popup, drag-to-reorder. Exposes `window.proseMirrorBlockMenuPlugin(options)` and a `blockMenuPluginKey`. |
| `public/app/prosemirror/ProseMirrorBlockMenu.test.js` | Create | Tests: popup builds + filters; selecting an item inserts the right node; plugin attaches a gutter element; drag move reorders. |
| `public/app/prosemirror/ProseMirrorCommands.js` | Modify | Add `insertBlock(editor, nodeName, attrs)` (+ test cases). |
| `public/app/prosemirror/ProseMirrorEditorMode.js` | Modify | On modern mount, add the block-menu plugin to the editor; on switch to classic, remove it. |
| `public/app/prosemirror/prosemirror.css` | Modify | Styles for `.prosemirror-block-gutter`, `.prosemirror-block-handle`, `.prosemirror-block-menu-popup`. |
| `src/shared/prosemirror/browser/index.ts` | Modify (if needed) | Export any missing PM symbols (`NodeSelection`, `Slice`, `Fragment`, `Decoration`, `DecorationSet`). Then `bun run bundle:prosemirror`. |

---

## Task 1: `ProseMirrorEditor` plugin add/remove support

**Files:** Modify `public/app/prosemirror/ProseMirrorEditor.js`; tests in its existing test file if present, else add focused assertions.

- [ ] **Step 1:** Read `ProseMirrorEditor.js` `addPlugins()`. Add:
```javascript
		/**
		 * Remove previously-added plugins by their PluginKey (or plugin instance).
		 * @param {Array} keys - PluginKey instances (or plugins) to remove
		 */
		removePlugins(keys) {
			if (!Array.isArray(keys)) keys = [keys];
			const keySet = new Set(keys);
			const keep = (p) => {
				// match by stored spec key or identity
				for (const k of keySet) {
					if (p === k) return false;
					if (k && p.spec && p.spec.key && p.spec.key === k) return false;
					if (k && p.key && k.key && p.key === k.key) return false;
				}
				return true;
			};
			this._additionalPlugins = this._additionalPlugins.filter(keep);
			const base = this.view.state.plugins.filter(keep);
			const newState = this.view.state.reconfigure({ plugins: base });
			this.view.updateState(newState);
			this.state = newState;
		}

		hasPlugin(key) {
			return this.view.state.plugins.some((p) => p === key || (p.spec && p.spec.key === key) || (p.key && key && p.key === key.key));
		}
```
- [ ] **Step 2:** Add/extend a test verifying `addPlugins([p])` then `removePlugins([p])` leaves `hasPlugin(p)` false and the editor still functional. Run the prosemirror tests. Commit.

---

## Task 2: `ProseMirrorCommands.insertBlock`

**Files:** Modify `ProseMirrorCommands.js` + `ProseMirrorCommands.test.js`.

- [ ] **Step 1 (TDD):** Add tests for `insertBlock(editor, nodeName, attrs)`:
  - returns false for unknown node;
  - for a known textblock (`heading`) calls `editor.execCommand` (mock) / dispatches a transaction that sets/inserts the node.
- [ ] **Step 2:** Implement `insertBlock`:
```javascript
	function insertBlock(editor, nodeName, attrs) {
		const schema = editor.schema;
		const type = schema?.nodes?.[nodeName];
		if (!type) return false;
		const { state, dispatch } = editor.view;
		const { $from } = state.selection;
		// If the current block is an empty textblock, replace it; else insert after.
		const node = type.createAndFill(attrs || {});
		if (!node) return false;
		let tr = state.tr;
		const here = $from.before($from.depth);
		const cur = $from.node($from.depth);
		if (cur.isTextblock && cur.content.size === 0) {
			tr = tr.replaceWith(here, here + cur.nodeSize, node);
		} else {
			tr = tr.insert($from.after($from.depth), node);
		}
		dispatch(tr.scrollIntoView());
		editor.focus();
		return true;
	}
```
  Export it on `window.ProseMirrorCommands`. Run tests. Commit.

---

## Task 3: `ProseMirrorBlockMenu` plugin — gutter + insert popup

**Files:** Create `ProseMirrorBlockMenu.js` + `.test.js`.

Plugin shape:
```javascript
(function () {
	'use strict';
	const t = (s) => (typeof _ === 'function' ? _(s) : s);
	const { Plugin, PluginKey } = window.ProseMirrorBundle;
	const blockMenuPluginKey = new PluginKey('exeBlockMenu');

	// Block catalog (filtered names map to schema nodes / commands)
	function blockCatalog(schema) {
		const items = [
			{ key: 'paragraph', label: t('Paragraph'), node: 'paragraph' },
			{ key: 'h1', label: t('Heading 1'), node: 'heading', attrs: { level: 1 } },
			{ key: 'h2', label: t('Heading 2'), node: 'heading', attrs: { level: 2 } },
			{ key: 'h3', label: t('Heading 3'), node: 'heading', attrs: { level: 3 } },
			{ key: 'bullet', label: t('Bullet list'), node: 'bullet_list', list: true },
			{ key: 'ordered', label: t('Numbered list'), node: 'ordered_list', list: true },
			{ key: 'quote', label: t('Quote'), node: 'blockquote', wrap: true },
			{ key: 'code', label: t('Code block'), node: 'code_block' },
			{ key: 'table', label: t('Table'), node: 'table' },
			{ key: 'hr', label: t('Horizontal rule'), node: 'horizontal_rule' },
		];
		return items.filter((it) => schema.nodes[it.node]);
	}
	// ... view(editorView): create gutter element (+ and handle), position on mousemove
	// ... + click: open popup with filter input + filtered blockCatalog; selecting inserts via ProseMirrorCommands
	window.proseMirrorBlockMenuPlugin = function (options) { /* returns new Plugin({ key: blockMenuPluginKey, view, props }) */ };
	window.blockMenuPluginKey = blockMenuPluginKey;
})();
```

- [ ] **Step 1:** Implement `blockCatalog`, the gutter element (a `div.prosemirror-block-gutter` containing `button.prosemirror-block-handle[data-role="add"]` and `[data-role="drag"]`), appended to `editorView.dom.parentNode`. Position it on `mousemove` over the editor: find the block DOM node under the pointer (`editorView.posAtCoords`, then `$pos.before(depth)`), set the gutter `top` to that block's offset.
- [ ] **Step 2:** `+` click → build `div.prosemirror-block-menu-popup` with an `input.filter` and the catalog list; typing filters by label; clicking an item calls `window.ProseMirrorCommands.insertBlock(editorWrapper, item.node, item.attrs)` (or wrap/list command) then closes the popup. `editorWrapper` is the `ProseMirrorEditor` instance passed via `options.editor`.
- [ ] **Step 3:** TDD-style unit tests (happy-dom): construct the plugin with a fake `editor`/`view`, simulate opening the popup (call the exposed open function or click the `+`), assert the popup renders the catalog and that typing in the filter narrows the list, and that clicking an item calls the insert helper.
- [ ] **Step 4:** Browser verification (live): in modern mode, hovering a block shows the `+`/handle; `+` opens the popup; filtering works; inserting H1/list/table/hr works; Yjs content stays consistent.
- [ ] **Step 5:** Commit.

---

## Task 4: Drag-to-reorder via the `⠿` handle (same plugin)

- [ ] **Step 1:** Make the `⠿` handle `draggable=true`. On `dragstart`, compute the hovered block range (`from`/`to`) and stash it; set a drag image. On `drop` over the editor, compute the target block boundary (`posAtCoords`), and dispatch a transaction that deletes the source block and inserts its slice at the target (use `Slice`/`Fragment`; guard against dropping inside itself).
- [ ] **Step 2:** Unit test the move logic with a constructed state (assert node order changes).
- [ ] **Step 3:** Browser verification: drag a block above/below another; order updates and persists via Yjs.
- [ ] **Step 4:** Commit.

---

## Task 5: Wire block menu into modern mode

**Files:** Modify `ProseMirrorEditorMode.js`.

- [ ] **Step 1:** In `mount`, after building modern chrome, if `window.proseMirrorBlockMenuPlugin` exists call `editor.addPlugins([window.proseMirrorBlockMenuPlugin({ editor })])`. When switching to classic (or destroy), call `editor.removePlugins([window.blockMenuPluginKey])` and ensure the gutter DOM is removed (the plugin's `view.destroy()` must remove it).
- [ ] **Step 2:** Update `ProseMirrorEditorMode.test.js`: stub `window.proseMirrorBlockMenuPlugin` and an `editor` with `addPlugins`/`removePlugins` spies; assert `addPlugins` called on modern mount and `removePlugins` on switch to classic.
- [ ] **Step 3:** Run tests. Commit.

---

## Task 6: CSS + final browser verification

**Files:** Modify `prosemirror.css`.

- [ ] **Step 1:** Add styles: `.prosemirror-block-gutter` (absolute, left of content, hidden by default, shown on hover), `.prosemirror-block-handle` (small button, teal hover), `.prosemirror-block-menu-popup` (white card, shadow, filter input, list rows with hover). Match the eXe theme (`#047857`).
- [ ] **Step 2:** Full browser pass: modern mode shows gutter; `+` inserts blocks; drag reorders; toggling to classic removes the gutter (no leftover DOM, no console errors); toggling back restores it.
- [ ] **Step 3:** Run `bun vitest run --config vitest.config.mts public/app/prosemirror public/files/perm/idevices/base/collaborative-editing/edition/collaborative-editing.test.js` (all pass) and `make fix`. Commit.

## Phase 2 done criteria

- In modern mode, a gutter `+`/`⠿` appears by the active block; `+` opens a filterable block popup that inserts the chosen block; `⠿` reorders blocks by drag; switching to classic cleanly removes the plugin and its DOM; no console errors; tests pass; lint clean.

## Next

Phase 3: `ProseMirrorFloatingToolbar` (selection toolbar), added to the modern chrome the same way (`addPlugins`/`removePlugins`).
