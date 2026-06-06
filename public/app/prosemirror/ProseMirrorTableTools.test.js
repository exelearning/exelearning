import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadScript(rel) {
	const code = readFileSync(join(__dirname, rel), 'utf-8');
	(0, eval)(code);
}

function setupBundle(overrides = {}) {
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
		isInTable: vi.fn(() => true),
		setCellAttr: vi.fn(() => vi.fn()),
		addRowBefore: vi.fn(() => true),
		addRowAfter: vi.fn(() => true),
		deleteRow: vi.fn(() => true),
		addColumnBefore: vi.fn(() => true),
		addColumnAfter: vi.fn(() => true),
		deleteColumn: vi.fn(() => true),
		mergeCells: vi.fn(() => true),
		splitCell: vi.fn(() => true),
		toggleHeaderRow: vi.fn(() => true),
		deleteTable: vi.fn(() => true),
		...overrides,
	};
	global.window.ProseMirrorIcons = { getIcon: vi.fn((n) => `<svg data-icon="${n}"></svg>`) };
	global.window.ProseMirrorDialog = { openForm: vi.fn(async () => null) };
}

function mkNodeType(name) {
	return {
		name,
		createAndFill: vi.fn(() => ({ type: name })),
		create: vi.fn((attrs, content) => ({ type: name, attrs, content })),
	};
}

function buildChainableTr() {
	return {
		replaceSelectionWith: vi.fn(function () {
			return this;
		}),
		scrollIntoView: vi.fn(function () {
			return this;
		}),
	};
}

function buildEditor(selection = {}) {
	const tr = buildChainableTr();
	const dispatch = vi.fn();
	const nodes = {
		table: mkNodeType('table'),
		table_row: mkNodeType('table_row'),
		table_cell: mkNodeType('table_cell'),
		table_header: mkNodeType('table_header'),
	};
	const schema = { nodes };
	const view = { state: { schema, selection, tr }, dispatch };
	return { view, schema, focus: vi.fn(), _tr: tr, _dispatch: dispatch, _nodes: nodes };
}

