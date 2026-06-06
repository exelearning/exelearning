import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadScript(rel) {
	const code = readFileSync(join(__dirname, rel), 'utf-8');
	(0, eval)(code);
}

const MATH_TYPE = { name: 'math' };

function buildChainableTr() {
	return {
		replaceSelectionWith: vi.fn(function () {
			return this;
		}),
		replaceWith: vi.fn(function () {
			return this;
		}),
		scrollIntoView: vi.fn(function () {
			return this;
		}),
	};
}

function buildEditor(selection = { empty: true }) {
	const tr = buildChainableTr();
	const mathType = Object.assign({}, MATH_TYPE, { create: vi.fn((attrs) => ({ type: MATH_TYPE, attrs, nodeSize: 1 })) });
	const dispatch = vi.fn();
	const view = { state: { schema: { nodes: { math: mathType } }, selection, tr }, dispatch, focus: vi.fn() };
	return { view, schema: view.state.schema, focus: vi.fn(), _tr: tr, _dispatch: dispatch, _mathType: mathType };
}

function fakeDoc(latex, delim) {
	return {
		getElementById: (id) => {
			if (id === 'latex-input') return { value: latex };
			if (id === 'delimiter-selector') return { value: delim };
			return null;
		},
	};
}

function stubModal() {
	let cfg = null;
	global.window.eXeLearning = {
		app: { modals: { confirm: { show: (c) => { cfg = c; } } } },
		config: { basePath: '/base' },
		version: 'v1',
	};
	return () => cfg;
}

