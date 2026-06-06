/**
 * ProseMirror Table tools
 *
 * Phase C of the editor-dialogs effort: an insert-table dialog (rows / cols /
 * header row), a contextual table-editing toolbar (modern mode) shown when the
 * selection is inside a table, and a cell-properties dialog (background / border
 * colour) — all built on the shared ProseMirrorDialog and the bundled
 * prosemirror-tables commands. Replaces the old prompt()-based table insert.
 */
(function () {
	'use strict';

	const t = (s) => (typeof _ === 'function' ? _(s) : s);
	const PM = window.ProseMirrorBundle || {};
	const { Plugin, PluginKey } = PM;
	const tableToolbarPluginKey = PluginKey ? new PluginKey('exeTableToolbar') : { key: 'exeTableToolbar' };

	const MAX_TABLE_SIZE = 50;

	function icon(name) {
		return (window.ProseMirrorIcons && window.ProseMirrorIcons.getIcon && window.ProseMirrorIcons.getIcon(name)) || '';
	}

	function isInTable(state) {
		return !!(state && typeof PM.isInTable === 'function' && PM.isInTable(state));
	}

	/** Clamp the raw dialog values into a sane table spec. Pure + testable. */
	function normalizeTableSpec(values) {
		values = values || {};
		const clamp = (n, fallback) => {
			const v = Math.round(Number(n));
			if (!Number.isFinite(v) || v < 1) return fallback;
			return Math.min(v, MAX_TABLE_SIZE);
		};
		return {
			rows: clamp(values.rows, 3),
			cols: clamp(values.cols, 3),
			headerRow: values.headerRow !== false,
		};
	}

	/** Build and insert a table node from a (raw) spec. */
	function insertTable(editor, rawSpec) {
		const { rows, cols, headerRow } = normalizeTableSpec(rawSpec);
		const nodes = editor.schema.nodes;
		const { table, table_row, table_cell, table_header } = nodes;
		if (!table || !table_row || !table_cell) return false;

		const buildRow = (cellType) => {
			const cells = [];
			for (let i = 0; i < cols; i++) cells.push(cellType.createAndFill());
			return table_row.create(null, cells);
		};

		const rowNodes = [];
		for (let r = 0; r < rows; r++) {
			const useHeader = headerRow && r === 0 && table_header;
			rowNodes.push(buildRow(useHeader ? table_header : table_cell));
		}

		const tableNode = table.create(null, rowNodes);
		const view = editor.view;
		view.dispatch(view.state.tr.replaceSelectionWith(tableNode).scrollIntoView());
		if (typeof editor.focus === 'function') editor.focus();
		return true;
	}

	/** Open the insert-table dialog. */
	async function openInsertDialog(editor) {
		if (!editor || !window.ProseMirrorDialog || !editor.schema.nodes.table) return;
		const values = await window.ProseMirrorDialog.openForm({
			title: t('Insert table'),
			submitLabel: t('Insert'),
			fields: [
				{ name: 'rows', type: 'number', label: t('Rows'), value: 3, min: 1, max: MAX_TABLE_SIZE },
				{ name: 'cols', type: 'number', label: t('Columns'), value: 3, min: 1, max: MAX_TABLE_SIZE },
				{ name: 'headerRow', type: 'checkbox', label: t('Header row'), value: true },
			],
		});
		if (values == null) {
			if (typeof editor.focus === 'function') editor.focus();
			return;
		}
		insertTable(editor, values);
	}

	/** Run a bundled prosemirror-tables command by name against the editor. */
	function runCommand(editor, name) {
		const cmd = PM[name];
		if (typeof cmd !== 'function') return false;
		const view = editor.view;
		const ok = cmd(view.state, view.dispatch, view);
		if (typeof editor.focus === 'function') editor.focus();
		return ok;
	}

	/** Read the background / border colour of the cell at the selection. */
	function currentCellAttrs(view) {
		const sel = view.state.selection;
		const $from = sel.$from;
		if (!$from) return {};
		for (let d = $from.depth; d > 0; d--) {
			const node = $from.node(d);
			const role = node.type.spec && node.type.spec.tableRole;
			if (role === 'cell' || role === 'header_cell') {
				return { background: node.attrs.background, borderColor: node.attrs.borderColor };
			}
		}
		return {};
	}

	/** Apply background / border colour to the selected cell(s). */
	function applyCellAttrs(editor, values) {
		if (typeof PM.setCellAttr !== 'function') return false;
		const view = editor.view;
		if (values.background) PM.setCellAttr('background', values.background)(view.state, view.dispatch);
		if (values.borderColor) PM.setCellAttr('borderColor', values.borderColor)(view.state, view.dispatch);
		if (typeof editor.focus === 'function') editor.focus();
		return true;
	}

	/** Open the cell-properties dialog (background / border colour). */
	async function openProperties(editor) {
		if (!editor || !window.ProseMirrorDialog || !isInTable(editor.view.state)) return;
		const current = currentCellAttrs(editor.view);
		const values = await window.ProseMirrorDialog.openForm({
			title: t('Cell properties'),
			submitLabel: t('OK'),
			fields: [
				{ name: 'background', type: 'color', label: t('Background color'), value: current.background || '#ffffff' },
				{ name: 'borderColor', type: 'color', label: t('Border color'), value: current.borderColor || '#000000' },
			],
		});
		if (values == null) {
			if (typeof editor.focus === 'function') editor.focus();
			return;
		}
		applyCellAttrs(editor, values);
	}

	/** Dispatch a contextual-toolbar action. */
	function runToolbarAction(editor, cmd) {
		if (cmd === 'properties') {
			openProperties(editor);
			return;
		}
		runCommand(editor, cmd);
	}

	// Contextual toolbar buttons: { cmd → bundled command name (or 'properties') }.
	const TOOLBAR_BUTTONS = [
		{ cmd: 'addRowBefore', icon: 'tablerowbefore', label: t('Insert row before') },
		{ cmd: 'addRowAfter', icon: 'tablerowafter', label: t('Insert row after') },
		{ cmd: 'deleteRow', icon: 'tablerowdelete', label: t('Delete row') },
		{ cmd: 'addColumnBefore', icon: 'tablecolbefore', label: t('Insert column before') },
		{ cmd: 'addColumnAfter', icon: 'tablecolafter', label: t('Insert column after') },
		{ cmd: 'deleteColumn', icon: 'tablecoldelete', label: t('Delete column') },
		{ cmd: 'mergeCells', icon: 'tablemerge', label: t('Merge cells') },
		{ cmd: 'splitCell', icon: 'tablesplit', label: t('Split cell') },
		{ cmd: 'toggleHeaderRow', icon: 'table', label: t('Toggle header row') },
		{ cmd: 'properties', icon: 'backcolor', label: t('Cell properties') },
		{ cmd: 'deleteTable', icon: 'tabledelete', label: t('Delete table') },
	];

	/** Find the <table> DOM element containing the current selection, if any. */
	function tableElementAt(view) {
		try {
			const dom = view.domAtPos(view.state.selection.from);
			let el = dom && dom.node;
			if (el && el.nodeType === 3) el = el.parentElement;
			return el && el.closest ? el.closest('table') : null;
		} catch (_e) {
			return null;
		}
	}

	/**
	 * Contextual table toolbar plugin (modern mode). Mirrors the image toolbar:
	 * a floating bar shown above the table while the selection is inside it, with
	 * row/column/merge/header/cell/delete actions; repositions on scroll/resize
	 * and tears itself down on destroy.
	 */
	function proseMirrorTableToolbarPlugin(options) {
		options = options || {};
		const passedEditor = options.editor || null;

		return new Plugin({
			key: tableToolbarPluginKey,
			view(editorView) {
				const host = editorView.dom.parentNode;
				if (host && getComputedStyle(host).position === 'static') {
					host.style.position = 'relative';
				}

				const editor = passedEditor || {
					view: editorView,
					schema: editorView.state.schema,
					focus: () => editorView.focus(),
				};

				const bar = document.createElement('div');
				bar.className = 'prosemirror-table-toolbar';
				bar.style.display = 'none';

				TOOLBAR_BUTTONS.forEach((b) => {
					const btn = document.createElement('button');
					btn.type = 'button';
					btn.className = 'prosemirror-table-btn';
					btn.setAttribute('data-cmd', b.cmd);
					btn.setAttribute('title', b.label);
					const svg = icon(b.icon);
					btn.innerHTML = svg || `<span>${b.label}</span>`;
					btn.addEventListener('mousedown', (e) => {
						// Keep the cell selection while the button is pressed.
						e.preventDefault();
						runToolbarAction(editor, b.cmd);
					});
					bar.appendChild(btn);
				});

				host.appendChild(bar);

				function hide() {
					bar.style.display = 'none';
				}

				function reposition() {
					if (!isInTable(editorView.state) || !editorView.hasFocus()) {
						hide();
						return;
					}
					const tableEl = tableElementAt(editorView);
					const hostRect = host.getBoundingClientRect();
					bar.style.display = 'flex';
					const barRect = bar.getBoundingClientRect();
					const ref = tableEl ? tableEl.getBoundingClientRect() : editorView.coordsAtPos(editorView.state.selection.from);
					let left = (ref.left != null ? ref.left : ref.x) - hostRect.left;
					left = Math.max(2, left);
					let top = (ref.top != null ? ref.top : ref.y) - hostRect.top - barRect.height - 8;
					if (top < 0) top = (ref.bottom || ref.top) - hostRect.top + 8; // flip below if no room above
					bar.style.left = `${left}px`;
					bar.style.top = `${top}px`;
				}

				const onScroll = () => {
					if (bar.style.display !== 'none') reposition();
				};
				window.addEventListener('scroll', onScroll, true);
				window.addEventListener('resize', onScroll);

				reposition();

				return {
					update() {
						reposition();
					},
					destroy() {
						window.removeEventListener('scroll', onScroll, true);
						window.removeEventListener('resize', onScroll);
						if (bar.parentNode) bar.parentNode.removeChild(bar);
					},
				};
			},
		});
	}

	window.ProseMirrorTableTools = {
		openInsertDialog,
		insertTable,
		openProperties,
		runCommand,
		applyCellAttrs,
		isInTable,
	};
	window.proseMirrorTableToolbarPlugin = proseMirrorTableToolbarPlugin;
	window.tableToolbarPluginKey = tableToolbarPluginKey;
	window.ProseMirrorTableToolsInternals = {
		normalizeTableSpec,
		currentCellAttrs,
		runToolbarAction,
		tableElementAt,
	};
})();