describe('ProseMirrorTableTools', () => {
	beforeEach(() => {
		if (typeof global._ !== 'function') global._ = (s) => s;
		setupBundle();
		loadScript('./ProseMirrorTableTools.js');
	});

	afterEach(() => {
		delete global.window.ProseMirrorTableTools;
		delete global.window.proseMirrorTableToolbarPlugin;
		delete global.window.tableToolbarPluginKey;
		delete global.window.ProseMirrorTableToolsInternals;
		delete global.window.ProseMirrorBundle;
		delete global.window.ProseMirrorIcons;
		delete global.window.ProseMirrorDialog;
		document.body.innerHTML = '';
		vi.restoreAllMocks();
	});

	// -------------------------------------------------------------------------
	// Exports
	// -------------------------------------------------------------------------
	it('exposes the public API, plugin factory, key, and internals', () => {
		const api = window.ProseMirrorTableTools;
		expect(typeof api.openInsertDialog).toBe('function');
		expect(typeof api.insertTable).toBe('function');
		expect(typeof api.openProperties).toBe('function');
		expect(typeof api.runCommand).toBe('function');
		expect(typeof api.isInTable).toBe('function');
		expect(typeof window.proseMirrorTableToolbarPlugin).toBe('function');
		expect(window.tableToolbarPluginKey.key).toBe('exeTableToolbar');
		expect(window.ProseMirrorTableToolsInternals).toBeTruthy();
	});

	// -------------------------------------------------------------------------
	// normalizeTableSpec
	// -------------------------------------------------------------------------
	describe('normalizeTableSpec', () => {
		let normalize;
		beforeEach(() => {
			normalize = window.ProseMirrorTableToolsInternals.normalizeTableSpec;
		});

		it('passes through sane values', () => {
			expect(normalize({ rows: 2, cols: 4, headerRow: false })).toEqual({ rows: 2, cols: 4, headerRow: false });
		});

		it('defaults missing values to 3×3 with a header row', () => {
			expect(normalize({})).toEqual({ rows: 3, cols: 3, headerRow: true });
			expect(normalize()).toEqual({ rows: 3, cols: 3, headerRow: true });
		});

		it('coerces strings and falls back on non-positive values', () => {
			expect(normalize({ rows: '5', cols: 0 })).toEqual({ rows: 5, cols: 3, headerRow: true });
		});

		it('clamps to the maximum size', () => {
			expect(normalize({ rows: 100, cols: 999 })).toEqual({ rows: 50, cols: 50, headerRow: true });
		});
	});

	// -------------------------------------------------------------------------
	// insertTable
	// -------------------------------------------------------------------------
	describe('insertTable', () => {
		it('builds rows/cols and uses header cells for the first row', () => {
			const editor = buildEditor();
			const ok = window.ProseMirrorTableTools.insertTable(editor, { rows: 2, cols: 2, headerRow: true });
			expect(ok).toBe(true);
			expect(editor._nodes.table_header.createAndFill).toHaveBeenCalledTimes(2); // header row
			expect(editor._nodes.table_cell.createAndFill).toHaveBeenCalledTimes(2); // body row
			expect(editor._nodes.table_row.create).toHaveBeenCalledTimes(2);
			expect(editor._nodes.table.create).toHaveBeenCalledTimes(1);
			expect(editor._tr.replaceSelectionWith).toHaveBeenCalled();
			expect(editor._dispatch).toHaveBeenCalled();
			expect(editor.focus).toHaveBeenCalled();
		});

		it('uses only body cells when there is no header row', () => {
			const editor = buildEditor();
			window.ProseMirrorTableTools.insertTable(editor, { rows: 2, cols: 3, headerRow: false });
			expect(editor._nodes.table_header.createAndFill).not.toHaveBeenCalled();
			expect(editor._nodes.table_cell.createAndFill).toHaveBeenCalledTimes(6);
		});

		it('returns false when the schema has no table node', () => {
			const editor = buildEditor();
			editor.schema.nodes = {};
			expect(window.ProseMirrorTableTools.insertTable(editor, { rows: 2, cols: 2 })).toBe(false);
			expect(editor._dispatch).not.toHaveBeenCalled();
		});
	});

	// -------------------------------------------------------------------------
	// openInsertDialog
	// -------------------------------------------------------------------------
	describe('openInsertDialog', () => {
		it('opens the dialog and inserts on confirm', async () => {
			const editor = buildEditor();
			window.ProseMirrorDialog.openForm = vi.fn(async () => ({ rows: 2, cols: 2, headerRow: false }));
			await window.ProseMirrorTableTools.openInsertDialog(editor);
			expect(window.ProseMirrorDialog.openForm).toHaveBeenCalled();
			expect(editor._nodes.table.create).toHaveBeenCalled();
		});

		it('focuses and does nothing on cancel', async () => {
			const editor = buildEditor();
			window.ProseMirrorDialog.openForm = vi.fn(async () => null);
			await window.ProseMirrorTableTools.openInsertDialog(editor);
			expect(editor.focus).toHaveBeenCalled();
			expect(editor._dispatch).not.toHaveBeenCalled();
		});

		it('is a no-op without the dialog framework or table node', async () => {
			const editor = buildEditor();
			delete window.ProseMirrorDialog;
			await window.ProseMirrorTableTools.openInsertDialog(editor);
			expect(editor._dispatch).not.toHaveBeenCalled();
		});
	});

	// -------------------------------------------------------------------------
	// runCommand
	// -------------------------------------------------------------------------
	describe('runCommand', () => {
		it('runs a bundled command and focuses', () => {
			const editor = buildEditor();
			const ok = window.ProseMirrorTableTools.runCommand(editor, 'addRowBefore');
			expect(ok).toBe(true);
			expect(window.ProseMirrorBundle.addRowBefore).toHaveBeenCalledWith(editor.view.state, editor.view.dispatch, editor.view);
			expect(editor.focus).toHaveBeenCalled();
		});

		it('returns false for an unknown command', () => {
			const editor = buildEditor();
			expect(window.ProseMirrorTableTools.runCommand(editor, 'nope')).toBe(false);
		});
	});

	// -------------------------------------------------------------------------
	// currentCellAttrs / applyCellAttrs / openProperties
	// -------------------------------------------------------------------------
	describe('cell properties', () => {
		function selectionInCell(attrs) {
			const cellNode = { type: { spec: { tableRole: 'cell' } }, attrs };
			return {
				$from: {
					depth: 2,
					node: (d) => (d === 2 ? cellNode : { type: { spec: {} } }),
				},
			};
		}

		it('currentCellAttrs reads background / border from the enclosing cell', () => {
			const { currentCellAttrs } = window.ProseMirrorTableToolsInternals;
			const view = { state: { selection: selectionInCell({ background: '#f00', borderColor: '#00f' }) } };
			expect(currentCellAttrs(view)).toEqual({ background: '#f00', borderColor: '#00f' });
		});

		it('currentCellAttrs returns empty when not inside a cell', () => {
			const { currentCellAttrs } = window.ProseMirrorTableToolsInternals;
			const view = { state: { selection: { $from: { depth: 1, node: () => ({ type: { spec: {} } }) } } } };
			expect(currentCellAttrs(view)).toEqual({});
		});

		it('applyCellAttrs sets background and border via setCellAttr', () => {
			const editor = buildEditor();
			window.ProseMirrorTableTools.applyCellAttrs(editor, { background: '#f00', borderColor: '#00f' });
			expect(window.ProseMirrorBundle.setCellAttr).toHaveBeenCalledWith('background', '#f00');
			expect(window.ProseMirrorBundle.setCellAttr).toHaveBeenCalledWith('borderColor', '#00f');
			expect(editor.focus).toHaveBeenCalled();
		});

		it('openProperties opens a prefilled dialog and applies on confirm', async () => {
			const editor = buildEditor(selectionInCell({ background: '#abcabc', borderColor: null }));
			window.ProseMirrorDialog.openForm = vi.fn(async (cfg) => {
				const bg = cfg.fields.find((f) => f.name === 'background');
				expect(bg.value).toBe('#abcabc');
				return { background: '#123123', borderColor: '#000000' };
			});
			await window.ProseMirrorTableTools.openProperties(editor);
			expect(window.ProseMirrorBundle.setCellAttr).toHaveBeenCalledWith('background', '#123123');
		});

		it('openProperties is a no-op when not inside a table', async () => {
			window.ProseMirrorBundle.isInTable = vi.fn(() => false);
			const editor = buildEditor();
			window.ProseMirrorDialog.openForm = vi.fn();
			await window.ProseMirrorTableTools.openProperties(editor);
			expect(window.ProseMirrorDialog.openForm).not.toHaveBeenCalled();
		});
	});

	// -------------------------------------------------------------------------
	// runToolbarAction
	// -------------------------------------------------------------------------
	describe('runToolbarAction', () => {
		it('routes "properties" to the properties dialog', () => {
			const { runToolbarAction } = window.ProseMirrorTableToolsInternals;
			const editor = buildEditor({ $from: { depth: 2, node: (d) => (d === 2 ? { type: { spec: { tableRole: 'cell' } }, attrs: {} } : { type: { spec: {} } }) } });
			window.ProseMirrorDialog.openForm = vi.fn(async () => null);
			runToolbarAction(editor, 'properties');
			expect(window.ProseMirrorDialog.openForm).toHaveBeenCalled();
		});

		it('routes other commands to runCommand', () => {
			const { runToolbarAction } = window.ProseMirrorTableToolsInternals;
			const editor = buildEditor();
			runToolbarAction(editor, 'deleteRow');
			expect(window.ProseMirrorBundle.deleteRow).toHaveBeenCalled();
		});
	});

	// -------------------------------------------------------------------------
	// tableElementAt
	// -------------------------------------------------------------------------
	describe('tableElementAt', () => {
		it('returns the closest table element from the selection', () => {
			const { tableElementAt } = window.ProseMirrorTableToolsInternals;
			const table = document.createElement('table');
			const td = document.createElement('td');
			const text = document.createTextNode('x');
			td.appendChild(text);
			table.appendChild(td);
			document.body.appendChild(table);
			const view = { state: { selection: { from: 1 } }, domAtPos: () => ({ node: text }) };
			expect(tableElementAt(view)).toBe(table);
		});

		it('returns null when domAtPos throws', () => {
			const { tableElementAt } = window.ProseMirrorTableToolsInternals;
			const view = {
				state: { selection: { from: 1 } },
				domAtPos: () => {
					throw new Error('boom');
				},
			};
			expect(tableElementAt(view)).toBeNull();
		});
	});

	// -------------------------------------------------------------------------
	// Plugin
	// -------------------------------------------------------------------------
	describe('proseMirrorTableToolbarPlugin', () => {
		function buildEditorView({ inTable = true, focused = true } = {}) {
			window.ProseMirrorBundle.isInTable = vi.fn(() => inTable);
			const host = document.createElement('div');
			const dom = document.createElement('div');
			host.appendChild(dom);
			document.body.appendChild(host);
			const table = document.createElement('table');
			dom.appendChild(table);
			return {
				dom,
				state: { schema: { nodes: {} }, selection: { from: 1 } },
				hasFocus: () => focused,
				coordsAtPos: vi.fn(() => ({ left: 10, top: 40, bottom: 60 })),
				domAtPos: () => ({ node: table }),
				focus: vi.fn(),
				_host: host,
			};
		}

		it('returns a Plugin with the table toolbar key', () => {
			expect(window.proseMirrorTableToolbarPlugin().key.key).toBe('exeTableToolbar');
		});

		it('builds a bar with one button per toolbar action and hides it outside a table', () => {
			const view = buildEditorView({ inTable: false });
			window.proseMirrorTableToolbarPlugin().spec.view(view);
			const bar = view._host.querySelector('.prosemirror-table-toolbar');
			expect(bar.querySelectorAll('.prosemirror-table-btn').length).toBe(11);
			expect(bar.style.display).toBe('none');
		});

		it('shows the bar when the selection is inside a focused table', () => {
			const view = buildEditorView({ inTable: true, focused: true });
			window.proseMirrorTableToolbarPlugin().spec.view(view);
			const bar = view._host.querySelector('.prosemirror-table-toolbar');
			expect(bar.style.display).toBe('flex');
		});

		it('runs the action on button mousedown using the passed editor', () => {
			const editor = buildEditor();
			const view = buildEditorView({ inTable: true });
			window.proseMirrorTableToolbarPlugin({ editor }).spec.view(view);
			const bar = view._host.querySelector('.prosemirror-table-toolbar');
			const delRow = bar.querySelector('[data-cmd="deleteRow"]');
			delRow.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
			expect(window.ProseMirrorBundle.deleteRow).toHaveBeenCalled();
		});

		it('cleans up the bar and listeners on destroy', () => {
			const removeSpy = vi.spyOn(window, 'removeEventListener');
			const view = buildEditorView({ inTable: false });
			const handle = window.proseMirrorTableToolbarPlugin().spec.view(view);
			handle.update();
			handle.destroy();
			expect(view._host.querySelector('.prosemirror-table-toolbar')).toBeNull();
			expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function), true);
			expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
		});
	});
});
