import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadScript(rel) {
	const code = readFileSync(join(__dirname, rel), 'utf-8');
	(0, eval)(code);
}

describe('ProseMirrorDialog', () => {
	beforeEach(() => {
		// i18n passthrough
		if (typeof global._ !== 'function') {
			global._ = (s) => s;
		}
		delete global.window.ProseMirrorDialog;
		delete global.window.ProseMirrorDialogInternals;
		loadScript('./ProseMirrorDialog.js');
	});

	afterEach(() => {
		delete global.window.ProseMirrorDialog;
		delete global.window.ProseMirrorDialogInternals;
		delete global.window.eXeLearning;
		document.body.innerHTML = '';
	});

	// -------------------------------------------------------------------------
	// Exports
	// -------------------------------------------------------------------------
	it('exposes ProseMirrorDialog.openForm and ProseMirrorDialogInternals', () => {
		expect(typeof window.ProseMirrorDialog.openForm).toBe('function');
		expect(window.ProseMirrorDialogInternals).toBeTruthy();
		expect(typeof window.ProseMirrorDialogInternals.buildFormHtml).toBe('function');
		expect(typeof window.ProseMirrorDialogInternals.collectValues).toBe('function');
		expect(typeof window.ProseMirrorDialogInternals.renderField).toBe('function');
	});

	// -------------------------------------------------------------------------
	// buildFormHtml
	// -------------------------------------------------------------------------
	describe('buildFormHtml', () => {
		it('renders a labelled text field, select field, and checkbox field', () => {
			const { buildFormHtml } = window.ProseMirrorDialogInternals;
			const fields = [
				{ name: 'href', type: 'text', label: 'URL', value: 'x' },
				{
					name: 'tgt',
					type: 'select',
					label: 'T',
					value: 'a',
					options: [
						{ value: 'a', label: 'A' },
						{ value: 'b', label: 'B' },
					],
				},
				{ name: 'chk', type: 'checkbox', label: 'C', value: true },
			];

			const html = buildFormHtml('f1', fields);
			document.body.innerHTML = html;

			// Container with correct id and class
			const form = document.getElementById('f1');
			expect(form).toBeTruthy();
			expect(form.classList.contains('pm-dialog-form')).toBe(true);

			// Text input
			const hrefInput = form.querySelector('[name="href"]');
			expect(hrefInput).toBeTruthy();
			expect(hrefInput.tagName.toLowerCase()).toBe('input');
			expect(hrefInput.value).toBe('x');

			// Select with correct option selected
			const select = form.querySelector('[name="tgt"]');
			expect(select).toBeTruthy();
			expect(select.tagName.toLowerCase()).toBe('select');
			expect(select.value).toBe('a');

			// Checkbox checked
			const checkbox = form.querySelector('[name="chk"]');
			expect(checkbox).toBeTruthy();
			expect(checkbox.type).toBe('checkbox');
			expect(checkbox.checked).toBe(true);
		});
	});

	// -------------------------------------------------------------------------
	// collectValues
	// -------------------------------------------------------------------------
	describe('collectValues', () => {
		it('reads DOM values into a plain object', () => {
			const { buildFormHtml, collectValues } = window.ProseMirrorDialogInternals;
			const fields = [
				{ name: 'href', type: 'text', label: 'URL', value: 'x' },
				{
					name: 'tgt',
					type: 'select',
					label: 'T',
					value: 'a',
					options: [
						{ value: 'a', label: 'A' },
						{ value: 'b', label: 'B' },
					],
				},
				{ name: 'chk', type: 'checkbox', label: 'C', value: true },
			];

			document.body.innerHTML = buildFormHtml('f1', fields);

			// Override the text input value
			document.querySelector('[name="href"]').value = 'https://y';

			const result = collectValues('f1', fields);
			expect(result.href).toBe('https://y');
			expect(result.tgt).toBe('a');
			expect(result.chk).toBe(true);
		});

		it('returns number type for number fields', () => {
			const { buildFormHtml, collectValues } = window.ProseMirrorDialogInternals;
			const fields = [{ name: 'count', type: 'number', label: 'Count', value: 3 }];
			document.body.innerHTML = buildFormHtml('f-num', fields);
			const result = collectValues('f-num', fields);
			expect(typeof result.count).toBe('number');
			expect(result.count).toBe(3);
		});

		it('returns empty object when form id does not exist', () => {
			const { collectValues } = window.ProseMirrorDialogInternals;
			const result = collectValues('nonexistent-id', [{ name: 'x', type: 'text' }]);
			expect(result).toEqual({});
		});
	});

	// -------------------------------------------------------------------------
	// openForm — resolves with values on confirm
	// -------------------------------------------------------------------------
	describe('openForm', () => {
		it('resolves with field values when confirmExec is called', async () => {
			let capturedData;
			global.window.eXeLearning = {
				app: {
					modals: {
						confirm: {
							show: vi.fn((data) => {
								capturedData = data;
							}),
						},
					},
				},
			};

			const p = window.ProseMirrorDialog.openForm({
				title: 'T',
				fields: [{ name: 'href', type: 'text', label: 'URL', value: 'z' }],
			});

			// confirm.show should have been called synchronously
			expect(global.window.eXeLearning.app.modals.confirm.show).toHaveBeenCalled();
			expect(capturedData).toBeTruthy();
			expect(capturedData.title).toBe('T');
			expect(capturedData.body).toContain('pm-dialog-form');

			// Simulate the modal rendering the body and the user editing the field
			document.body.innerHTML = capturedData.body;
			document.querySelector('[name="href"]').value = 'https://example.com';

			// Simulate the user clicking OK
			capturedData.confirmExec();

			const result = await p;
			expect(result).toEqual({ href: 'https://example.com' });
		});

		it('resolves null when cancelExec is called', async () => {
			let capturedData;
			global.window.eXeLearning = {
				app: {
					modals: {
						confirm: {
							show: vi.fn((data) => {
								capturedData = data;
							}),
						},
					},
				},
			};

			const p = window.ProseMirrorDialog.openForm({
				title: 'T',
				fields: [{ name: 'href', type: 'text', label: 'URL', value: 'z' }],
			});

			capturedData.cancelExec();

			const result = await p;
			expect(result).toBeNull();
		});

		it('resolves null when closeExec is called', async () => {
			let capturedData;
			global.window.eXeLearning = {
				app: {
					modals: {
						confirm: {
							show: vi.fn((data) => {
								capturedData = data;
							}),
						},
					},
				},
			};

			const p = window.ProseMirrorDialog.openForm({
				title: 'T',
				fields: [],
			});

			capturedData.closeExec();

			const result = await p;
			expect(result).toBeNull();
		});

		it('resolves null when the modal system is missing', async () => {
			global.window.eXeLearning = {};
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const result = await window.ProseMirrorDialog.openForm({ fields: [] });
			expect(result).toBeNull();

			warnSpy.mockRestore();
		});

		it('resolves null when eXeLearning is entirely absent', async () => {
			delete global.window.eXeLearning;
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const result = await window.ProseMirrorDialog.openForm({ fields: [] });
			expect(result).toBeNull();

			warnSpy.mockRestore();
		});
	});
});
