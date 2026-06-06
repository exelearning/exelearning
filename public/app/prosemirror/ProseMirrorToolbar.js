/**
 * ProseMirror Toolbar Component - TinyMCE-like appearance
 *
 * Provides a complete toolbar matching TinyMCE's advanced configuration with:
 * - Menubar (Edit, Insert, Format, Table, Tools)
 * - Multiple button rows with all formatting options
 * - Format/Font/Size selectors
 * - Color pickers
 * - Modal dialogs for inserting elements
 */
(function () {
	'use strict';

	const {
		toggleMark,
		setBlockType,
		wrapIn,
		lift,
		chainCommands,
		undo,
		redo,
		wrapInList,
		liftListItem,
		addColumnAfter,
		addColumnBefore,
		deleteColumn,
		addRowAfter,
		addRowBefore,
		deleteRow,
		deleteTable,
		mergeCells,
		splitCell,
		toggleHeaderRow,
		toggleHeaderColumn,
		isInTable,
	} = window.ProseMirrorBundle;

	// Translation function fallback
	const _ = window._ || ((s) => s);

	/**
	 * Check if a mark is active at current selection
	 */
	function isMarkActive(state, markType) {
		const { from, $from, to, empty } = state.selection;
		if (empty) {
			return !!markType.isInSet(state.storedMarks || $from.marks());
		}
		return state.doc.rangeHasMark(from, to, markType);
	}

	/**
	 * Check if a block type is active at current selection
	 */
	function isBlockActive(state, nodeType, attrs = {}) {
		const { $from, to } = state.selection;
		let depth = $from.sharedDepth(to);
		while (depth >= 0) {
			const node = $from.node(depth);
			if (node.type === nodeType) {
				if (!attrs || Object.keys(attrs).every((key) => node.attrs[key] === attrs[key])) {
					return true;
				}
			}
			depth--;
		}
		return false;
	}

	/**
	 * Set text alignment for current block
	 */
	function setAlignment(align) {
		return function (state, dispatch) {
			const { from, to } = state.selection;
			let applied = false;

			state.doc.nodesBetween(from, to, (node, pos) => {
				if (node.type.name === 'paragraph' || node.type.name === 'heading') {
					if (dispatch) {
						const tr = state.tr.setNodeMarkup(pos, null, {
							...node.attrs,
							textAlign: align === 'left' ? null : align,
						});
						dispatch(tr);
					}
					applied = true;
				}
			});

			return applied;
		};
	}

	/**
	 * Insert horizontal rule
	 */
	function insertHorizontalRule(state, dispatch) {
		const { schema } = state;
		const hrType = schema.nodes.horizontal_rule;
		if (!hrType) return false;

		if (dispatch) {
			dispatch(state.tr.replaceSelectionWith(hrType.create()).scrollIntoView());
		}
		return true;
	}

	/**
	 * Clear all formatting marks from selection
	 */
	function clearFormatting(state, dispatch) {
		const { from, to } = state.selection;
		if (dispatch) {
			let tr = state.tr;
			// Remove all marks
			state.doc.nodesBetween(from, to, (node, pos) => {
				if (node.marks.length > 0) {
					node.marks.forEach((mark) => {
						tr = tr.removeMark(Math.max(from, pos), Math.min(to, pos + node.nodeSize), mark.type);
					});
				}
			});
			dispatch(tr);
		}
		return true;
	}

	/**
	 * Special characters map
	 */
	const SPECIAL_CHARS = [
		// Currency
		{ char: '€', name: 'Euro' },
		{ char: '£', name: 'Pound' },
		{ char: '¥', name: 'Yen' },
		{ char: '¢', name: 'Cent' },
		{ char: '©', name: 'Copyright' },
		{ char: '®', name: 'Registered' },
		{ char: '™', name: 'Trademark' },
		// Math
		{ char: '±', name: 'Plus-minus' },
		{ char: '×', name: 'Multiply' },
		{ char: '÷', name: 'Divide' },
		{ char: '≠', name: 'Not equal' },
		{ char: '≤', name: 'Less or equal' },
		{ char: '≥', name: 'Greater or equal' },
		{ char: '∞', name: 'Infinity' },
		{ char: '√', name: 'Square root' },
		{ char: 'π', name: 'Pi' },
		{ char: 'Σ', name: 'Sigma' },
		{ char: 'Ω', name: 'Omega' },
		// Arrows
		{ char: '←', name: 'Left arrow' },
		{ char: '→', name: 'Right arrow' },
		{ char: '↑', name: 'Up arrow' },
		{ char: '↓', name: 'Down arrow' },
		{ char: '↔', name: 'Left-right arrow' },
		// Punctuation
		{ char: '…', name: 'Ellipsis' },
		{ char: '–', name: 'En dash' },
		{ char: '—', name: 'Em dash' },
		{ char: '•', name: 'Bullet' },
		{ char: '·', name: 'Middle dot' },
		// Greek letters
		{ char: 'α', name: 'Alpha' },
		{ char: 'β', name: 'Beta' },
		{ char: 'γ', name: 'Gamma' },
		{ char: 'δ', name: 'Delta' },
		{ char: 'θ', name: 'Theta' },
		{ char: 'λ', name: 'Lambda' },
		{ char: 'μ', name: 'Mu' },
		// Fractions
		{ char: '½', name: 'One half' },
		{ char: '¼', name: 'One quarter' },
		{ char: '¾', name: 'Three quarters' },
		// Other
		{ char: '°', name: 'Degree' },
		{ char: '§', name: 'Section' },
		{ char: '¶', name: 'Paragraph' },
		{ char: '†', name: 'Dagger' },
		{ char: '‡', name: 'Double dagger' },
	];

	/**
	 * Common emoticons
	 */
	const EMOTICONS = [
		'😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂',
		'😉', '😍', '🥰', '😘', '😋', '😎', '🤔', '🤗', '🤩', '🥳',
		'😢', '😭', '😤', '😠', '😡', '🤯', '😱', '😨', '😰', '😥',
		'👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '👌', '🙏', '💪',
		'❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💖',
		'⭐', '🌟', '✨', '💫', '🔥', '💯', '✅', '❌', '⚠️', '💡',
	];

	/**
	 * Font families
	 */
	const FONT_FAMILIES = [
		{ value: '', label: _('Default') },
		{ value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
		{ value: 'Georgia, serif', label: 'Georgia' },
		{ value: 'Impact, sans-serif', label: 'Impact' },
		{ value: 'Tahoma, Geneva, sans-serif', label: 'Tahoma' },
		{ value: '"Times New Roman", Times, serif', label: 'Times New Roman' },
		{ value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
		{ value: '"Courier New", Courier, monospace', label: 'Courier New' },
		{ value: 'system-ui, -apple-system, sans-serif', label: 'System UI' },
	];

	/**
	 * Font sizes
	 */
	const FONT_SIZES = [
		{ value: '8pt', label: '8pt' },
		{ value: '9pt', label: '9pt' },
		{ value: '10pt', label: '10pt' },
		{ value: '11pt', label: '11pt' },
		{ value: '12pt', label: '12pt' },
		{ value: '14pt', label: '14pt' },
		{ value: '16pt', label: '16pt' },
		{ value: '18pt', label: '18pt' },
		{ value: '20pt', label: '20pt' },
		{ value: '24pt', label: '24pt' },
		{ value: '28pt', label: '28pt' },
		{ value: '36pt', label: '36pt' },
		{ value: '48pt', label: '48pt' },
		{ value: '72pt', label: '72pt' },
	];

	/**
	 * ProseMirrorToolbar class - TinyMCE-like
	 */
	class ProseMirrorToolbar {
		/**
		 * @param {Object} options
		 * @param {ProseMirrorEditor} options.editor - The editor instance
		 * @param {HTMLElement} options.container - Container for the toolbar
		 * @param {Function} [options.onMediaLibrary] - Callback to open media library
		 * @param {Function} [options.onLinkDialog] - Callback to open link dialog
		 */
		constructor(options = {}) {
			this.editor = options.editor;
			this.container = options.container;
			this.onMediaLibrary = options.onMediaLibrary || null;
			this.onLinkDialog = options.onLinkDialog || null;
			this.onSwitchToModern = options.onSwitchToModern || null;

			if (!this.editor || !this.container) {
				throw new Error('ProseMirrorToolbar: editor and container are required');
			}

			this.schema = this.editor.schema;
			this.buttons = [];
			this.menus = [];
			this._updateHandler = this._updateActiveStates.bind(this);
			this._openMenu = null;

			this._createToolbar();
			this._bindEvents();
		}

		/**
		 * Create the complete toolbar structure
		 * @private
		 */
		_createToolbar() {
			const wrapper = document.createElement('div');
			wrapper.className = 'prosemirror-toolbar-wrapper tox tox-tinymce';

			// Create menubar
			const menubar = this._createMenubar();
			wrapper.appendChild(menubar);

			// Create button rows
			const buttonRows = this._createButtonRows();
			wrapper.appendChild(buttonRows);

			this.container.appendChild(wrapper);
			this.wrapper = wrapper;
		}

		/**
		 * Create the menubar (Edit, Insert, Format, Table, Tools)
		 * @private
		 */
		_createMenubar() {
			const menubar = document.createElement('div');
			menubar.className = 'prosemirror-menubar tox-menubar';

			const menus = [
				{
					name: 'edit',
					label: _('Edit'),
					items: [
						{ name: 'undo', label: _('Undo'), icon: 'undo', shortcut: 'Ctrl+Z', command: () => undo },
						{ name: 'redo', label: _('Redo'), icon: 'redo', shortcut: 'Ctrl+Y', command: () => redo },
						{ type: 'separator' },
						{ name: 'selectall', label: _('Select all'), shortcut: 'Ctrl+A', action: 'selectAll' },
						{ name: 'searchreplace', label: _('Find and replace'), shortcut: 'Ctrl+H', action: 'searchReplace' },
						{ type: 'separator' },
						{ name: 'cut', label: _('Cut'), shortcut: 'Ctrl+X', action: 'cut' },
						{ name: 'copy', label: _('Copy'), shortcut: 'Ctrl+C', action: 'copy' },
						{ name: 'paste', label: _('Paste'), shortcut: 'Ctrl+V', action: 'paste' },
						{ name: 'pastetext', label: _('Paste as text'), action: 'pasteText' },
					],
				},
				{
					name: 'insert',
					label: _('Insert'),
					items: [
						{ name: 'template', label: _('Template...'), icon: 'template', action: 'template' },
						{ type: 'separator' },
						{ name: 'hr', label: _('Horizontal line'), icon: 'hr', action: 'hr' },
						{ name: 'charmap', label: _('Special character...'), icon: 'charmap', action: 'specialchar' },
						{ name: 'anchor', label: _('Anchor...'), icon: 'anchor', action: 'anchor' },
						{ type: 'separator' },
						{ name: 'insertdatetime', label: _('Date/time'), icon: 'datetime', action: 'insertDateTime' },
						{ name: 'abbr', label: _('Abbreviation...'), action: 'abbr' },
					],
				},
				{
					name: 'format',
					label: _('Format'),
					items: [
						{ name: 'bold', label: _('Bold'), icon: 'bold', shortcut: 'Ctrl+B', mark: 'strong' },
						{ name: 'italic', label: _('Italic'), icon: 'italic', shortcut: 'Ctrl+I', mark: 'em' },
						{ name: 'underline', label: _('Underline'), icon: 'underline', shortcut: 'Ctrl+U', mark: 'underline' },
						{ name: 'strikethrough', label: _('Strikethrough'), icon: 'strikethrough', mark: 'strike' },
						{ type: 'separator' },
						{ name: 'superscript', label: _('Superscript'), mark: 'superscript' },
						{ name: 'subscript', label: _('Subscript'), mark: 'subscript' },
						{ name: 'code', label: _('Code'), icon: 'code', mark: 'code' },
						{ type: 'separator' },
						{
							name: 'blocks',
							label: _('Blocks'),
							submenu: [
								{ name: 'paragraph', label: _('Paragraph'), block: 'paragraph' },
								{ name: 'h1', label: _('Heading 1'), block: 'heading', attrs: { level: 1 } },
								{ name: 'h2', label: _('Heading 2'), block: 'heading', attrs: { level: 2 } },
								{ name: 'h3', label: _('Heading 3'), block: 'heading', attrs: { level: 3 } },
								{ name: 'h4', label: _('Heading 4'), block: 'heading', attrs: { level: 4 } },
								{ name: 'h5', label: _('Heading 5'), block: 'heading', attrs: { level: 5 } },
								{ name: 'h6', label: _('Heading 6'), block: 'heading', attrs: { level: 6 } },
								{ type: 'separator' },
								{ name: 'blockquote', label: _('Blockquote'), wrap: 'blockquote' },
								{ name: 'codeblock', label: _('Code block'), block: 'code_block' },
								{ name: 'pre', label: _('Preformatted'), block: 'code_block' },
							],
						},
						{
							name: 'align',
							label: _('Align'),
							submenu: [
								{ name: 'align-left', label: _('Left'), icon: 'alignleft', action: 'align', value: 'left' },
								{ name: 'align-center', label: _('Center'), icon: 'aligncenter', action: 'align', value: 'center' },
								{ name: 'align-right', label: _('Right'), icon: 'alignright', action: 'align', value: 'right' },
								{ name: 'align-justify', label: _('Justify'), icon: 'alignjustify', action: 'align', value: 'justify' },
							],
						},
						{ type: 'separator' },
						{ name: 'removeformat', label: _('Clear formatting'), action: 'clearFormat' },
					],
				},
				{
					name: 'table',
					label: _('Table'),
					items: [
						{ name: 'inserttable', label: _('Insert table'), action: 'table' },
						{ name: 'tableprops', label: _('Table properties'), action: 'tableProps' },
						{ name: 'deletetable', label: _('Delete table'), action: 'deleteTable' },
						{ type: 'separator' },
						{
							name: 'cell',
							label: _('Cell'),
							submenu: [
								{ name: 'mergecells', label: _('Merge cells'), action: 'mergeCells' },
								{ name: 'splitcell', label: _('Split cell'), action: 'splitCell' },
							],
						},
						{
							name: 'row',
							label: _('Row'),
							submenu: [
								{ name: 'insertrowbefore', label: _('Insert row before'), action: 'addRowBefore' },
								{ name: 'insertrowafter', label: _('Insert row after'), action: 'addRowAfter' },
								{ name: 'deleterow', label: _('Delete row'), action: 'deleteRow' },
							],
						},
						{
							name: 'column',
							label: _('Column'),
							submenu: [
								{ name: 'insertcolbefore', label: _('Insert column before'), action: 'addColumnBefore' },
								{ name: 'insertcolafter', label: _('Insert column after'), action: 'addColumnAfter' },
								{ name: 'deletecolumn', label: _('Delete column'), action: 'deleteColumn' },
							],
						},
					],
				},
				{
					name: 'tools',
					label: _('Tools'),
					items: [
						{ name: 'modernmode', label: _('Modern mode'), action: 'switchModern' },
						{ type: 'separator' },
						{ name: 'sourcecode', label: _('Source code'), icon: 'sourcecode', action: 'sourceCode' },
						{ name: 'visualchars', label: _('Show invisible characters'), action: 'visualChars' },
						{ name: 'visualblocks', label: _('Show block elements'), action: 'visualBlocks' },
						{ type: 'separator' },
						{ name: 'fullscreen', label: _('Fullscreen'), icon: 'fullscreen', action: 'fullscreen' },
					],
				},
			];

			menus.forEach((menu) => {
				const menuBtn = this._createMenuButton(menu);
				menubar.appendChild(menuBtn);
				this.menus.push({ element: menuBtn, config: menu });
			});

			return menubar;
		}

		/**
		 * Create a menu button with dropdown
		 * @private
		 */
		_createMenuButton(menu) {
			const wrapper = document.createElement('div');
			wrapper.className = 'prosemirror-menu-wrapper';

			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'prosemirror-menu-btn tox-mbtn';
			btn.textContent = menu.label;
			btn.dataset.menu = menu.name;

			const dropdown = this._createDropdown(menu.items);
			dropdown.className = 'prosemirror-menu-dropdown tox-menu';
			dropdown.style.display = 'none';

			btn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				this._toggleMenu(dropdown, btn);
			});

			wrapper.appendChild(btn);
			wrapper.appendChild(dropdown);

			return wrapper;
		}

		/**
		 * Create dropdown menu
		 * @private
		 */
		_createDropdown(items) {
			const dropdown = document.createElement('div');
			dropdown.className = 'prosemirror-dropdown';

			items.forEach((item) => {
				if (item.type === 'separator') {
					const sep = document.createElement('div');
					sep.className = 'prosemirror-menu-separator';
					dropdown.appendChild(sep);
				} else if (item.submenu) {
					const submenuWrapper = document.createElement('div');
					submenuWrapper.className = 'prosemirror-submenu-wrapper';

					const menuItem = document.createElement('div');
					menuItem.className = 'prosemirror-menu-item has-submenu';
					const chevronSvg = window.ProseMirrorIcons?.getIcon('chevronright') || '▶';
					menuItem.innerHTML = `
						<span class="menu-item-text">${item.label}</span>
						<span class="menu-item-arrow">${chevronSvg}</span>
					`;

					const submenu = this._createDropdown(item.submenu);
					submenu.className = 'prosemirror-submenu tox-menu';
					submenu.style.display = 'none';

					submenuWrapper.addEventListener('mouseenter', () => {
						submenu.style.display = 'block';
					});
					submenuWrapper.addEventListener('mouseleave', () => {
						submenu.style.display = 'none';
					});

					submenuWrapper.appendChild(menuItem);
					submenuWrapper.appendChild(submenu);
					dropdown.appendChild(submenuWrapper);
				} else {
					const menuItem = document.createElement('div');
					menuItem.className = 'prosemirror-menu-item';
					const iconSvg = item.icon ? window.ProseMirrorIcons?.getIcon(item.icon) : null;
					menuItem.innerHTML = `
						<span class="menu-item-icon">${iconSvg || ''}</span>
						<span class="menu-item-text">${item.label}</span>
						${item.shortcut ? `<span class="menu-item-shortcut">${item.shortcut}</span>` : ''}
					`;

					menuItem.addEventListener('click', (e) => {
						e.preventDefault();
						e.stopPropagation();
						this._executeMenuItem(item);
						this._closeAllMenus();
						this.editor.focus();
					});

					dropdown.appendChild(menuItem);
				}
			});

			return dropdown;
		}

		/**
		 * Toggle menu visibility
		 * @private
		 */
		_toggleMenu(dropdown, btn) {
			const isOpen = dropdown.style.display !== 'none';

			// Close all menus first
			this._closeAllMenus();

			if (!isOpen) {
				dropdown.style.display = 'block';
				btn.classList.add('active');
				this._openMenu = dropdown;
			}
		}

		/**
		 * Close all menus
		 * @private
		 */
		_closeAllMenus() {
			this.container.querySelectorAll('.prosemirror-menu-dropdown').forEach((menu) => {
				menu.style.display = 'none';
			});
			this.container.querySelectorAll('.prosemirror-menu-btn').forEach((btn) => {
				btn.classList.remove('active');
			});
			this._openMenu = null;
		}

		/**
		 * Create multiple button rows - matching TinyMCE advanced layout
		 * @private
		 */
		_createButtonRows() {
			const container = document.createElement('div');
			container.className = 'prosemirror-button-rows tox-toolbar-overlord';

			// Row 1: Main formatting - Bold, Italic, Format, Size, Font, Colors
			const row1 = this._createButtonRow([
				{ type: 'group', items: [
					{ name: 'pastespecial', icon: 'paste', title: _('Paste'), action: 'paste' },
				]},
				{ type: 'separator' },
				{ type: 'group', items: [
					{ name: 'bold', icon: 'bold', title: _('Bold'), mark: 'strong' },
					{ name: 'italic', icon: 'italic', title: _('Italic'), mark: 'em' },
				]},
				{ type: 'separator' },
				{ type: 'select', name: 'formatselect', title: _('Format'), width: '110px', options: [
					{ value: 'paragraph', label: _('Paragraph') },
					{ value: 'h1', label: _('Heading 1') },
					{ value: 'h2', label: _('Heading 2') },
					{ value: 'h3', label: _('Heading 3') },
					{ value: 'h4', label: _('Heading 4') },
					{ value: 'h5', label: _('Heading 5') },
					{ value: 'h6', label: _('Heading 6') },
				]},
				{ type: 'select', name: 'fontsizeselect', title: _('Font size'), width: '70px', options: FONT_SIZES },
				{ type: 'select', name: 'fontselect', title: _('Font family'), width: '130px', options: FONT_FAMILIES },
				{ type: 'separator' },
				{ type: 'group', items: [
					{ name: 'forecolor', icon: 'forecolor', title: _('Text color'), action: 'textColor', hasDropdown: true },
					{ name: 'backcolor', icon: 'backcolor', title: _('Background color'), action: 'bgColor', hasDropdown: true },
				]},
			]);

			// Row 2: Alignment, Lists, Links, Indentation, Quotes, Direction
			const row2 = this._createButtonRow([
				{ type: 'group', items: [
					{ name: 'alignleft', icon: 'alignleft', title: _('Align left'), action: 'align', value: 'left' },
					{ name: 'aligncenter', icon: 'aligncenter', title: _('Align center'), action: 'align', value: 'center' },
					{ name: 'alignright', icon: 'alignright', title: _('Align right'), action: 'align', value: 'right' },
					{ name: 'alignjustify', icon: 'alignjustify', title: _('Justify'), action: 'align', value: 'justify' },
				]},
				{ type: 'separator' },
				{ type: 'group', items: [
					{ name: 'anchor', icon: 'anchor', title: _('Anchor'), action: 'anchor' },
					{ name: 'table', icon: 'table', title: _('Table'), action: 'table' },
					{ name: 'clearfloat', icon: 'removeformat', title: _('Clear formatting'), action: 'clearFormat' },
				]},
				{ type: 'separator' },
				{ type: 'group', items: [
					{ name: 'bullist', icon: 'bullist', title: _('Bullet list'), list: 'bullet_list' },
					{ name: 'numlist', icon: 'numlist', title: _('Numbered list'), list: 'ordered_list' },
					{ name: 'definitionlist', icon: 'definitionlist', title: _('Definition list'), action: 'definitionList' },
				]},
				{ type: 'separator' },
				{ type: 'group', items: [
					{ name: 'link', icon: 'link', title: _('Insert/edit link'), action: 'link' },
					{ name: 'unlink', icon: 'unlink', title: _('Remove link'), action: 'unlink' },
				]},
				{ type: 'separator' },
				{ type: 'group', items: [
					{ name: 'outdent', icon: 'outdent', title: _('Decrease indent'), action: 'outdent' },
					{ name: 'indent', icon: 'indent', title: _('Increase indent'), action: 'indent' },
				]},
				{ type: 'separator' },
				{ type: 'group', items: [
					{ name: 'blockquote', icon: 'blockquote', title: _('Blockquote'), wrap: 'blockquote' },
					{ name: 'blockquoteandcite', icon: 'quote', title: _('Blockquote with cite'), action: 'blockquoteCite' },
				]},
				{ type: 'separator' },
				{ type: 'group', items: [
					{ name: 'ltr', icon: 'ltr', title: _('Left to right'), action: 'ltr' },
					{ name: 'rtl', icon: 'rtl', title: _('Right to left'), action: 'rtl' },
				]},
			]);

			// Row 3: History, Clipboard, Insert, Media, Code, etc.
			const row3 = this._createButtonRow([
				{ type: 'group', items: [
					{ name: 'undo', icon: 'undo', title: _('Undo'), command: () => undo },
					{ name: 'redo', icon: 'redo', title: _('Redo'), command: () => redo },
				]},
				{ type: 'separator' },
				{ type: 'group', items: [
					{ name: 'cut', icon: 'cut', title: _('Cut'), action: 'cut' },
					{ name: 'copy', icon: 'paste', title: _('Copy'), action: 'copy' },
					{ name: 'paste', icon: 'copy', title: _('Paste'), action: 'paste' },
					{ name: 'pastetext', icon: 'pastetext', title: _('Paste as text'), action: 'pasteText' },
				]},
				{ type: 'separator' },
				{ type: 'group', items: [
					{ name: 'sourcecode', icon: 'sourcecode', title: _('Source code'), action: 'sourceCode' },
					{ name: 'embed', icon: 'embed', title: _('Embed'), action: 'embed' },
					{ name: 'math', icon: 'info', title: _('Math formula'), action: 'math' },
				]},
				{ type: 'separator' },
				{ type: 'group', items: [
					{ name: 'tooltip', icon: 'info', title: _('Tooltip'), action: 'tooltip' },
					{ name: 'hr', icon: 'hr', title: _('Horizontal line'), action: 'hr' },
					{ name: 'charmap', icon: 'charmap', title: _('Special character'), action: 'specialchar' },
				]},
				{ type: 'separator' },
				{ type: 'group', items: [
					{ name: 'image', icon: 'image', title: _('Image'), action: 'image' },
					{ name: 'media', icon: 'media', title: _('Media'), action: 'media' },
				]},
				{ type: 'separator' },
				{ type: 'group', items: [
					{ name: 'template', icon: 'template', title: _('Template'), action: 'template' },
					{ name: 'anchormark', icon: 'anchor', title: _('Insert anchor'), action: 'anchor' },
				]},
				{ type: 'separator' },
				{ type: 'group', items: [
					{ name: 'emoticons', icon: 'emoticons', title: _('Emoticons'), action: 'emoticons' },
					{ name: 'audio', icon: 'media', title: _('Audio'), action: 'audio' },
				]},
				{ type: 'separator' },
				{ type: 'group', items: [
					{ name: 'html', icon: 'html', title: _('Edit HTML'), action: 'sourceCode' },
					{ name: 'fullscreen', icon: 'fullscreen', title: _('Fullscreen'), action: 'fullscreen' },
				]},
			]);

			container.appendChild(row1);
			container.appendChild(row2);
			container.appendChild(row3);

			return container;
		}

		/**
		 * Create a button row
		 * @private
		 */
		_createButtonRow(items) {
			const row = document.createElement('div');
			row.className = 'prosemirror-toolbar-row tox-toolbar__primary';

			items.forEach((item) => {
				if (item.type === 'separator') {
					const sep = document.createElement('div');
					sep.className = 'prosemirror-toolbar-separator';
					row.appendChild(sep);
				} else if (item.type === 'group') {
					const group = document.createElement('div');
					group.className = 'prosemirror-toolbar-group tox-toolbar__group';
					item.items.forEach((btnConfig) => {
						const btn = this._createButton(btnConfig);
						group.appendChild(btn);
						this.buttons.push({ element: btn, config: btnConfig });
					});
					row.appendChild(group);
				} else if (item.type === 'select') {
					const select = this._createSelect(item);
					row.appendChild(select);
				}
			});

			return row;
		}

		/**
		 * Create a toolbar button
		 * @private
		 */
		_createButton(config) {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'prosemirror-toolbar-btn tox-tbtn';
			btn.title = config.title;
			btn.dataset.name = config.name;

			if (config.icon) {
				// Use TinyMCE icons from ProseMirrorIcons.js
				const iconSvg = window.ProseMirrorIcons?.getIcon(config.icon);
				if (iconSvg) {
					btn.innerHTML = `<span class="tox-icon">${iconSvg}</span>`;
				} else {
					// Fallback to text if icon not found
					btn.innerHTML = `<span class="tox-icon">${config.name}</span>`;
				}
				if (config.hasDropdown) {
					const chevronSvg = window.ProseMirrorIcons?.getIcon('chevrondown') || '▼';
					btn.innerHTML += `<span class="tox-tbtn__select-chevron" style="display:inline-flex;align-items:center;">${chevronSvg}</span>`;
					btn.style.width = 'auto';
					btn.style.paddingRight = '8px';
				}
			} else if (config.text) {
				btn.innerHTML = `<span class="tox-tbtn__select-label">${config.text}</span>`;
			}

			btn.addEventListener('click', (e) => {
				e.preventDefault();
				this._executeButton(config);
				this.editor.focus();
			});

			return btn;
		}

		/**
		 * Create a select dropdown
		 * @private
		 */
		_createSelect(config) {
			const wrapper = document.createElement('div');
			wrapper.className = 'prosemirror-select-wrapper tox-tbtn tox-tbtn--select';

			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'prosemirror-select-btn';
			btn.title = config.title;
			if (config.width) {
				btn.style.minWidth = config.width;
			}
			const selectChevronSvg = window.ProseMirrorIcons?.getIcon('chevrondown') || '▼';
			btn.innerHTML = `
				<span class="tox-tbtn__select-label">${config.options[0].label}</span>
				<span class="tox-tbtn__select-chevron">${selectChevronSvg}</span>
			`;

			const dropdown = document.createElement('div');
			dropdown.className = 'prosemirror-select-dropdown';
			dropdown.style.display = 'none';

			config.options.forEach((opt) => {
				const item = document.createElement('div');
				item.className = 'prosemirror-select-option';
				item.textContent = opt.label;
				item.dataset.value = opt.value;

				item.addEventListener('click', (e) => {
					e.preventDefault();
					e.stopPropagation();
					this._executeSelect(config.name, opt.value);
					btn.querySelector('.tox-tbtn__select-label').textContent = opt.label;
					dropdown.style.display = 'none';
					this.editor.focus();
				});

				dropdown.appendChild(item);
			});

			btn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
			});

			wrapper.appendChild(btn);
			wrapper.appendChild(dropdown);

			return wrapper;
		}

		/**
		 * Execute a button action
		 * @private
		 */
		_executeButton(config) {
			const { state, dispatch } = this.editor.view;

			// Mark toggle
			if (config.mark) {
				const markType = this.schema.marks[config.mark];
				if (markType) {
					toggleMark(markType)(state, dispatch);
				}
				return;
			}

			// Block type
			if (config.block) {
				const nodeType = this.schema.nodes[config.block];
				if (nodeType) {
					if (config.attrs) {
						setBlockType(nodeType, config.attrs)(state, dispatch);
					} else {
						setBlockType(nodeType)(state, dispatch);
					}
				}
				return;
			}

			// Wrap in node
			if (config.wrap) {
				const nodeType = this.schema.nodes[config.wrap];
				if (nodeType) {
					wrapIn(nodeType)(state, dispatch);
				}
				return;
			}

			// List
			if (config.list) {
				const listType = this.schema.nodes[config.list];
				if (listType) {
					wrapInList(listType)(state, dispatch);
				}
				return;
			}

			// Command (undo/redo)
			if (config.command) {
				const cmd = config.command();
				cmd(state, dispatch);
				return;
			}

			// Custom actions
			if (config.action) {
				this._executeAction(config.action, config.value);
			}
		}

		/**
		 * Execute menu item
		 * @private
		 */
		_executeMenuItem(item) {
			const { state, dispatch } = this.editor.view;

			if (item.mark) {
				const markType = this.schema.marks[item.mark];
				if (markType) {
					toggleMark(markType)(state, dispatch);
				}
				return;
			}

			if (item.block) {
				const nodeType = this.schema.nodes[item.block];
				if (nodeType) {
					if (item.attrs) {
						setBlockType(nodeType, item.attrs)(state, dispatch);
					} else {
						setBlockType(nodeType)(state, dispatch);
					}
				}
				return;
			}

			if (item.wrap) {
				const nodeType = this.schema.nodes[item.wrap];
				if (nodeType) {
					wrapIn(nodeType)(state, dispatch);
				}
				return;
			}

			if (item.command) {
				const cmd = item.command();
				cmd(state, dispatch);
				return;
			}

			if (item.action) {
				this._executeAction(item.action, item.value);
			}
		}

		/**
		 * Execute select change
		 * @private
		 */
		_executeSelect(name, value) {
			const { state, dispatch } = this.editor.view;

			if (name === 'formatselect') {
				if (value === 'paragraph') {
					const nodeType = this.schema.nodes.paragraph;
					if (nodeType) setBlockType(nodeType)(state, dispatch);
				} else if (value.startsWith('h')) {
					const level = parseInt(value.slice(1));
					const nodeType = this.schema.nodes.heading;
					if (nodeType) setBlockType(nodeType, { level })(state, dispatch);
				}
			} else if (name === 'fontsizeselect') {
				// Apply font size via mark
				const markType = this.schema.marks.fontSize;
				if (markType) {
					const { from, to } = state.selection;
					dispatch(state.tr.addMark(from, to, markType.create({ size: value })));
				}
			} else if (name === 'fontselect') {
				// Apply font family via mark
				const markType = this.schema.marks.fontFamily;
				if (markType) {
					const { from, to } = state.selection;
					dispatch(state.tr.addMark(from, to, markType.create({ family: value })));
				}
			}
		}

		/**
		 * Execute custom action
		 * @private
		 */
		_executeAction(action, value) {
			const { state, dispatch } = this.editor.view;

			switch (action) {
				case 'align':
					setAlignment(value)(state, dispatch);
					break;

				case 'hr':
					insertHorizontalRule(state, dispatch);
					break;

				case 'clearFormat':
					clearFormatting(state, dispatch);
					break;

				case 'link':
					this._showLinkDialog();
					break;

				case 'unlink':
					this._removeLink();
					break;

				case 'image':
					if (this.onMediaLibrary) {
						this.onMediaLibrary('image');
					} else {
						this._showImageDialog();
					}
					break;

				case 'media':
					if (this.onMediaLibrary) {
						this.onMediaLibrary('media');
					} else {
						this._showMediaDialog();
					}
					break;

				case 'audio':
					if (this.onMediaLibrary) {
						this.onMediaLibrary('audio');
					} else {
						this._showAudioDialog();
					}
					break;

				case 'table':
					this._showTableDialog();
					break;

				case 'deleteTable':
					if (isInTable(state)) {
						deleteTable(state, dispatch);
					}
					break;

				case 'addRowBefore':
					if (isInTable(state)) {
						addRowBefore(state, dispatch);
					}
					break;

				case 'addRowAfter':
					if (isInTable(state)) {
						addRowAfter(state, dispatch);
					}
					break;

				case 'deleteRow':
					if (isInTable(state)) {
						deleteRow(state, dispatch);
					}
					break;

				case 'addColumnBefore':
					if (isInTable(state)) {
						addColumnBefore(state, dispatch);
					}
					break;

				case 'addColumnAfter':
					if (isInTable(state)) {
						addColumnAfter(state, dispatch);
					}
					break;

				case 'deleteColumn':
					if (isInTable(state)) {
						deleteColumn(state, dispatch);
					}
					break;

				case 'mergeCells':
					if (isInTable(state)) {
						mergeCells(state, dispatch);
					}
					break;

				case 'splitCell':
					if (isInTable(state)) {
						splitCell(state, dispatch);
					}
					break;

				case 'textColor':
					this._showColorPicker('textColor');
					break;

				case 'bgColor':
					this._showColorPicker('bgColor');
					break;

				case 'fullscreen':
					this._toggleFullscreen();
					break;

				case 'sourceCode':
					this._showSourceCode();
					break;

				case 'selectAll':
					document.execCommand('selectAll');
					break;

				case 'cut':
					document.execCommand('cut');
					break;

				case 'copy':
					document.execCommand('copy');
					break;

				case 'paste':
					document.execCommand('paste');
					break;

				case 'pasteText':
					// Paste as plain text
					navigator.clipboard.readText().then(text => {
						this.editor.insertText(text);
					}).catch(() => {
						document.execCommand('paste');
					});
					break;

				case 'outdent':
					liftListItem(this.schema.nodes.list_item)(state, dispatch);
					break;

				case 'indent':
					// Indent via wrapIn for blockquote or list
					break;

				case 'specialchar':
					this._showSpecialCharPicker();
					break;

				case 'emoticons':
					this._showEmoticonPicker();
					break;

				case 'anchor':
					this._showAnchorDialog();
					break;

				case 'embed':
					this._showEmbedDialog();
					break;

				case 'template':
					this._showTemplateDialog();
					break;

				case 'math':
					this._showMathDialog();
					break;

				case 'ltr':
					this._setDirection('ltr');
					break;

				case 'rtl':
					this._setDirection('rtl');
					break;

				case 'insertDateTime':
					this._insertDateTime();
					break;

				case 'blockquoteCite':
					this._showBlockquoteCiteDialog();
					break;

				case 'tooltip':
					this._showTooltipDialog();
					break;

				case 'abbr':
					this._showAbbrDialog();
					break;

				case 'switchModern':
					if (this.onSwitchToModern) this.onSwitchToModern();
					break;

				default:
					console.log(`[ProseMirrorToolbar] Action not implemented: ${action}`);
			}
		}

		/**
		 * Show link dialog
		 * @private
		 */
		_showLinkDialog() {
			if (window.ProseMirrorLinkDialog) {
				window.ProseMirrorLinkDialog.open(this.editor);
				return;
			}
			// Fallback (dialog module not loaded): minimal prompt.
			const url = prompt(_('Enter URL:'), 'https://');
			if (url) {
				const { state, dispatch } = this.editor.view;
				const markType = this.schema.marks.link;
				if (markType) {
					const { from, to } = state.selection;
					dispatch(state.tr.addMark(from, to, markType.create({ href: url })));
				}
			}
		}

		/**
		 * Remove link
		 * @private
		 */
		_removeLink() {
			const { state, dispatch } = this.editor.view;
			const markType = this.schema.marks.link;
			if (markType) {
				const { from, to } = state.selection;
				dispatch(state.tr.removeMark(from, to, markType));
			}
		}

		/**
		 * Show image dialog
		 * @private
		 */
		_showImageDialog() {
			const url = prompt(_('Enter image URL:'), 'https://');
			if (url) {
				this.insertImage({ src: url, alt: '' });
			}
		}

		/**
		 * Show media dialog
		 * @private
		 */
		_showMediaDialog() {
			const url = prompt(_('Enter media URL:'), 'https://');
			if (url) {
				if (url.match(/\.(mp4|webm|ogg)$/i)) {
					this._insertVideo(url);
				} else if (url.match(/\.(mp3|wav|ogg)$/i)) {
					this._insertAudio(url);
				} else {
					this._insertIframe(url);
				}
			}
		}

		/**
		 * Show audio dialog
		 * @private
		 */
		_showAudioDialog() {
			const url = prompt(_('Enter audio URL:'), 'https://');
			if (url) {
				this._insertAudio(url);
			}
		}

		/**
		 * Insert video
		 * @private
		 */
		_insertVideo(url) {
			const { state, dispatch } = this.editor.view;
			const nodeType = this.schema.nodes.video;
			if (nodeType) {
				const node = nodeType.create({ src: url });
				dispatch(state.tr.replaceSelectionWith(node));
			}
		}

		/**
		 * Insert audio
		 * @private
		 */
		_insertAudio(url) {
			const { state, dispatch } = this.editor.view;
			const nodeType = this.schema.nodes.audio;
			if (nodeType) {
				const node = nodeType.create({ src: url });
				dispatch(state.tr.replaceSelectionWith(node));
			}
		}

		/**
		 * Insert iframe
		 * @private
		 */
		_insertIframe(url) {
			const { state, dispatch } = this.editor.view;
			const nodeType = this.schema.nodes.iframe;
			if (nodeType) {
				const node = nodeType.create({ src: url });
				dispatch(state.tr.replaceSelectionWith(node));
			}
		}

		/**
		 * Show table dialog
		 * @private
		 */
		_showTableDialog() {
			const rows = parseInt(prompt(_('Number of rows:'), '3'), 10);
			const cols = parseInt(prompt(_('Number of columns:'), '3'), 10);

			if (rows > 0 && cols > 0) {
				this._insertTable(rows, cols);
			}
		}

		/**
		 * Insert table
		 * @private
		 */
		_insertTable(rows, cols) {
			const { state, dispatch } = this.editor.view;
			const { table, table_row, table_cell } = this.schema.nodes;

			if (!table || !table_row || !table_cell) return;

			const cells = [];
			for (let i = 0; i < cols; i++) {
				cells.push(table_cell.createAndFill());
			}

			const rowNodes = [];
			for (let i = 0; i < rows; i++) {
				rowNodes.push(table_row.create(null, cells.map((c) => c.copy(c.content))));
			}

			const tableNode = table.create(null, rowNodes);
			dispatch(state.tr.replaceSelectionWith(tableNode).scrollIntoView());
		}

		/**
		 * Show color picker
		 * @private
		 */
		_showColorPicker(type) {
			const colors = [
				'#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
				'#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
				'#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
				'#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
			];

			const picker = document.createElement('div');
			picker.className = 'prosemirror-color-picker';
			picker.innerHTML = `
				<div class="color-picker-grid">
					${colors.map((c) => `<div class="color-swatch" style="background-color: ${c}" data-color="${c}"></div>`).join('')}
				</div>
				<div class="color-picker-custom">
					<input type="color" class="color-input" value="#000000">
					<span>${_('Custom color')}</span>
				</div>
			`;

			const btn = this.container.querySelector(`[data-name="${type === 'textColor' ? 'forecolor' : 'backcolor'}"]`);
			if (btn) {
				const rect = btn.getBoundingClientRect();
				picker.style.position = 'absolute';
				picker.style.top = `${rect.bottom + 5}px`;
				picker.style.left = `${rect.left}px`;
			}

			document.body.appendChild(picker);

			picker.addEventListener('click', (e) => {
				const swatch = e.target.closest('.color-swatch');
				if (swatch) {
					const color = swatch.dataset.color;
					this._applyColor(type, color);
					picker.remove();
				}
			});

			picker.querySelector('.color-input').addEventListener('change', (e) => {
				this._applyColor(type, e.target.value);
				picker.remove();
			});

			const closeHandler = (e) => {
				if (!picker.contains(e.target)) {
					picker.remove();
					document.removeEventListener('click', closeHandler);
				}
			};
			setTimeout(() => document.addEventListener('click', closeHandler), 0);
		}

		/**
		 * Apply color to selection
		 * @private
		 */
		_applyColor(type, color) {
			const { state, dispatch } = this.editor.view;
			const markType = type === 'textColor' ? this.schema.marks.textColor : this.schema.marks.backgroundColor;

			if (markType) {
				const { from, to } = state.selection;
				dispatch(state.tr.addMark(from, to, markType.create({ color })));
			}
		}

		/**
		 * Show special character picker
		 * @private
		 */
		_showSpecialCharPicker() {
			const picker = document.createElement('div');
			picker.className = 'prosemirror-color-picker prosemirror-charmap-picker';
			picker.style.width = '320px';
			picker.innerHTML = `
				<div class="charmap-grid" style="display:grid;grid-template-columns:repeat(10,28px);gap:4px;">
					${SPECIAL_CHARS.map((c) => `<div class="char-item" data-char="${c.char}" title="${c.name}" style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:1px solid #ddd;border-radius:3px;cursor:pointer;font-size:16px;">${c.char}</div>`).join('')}
				</div>
			`;

			const btn = this.container.querySelector('[data-name="charmap"]');
			if (btn) {
				const rect = btn.getBoundingClientRect();
				picker.style.position = 'absolute';
				picker.style.top = `${rect.bottom + 5}px`;
				picker.style.left = `${rect.left}px`;
			}

			document.body.appendChild(picker);

			picker.addEventListener('click', (e) => {
				const item = e.target.closest('.char-item');
				if (item) {
					this.editor.insertText(item.dataset.char);
					picker.remove();
					this.editor.focus();
				}
			});

			const closeHandler = (e) => {
				if (!picker.contains(e.target)) {
					picker.remove();
					document.removeEventListener('click', closeHandler);
				}
			};
			setTimeout(() => document.addEventListener('click', closeHandler), 0);
		}

		/**
		 * Show emoticon picker
		 * @private
		 */
		_showEmoticonPicker() {
			const picker = document.createElement('div');
			picker.className = 'prosemirror-color-picker prosemirror-emoticon-picker';
			picker.style.width = '280px';
			picker.innerHTML = `
				<div class="emoticon-grid" style="display:grid;grid-template-columns:repeat(10,24px);gap:4px;">
					${EMOTICONS.map((e) => `<div class="emoticon-item" data-emoji="${e}" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;">${e}</div>`).join('')}
				</div>
			`;

			const btn = this.container.querySelector('[data-name="emoticons"]');
			if (btn) {
				const rect = btn.getBoundingClientRect();
				picker.style.position = 'absolute';
				picker.style.top = `${rect.bottom + 5}px`;
				picker.style.left = `${rect.left}px`;
			}

			document.body.appendChild(picker);

			picker.addEventListener('click', (e) => {
				const item = e.target.closest('.emoticon-item');
				if (item) {
					this.editor.insertText(item.dataset.emoji);
					picker.remove();
					this.editor.focus();
				}
			});

			const closeHandler = (e) => {
				if (!picker.contains(e.target)) {
					picker.remove();
					document.removeEventListener('click', closeHandler);
				}
			};
			setTimeout(() => document.addEventListener('click', closeHandler), 0);
		}

		/**
		 * Show anchor dialog
		 * @private
		 */
		_showAnchorDialog() {
			const name = prompt(_('Anchor name:'), '');
			if (name) {
				// Insert anchor as a span with id
				const { state, dispatch } = this.editor.view;
				const nodeType = this.schema.nodes.paragraph;
				// For now, just log - would need custom node for proper anchor
				console.log('[ProseMirrorToolbar] Anchor:', name);
			}
		}

		/**
		 * Show embed dialog
		 * @private
		 */
		_showEmbedDialog() {
			const code = prompt(_('Paste embed code:'), '');
			if (code) {
				// Parse iframe from embed code
				const match = code.match(/src=["']([^"']+)["']/);
				if (match) {
					this._insertIframe(match[1]);
				}
			}
		}

		/**
		 * Show template dialog
		 * @private
		 */
		_showTemplateDialog() {
			// Templates - for now just show message
			alert(_('Template feature coming soon'));
		}

		/**
		 * Show math dialog
		 * @private
		 */
		_showMathDialog() {
			const latex = prompt(_('Enter LaTeX formula:'), '\\frac{a}{b}');
			if (latex) {
				// Insert as text for now - would need MathJax integration
				this.editor.insertText(`$${latex}$`);
			}
		}

		/**
		 * Set text direction
		 * @private
		 */
		_setDirection(dir) {
			const { state, dispatch } = this.editor.view;
			const { from, to } = state.selection;

			state.doc.nodesBetween(from, to, (node, pos) => {
				if (node.type.name === 'paragraph' || node.type.name === 'heading') {
					const tr = state.tr.setNodeMarkup(pos, null, {
						...node.attrs,
						dir: dir,
					});
					dispatch(tr);
				}
			});
		}

		/**
		 * Insert current date/time
		 * @private
		 */
		_insertDateTime() {
			const now = new Date();
			const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
			this.editor.insertText(dateStr);
		}

		/**
		 * Show blockquote with cite dialog
		 * @private
		 */
		_showBlockquoteCiteDialog() {
			const cite = prompt(_('Citation URL (optional):'), '');
			const { state, dispatch } = this.editor.view;
			const nodeType = this.schema.nodes.blockquote;
			if (nodeType) {
				wrapIn(nodeType)(state, dispatch);
				// Add cite attribute would need custom implementation
			}
		}

		/**
		 * Show tooltip dialog
		 * @private
		 */
		_showTooltipDialog() {
			const text = prompt(_('Tooltip text:'), '');
			if (text) {
				const { state, dispatch } = this.editor.view;
				const markType = this.schema.marks.link;
				// For tooltip, we'd use title attribute on span
				console.log('[ProseMirrorToolbar] Tooltip:', text);
			}
		}

		/**
		 * Show abbreviation dialog
		 * @private
		 */
		_showAbbrDialog() {
			const title = prompt(_('Abbreviation meaning:'), '');
			if (title) {
				// Would need custom mark for <abbr>
				console.log('[ProseMirrorToolbar] Abbreviation:', title);
			}
		}

		/**
		 * Toggle fullscreen mode
		 * @private
		 */
		_toggleFullscreen() {
			const editorContainer = this.container.closest('.prosemirror-editor-container');
			if (editorContainer) {
				editorContainer.classList.toggle('fullscreen');
			}
		}

		/**
		 * Show source code view
		 * @private
		 */
		_showSourceCode() {
			const html = this.editor.getHTML();
			const newHtml = prompt(_('Edit source code:'), html);
			if (newHtml !== null && newHtml !== html) {
				this.editor.setHTML(newHtml);
			}
		}

		/**
		 * Insert image with attributes
		 * @public
		 */
		insertImage(attrs) {
			const { state, dispatch } = this.editor.view;
			const nodeType = this.schema.nodes.image;
			if (nodeType) {
				const node = nodeType.create(attrs);
				dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
			}
		}

		/**
		 * Bind editor events
		 * @private
		 */
		_bindEvents() {
			// Update button states on selection change
			this.editor.view.dom.addEventListener('keyup', this._updateHandler);
			this.editor.view.dom.addEventListener('mouseup', this._updateHandler);
			this.editor.view.dom.addEventListener('focus', this._updateHandler);

			// Close menus when clicking outside — store reference for cleanup
			this._docClickHandler = (e) => {
				if (!this.container.contains(e.target)) {
					this._closeAllMenus();
				}
			};
			document.addEventListener('click', this._docClickHandler);

			// Initial update
			this._updateActiveStates();
		}

		/**
		 * Update active states of buttons
		 * @private
		 */
		_updateActiveStates() {
			const { state } = this.editor.view;

			this.buttons.forEach(({ element, config }) => {
				let isActive = false;

				if (config.mark) {
					const markType = this.schema.marks[config.mark];
					if (markType) {
						isActive = isMarkActive(state, markType);
					}
				} else if (config.block) {
					const nodeType = this.schema.nodes[config.block];
					if (nodeType) {
						isActive = isBlockActive(state, nodeType, config.attrs);
					}
				}

				element.classList.toggle('tox-tbtn--enabled', isActive);
			});
		}

		/**
		 * Destroy the toolbar
		 */
		destroy() {
			// Remove editor DOM listeners to avoid leaks on detached toolbar
			if (this._updateHandler && this.editor?.view?.dom) {
				this.editor.view.dom.removeEventListener('keyup', this._updateHandler);
				this.editor.view.dom.removeEventListener('mouseup', this._updateHandler);
				this.editor.view.dom.removeEventListener('focus', this._updateHandler);
			}
			if (this._docClickHandler) {
				document.removeEventListener('click', this._docClickHandler);
				this._docClickHandler = null;
			}

			if (this.wrapper && this.wrapper.parentNode) {
				this.wrapper.parentNode.removeChild(this.wrapper);
			}
			this.buttons = [];
			this.menus = [];
		}
	}

	// Export to window
	window.ProseMirrorToolbar = ProseMirrorToolbar;
})();
