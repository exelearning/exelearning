import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadScript(rel) {
	const code = readFileSync(join(__dirname, rel), 'utf-8');
	(0, eval)(code);
}

// Minimal ProseMirrorBundle stub — must be set BEFORE the IIFE runs because
// it destructures Plugin/PluginKey at parse time.
function setupBundle() {
	global.window.ProseMirrorBundle = {
		Plugin: class {
			constructor(spec) {
				this.spec = spec;
				this.key = spec.key;
			}
		},
		PluginKey: class {
			constructor(name) {
				this.key = name;
			}
		},
		TextSelection: { near: vi.fn(() => ({ near: true })) },
	};
}

describe('ProseMirrorBlockMenu', () => {
	beforeEach(() => {
		setupBundle();
		global.window.ProseMirrorCommands = { insertBlock: vi.fn(() => true) };
		delete global.window.proseMirrorBlockMenuPlugin;
		delete global.window.blockMenuPluginKey;
		delete global.window.ProseMirrorBlockMenuInternals;
		loadScript('./ProseMirrorBlockMenu.js');
	});

	afterEach(() => {
		delete global.window.ProseMirrorBundle;
		delete global.window.ProseMirrorCommands;
		delete global.window.proseMirrorBlockMenuPlugin;
		delete global.window.blockMenuPluginKey;
		delete global.window.ProseMirrorBlockMenuInternals;
		document.body.innerHTML = '';
	});

	// -----------------------------------------------------------------------
	// Exports
	// -----------------------------------------------------------------------
	it('exposes proseMirrorBlockMenuPlugin, blockMenuPluginKey, and ProseMirrorBlockMenuInternals', () => {
		expect(typeof window.proseMirrorBlockMenuPlugin).toBe('function');
		expect(window.blockMenuPluginKey).toBeTruthy();
		expect(window.ProseMirrorBlockMenuInternals).toBeTruthy();
	});

	// -----------------------------------------------------------------------
	// blockCatalog
	// -----------------------------------------------------------------------
	describe('blockCatalog', () => {
		const { blockCatalog } = window.ProseMirrorBlockMenuInternals || {};

		it('returns only items whose node type exists in the schema', () => {
			const { blockCatalog } = window.ProseMirrorBlockMenuInternals;
			const schema = { nodes: { paragraph: {}, heading: {} } };
			const result = blockCatalog(schema);
			const keys = result.map((it) => it.key);
			// paragraph and the three heading variants should be present
			expect(keys).toContain('paragraph');
			expect(keys).toContain('h1');
			expect(keys).toContain('h2');
			expect(keys).toContain('h3');
			// types not in schema must be absent
			expect(keys).not.toContain('bullet_list');
			expect(keys).not.toContain('ordered_list');
			expect(keys).not.toContain('blockquote');
			expect(keys).not.toContain('code_block');
			expect(keys).not.toContain('table');
			expect(keys).not.toContain('horizontal_rule');
		});

		it('returns all items when schema has every node type', () => {
			const { blockCatalog } = window.ProseMirrorBlockMenuInternals;
			const schema = {
				nodes: {
					paragraph: {},
					heading: {},
					bullet_list: {},
					ordered_list: {},
					blockquote: {},
					code_block: {},
					table: {},
					horizontal_rule: {},
				},
			};
			const result = blockCatalog(schema);
			expect(result.length).toBe(10);
		});

		it('returns empty array when schema has no matching node types', () => {
			const { blockCatalog } = window.ProseMirrorBlockMenuInternals;
			const result = blockCatalog({ nodes: { custom_block: {} } });
			expect(result).toEqual([]);
		});

		it('each item has key, label, and node properties', () => {
			const { blockCatalog } = window.ProseMirrorBlockMenuInternals;
			const schema = { nodes: { paragraph: {}, heading: {} } };
			const result = blockCatalog(schema);
			for (const item of result) {
				expect(item).toHaveProperty('key');
				expect(item).toHaveProperty('label');
				expect(item).toHaveProperty('node');
			}
		});
	});

	// -----------------------------------------------------------------------
	// moveBlock
	// -----------------------------------------------------------------------
	describe('moveBlock', () => {
		/**
		 * Build a fake ProseMirror view whose tr chain records calls so we can
		 * assert the sequence: delete → mapping.map → insert → scrollIntoView →
		 * dispatch.
		 */
		function buildFakeView({ nodeAtReturn = { nodeSize: 5 } } = {}) {
			const scrollIntoView = vi.fn(function () { return this; });
			const insertResult = { scrollIntoView };
			const insertFn = vi.fn(() => insertResult);

			const mappingMapFn = vi.fn(() => 10); // mapped insertion position
			const mappingObj = { map: mappingMapFn };

			const deleteFn = vi.fn(function () {
				return { mapping: mappingObj, insert: insertFn };
			});

			const trObj = { delete: deleteFn };
			const dispatch = vi.fn();
			const view = {
				state: {
					doc: { nodeAt: vi.fn(() => nodeAtReturn), resolve: vi.fn(() => ({})) },
					tr: trObj,
				},
				dispatch,
			};
			return { view, dispatch, deleteFn, insertFn, scrollIntoView, mappingMapFn };
		}

		it('is a no-op when targetPos is inside [from, from+size)', () => {
			const { moveBlock } = window.ProseMirrorBlockMenuInternals;
			const { view, dispatch } = buildFakeView();
			moveBlock(view, 5, 10, 7); // target 7 is inside [5, 15)
			expect(dispatch).not.toHaveBeenCalled();
		});

		it('is a no-op when targetPos equals from', () => {
			const { moveBlock } = window.ProseMirrorBlockMenuInternals;
			const { view, dispatch } = buildFakeView();
			moveBlock(view, 5, 10, 5); // target == from
			expect(dispatch).not.toHaveBeenCalled();
		});

		it('is a no-op when nodeAt returns null', () => {
			const { moveBlock } = window.ProseMirrorBlockMenuInternals;
			const { view, dispatch } = buildFakeView({ nodeAtReturn: null });
			moveBlock(view, 5, 10, 20);
			expect(dispatch).not.toHaveBeenCalled();
		});

		it('calls delete then insert then dispatch when target is after the block', () => {
			const { moveBlock } = window.ProseMirrorBlockMenuInternals;
			const { view, dispatch, deleteFn, insertFn, scrollIntoView } = buildFakeView();
			moveBlock(view, 5, 10, 20); // target 20 is outside [5, 15)
			expect(deleteFn).toHaveBeenCalledWith(5, 15);
			expect(insertFn).toHaveBeenCalled();
			expect(scrollIntoView).toHaveBeenCalled();
			expect(dispatch).toHaveBeenCalledTimes(1);
		});

		it('calls delete then insert then dispatch when target is before the block', () => {
			const { moveBlock } = window.ProseMirrorBlockMenuInternals;
			const { view, dispatch, deleteFn, insertFn } = buildFakeView();
			moveBlock(view, 10, 5, 2); // target 2 is before [10, 15)
			expect(deleteFn).toHaveBeenCalledWith(10, 15);
			expect(insertFn).toHaveBeenCalled();
			expect(dispatch).toHaveBeenCalledTimes(1);
		});

		it('passes the mapped target position to insert', () => {
			const { moveBlock } = window.ProseMirrorBlockMenuInternals;
			const { view, insertFn, mappingMapFn } = buildFakeView();
			// mappingMapFn returns 10
			moveBlock(view, 5, 10, 20);
			const mappedPos = mappingMapFn.mock.results[0].value;
			expect(insertFn).toHaveBeenCalledWith(mappedPos, expect.anything());
		});
	});

	// -----------------------------------------------------------------------
	// Plugin view — gutter, popup, insert, destroy
	// -----------------------------------------------------------------------
	describe('proseMirrorBlockMenuPlugin — view lifecycle', () => {
		function buildEditorView() {
			// Create a container that IS in the document so parentNode exists.
			const container = document.createElement('div');
			document.body.appendChild(container);
			const editorDom = document.createElement('div');
			container.appendChild(editorDom);

			const fakeView = {
				dom: editorDom,
				state: {
					schema: { nodes: { paragraph: {}, heading: {} } },
					doc: { resolve: vi.fn(() => ({})) },
					tr: {
						setSelection: vi.fn(function () { return this; }),
						delete: vi.fn(function () { return this; }),
					},
				},
				posAtCoords: vi.fn(() => null),
				nodeDOM: vi.fn(() => null),
				dispatch: vi.fn(),
				focus: vi.fn(),
			};
			return { fakeView, container };
		}

		it('appends a .prosemirror-block-gutter to the editor host', () => {
			const fakeEditorWrapper = { schema: { nodes: { paragraph: {}, heading: {} } } };
			const plugin = window.proseMirrorBlockMenuPlugin({ editor: fakeEditorWrapper });
			const { fakeView, container } = buildEditorView();

			plugin.spec.view(fakeView);

			expect(container.querySelector('.prosemirror-block-gutter')).toBeTruthy();
		});

		it('opens a .prosemirror-block-menu-popup with items when [data-role="add"] is clicked', () => {
			const fakeEditorWrapper = { schema: { nodes: { paragraph: {}, heading: {} } } };
			const plugin = window.proseMirrorBlockMenuPlugin({ editor: fakeEditorWrapper });
			const { fakeView, container } = buildEditorView();

			plugin.spec.view(fakeView);

			const addBtn = container.querySelector('[data-role="add"]');
			expect(addBtn).toBeTruthy();
			addBtn.click();

			const popup = container.querySelector('.prosemirror-block-menu-popup');
			expect(popup).toBeTruthy();
			const items = container.querySelectorAll('.prosemirror-block-menu-item');
			expect(items.length).toBeGreaterThan(0);
		});

		it('filter input narrows the visible items', () => {
			const fakeEditorWrapper = {};
			const plugin = window.proseMirrorBlockMenuPlugin({ editor: fakeEditorWrapper });
			const { fakeView, container } = buildEditorView();

			plugin.spec.view(fakeView);
			container.querySelector('[data-role="add"]').click();

			const filter = container.querySelector('.prosemirror-block-menu-filter');
			expect(filter).toBeTruthy();

			const totalBefore = container.querySelectorAll('.prosemirror-block-menu-item').length;

			// Type a string that only matches "Paragraph"
			filter.value = 'Paragraph';
			filter.dispatchEvent(new Event('input'));

			const totalAfter = container.querySelectorAll('.prosemirror-block-menu-item').length;
			expect(totalAfter).toBeLessThan(totalBefore);
			expect(totalAfter).toBe(1);
		});

		it('mousedown on an item calls insertBlock and closes the popup', () => {
			const fakeEditorWrapper = { schema: {} };
			const plugin = window.proseMirrorBlockMenuPlugin({ editor: fakeEditorWrapper });
			const { fakeView, container } = buildEditorView();

			plugin.spec.view(fakeView);
			container.querySelector('[data-role="add"]').click();

			const item = container.querySelector('.prosemirror-block-menu-item');
			expect(item).toBeTruthy();

			item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

			// insertBlock should have been called with the editorWrapper and a node name
			expect(window.ProseMirrorCommands.insertBlock).toHaveBeenCalledWith(
				fakeEditorWrapper,
				expect.any(String),
				expect.toSatisfy((v) => v === undefined || typeof v === 'object')
			);
			// Popup should be gone
			expect(container.querySelector('.prosemirror-block-menu-popup')).toBeFalsy();
		});

		it('clicking [data-role="add"] again closes an open popup (toggle)', () => {
			const plugin = window.proseMirrorBlockMenuPlugin({});
			const { fakeView, container } = buildEditorView();

			plugin.spec.view(fakeView);
			const addBtn = container.querySelector('[data-role="add"]');
			addBtn.click(); // open
			expect(container.querySelector('.prosemirror-block-menu-popup')).toBeTruthy();
			addBtn.click(); // close
			expect(container.querySelector('.prosemirror-block-menu-popup')).toBeFalsy();
		});

		it('destroy removes the gutter from the DOM', () => {
			const plugin = window.proseMirrorBlockMenuPlugin({});
			const { fakeView, container } = buildEditorView();

			const pluginView = plugin.spec.view(fakeView);
			expect(container.querySelector('.prosemirror-block-gutter')).toBeTruthy();

			pluginView.destroy();
			expect(container.querySelector('.prosemirror-block-gutter')).toBeFalsy();
		});

		it('destroy also removes any open popup', () => {
			const plugin = window.proseMirrorBlockMenuPlugin({});
			const { fakeView, container } = buildEditorView();

			const pluginView = plugin.spec.view(fakeView);
			container.querySelector('[data-role="add"]').click(); // open popup
			expect(container.querySelector('.prosemirror-block-menu-popup')).toBeTruthy();

			pluginView.destroy();
			expect(container.querySelector('.prosemirror-block-menu-popup')).toBeFalsy();
		});

		it('plugin key is "exeBlockMenu"', () => {
			expect(window.blockMenuPluginKey.key).toBe('exeBlockMenu');
		});
	});
});
