/**
 * ProseMirror modern (compact) toolbar
 *
 * A single-row, icon-based toolbar themed for eXeLearning, inspired by the
 * Lexical playground. Commands are dispatched through window.ProseMirrorCommands
 * onto the shared ProseMirrorEditor view. Block/media insertion is consolidated
 * into a single "Insert" dropdown.
 */
(function () {
	'use strict';

	const t = (s) => (typeof _ === 'function' ? _(s) : s);

	class ProseMirrorModernToolbar {
		constructor(options = {}) {
			this.editor = options.editor;
			this.container = options.container;
			this.onMediaLibrary = options.onMediaLibrary || null;
			this.onSwitchToClassic = options.onSwitchToClassic || null;
			if (!this.editor || !this.container) {
				throw new Error('ProseMirrorModernToolbar: editor and container are required');
			}
			this.schema = this.editor.schema;
			this.cmds = window.ProseMirrorCommands;
			this._insertMenu = null;
			this._build();
		}

		/** Resolve a TinyMCE icon name to its SVG (via ProseMirrorIcons.getIcon). */
		_icon(name) {
			return (window.ProseMirrorIcons && window.ProseMirrorIcons.getIcon && window.ProseMirrorIcons.getIcon(name)) || '';
		}

		/** Set button content to an icon when available, else a text label. */
		_setButtonContent(btn, iconName, label) {
			const svg = this._icon(iconName);
			btn.innerHTML = svg ? `<span class="pm-modern-icon">${svg}</span>` : `<span>${label}</span>`;
		}

		_markButton(label, iconName, markName) {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'pm-modern-btn';
			btn.setAttribute('data-cmd', markName);
			btn.setAttribute('title', label);
			this._setButtonContent(btn, iconName, label);
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				const cmd = this.cmds.toggleMark(this.schema, markName);
				if (cmd) this.editor.execCommand(cmd);
				this.editor.focus();
			});
			return btn;
		}

		_blockTypeSelect() {
			const select = document.createElement('select');
			select.className = 'pm-modern-blocktype';
			select.setAttribute('title', t('Block type'));
			const options = [
				{ value: 'p', label: t('Paragraph') },
				{ value: 'h1', label: t('Heading 1') },
				{ value: 'h2', label: t('Heading 2') },
				{ value: 'h3', label: t('Heading 3') },
			];
			for (const o of options) {
				const opt = document.createElement('option');
				opt.value = o.value;
				opt.textContent = o.label;
				select.appendChild(opt);
			}
			select.addEventListener('change', () => {
				const v = select.value;
				let cmd = null;
				if (v === 'p') cmd = this.cmds.setBlockType(this.schema, 'paragraph');
				else cmd = this.cmds.setBlockType(this.schema, 'heading', { level: Number(v.slice(1)) });
				if (cmd) this.editor.execCommand(cmd);
				this.editor.focus();
			});
			return select;
		}

		_listButton(label, iconName, nodeName, dataCmd) {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'pm-modern-btn';
			btn.setAttribute('data-cmd', dataCmd);
			btn.setAttribute('title', label);
			this._setButtonContent(btn, iconName, label);
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				const cmd = this.cmds.wrapInList(this.schema, nodeName);
				if (cmd) this.editor.execCommand(cmd);
				this.editor.focus();
			});
			return btn;
		}

		_linkButton() {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'pm-modern-btn';
			btn.setAttribute('data-cmd', 'link');
			btn.setAttribute('title', t('Link'));
			this._setButtonContent(btn, 'link', t('Link'));
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				const linkMark = this.schema.marks.link;
				if (!linkMark) return;
				// eslint-disable-next-line no-alert
				const href = window.prompt(t('Enter the link URL:'), 'https://');
				if (href) {
					const cmd = window.ProseMirrorBundle.toggleMark(linkMark, { href });
					this.editor.execCommand(cmd);
				}
				this.editor.focus();
			});
			return btn;
		}

		_iconButton(label, iconName, action, onClick) {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'pm-modern-btn';
			btn.setAttribute('data-action', action);
			btn.setAttribute('title', label);
			this._setButtonContent(btn, iconName, label);
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				onClick();
			});
			return btn;
		}

		/** The catalog for the "Insert" dropdown, filtered to what is available. */
		_insertCatalog() {
			const s = this.schema;
			const all = [
				{ key: 'image', label: t('Image'), icon: 'image', media: 'image' },
				{ key: 'video', label: t('Video'), icon: 'media', media: 'media' },
				{ key: 'audio', label: t('Audio'), icon: 'media', media: 'audio' },
				{ key: 'table', label: t('Table'), icon: 'table', node: 'table' },
				{ key: 'hr', label: t('Horizontal rule'), icon: 'hr', node: 'horizontal_rule' },
				{ key: 'code', label: t('Code block'), icon: 'sourcecode', node: 'code_block' },
			];
			return all.filter((it) => {
				if (it.media) return !!this.onMediaLibrary;
				return !!(s.nodes && s.nodes[it.node]);
			});
		}

		_closeInsertMenu() {
			if (this._insertMenu && this._insertMenu.parentNode) {
				this._insertMenu.parentNode.removeChild(this._insertMenu);
			}
			this._insertMenu = null;
		}

		_openInsertMenu(anchorBtn) {
			this._closeInsertMenu();
			const menu = document.createElement('div');
			menu.className = 'pm-modern-insert-menu';
			this._insertCatalog().forEach((it) => {
				const row = document.createElement('div');
				row.className = 'pm-modern-insert-item';
				row.setAttribute('data-insert', it.key);
				const icon = this._icon(it.icon);
				row.innerHTML = `<span class="pm-modern-insert-icon">${icon}</span><span>${it.label}</span>`;
				row.addEventListener('mousedown', (e) => {
					e.preventDefault();
					this._closeInsertMenu();
					if (it.media) {
						if (this.onMediaLibrary) this.onMediaLibrary(it.media);
					} else if (it.node && this.cmds.insertBlock) {
						this.cmds.insertBlock(this.editor, it.node, it.attrs);
					}
					this.editor.focus();
				});
				menu.appendChild(row);
			});
			// Position below the anchor button within the bar.
			menu.style.top = `${anchorBtn.offsetTop + anchorBtn.offsetHeight + 2}px`;
			menu.style.left = `${anchorBtn.offsetLeft}px`;
			this.bar.appendChild(menu);
			this._insertMenu = menu;
		}

		_insertButton() {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'pm-modern-btn pm-modern-insert-btn';
			btn.setAttribute('data-action', 'insert-menu');
			btn.setAttribute('title', t('Insert'));
			const plus = this._icon('plus') || '+';
			const chevron = this._icon('chevrondown') || '▾';
			btn.innerHTML = `<span class="pm-modern-icon">${plus}</span><span class="pm-modern-insert-label">${t('Insert')}</span><span class="pm-modern-chevron">${chevron}</span>`;
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				if (this._insertMenu) this._closeInsertMenu();
				else this._openInsertMenu(btn);
			});
			return btn;
		}

		_sep() {
			const s = document.createElement('span');
			s.className = 'pm-modern-sep';
			return s;
		}

		_build() {
			const bar = document.createElement('div');
			bar.className = 'prosemirror-modern-toolbar';

			bar.appendChild(this._blockTypeSelect());
			bar.appendChild(this._sep());
			bar.appendChild(this._markButton(t('Bold'), 'bold', 'strong'));
			bar.appendChild(this._markButton(t('Italic'), 'italic', 'em'));
			bar.appendChild(this._markButton(t('Underline'), 'underline', 'underline'));
			bar.appendChild(this._markButton(t('Code'), 'code', 'code'));
			if (this.schema.marks.link) {
				bar.appendChild(this._linkButton());
			}
			bar.appendChild(this._sep());
			bar.appendChild(this._listButton(t('Bullet list'), 'bullist', 'bullet_list', 'bullet_list'));
			bar.appendChild(this._listButton(t('Numbered list'), 'numlist', 'ordered_list', 'ordered_list'));
			bar.appendChild(this._sep());
			bar.appendChild(this._insertButton());

			// Trailing: switch back to classic
			const spacer = document.createElement('span');
			spacer.className = 'pm-modern-spacer';
			bar.appendChild(spacer);
			bar.appendChild(
				this._iconButton(t('Classic mode'), null, 'switch-classic', () => {
					if (this.onSwitchToClassic) this.onSwitchToClassic();
				})
			);

			this.container.appendChild(bar);
			this.bar = bar;

			// Close the insert menu on outside clicks.
			this._docClickHandler = (e) => {
				if (this._insertMenu && !this._insertMenu.contains(e.target) && !e.target.closest('.pm-modern-insert-btn')) {
					this._closeInsertMenu();
				}
			};
			document.addEventListener('mousedown', this._docClickHandler, true);

			// Bind selection-change listener for active-state highlighting
			this._updateHandler = () => this._updateActiveStates();
			if (this.editor.view?.dom) {
				this.editor.view.dom.addEventListener('keyup', this._updateHandler);
				this.editor.view.dom.addEventListener('mouseup', this._updateHandler);
				this.editor.view.dom.addEventListener('focus', this._updateHandler);
			}

			// Apply initial active states
			this._updateActiveStates();
		}

		/**
		 * Update the `.is-active` class on each [data-cmd] button based on
		 * the current editor selection state.
		 * @private
		 */
		_updateActiveStates() {
			const state = this.editor.view?.state;
			if (!state || !this.bar) return;
			this.bar.querySelectorAll('[data-cmd]').forEach((btn) => {
				const name = btn.getAttribute('data-cmd');
				const active =
					this.cmds.isMarkActive(state, this.schema, name) ||
					this.cmds.isBlockActive(state, this.schema, name);
				btn.classList.toggle('is-active', !!active);
			});
		}

		destroy() {
			this._closeInsertMenu();
			if (this._docClickHandler) {
				document.removeEventListener('mousedown', this._docClickHandler, true);
				this._docClickHandler = null;
			}
			// Remove editor DOM listeners before tearing down the bar
			if (this._updateHandler && this.editor?.view?.dom) {
				this.editor.view.dom.removeEventListener('keyup', this._updateHandler);
				this.editor.view.dom.removeEventListener('mouseup', this._updateHandler);
				this.editor.view.dom.removeEventListener('focus', this._updateHandler);
			}
			if (this.bar && this.bar.parentNode) this.bar.parentNode.removeChild(this.bar);
			this.bar = null;
		}
	}

	window.ProseMirrorModernToolbar = ProseMirrorModernToolbar;
})();
