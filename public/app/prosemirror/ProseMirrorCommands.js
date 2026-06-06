/**
 * ProseMirror shared command helpers
 *
 * Thin wrappers over window.ProseMirrorBundle commands plus active-state queries,
 * shared by the modern toolbar and (later) the block and floating menus so they
 * don't each re-implement command wiring.
 */
(function () {
	'use strict';

	const PM = () => window.ProseMirrorBundle;

	function toggleMark(schema, markName) {
		const mark = schema?.marks?.[markName];
		if (!mark) return null;
		return PM().toggleMark(mark);
	}

	function setBlockType(schema, nodeName, attrs) {
		const node = schema?.nodes?.[nodeName];
		if (!node) return null;
		return PM().setBlockType(node, attrs || {});
	}

	function wrapInList(schema, nodeName) {
		const node = schema?.nodes?.[nodeName];
		if (!node || typeof PM().wrapInList !== 'function') return null;
		return PM().wrapInList(node);
	}

	function isMarkActive(state, schema, markName) {
		const type = schema?.marks?.[markName];
		if (!type || !state) return false;
		const { from, to, empty } = state.selection;
		if (empty) {
			const marks = state.storedMarks || state.selection.$head.marks();
			return !!marks.find((m) => m.type === type);
		}
		return state.doc.rangeHasMark(from, to, type);
	}

	function isBlockActive(state, schema, nodeName, attrs) {
		const type = schema?.nodes?.[nodeName];
		if (!type || !state) return false;
		const { $from } = state.selection;
		const node = $from.node($from.depth);
		if (node.type !== type) return false;
		if (!attrs) return true;
		return Object.keys(attrs).every((k) => node.attrs[k] === attrs[k]);
	}

	window.ProseMirrorCommands = {
		toggleMark,
		setBlockType,
		wrapInList,
		isMarkActive,
		isBlockActive,
	};
})();