describe('ProseMirrorMathTools', () => {
	beforeEach(() => {
		if (typeof global._ !== 'function') global._ = (s) => s;
		loadScript('./ProseMirrorMathTools.js');
	});

	afterEach(() => {
		delete global.window.ProseMirrorMathTools;
		delete global.window.ProseMirrorMathToolsInternals;
		delete global.window.eXeLearning;
		delete global.window.MathJax;
		delete global.window.__EXE_STATIC_MODE__;
		document.body.innerHTML = '';
		vi.restoreAllMocks();
	});

	// -------------------------------------------------------------------------
	// Exports
	// -------------------------------------------------------------------------
	it('exposes the public API and internals', () => {
		const api = window.ProseMirrorMathTools;
		expect(typeof api.openDialog).toBe('function');
		expect(typeof api.applyMath).toBe('function');
		expect(typeof api.createMathNodeView).toBe('function');
		expect(window.ProseMirrorMathToolsInternals).toBeTruthy();
	});

	// -------------------------------------------------------------------------
	// Pure helpers
	// -------------------------------------------------------------------------
	describe('helpers', () => {
		let I;
		beforeEach(() => {
			I = window.ProseMirrorMathToolsInternals;
		});

		it('wrapLatex uses inline or block delimiters', () => {
			expect(I.wrapLatex('a+b', 'inline')).toBe('\\(a+b\\)');
			expect(I.wrapLatex('a+b', 'block')).toBe('\\[a+b\\]');
			expect(I.wrapLatex('', 'inline')).toBe('\\(\\)');
		});

		it('delimToDisplay maps block delimiters to block, else inline', () => {
			expect(I.delimToDisplay('brackets')).toBe('block');
			expect(I.delimToDisplay('double_dollar')).toBe('block');
			expect(I.delimToDisplay('parentheses')).toBe('inline');
			expect(I.delimToDisplay('none')).toBe('inline');
			expect(I.delimToDisplay(undefined)).toBe('inline');
		});

		it('assetBase honours static mode and basePath/version', () => {
			global.window.eXeLearning = { config: { basePath: '/base' }, version: 'v9' };
			expect(I.assetBase()).toBe('/base/v9');
			global.window.__EXE_STATIC_MODE__ = true;
			expect(I.assetBase()).toBe('.');
		});

		it('edicuatexUrl appends an encoded sel only when prefilled', () => {
			global.window.eXeLearning = { config: { basePath: '/base' }, version: 'v1' };
			expect(I.edicuatexUrl('')).toBe('/base/v1/app/common/edicuatex/index.html');
			expect(I.edicuatexUrl('\\frac{a}{b}')).toBe('/base/v1/app/common/edicuatex/index.html?sel=%5Cfrac%7Ba%7D%7Bb%7D');
		});

		it('readMathFromDoc reads latex + display from the edicuatex document', () => {
			expect(I.readMathFromDoc(fakeDoc('  x^2  ', 'brackets'))).toEqual({ latex: 'x^2', display: 'block' });
			expect(I.readMathFromDoc(fakeDoc('y', 'parentheses'))).toEqual({ latex: 'y', display: 'inline' });
			expect(I.readMathFromDoc(null)).toBeNull();
		});

		it('renderMath writes data attrs and delimited text', () => {
			const dom = document.createElement('span');
			I.renderMath(dom, { latex: 'a', display: 'block' });
			expect(dom.getAttribute('data-latex')).toBe('a');
			expect(dom.getAttribute('data-display')).toBe('block');
			expect(dom.textContent).toBe('\\[a\\]');
		});

		it('typeset is a no-op when MathJax is absent', () => {
			expect(() => I.typeset(document.createElement('span'))).not.toThrow();
		});
	});

	// -------------------------------------------------------------------------
	// applyMath
	// -------------------------------------------------------------------------
	describe('applyMath', () => {
		it('inserts a new math node when there is no target', () => {
			const editor = buildEditor();
			const ok = window.ProseMirrorMathTools.applyMath(editor, { latex: 'a+b', display: 'inline' });
			expect(ok).toBe(true);
			expect(editor._mathType.create).toHaveBeenCalledWith({ latex: 'a+b', display: 'inline' });
			expect(editor._tr.replaceSelectionWith).toHaveBeenCalled();
			expect(editor._dispatch).toHaveBeenCalled();
		});

		it('replaces the targeted node when editing', () => {
			const editor = buildEditor();
			const target = { pos: 4, node: { nodeSize: 1 } };
			window.ProseMirrorMathTools.applyMath(editor, { latex: 'z', display: 'block' }, target);
			expect(editor._tr.replaceWith).toHaveBeenCalledWith(4, 5, expect.anything());
		});

		it('is a no-op without latex or a math node', () => {
			const editor = buildEditor();
			expect(window.ProseMirrorMathTools.applyMath(editor, { latex: '' })).toBe(false);
			editor.schema.nodes = {};
			expect(window.ProseMirrorMathTools.applyMath(editor, { latex: 'a' })).toBe(false);
			expect(editor._dispatch).not.toHaveBeenCalled();
		});
	});

	// -------------------------------------------------------------------------
	// openDialog
	// -------------------------------------------------------------------------
	describe('openDialog', () => {
		it('is a no-op without the modal system or math node', () => {
			const editor = buildEditor();
			window.ProseMirrorMathTools.openDialog(editor); // no eXeLearning
			expect(editor._dispatch).not.toHaveBeenCalled();
		});

		it('opens edicuatex prefilled and inserts on confirm', () => {
			const getCfg = stubModal();
			const editor = buildEditor();
			window.ProseMirrorMathTools.openDialog(editor, { pos: 2, node: { attrs: { latex: 'a' }, nodeSize: 1 } });
			const cfg = getCfg();
			expect(cfg).toBeTruthy();
			expect(cfg.body).toContain('app/common/edicuatex/index.html');
			expect(cfg.body).toContain('sel=a');

			const frameId = cfg.body.match(/id="(pm-math-frame-\d+)"/)[1];
			const fakeFrame = { contentWindow: { document: fakeDoc('x^2', 'brackets') } };
			vi.spyOn(document, 'getElementById').mockImplementation((id) => (id === frameId ? fakeFrame : null));

			cfg.confirmExec();
			expect(editor._mathType.create).toHaveBeenCalledWith({ latex: 'x^2', display: 'block' });
			expect(editor._tr.replaceWith).toHaveBeenCalled(); // editing an existing node
		});

		it('focuses (no insert) when the dialog returns no latex', () => {
			const getCfg = stubModal();
			const editor = buildEditor();
			window.ProseMirrorMathTools.openDialog(editor);
			const cfg = getCfg();
			const frameId = cfg.body.match(/id="(pm-math-frame-\d+)"/)[1];
			vi.spyOn(document, 'getElementById').mockImplementation((id) =>
				id === frameId ? { contentWindow: { document: fakeDoc('   ', 'none') } } : null,
			);
			cfg.confirmExec();
			expect(editor._dispatch).not.toHaveBeenCalled();
			expect(editor.focus).toHaveBeenCalled();
		});

		it('cancel focuses the editor', () => {
			const getCfg = stubModal();
			const editor = buildEditor();
			window.ProseMirrorMathTools.openDialog(editor);
			getCfg().cancelExec();
			expect(editor.focus).toHaveBeenCalled();
		});
	});

	// -------------------------------------------------------------------------
	// readFrame
	// -------------------------------------------------------------------------
	describe('readFrame', () => {
		it('returns null when the frame is missing', () => {
			expect(window.ProseMirrorMathToolsInternals.readFrame('missing')).toBeNull();
		});

		it('returns null when access throws (cross-origin)', () => {
			vi.spyOn(document, 'getElementById').mockReturnValue({
				get contentWindow() {
					throw new Error('cross-origin');
				},
			});
			expect(window.ProseMirrorMathToolsInternals.readFrame('x')).toBeNull();
		});
	});

	// -------------------------------------------------------------------------
	// createMathNodeView
	// -------------------------------------------------------------------------
	describe('createMathNodeView', () => {
		function buildView() {
			return { state: { schema: { nodes: { math: MATH_TYPE } } }, focus: vi.fn() };
		}

		it('renders a math span with delimited latex', () => {
			const node = { type: MATH_TYPE, attrs: { latex: 'a^2', display: 'inline' } };
			const nv = window.ProseMirrorMathTools.createMathNodeView(node, buildView(), () => 1);
			expect(nv.dom.classList.contains('exe-math-rendered')).toBe(true);
			expect(nv.dom.getAttribute('data-latex')).toBe('a^2');
			expect(nv.dom.textContent).toBe('\\(a^2\\)');
		});

		it('toggles the selected class and updates same-type nodes', () => {
			const node = { type: MATH_TYPE, attrs: { latex: 'a', display: 'inline' } };
			const nv = window.ProseMirrorMathTools.createMathNodeView(node, buildView(), () => 1);
			nv.selectNode();
			expect(nv.dom.classList.contains('pm-math-selected')).toBe(true);
			nv.deselectNode();
			expect(nv.dom.classList.contains('pm-math-selected')).toBe(false);
			expect(nv.update({ type: MATH_TYPE, attrs: { latex: 'b', display: 'block' } })).toBe(true);
			expect(nv.dom.textContent).toBe('\\[b\\]');
			expect(nv.update({ type: { name: 'paragraph' }, attrs: {} })).toBe(false);
		});

		it('ignores mutations and does not stop events', () => {
			const node = { type: MATH_TYPE, attrs: { latex: 'a', display: 'inline' } };
			const nv = window.ProseMirrorMathTools.createMathNodeView(node, buildView(), () => 1);
			expect(nv.ignoreMutation()).toBe(true);
			expect(nv.stopEvent()).toBe(false);
		});

		it('double-click reopens the equation dialog for the node', () => {
			const getCfg = stubModal();
			const node = { type: MATH_TYPE, attrs: { latex: 'a', display: 'inline' }, nodeSize: 1 };
			const view = { state: { schema: { nodes: { math: MATH_TYPE } } }, focus: vi.fn() };
			const nv = window.ProseMirrorMathTools.createMathNodeView(node, view, () => 3);
			nv.dom.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true, cancelable: true }));
			const cfg = getCfg();
			expect(cfg).toBeTruthy();
			expect(cfg.body).toContain('sel=a');
		});
	});
});
