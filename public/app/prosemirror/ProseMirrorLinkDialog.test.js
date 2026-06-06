import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadScript(rel) {
	const code = readFileSync(join(__dirname, rel), 'utf-8');
	(0, eval)(code);
}

// Shared link type sentinel
const LINKTYPE = { name: 'link' };

function buildFakeSchema() {
	LINKTYPE.create = vi.fn((attrs) => ({ type: LINKTYPE, attrs }));
	return {
		marks: { link: LINKTYPE },
		text: vi.fn((txt, marks) => ({ text: txt, marks })),
	};
}

function buildChainableTr(overrides = {}) {
	const tr = {
		insert: vi.fn(function () { return this; }),
		addMark: vi.fn(function () { return this; }),
		removeMark: vi.fn(function () { return this; }),
		replaceWith: vi.fn(function () { return this; }),
		scrollIntoView: vi.fn(function () { return this; }),
		...overrides,
	};
	return tr;
}

describe('ProseMirrorLinkDialog', () => {
	beforeEach(() => {
		if (typeof global._ !== 'function') {
			global._ = (s) => s;
		}
		// ProseMirrorLinkDialog depends on ProseMirrorDialog being present (checked in `open`)
		global.window.ProseMirrorDialog = { openForm: vi.fn(async () => null) };
		delete global.window.ProseMirrorLinkDialog;
		loadScript('./ProseMirrorLinkDialog.js');
	});

	afterEach(() => {
		delete global.window.ProseMirrorLinkDialog;
		delete global.window.ProseMirrorDialog;
		document.body.innerHTML = '';
	});

	// -------------------------------------------------------------------------
	// Exports
	// -------------------------------------------------------------------------
	it('exposes open, getLinkAttrs, applyLink, getSelectedText', () => {
		const api = window.ProseMirrorLinkDialog;
		expect(typeof api.open).toBe('function');
		expect(typeof api.getLinkAttrs).toBe('function');
		expect(typeof api.applyLink).toBe('function');
		expect(typeof api.getSelectedText).toBe('function');
	});

	// -------------------------------------------------------------------------
	// getLinkAttrs
	// -------------------------------------------------------------------------
	describe('getLinkAttrs', () => {
		it('returns null when there is no link mark in an empty selection', () => {
			const { getLinkAttrs } = window.ProseMirrorLinkDialog;
			const schema = buildFakeSchema();
			const view = {
				state: {
					selection: { empty: true, from: 1, to: 1, $from: { marks: () => [] } },
					storedMarks: null,
				},
			};
			expect(getLinkAttrs(view, schema)).toBeNull();
		});

		it('returns link attrs from stored marks on an empty selection', () => {
			const { getLinkAttrs } = window.ProseMirrorLinkDialog;
			const schema = buildFakeSchema();
			const view = {
				state: {
					selection: { empty: true, from: 1, to: 1, $from: { marks: () => [] } },
					storedMarks: [{ type: LINKTYPE, attrs: { href: 'h', target: '_blank', title: 't' } }],
				},
			};
			const result = getLinkAttrs(view, schema);
			expect(result).toEqual({ href: 'h', target: '_blank', title: 't' });
		});

		it('returns null when schema has no link mark type', () => {
			const { getLinkAttrs } = window.ProseMirrorLinkDialog;
			const schema = { marks: {} };
			const view = {
				state: {
					selection: { empty: true, from: 1, to: 1, $from: { marks: () => [] } },
					storedMarks: null,
				},
			};
			expect(getLinkAttrs(view, schema)).toBeNull();
		});

		it('reads link mark from a non-empty selection via nodesBetween', () => {
			const { getLinkAttrs } = window.ProseMirrorLinkDialog;
			const schema = buildFakeSchema();
			const linkMark = { type: LINKTYPE, attrs: { href: 'https://a', target: null, title: null } };
			const view = {
				state: {
					selection: { empty: false, from: 1, to: 5 },
					storedMarks: null,
					doc: {
						nodesBetween: vi.fn((_from, _to, cb) => {
							cb({ marks: [linkMark] });
						}),
					},
				},
			};
			const result = getLinkAttrs(view, schema);
			expect(result).toEqual({ href: 'https://a', target: null, title: null });
		});
	});

	// -------------------------------------------------------------------------
	// applyLink
	// -------------------------------------------------------------------------
	describe('applyLink', () => {
		it('inserts a new linked text node when selection is empty and href is non-empty', () => {
			const { applyLink } = window.ProseMirrorLinkDialog;
			const schema = buildFakeSchema();
			const tr = buildChainableTr();
			const dispatch = vi.fn();
			const view = {
				state: {
					selection: { from: 1, to: 1, empty: true },
					tr,
				},
				dispatch,
			};
			const editor = { view, schema, focus: vi.fn() };

			applyLink(editor, { href: 'https://a', text: 'Hello', target: '_blank' });

			expect(LINKTYPE.create).toHaveBeenCalledWith({ href: 'https://a', target: '_blank', title: null });
			expect(schema.text).toHaveBeenCalledWith('Hello', expect.any(Array));
			expect(tr.insert).toHaveBeenCalledWith(1, expect.anything());
			expect(dispatch).toHaveBeenCalledTimes(1);
		});

		it('removes the link mark on a non-empty selection when href is empty', () => {
			const { applyLink } = window.ProseMirrorLinkDialog;
			const schema = buildFakeSchema();
			const tr = buildChainableTr();
			const dispatch = vi.fn();
			const view = {
				state: {
					selection: { from: 1, to: 5, empty: false },
					tr,
				},
				dispatch,
			};
			const editor = { view, schema, focus: vi.fn() };

			applyLink(editor, { href: '' });

			expect(tr.removeMark).toHaveBeenCalledWith(1, 5, LINKTYPE);
			expect(dispatch).toHaveBeenCalledTimes(1);
		});

		it('adds the mark on a non-empty selection when text matches selected text', () => {
			const { applyLink } = window.ProseMirrorLinkDialog;
			const schema = buildFakeSchema();
			const tr = buildChainableTr();
			const dispatch = vi.fn();
			const view = {
				state: {
					selection: { from: 1, to: 4, empty: false },
					tr,
					doc: { textBetween: vi.fn(() => 'sel') },
				},
				dispatch,
			};
			const editor = { view, schema, focus: vi.fn() };

			// text is empty → getSelectedText returns 'sel'; they differ from 'sel' only
			// when text is explicitly different. Provide no text → addMark path.
			applyLink(editor, { href: 'https://b', text: '' });

			expect(tr.addMark).toHaveBeenCalledWith(1, 4, expect.objectContaining({ type: LINKTYPE }));
			expect(dispatch).toHaveBeenCalledTimes(1);
		});

		it('replaces selected text with new linked text when text differs from selection', () => {
			const { applyLink } = window.ProseMirrorLinkDialog;
			const schema = buildFakeSchema();
			const tr = buildChainableTr();
			const dispatch = vi.fn();
			const view = {
				state: {
					selection: { from: 1, to: 4, empty: false },
					tr,
					doc: { textBetween: vi.fn(() => 'old') },
				},
				dispatch,
			};
			const editor = { view, schema, focus: vi.fn() };

			applyLink(editor, { href: 'https://c', text: 'new text', target: null });

			expect(schema.text).toHaveBeenCalledWith('new text', expect.any(Array));
			expect(tr.replaceWith).toHaveBeenCalledWith(1, 4, expect.anything());
			expect(dispatch).toHaveBeenCalledTimes(1);
		});

		it('is a no-op when the schema has no link mark type', () => {
			const { applyLink } = window.ProseMirrorLinkDialog;
			const schema = { marks: {}, text: vi.fn() };
			const dispatch = vi.fn();
			const view = {
				state: { selection: { from: 1, to: 1, empty: true }, tr: buildChainableTr() },
				dispatch,
			};
			const editor = { view, schema, focus: vi.fn() };

			applyLink(editor, { href: 'https://x' });

			expect(dispatch).not.toHaveBeenCalled();
		});

		it('uses href as label when text is empty and selection is empty', () => {
			const { applyLink } = window.ProseMirrorLinkDialog;
			const schema = buildFakeSchema();
			const tr = buildChainableTr();
			const dispatch = vi.fn();
			const view = {
				state: { selection: { from: 2, to: 2, empty: true }, tr },
				dispatch,
			};
			const editor = { view, schema, focus: vi.fn() };

			applyLink(editor, { href: 'https://fallback', text: '' });

			// When text is empty, label falls back to href
			expect(schema.text).toHaveBeenCalledWith('https://fallback', expect.any(Array));
			expect(tr.insert).toHaveBeenCalled();
			expect(dispatch).toHaveBeenCalledTimes(1);
		});
	});

	// -------------------------------------------------------------------------
	// getSelectedText
	// -------------------------------------------------------------------------
	describe('getSelectedText', () => {
		it('returns empty string when selection is empty', () => {
			const { getSelectedText } = window.ProseMirrorLinkDialog;
			const view = {
				state: {
					selection: { from: 1, to: 1, empty: true },
					doc: { textBetween: vi.fn(() => 'should not be called') },
				},
			};
			expect(getSelectedText(view)).toBe('');
		});

		it('returns text from doc.textBetween when selection is non-empty', () => {
			const { getSelectedText } = window.ProseMirrorLinkDialog;
			const textBetween = vi.fn(() => 'hello');
			const view = {
				state: {
					selection: { from: 1, to: 6, empty: false },
					doc: { textBetween },
				},
			};
			const result = getSelectedText(view);
			expect(result).toBe('hello');
			expect(textBetween).toHaveBeenCalledWith(1, 6, ' ');
		});
	});
});
