/**
 * ProseMirror Link dialog
 *
 * Opens an eXe modal form (via ProseMirrorDialog) to insert / edit / remove a
 * link, replacing the old prompt(). Works on the shared ProseMirrorEditor view.
 */
(function () {
	'use strict';

	const t = (s) => (typeof _ === 'function' ? _(s) : s);

	/** Read the link mark currently affecting the selection, if any. */
	function getLinkAttrs(view, schema) {
		const linkType = schema.marks.link;
		if (!linkType) return null;
		const state = view.state;
		const { from, to, empty, $from } = state.selection;
		let mark = null;
		if (empty) {
			const marks = state.storedMarks || $from.marks();
			mark = marks.find((m) => m.type === linkType) || null;
		} else {
			state.doc.nodesBetween(from, to, (node) => {
				const m = node.marks.find((mm) => mm.type === linkType);
				if (m) mark = m;
			});
		}
		return mark ? { href: mark.attrs.href, target: mark.attrs.target, title: mark.attrs.title } : null;
	}

	function getSelectedText(view) {
		const { from, to, empty } = view.state.selection;
		return empty ? '' : view.state.doc.textBetween(from, to, ' ');
	}

	/** Apply / replace / remove the link based on the dialog values. */
	function applyLink(editor, values) {
		const view = editor.view;
		const schema = editor.schema;
		const linkType = schema.marks.link;
		if (!linkType) return;
		const state = view.state;
		const { from, to, empty } = state.selection;
		const href = (values.href || '').trim();
		let tr = state.tr;

		if (!href) {
			// Remove the link mark across the selection.
			if (!empty) tr = tr.removeMark(from, to, linkType);
			view.dispatch(tr);
			editor.focus();
			return;
		}

		const attrs = { href, target: values.target || null, title: values.title || null };
		const text = (values.text || '').trim();

		if (empty) {
			const label = text || href;
			const node = schema.text(label, [linkType.create(attrs)]);
			tr = tr.insert(from, node);
			view.dispatch(tr.scrollIntoView());
		} else if (text && text !== getSelectedText(view)) {
			// Replace the selected text with the new linked text.
			const node = schema.text(text, [linkType.create(attrs)]);
			tr = tr.replaceWith(from, to, node);
			view.dispatch(tr.scrollIntoView());
		} else {
			// Keep the selected text, just (re)apply the mark.
			tr = tr.addMark(from, to, linkType.create(attrs));
			view.dispatch(tr.scrollIntoView());
		}
		editor.focus();
	}

	/** Open the link dialog for the given ProseMirrorEditor instance. */
	async function open(editor) {
		const view = editor.view;
		const schema = editor.schema;
		if (!schema.marks.link || !window.ProseMirrorDialog) {
			return;
		}
		const existing = getLinkAttrs(view, schema);
		const selText = getSelectedText(view);
		const values = await window.ProseMirrorDialog.openForm({
			title: t('Link'),
			submitLabel: t('OK'),
			fields: [
				{ name: 'href', type: 'text', label: t('URL'), value: existing ? existing.href : 'https://' },
				{ name: 'text', type: 'text', label: t('Text to display'), value: selText },
				{
					name: 'target',
					type: 'select',
					label: t('Open in'),
					value: existing ? existing.target || '' : '',
					options: [
						{ value: '', label: t('Same window') },
						{ value: '_blank', label: t('New window') },
					],
				},
				{ name: 'title', type: 'text', label: t('Title'), value: existing ? existing.title || '' : '' },
			],
		});
		if (values == null) {
			editor.focus();
			return;
		}
		applyLink(editor, values);
	}

	window.ProseMirrorLinkDialog = { open, getLinkAttrs, applyLink, getSelectedText };
})();
