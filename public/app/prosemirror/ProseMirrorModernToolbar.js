/**
 * ProseMirror modern (compact) toolbar
 *
 * A single-row toolbar themed for eXeLearning. Commands are dispatched through
 * window.ProseMirrorCommands onto the shared ProseMirrorEditor view.
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
			this._build();
		}

		_icon(name, fallback) {
			const svg = window.ProseMirrorIcons?.[name];
			return svg || fallback || '';
		}

		_markButton(label, iconName, markName) {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'pm-modern-btn';
			btn.setAttribute('data-cmd', markName);
			btn.setAttribute('title', label);
			btn.innerHTML = this._icon(iconName, `<span>${label}</span>`);
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

		_listButton(label, nodeName, dataCmd) {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'pm-modern-btn';
			btn.setAttribute('data-cmd', dataCmd);
			btn.setAttribute('title', label);
			btn.innerHTML = `<span>${label}</span>`;
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				const cmd = this.cmds.wrapInList(this.schema, nodeName);
				if (cmd) this.editor.execCommand(cmd);
				this.editor.focus();
			});
			return btn;
		}

		_actionButton(label, action, onClick) {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'pm-modern-btn';
			btn.setAttribute('data-action', action);
			btn.setAttribute('title', label);
			btn.innerHTML = `<span>${label}</span>`;
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				onClick();
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
			bar.appendChild(this._sep());
			bar.appendChild(this._listButton(t('Bullet list'), 'bullet_list', 'bullet_list'));
			bar.appendChild(this._listButton(t('Numbered list'), 'ordered_list', 'ordered_list'));
			bar.appendChild(this._sep());
			bar.appendChild(
				this._actionButton(t('Insert image'), 'insert-image', () => {
					if (this.onMediaLibrary) this.onMediaLibrary('image');
				})
			);

			// Trailing: switch back to classic
			const spacer = document.createElement('span');
			spacer.className = 'pm-modern-spacer';
			bar.appendChild(spacer);
			bar.appendChild(
				this._actionButton(t('Classic mode'), 'switch-classic', () => {
					if (this.onSwitchToClassic) this.onSwitchToClassic();
				})
			);

			this.container.appendChild(bar);
			this.bar = bar;
		}

		destroy() {
			if (this.bar && this.bar.parentNode) this.bar.parentNode.removeChild(this.bar);
			this.bar = null;
		}
	}

	window.ProseMirrorModernToolbar = ProseMirrorModernToolbar;
})();
