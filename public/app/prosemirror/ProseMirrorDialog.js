/**
 * ProseMirror Dialog framework
 *
 * Renders a declarative form inside an eXeLearning modal (ModalConfirm) and
 * resolves with the collected field values (or null on cancel). Used by the
 * editor's link / image / table / math dialogs so they share one consistent,
 * accessible dialog instead of JS prompt().
 */
(function () {
	'use strict';

	const t = (s) => (typeof _ === 'function' ? _(s) : s);
	let counter = 0;

	function escapeHtml(s) {
		return String(s == null ? '' : s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function renderField(f) {
		const name = escapeHtml(f.name);
		const val = f.value == null ? '' : f.value;
		switch (f.type) {
			case 'textarea':
				return `<textarea name="${name}" class="pm-dialog-input" placeholder="${escapeHtml(f.placeholder || '')}">${escapeHtml(val)}</textarea>`;
			case 'number':
				return `<input type="number" name="${name}" class="pm-dialog-input" value="${escapeHtml(val)}"${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''} />`;
			case 'checkbox':
				return `<input type="checkbox" name="${name}" class="pm-dialog-checkbox"${val ? ' checked' : ''} />`;
			case 'color':
				return `<input type="color" name="${name}" class="pm-dialog-color" value="${escapeHtml(val || '#000000')}" />`;
			case 'select': {
				const opts = (f.options || [])
					.map((o) => `<option value="${escapeHtml(o.value)}"${String(o.value) === String(val) ? ' selected' : ''}>${escapeHtml(o.label)}</option>`)
					.join('');
				return `<select name="${name}" class="pm-dialog-input">${opts}</select>`;
			}
			case 'media':
				// Text input + a Browse button (wired up after render via _wireMediaFields).
				return `<span class="pm-dialog-media"><input type="text" name="${name}" class="pm-dialog-input" value="${escapeHtml(val)}" placeholder="${escapeHtml(f.placeholder || '')}" /><button type="button" class="pm-dialog-browse" data-field="${name}" data-accept="${escapeHtml(f.accept || '')}">${escapeHtml(t('Browse…'))}</button></span>`;
			default:
				return `<input type="text" name="${name}" class="pm-dialog-input" value="${escapeHtml(val)}" placeholder="${escapeHtml(f.placeholder || '')}" />`;
		}
	}

	function buildFormHtml(formId, fields) {
		let html = `<div id="${formId}" class="pm-dialog-form">`;
		for (const f of fields) {
			html += '<div class="pm-dialog-field">';
			if (f.type === 'checkbox') {
				html += `<label class="pm-dialog-inline">${renderField(f)}<span>${escapeHtml(f.label)}</span></label>`;
			} else {
				html += `<label>${escapeHtml(f.label)}</label>${renderField(f)}`;
			}
			html += '</div>';
		}
		html += '</div>';
		return html;
	}

	function collectValues(formId, fields) {
		const root = document.getElementById(formId);
		const out = {};
		if (!root) return out;
		for (const f of fields) {
			const el = root.querySelector(`[name="${f.name}"]`);
			if (!el) continue;
			if (f.type === 'checkbox') out[f.name] = el.checked;
			else if (f.type === 'number') out[f.name] = el.value === '' ? null : Number(el.value);
			else out[f.name] = el.value;
		}
		return out;
	}

	/**
	 * Wire "Browse…" buttons in media fields to the Media Library modal.
	 * The Media Library fills the text input with the chosen asset URL.
	 */
	function wireMediaFields(formId) {
		const root = document.getElementById(formId);
		if (!root) return;
		root.querySelectorAll('.pm-dialog-browse').forEach((btn) => {
			btn.addEventListener('click', (e) => {
				e.preventDefault();
				const fieldName = btn.getAttribute('data-field');
				const accept = btn.getAttribute('data-accept') || null;
				const filemanager = window.eXeLearning?.app?.modals?.filemanager;
				if (!filemanager) return;
				filemanager.show({
					accept: accept,
					onSelect: (result) => {
						if (!result) return;
						const input = root.querySelector(`[name="${fieldName}"]`);
						if (input) {
							input.value = result.blobUrl || result.assetUrl || '';
							input.setAttribute('data-asset-id', result.asset?.id || '');
							input.setAttribute('data-asset-src', result.assetUrl || '');
						}
					},
				});
			});
		});
	}

	/**
	 * Open a modal form.
	 * @param {Object} cfg
	 * @param {string} cfg.title
	 * @param {Array} cfg.fields - field descriptors
	 * @param {string} [cfg.submitLabel]
	 * @returns {Promise<Object|null>} resolved values keyed by field name, or null on cancel
	 */
	function openForm(cfg) {
		return new Promise((resolve) => {
			const modals = window.eXeLearning?.app?.modals;
			if (!modals || !modals.confirm) {
				console.warn('[ProseMirrorDialog] eXe modal system not available');
				resolve(null);
				return;
			}
			const fields = cfg.fields || [];
			const formId = `pm-dialog-${++counter}`;
			const body = buildFormHtml(formId, fields);
			let settled = false;
			const done = (value) => {
				if (settled) return;
				settled = true;
				resolve(value);
			};
			modals.confirm.show({
				title: cfg.title || '',
				body: body,
				contentId: 'pm-dialog',
				confirmButtonText: cfg.submitLabel || t('OK'),
				cancelButtonText: t('Cancel'),
				focusFirstInputText: true,
				behaviour: () => wireMediaFields(formId),
				confirmExec: () => done(collectValues(formId, fields)),
				cancelExec: () => done(null),
				closeExec: () => done(null),
			});
		});
	}

	window.ProseMirrorDialog = { openForm };
	window.ProseMirrorDialogInternals = { buildFormHtml, collectValues, renderField };
})();
