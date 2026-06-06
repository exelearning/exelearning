/**
 * ProseMirror Editor Wrapper
 *
 * High-level wrapper class for ProseMirror editor instances.
 * Handles initialization, plugin management, and common operations.
 */
(function () {
	'use strict';

	const {
		EditorState,
		Plugin,
		PluginKey,
		EditorView,
		keymap,
		baseKeymap,
		history,
		undo,
		redo,
		inputRules,
		wrappingInputRule,
		textblockTypeInputRule,
		smartQuotes,
		emDash,
		ellipsis,
		gapCursor,
		dropCursor,
		tableEditing,
		columnResizing,
		goToNextCell,
	} = window.ProseMirrorBundle;

	const Logger = window.Logger || console;

	/**
	 * Build input rules for common patterns
	 */
	function buildInputRules(schema) {
		const rules = [];

		// Smart quotes and typography
		rules.push(...smartQuotes);
		rules.push(emDash);
		rules.push(ellipsis);

		// Block quote: > at start of line
		if (schema.nodes.blockquote) {
			rules.push(wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote));
		}

		// Ordered list: 1. at start of line
		if (schema.nodes.ordered_list) {
			rules.push(
				wrappingInputRule(
					/^(\d+)\.\s$/,
					schema.nodes.ordered_list,
					(match) => ({ order: +match[1] }),
					(match, node) => node.childCount + node.attrs.order === +match[1]
				)
			);
		}

		// Bullet list: - or * at start of line
		if (schema.nodes.bullet_list) {
			rules.push(wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list));
		}

		// Code block: ``` at start of line
		if (schema.nodes.code_block) {
			rules.push(textblockTypeInputRule(/^```(\w+)?\s$/, schema.nodes.code_block, (match) => ({ language: match[1] || '' })));
		}

		// Headings: # at start of line
		if (schema.nodes.heading) {
			for (let level = 1; level <= 6; level++) {
				const pattern = new RegExp(`^(#{${level}})\\s$`);
				rules.push(textblockTypeInputRule(pattern, schema.nodes.heading, { level }));
			}
		}

		return inputRules({ rules });
	}

	/**
	 * Build keymap for the editor
	 */
	function buildKeymap(schema) {
		const { toggleMark, setBlockType, wrapIn, lift, chainCommands, exitCode, joinUp, joinDown, liftListItem, sinkListItem, splitListItem } =
			window.ProseMirrorBundle;

		const keys = {};

		// Basic formatting
		if (schema.marks.strong) {
			keys['Mod-b'] = toggleMark(schema.marks.strong);
			keys['Mod-B'] = toggleMark(schema.marks.strong);
		}
		if (schema.marks.em) {
			keys['Mod-i'] = toggleMark(schema.marks.em);
			keys['Mod-I'] = toggleMark(schema.marks.em);
		}
		if (schema.marks.underline) {
			keys['Mod-u'] = toggleMark(schema.marks.underline);
			keys['Mod-U'] = toggleMark(schema.marks.underline);
		}
		if (schema.marks.strike) {
			keys['Mod-Shift-s'] = toggleMark(schema.marks.strike);
		}
		if (schema.marks.code) {
			keys['Mod-`'] = toggleMark(schema.marks.code);
		}

		// Block formatting
		if (schema.nodes.code_block) {
			keys['Shift-Ctrl-\\'] = setBlockType(schema.nodes.code_block);
		}
		if (schema.nodes.heading) {
			keys['Shift-Ctrl-1'] = setBlockType(schema.nodes.heading, { level: 1 });
			keys['Shift-Ctrl-2'] = setBlockType(schema.nodes.heading, { level: 2 });
			keys['Shift-Ctrl-3'] = setBlockType(schema.nodes.heading, { level: 3 });
		}
		if (schema.nodes.paragraph) {
			keys['Shift-Ctrl-0'] = setBlockType(schema.nodes.paragraph);
		}

		// Lists
		if (schema.nodes.bullet_list) {
			keys['Shift-Ctrl-8'] = wrapIn(schema.nodes.bullet_list);
		}
		if (schema.nodes.ordered_list) {
			keys['Shift-Ctrl-9'] = wrapIn(schema.nodes.ordered_list);
		}
		if (schema.nodes.blockquote) {
			keys['Ctrl->'] = wrapIn(schema.nodes.blockquote);
		}

		// List manipulation
		if (schema.nodes.list_item) {
			keys['Enter'] = splitListItem(schema.nodes.list_item);
			keys['Tab'] = sinkListItem(schema.nodes.list_item);
			keys['Shift-Tab'] = liftListItem(schema.nodes.list_item);
		}

		// Navigation
		keys['Alt-ArrowUp'] = joinUp;
		keys['Alt-ArrowDown'] = joinDown;
		keys['Mod-BracketLeft'] = lift;

		// Table navigation
		if (schema.nodes.table) {
			keys['Tab'] = chainCommands(goToNextCell(1), keys['Tab'] || (() => false));
			keys['Shift-Tab'] = chainCommands(goToNextCell(-1), keys['Shift-Tab'] || (() => false));
		}

		// History
		keys['Mod-z'] = undo;
		keys['Mod-y'] = redo;
		keys['Mod-Shift-z'] = redo;

		return keymap(keys);
	}

	/**
	 * Placeholder plugin
	 */
	function placeholderPlugin(text) {
		return new Plugin({
			key: new PluginKey('placeholder'),
			props: {
				decorations(state) {
					const { Decoration, DecorationSet } = window.ProseMirrorBundle;
					const doc = state.doc;
					if (doc.childCount === 1 && doc.firstChild.isTextblock && doc.firstChild.content.size === 0) {
						const placeholder = document.createElement('span');
						placeholder.className = 'prosemirror-placeholder';
						placeholder.textContent = text;
						return DecorationSet.create(doc, [Decoration.widget(1, placeholder)]);
					}
					return null;
				},
			},
		});
	}

	/**
	 * ProseMirrorEditor class
	 */
	class ProseMirrorEditor {
		/**
		 * @param {Object} options
		 * @param {HTMLElement} options.container - Container element for the editor
		 * @param {string} [options.content=''] - Initial HTML content
		 * @param {string} [options.placeholder=''] - Placeholder text
		 * @param {Function} [options.onUpdate] - Callback when content changes
		 * @param {Function} [options.onSelectionChange] - Callback when selection changes
		 * @param {boolean} [options.editable=true] - Whether the editor is editable
		 */
		constructor(options = {}) {
			this.container = options.container;
			this.onUpdate = options.onUpdate || null;
			this.onSelectionChange = options.onSelectionChange || null;
			this._additionalPlugins = [];
			this._destroyed = false;

			if (!this.container) {
				throw new Error('ProseMirrorEditor: container is required');
			}

			// Get schema
			this.schema = window.ProseMirrorSchema.getSchema();

			// Parse initial content
			const doc = options.content ? window.ProseMirrorSchema.parseHTML(options.content) : this.schema.node('doc', null, [this.schema.node('paragraph')]);

			// Build plugins
			const plugins = [
				buildInputRules(this.schema),
				buildKeymap(this.schema),
				keymap(baseKeymap),
				history(),
				dropCursor(),
				gapCursor(),
			];

			// Add table plugins if tables are supported
			if (this.schema.nodes.table) {
				plugins.push(columnResizing());
				plugins.push(tableEditing());
			}

			// Add placeholder if provided
			if (options.placeholder) {
				plugins.push(placeholderPlugin(options.placeholder));
			}

			// Create editor state
			this.state = EditorState.create({
				doc,
				plugins,
			});

			// Node views (optional, loaded lazily alongside the toolbars). The image
			// node view adds in-place corner resize handles.
			const nodeViews = {};
			if (this.schema.nodes.image && window.ProseMirrorImageTools?.createImageNodeView) {
				nodeViews.image = (node, view, getPos) => window.ProseMirrorImageTools.createImageNodeView(node, view, getPos);
			}

			// Create editor view
			this.view = new EditorView(this.container, {
				state: this.state,
				editable: () => options.editable !== false,
				dispatchTransaction: this._dispatchTransaction.bind(this),
				nodeViews,
			});

			Logger.log('[ProseMirrorEditor] Initialized');
		}

		/**
		 * Handle transactions
		 * @private
		 */
		_dispatchTransaction(tr) {
			if (this._destroyed) return;

			const newState = this.view.state.apply(tr);
			this.view.updateState(newState);
			this.state = newState;

			if (tr.docChanged && this.onUpdate) {
				this.onUpdate(this.getHTML());
			}

			if (tr.selectionSet && this.onSelectionChange) {
				this.onSelectionChange(newState.selection);
			}
		}

		/**
		 * Get HTML content
		 * @returns {string}
		 */
		getHTML() {
			return window.ProseMirrorSchema.serializeHTML(this.view.state.doc);
		}

		/**
		 * Set HTML content
		 * @param {string} html
		 */
		setHTML(html) {
			const doc = window.ProseMirrorSchema.parseHTML(html);
			const tr = this.view.state.tr.replaceWith(0, this.view.state.doc.content.size, doc.content);
			this.view.dispatch(tr);
		}

		/**
		 * Get plain text content
		 * @returns {string}
		 */
		getText() {
			return this.view.state.doc.textContent;
		}

		/**
		 * Check if editor is empty
		 * @returns {boolean}
		 */
		isEmpty() {
			const doc = this.view.state.doc;
			return doc.childCount === 1 && doc.firstChild.isTextblock && doc.firstChild.content.size === 0;
		}

		/**
		 * Focus the editor
		 */
		focus() {
			this.view.focus();
		}

		/**
		 * Blur the editor
		 */
		blur() {
			this.view.dom.blur();
		}

		/**
		 * Add plugins to the editor
		 * @param {Plugin[]} plugins
		 */
		addPlugins(plugins) {
			if (!Array.isArray(plugins)) {
				plugins = [plugins];
			}

			this._additionalPlugins.push(...plugins);

			const allPlugins = [...this.view.state.plugins, ...plugins];
			const newState = this.view.state.reconfigure({ plugins: allPlugins });
			this.view.updateState(newState);
			this.state = newState;
		}

		/**
		 * Remove previously-added plugins, matched by PluginKey or plugin identity.
		 * @param {Array} keys - PluginKey instances or Plugin instances to remove
		 */
		removePlugins(keys) {
			if (!Array.isArray(keys)) keys = [keys];
			const matches = (p) =>
				keys.some(
					(k) =>
						p === k ||
						(p.spec && p.spec.key && k && (p.spec.key === k || (k.key && p.spec.key.key === k.key)))
				);
			this._additionalPlugins = this._additionalPlugins.filter((p) => !matches(p));
			const base = this.view.state.plugins.filter((p) => !matches(p));
			const newState = this.view.state.reconfigure({ plugins: base });
			this.view.updateState(newState);
			this.state = newState;
		}

		/**
		 * Whether a plugin with the given PluginKey (or identity) is active.
		 */
		hasPlugin(key) {
			return this.view.state.plugins.some(
				(p) => p === key || (p.spec && p.spec.key && (p.spec.key === key || (key && key.key && p.spec.key.key === key.key)))
			);
		}

		/**
		 * Execute a command
		 * @param {Function} command
		 * @returns {boolean}
		 */
		execCommand(command) {
			return command(this.view.state, this.view.dispatch, this.view);
		}

		/**
		 * Check if a command is applicable
		 * @param {Function} command
		 * @returns {boolean}
		 */
		canExecCommand(command) {
			return command(this.view.state, null, this.view);
		}

		/**
		 * Insert text at cursor position
		 * @param {string} text
		 */
		insertText(text) {
			const { from, to } = this.view.state.selection;
			const tr = this.view.state.tr.insertText(text, from, to);
			this.view.dispatch(tr);
		}

		/**
		 * Insert a node at cursor position
		 * @param {Node} node
		 */
		insertNode(node) {
			const { from, to } = this.view.state.selection;
			const tr = this.view.state.tr.replaceWith(from, to, node);
			this.view.dispatch(tr);
		}

		/**
		 * Insert an image
		 * @param {Object} attrs - Image attributes (src, alt, title, etc.)
		 */
		insertImage(attrs) {
			const node = this.schema.nodes.image.create(attrs);
			this.insertNode(node);
		}

		/**
		 * Set editable state
		 * @param {boolean} editable
		 */
		setEditable(editable) {
			this.view.setProps({
				editable: () => editable,
			});
		}

		/**
		 * Get the current selection
		 * @returns {Selection}
		 */
		getSelection() {
			return this.view.state.selection;
		}

		/**
		 * Check if the editor has been destroyed
		 * @returns {boolean}
		 */
		isDestroyed() {
			return this._destroyed;
		}

		/**
		 * Destroy the editor
		 */
		destroy() {
			if (this._destroyed) return;

			this._destroyed = true;
			this.view.destroy();
			this.container.innerHTML = '';

			Logger.log('[ProseMirrorEditor] Destroyed');
		}
	}

	// Export globally
	window.ProseMirrorEditor = ProseMirrorEditor;
})();
