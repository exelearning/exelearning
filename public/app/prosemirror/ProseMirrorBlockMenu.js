/**
 * ProseMirror Block Menu plugin
 *
 * Adds a Notion/Lexical-style gutter next to the block under the pointer with:
 *   - a `+` button that opens a filterable "Filter blocks…" popup to insert a block
 *   - a `⠿` drag handle to reorder blocks
 *
 * Vanilla ProseMirror plugin. Added to the editor only in "modern" mode by
 * ProseMirrorEditorMode, and removed (with its DOM) when switching to classic.
 */
(function () {
	'use strict';

	const t = (s) => (typeof _ === 'function' ? _(s) : s);
	const { Plugin, PluginKey } = window.ProseMirrorBundle;
	const blockMenuPluginKey = new PluginKey('exeBlockMenu');

	/**
	 * Catalog of insertable blocks, filtered to those the schema supports.
	 */
	function blockCatalog(schema) {
		const all = [
			{ key: 'paragraph', label: t('Paragraph'), node: 'paragraph' },
			{ key: 'h1', label: t('Heading 1'), node: 'heading', attrs: { level: 1 } },
			{ key: 'h2', label: t('Heading 2'), node: 'heading', attrs: { level: 2 } },
			{ key: 'h3', label: t('Heading 3'), node: 'heading', attrs: { level: 3 } },
			{ key: 'bullet_list', label: t('Bullet list'), node: 'bullet_list' },
			{ key: 'ordered_list', label: t('Numbered list'), node: 'ordered_list' },
			{ key: 'blockquote', label: t('Quote'), node: 'blockquote' },
			{ key: 'code_block', label: t('Code block'), node: 'code_block' },
			{ key: 'table', label: t('Table'), node: 'table' },
			{ key: 'horizontal_rule', label: t('Horizontal rule'), node: 'horizontal_rule' },
		];
		return all.filter((it) => schema.nodes[it.node]);
	}

	/**
	 * Find the document position of the top-level block whose rendered box
	 * contains the given viewport Y coordinate.
	 * @returns {{ pos: number, dom: HTMLElement, node: Node } | null}
	 */
	function blockAtCoords(view, clientX, clientY) {
		const dom = view.dom;
		const rect = dom.getBoundingClientRect();
		// Probe near the left edge of the content so we hit the block even when
		// the pointer is over the gutter.
		const probeX = rect.left + 24;
		const coords = view.posAtCoords({ left: probeX, top: clientY });
		if (!coords) return null;
		const $pos = view.state.doc.resolve(coords.pos);
		// Top-level block is at depth 1 (depth 0 is the doc).
		const depth = Math.min(1, $pos.depth);
		const blockPos = $pos.before(depth + 0 === 0 ? 1 : depth);
		// Resolve the position before the depth-1 ancestor.
		let topPos;
		try {
			topPos = $pos.before(1);
		} catch (e) {
			return null;
		}
		const node = view.state.doc.nodeAt(topPos);
		const nodeDom = view.nodeDOM(topPos);
		if (!node || !nodeDom || nodeDom.nodeType !== 1) return null;
		return { pos: topPos, dom: nodeDom, node };
	}

	function proseMirrorBlockMenuPlugin(options) {
		options = options || {};
		const editorWrapper = options.editor; // the ProseMirrorEditor instance

		return new Plugin({
			key: blockMenuPluginKey,
			view(editorView) {
				const host = editorView.dom.parentNode;
				if (host && getComputedStyle(host).position === 'static') {
					host.style.position = 'relative';
				}

				// Gutter (the + and drag handle)
				const gutter = document.createElement('div');
				gutter.className = 'prosemirror-block-gutter';
				gutter.style.display = 'none';
				const addBtn = document.createElement('button');
				addBtn.type = 'button';
				addBtn.className = 'prosemirror-block-handle';
				addBtn.setAttribute('data-role', 'add');
				addBtn.setAttribute('title', t('Insert block'));
				addBtn.textContent = '+';
				const dragBtn = document.createElement('button');
				dragBtn.type = 'button';
				dragBtn.className = 'prosemirror-block-handle';
				dragBtn.setAttribute('data-role', 'drag');
				dragBtn.setAttribute('title', t('Drag to reorder'));
				dragBtn.setAttribute('draggable', 'true');
				dragBtn.textContent = '☰'; // ☰
				gutter.appendChild(addBtn);
				gutter.appendChild(dragBtn);
				host.appendChild(gutter);

				let currentBlock = null; // { pos, dom, node }
				let popup = null;

				function positionGutterTo(block) {
					currentBlock = block;
					const hostRect = host.getBoundingClientRect();
					const blockRect = block.dom.getBoundingClientRect();
					gutter.style.display = 'flex';
					gutter.style.top = `${blockRect.top - hostRect.top}px`;
				}

				function hideGutter() {
					if (!popup) gutter.style.display = 'none';
				}

				function closePopup() {
					if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
					popup = null;
				}

				function openPopup() {
					closePopup();
					const schema = editorView.state.schema;
					const items = blockCatalog(schema);
					popup = document.createElement('div');
					popup.className = 'prosemirror-block-menu-popup';

					const input = document.createElement('input');
					input.type = 'text';
					input.className = 'prosemirror-block-menu-filter';
					input.placeholder = t('Filter blocks…');
					popup.appendChild(input);

					const list = document.createElement('div');
					list.className = 'prosemirror-block-menu-list';
					popup.appendChild(list);

					function renderList(filter) {
						list.innerHTML = '';
						const f = (filter || '').toLowerCase();
						items
							.filter((it) => it.label.toLowerCase().includes(f))
							.forEach((it) => {
								const row = document.createElement('div');
								row.className = 'prosemirror-block-menu-item';
								row.setAttribute('data-block', it.key);
								row.textContent = it.label;
								row.addEventListener('mousedown', (e) => {
									e.preventDefault();
									insertChosen(it);
								});
								list.appendChild(row);
							});
					}

					function insertChosen(it) {
						// Place the selection inside the current block before inserting.
						if (currentBlock) {
							const sel = window.ProseMirrorBundle.TextSelection.near(
								editorView.state.doc.resolve(currentBlock.pos + 1)
							);
							editorView.dispatch(editorView.state.tr.setSelection(sel));
						}
						if (window.ProseMirrorCommands && editorWrapper) {
							window.ProseMirrorCommands.insertBlock(editorWrapper, it.node, it.attrs);
						}
						closePopup();
						editorView.focus();
					}

					input.addEventListener('input', () => renderList(input.value));
					renderList('');

					// Position popup near the gutter
					popup.style.position = 'absolute';
					popup.style.top = gutter.style.top;
					popup.style.left = '36px';
					host.appendChild(popup);
					input.focus();
				}

				addBtn.addEventListener('click', (e) => {
					e.preventDefault();
					e.stopPropagation();
					if (popup) closePopup();
					else openPopup();
				});

				// Close popup on outside click
				const onDocMouseDown = (e) => {
					if (popup && !popup.contains(e.target) && e.target !== addBtn) {
						closePopup();
					}
				};
				document.addEventListener('mousedown', onDocMouseDown, true);

				// Track pointer to position the gutter
				const onMouseMove = (e) => {
					if (popup) return;
					const block = blockAtCoords(editorView, e.clientX, e.clientY);
					if (block) positionGutterTo(block);
				};
				editorView.dom.addEventListener('mousemove', onMouseMove);
				const onMouseLeave = () => hideGutter();
				editorView.dom.addEventListener('mouseleave', onMouseLeave);

				// --- Drag to reorder ---
				dragBtn.addEventListener('dragstart', (e) => {
					if (!currentBlock) return;
					const { pos, node } = currentBlock;
					e.dataTransfer.effectAllowed = 'move';
					e.dataTransfer.setData('text/plain', '');
					gutter.dataset.dragFrom = String(pos);
					gutter.dataset.dragSize = String(node.nodeSize);
				});

				const onDrop = (e) => {
					const fromStr = gutter.dataset.dragFrom;
					if (fromStr == null) return;
					e.preventDefault();
					const from = Number(fromStr);
					const size = Number(gutter.dataset.dragSize);
					delete gutter.dataset.dragFrom;
					delete gutter.dataset.dragSize;
					const target = blockAtCoords(editorView, e.clientX, e.clientY);
					if (!target) return;
					moveBlock(editorView, from, size, target.pos);
				};
				editorView.dom.addEventListener('drop', onDrop);
				const onDragOver = (e) => {
					if (gutter.dataset.dragFrom != null) e.preventDefault();
				};
				editorView.dom.addEventListener('dragover', onDragOver);

				return {
					update() {
						if (popup) {
							gutter.style.display = 'flex';
						}
					},
					destroy() {
						closePopup();
						document.removeEventListener('mousedown', onDocMouseDown, true);
						editorView.dom.removeEventListener('mousemove', onMouseMove);
						editorView.dom.removeEventListener('mouseleave', onMouseLeave);
						editorView.dom.removeEventListener('drop', onDrop);
						editorView.dom.removeEventListener('dragover', onDragOver);
						if (gutter.parentNode) gutter.parentNode.removeChild(gutter);
					},
				};
			},
		});
	}

	/**
	 * Move the block [from, from+size) so that it lands at the boundary of the
	 * block currently at targetPos. No-op if dropping onto itself.
	 */
	function moveBlock(view, from, size, targetPos) {
		if (targetPos >= from && targetPos < from + size) return; // dropping into itself
		const state = view.state;
		const node = state.doc.nodeAt(from);
		if (!node) return;
		let tr = state.tr.delete(from, from + size);
		// Map the target through the deletion.
		let insertAt = tr.mapping.map(targetPos, -1);
		// Insert before the target block.
		tr = tr.insert(insertAt, node);
		view.dispatch(tr.scrollIntoView());
	}

	window.proseMirrorBlockMenuPlugin = proseMirrorBlockMenuPlugin;
	window.blockMenuPluginKey = blockMenuPluginKey;
	window.ProseMirrorBlockMenuInternals = { blockCatalog, blockAtCoords, moveBlock };
})();
