/**
 * ProseMirror Floating Toolbar plugin
 *
 * Shows a small floating toolbar (Bold / Italic / Underline / Link) above a
 * non-empty text selection, Lexical-playground style. Vanilla ProseMirror
 * plugin; added to the editor only in "modern" mode by ProseMirrorEditorMode
 * and removed (with its DOM) when switching to classic.
 */
(function () {
	'use strict';

	const t = (s) => (typeof _ === 'function' ? _(s) : s);
	const { Plugin, PluginKey } = window.ProseMirrorBundle;
	const floatingToolbarPluginKey = new PluginKey('exeFloatingToolbar');

	function icon(name) {
		return (window.ProseMirrorIcons && window.ProseMirrorIcons.getIcon && window.ProseMirrorIcons.getIcon(name)) || '';
	}

	/** Whether the current selection is a non-empty text selection. */
	function isTextSelectionActive(state) {
		const sel = state.selection;
		if (sel.empty) return false;
		// NodeSelection (image, etc.) has a `.node` property — skip those.
		if (sel.node) return false;
		return true;
	}

	function proseMirrorFloatingToolbarPlugin(options) {
		options = options || {};

		return new Plugin({
			key: floatingToolbarPluginKey,
			view(editorView) {
				const host = editorView.dom.parentNode;
				if (host && getComputedStyle(host).position === 'static') {
					host.style.position = 'relative';
				}

				const bar = document.createElement('div');
				bar.className = 'prosemirror-floating-toolbar';
				bar.style.display = 'none';

				const schema = editorView.state.schema;
				const buttons = [
					{ mark: 'strong', icon: 'bold', label: t('Bold') },
					{ mark: 'em', icon: 'italic', label: t('Italic') },
					{ mark: 'underline', icon: 'underline', label: t('Underline') },
					{ mark: 'link', icon: 'link', label: t('Link') },
				];

				buttons.forEach((b) => {
					if (!schema.marks[b.mark]) return;
					const btn = document.createElement('button');
					btn.type = 'button';
					btn.className = 'prosemirror-floating-btn';
					btn.setAttribute('data-cmd', b.mark);
					btn.setAttribute('title', b.label);
					const svg = icon(b.icon);
					btn.innerHTML = svg || `<span>${b.label}</span>`;
					btn.addEventListener('mousedown', (e) => {
						// Prevent the selection from being lost when the button is pressed.
						e.preventDefault();
						applyMark(editorView, schema, b.mark);
					});
					bar.appendChild(btn);
				});

				host.appendChild(bar);

				function hide() {
					bar.style.display = 'none';
				}

				function reposition() {
					const state = editorView.state;
					if (!isTextSelectionActive(state) || !editorView.hasFocus()) {
						hide();
						return;
					}
					const { from, to } = state.selection;
					const start = editorView.coordsAtPos(from);
					const end = editorView.coordsAtPos(to);
					const hostRect = host.getBoundingClientRect();
					bar.style.display = 'flex';
					const barRect = bar.getBoundingClientRect();
					const centerX = (start.left + end.left) / 2 - hostRect.left;
					let left = centerX - barRect.width / 2;
					left = Math.max(2, left);
					let top = start.top - hostRect.top - barRect.height - 8;
					if (top < 0) top = end.bottom - hostRect.top + 8; // flip below if no room above
					bar.style.left = `${left}px`;
					bar.style.top = `${top}px`;
					updateActive(state, schema);
				}

				function updateActive(state, sch) {
					const cmds = window.ProseMirrorCommands;
					bar.querySelectorAll('[data-cmd]').forEach((btn) => {
						const name = btn.getAttribute('data-cmd');
						const active = cmds && cmds.isMarkActive ? cmds.isMarkActive(state, sch, name) : false;
						btn.classList.toggle('is-active', !!active);
					});
				}

				// Reposition on scroll/resize while a selection is shown.
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

	/** Toggle a mark on the current selection. For links, prompt for the URL. */
	function applyMark(view, schema, markName) {
		const markType = schema.marks[markName];
		if (!markType) return;
		let attrs;
		if (markName === 'link') {
			// eslint-disable-next-line no-alert
			const href = window.prompt(t('Enter the link URL:'), 'https://');
			if (!href) return;
			attrs = { href };
		}
		const cmd = window.ProseMirrorBundle.toggleMark(markType, attrs);
		cmd(view.state, view.dispatch, view);
		view.focus();
	}

	window.proseMirrorFloatingToolbarPlugin = proseMirrorFloatingToolbarPlugin;
	window.floatingToolbarPluginKey = floatingToolbarPluginKey;
	window.ProseMirrorFloatingToolbarInternals = { isTextSelectionActive, applyMark };
})();
