/**
 * ProseMirror Math tools
 *
 * Phase D of the editor-dialogs effort: a `math` node editor backed by the
 * bundled edicuatex LaTeX editor (opened in a modal iframe) with MathJax
 * rendering inside the editor. Replaces the old prompt()-based math insert.
 *
 * The dialog reads the LaTeX straight from the same-origin edicuatex iframe DOM
 * on confirm (rather than postMessage), which is robust regardless of how
 * edicuatex detects its host. The math node serializes to the shared
 * `exe-math-rendered` convention so export / LatexPreRenderer render it too.
 */
(function () {
	'use strict';

	const t = (s) => (typeof _ === 'function' ? _(s) : s);
	let counter = 0;

	/** Wrap raw LaTeX in the inline `\( … \)` or block `\[ … \]` delimiters. */
	function wrapLatex(latex, display) {
		const l = latex || '';
		return display === 'block' ? `\\[${l}\\]` : `\\(${l}\\)`;
	}

	/** Map an edicuatex delimiter selection to our inline/block display mode. */
	function delimToDisplay(delim) {
		return delim === 'brackets' || delim === 'double_dollar' ? 'block' : 'inline';
	}

	/** Versioned asset base, matching YjsLoader's assetPath() resolution. */
	function assetBase() {
		if (window.__EXE_STATIC_MODE__ === true) return '.';
		const cfg = window.eXeLearning && window.eXeLearning.config;
		const basePath = (cfg && cfg.basePath) || '';
		const version = (window.eXeLearning && window.eXeLearning.version) || 'v1.0.0';
		return `${basePath}/${version}`;
	}

	/** URL of the edicuatex editor, optionally prefilled with existing LaTeX. */
	function edicuatexUrl(existingLatex) {
		let url = `${assetBase()}/app/common/edicuatex/index.html`;
		if (existingLatex) url += `?sel=${encodeURIComponent(existingLatex)}`;
		return url;
	}

	/** Read { latex, display } from the edicuatex document (same-origin). */
	function readMathFromDoc(doc) {
		if (!doc) return null;
		const input = doc.getElementById('latex-input');
		const selector = doc.getElementById('delimiter-selector');
		const latex = (input && input.value ? input.value : '').trim();
		const display = delimToDisplay(selector && selector.value);
		return { latex, display };
	}

	/** Ask MathJax (v3/v4) to typeset a freshly-rendered node, if present. */
	function typeset(el) {
		const MJ = window.MathJax;
		if (!MJ || typeof MJ.typesetPromise !== 'function') return;
		try {
			if (typeof MJ.typesetClear === 'function') MJ.typesetClear([el]);
			MJ.typesetPromise([el]).catch(() => {});
		} catch (_e) {
			/* MathJax not ready yet — node still shows raw LaTeX */
		}
	}

	/** Render a math span's delimited LaTeX + data attributes from node attrs. */
	function renderMath(dom, attrs) {
		const display = attrs.display === 'block' ? 'block' : 'inline';
		dom.setAttribute('data-latex', attrs.latex || '');
		dom.setAttribute('data-display', display);
		dom.textContent = wrapLatex(attrs.latex || '', display);
	}

	/** Resolve a ProseMirror getPos (function in current versions) to a number. */
	function resolvePos(getPos) {
		const pos = typeof getPos === 'function' ? getPos() : getPos;
		return typeof pos === 'number' ? pos : null;
	}

	/** Insert a new math node, or replace the one at target.pos when editing. */
	function applyMath(editor, values, target) {
		if (!values || !values.latex) return false;
		const type = editor.schema.nodes.math;
		if (!type) return false;
		const view = editor.view;
		const node = type.create({ latex: values.latex, display: values.display === 'block' ? 'block' : 'inline' });
		let tr;
		if (target && typeof target.pos === 'number' && target.node) {
			tr = view.state.tr.replaceWith(target.pos, target.pos + target.node.nodeSize, node);
		} else {
			tr = view.state.tr.replaceSelectionWith(node);
		}
		view.dispatch(tr.scrollIntoView());
		if (typeof editor.focus === 'function') editor.focus();
		return true;
	}

	/**
	 * Open the edicuatex equation editor in an eXe modal. On confirm the LaTeX is
	 * read from the iframe and inserted/replaced as a `math` node.
	 * @param {Object} editor - ProseMirrorEditor (or shim with view/schema/focus)
	 * @param {{pos:number, node:Object}} [target] - existing math node to edit
	 */
	function openDialog(editor, target) {
		const modals = window.eXeLearning && window.eXeLearning.app && window.eXeLearning.app.modals;
		if (!modals || !modals.confirm || !editor.schema.nodes.math) return;
		const existing = target && target.node ? target.node.attrs.latex : '';
		const frameId = `pm-math-frame-${++counter}`;
		const body = `<div class="pm-math-dialog"><iframe id="${frameId}" class="pm-math-frame" src="${edicuatexUrl(existing)}" title="${t('Equation editor')}"></iframe></div>`;
		const focus = () => {
			if (typeof editor.focus === 'function') editor.focus();
		};
		modals.confirm.show({
			title: t('Equation'),
			body,
			contentId: 'pm-math-dialog',
			confirmButtonText: t('OK'),
			cancelButtonText: t('Cancel'),
			confirmExec: () => {
				const values = readFrame(frameId);
				if (values && values.latex) applyMath(editor, values, target);
				else focus();
			},
			cancelExec: focus,
			closeExec: focus,
		});
	}

	/** Read the LaTeX from the modal's edicuatex iframe by id. */
	function readFrame(frameId) {
		const frame = document.getElementById(frameId);
		if (!frame) return null;
		try {
			return readMathFromDoc(frame.contentWindow.document);
		} catch (_e) {
			return null; // cross-origin or not loaded
		}
	}

	/**
	 * ProseMirror NodeView for `math`: a span rendered by MathJax. Double-click
	 * reopens the equation editor. MathJax mutates the span internals, so all
	 * mutations are ignored (the canonical state lives in the node attrs).
	 */
	function createMathNodeView(node, view, getPos) {
		const dom = document.createElement('span');
		dom.className = 'exe-math-rendered pm-math';
		renderMath(dom, node.attrs);
		typeset(dom);

		dom.addEventListener('dblclick', (e) => {
			e.preventDefault();
			const editor = { view, schema: view.state.schema, focus: () => view.focus() };
			openDialog(editor, { pos: resolvePos(getPos), node });
		});

		return {
			dom,
			selectNode() {
				dom.classList.add('pm-math-selected');
			},
			deselectNode() {
				dom.classList.remove('pm-math-selected');
			},
			update(newNode) {
				if (newNode.type !== node.type) return false;
				node = newNode;
				renderMath(dom, newNode.attrs);
				typeset(dom);
				return true;
			},
			ignoreMutation() {
				return true; // MathJax rewrites the span internals
			},
			stopEvent() {
				return false;
			},
		};
	}

	window.ProseMirrorMathTools = {
		openDialog,
		applyMath,
		createMathNodeView,
	};
	window.ProseMirrorMathToolsInternals = {
		wrapLatex,
		delimToDisplay,
		assetBase,
		edicuatexUrl,
		readMathFromDoc,
		readFrame,
		renderMath,
		resolvePos,
		typeset,
	};
})();
