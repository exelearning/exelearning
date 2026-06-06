import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadScript(rel) {
	const code = readFileSync(join(__dirname, rel), 'utf-8');
	(0, eval)(code);
}

describe('ProseMirrorCommands', () => {
	beforeEach(() => {
		// Minimal ProseMirrorBundle command stubs that just record their construction
		global.window.ProseMirrorBundle = {
			toggleMark: vi.fn((mark) => ({ kind: 'toggleMark', mark })),
			setBlockType: vi.fn((node, attrs) => ({ kind: 'setBlockType', node, attrs })),
			wrapInList: vi.fn((node) => ({ kind: 'wrapInList', node })),
		};
		delete global.window.ProseMirrorCommands;
		loadScript('./ProseMirrorCommands.js');
	});

	it('exposes window.ProseMirrorCommands', () => {
		expect(window.ProseMirrorCommands).toBeDefined();
	});

	it('toggleMark returns a command for a known mark', () => {
		const schema = { marks: { strong: { name: 'strong' } } };
		const cmd = window.ProseMirrorCommands.toggleMark(schema, 'strong');
		expect(window.ProseMirrorBundle.toggleMark).toHaveBeenCalledWith(schema.marks.strong);
		expect(cmd.kind).toBe('toggleMark');
	});

	it('toggleMark returns null for an unknown mark', () => {
		const schema = { marks: {} };
		expect(window.ProseMirrorCommands.toggleMark(schema, 'strong')).toBeNull();
	});

	it('isMarkActive returns true when the stored mark is in the selection', () => {
		const markType = { name: 'strong' };
		const schema = { marks: { strong: markType } };
		const state = {
			selection: { empty: true, $head: { marks: () => [{ type: markType }] } },
			storedMarks: null,
		};
		expect(window.ProseMirrorCommands.isMarkActive(state, schema, 'strong')).toBe(true);
	});

	it('isMarkActive returns false when the mark is absent', () => {
		const markType = { name: 'strong' };
		const schema = { marks: { strong: markType } };
		const state = {
			selection: { empty: true, $head: { marks: () => [] } },
			storedMarks: null,
		};
		expect(window.ProseMirrorCommands.isMarkActive(state, schema, 'strong')).toBe(false);
	});

	describe('insertBlock', () => {
		it('returns false for an unknown node name', () => {
			const editor = { schema: { nodes: {} }, view: {} };
			expect(window.ProseMirrorCommands.insertBlock(editor, 'heading', {})).toBe(false);
		});

		it('returns false when createAndFill returns null', () => {
			const headingType = { createAndFill: vi.fn(() => null) };
			const editor = {
				schema: { nodes: { heading: headingType } },
				view: {
					state: {
						selection: { $from: { depth: 1, node: () => ({ isTextblock: true, content: { size: 0 }, nodeSize: 2 }), before: () => 5, after: () => 7 } },
						tr: { replaceWith: vi.fn(), insert: vi.fn(), scrollIntoView: vi.fn() },
					},
				},
			};
			expect(window.ProseMirrorCommands.insertBlock(editor, 'heading', { level: 1 })).toBe(false);
			expect(headingType.createAndFill).toHaveBeenCalledWith({ level: 1 });
		});

		it('calls replaceWith when cursor is in an empty textblock', () => {
			const fakeNode = { isTextblock: true, nodeSize: 2 };
			const headingType = { createAndFill: vi.fn(() => fakeNode) };
			const dispatchSpy = vi.fn();
			const scrollIntoViewMock = vi.fn();
			const replaceWithMock = vi.fn();
			const tr = {
				replaceWith: vi.fn(function () { return this; }),
				insert: vi.fn(function () { return this; }),
				scrollIntoView: vi.fn(function () { scrollIntoViewMock(); return this; }),
			};
			const focusSpy = vi.fn();
			const editor = {
				schema: { nodes: { heading: headingType } },
				view: {
					state: {
						selection: {
							$from: {
								depth: 1,
								node: (depth) => depth === 1 ? { isTextblock: true, content: { size: 0 }, nodeSize: 2 } : null,
								before: () => 5,
								after: () => 7,
							},
						},
						tr,
					},
					dispatch: dispatchSpy,
				},
				focus: focusSpy,
			};

			const result = window.ProseMirrorCommands.insertBlock(editor, 'heading', { level: 2 });

			expect(result).toBe(true);
			expect(headingType.createAndFill).toHaveBeenCalledWith({ level: 2 });
			expect(tr.replaceWith).toHaveBeenCalled();
			expect(tr.insert).not.toHaveBeenCalled();
			expect(dispatchSpy).toHaveBeenCalled();
			expect(focusSpy).toHaveBeenCalled();
		});

		it('calls insert when cursor is in a non-empty textblock', () => {
			const fakeNode = { isTextblock: true, nodeSize: 2 };
			const headingType = { createAndFill: vi.fn(() => fakeNode) };
			const dispatchSpy = vi.fn();
			const tr = {
				replaceWith: vi.fn(function () { return this; }),
				insert: vi.fn(function () { return this; }),
				scrollIntoView: vi.fn(function () { return this; }),
			};
			const editor = {
				schema: { nodes: { heading: headingType } },
				view: {
					state: {
						selection: {
							$from: {
								depth: 1,
								node: (depth) => depth === 1 ? { isTextblock: true, content: { size: 5 }, nodeSize: 7 } : null,
								before: () => 5,
								after: () => 12,
							},
						},
						tr,
					},
					dispatch: dispatchSpy,
				},
			};

			const result = window.ProseMirrorCommands.insertBlock(editor, 'heading', { level: 3 });

			expect(result).toBe(true);
			expect(tr.replaceWith).not.toHaveBeenCalled();
			expect(tr.insert).toHaveBeenCalledWith(12, fakeNode);
			expect(dispatchSpy).toHaveBeenCalled();
		});
	});

	describe('isBlockActive', () => {
		it('returns true when the current node type matches', () => {
			const paragraphType = { name: 'paragraph' };
			const headingType = { name: 'heading' };
			const schema = { nodes: { paragraph: paragraphType, heading: headingType } };
			const state = {
				selection: {
					$from: {
						depth: 1,
						node: (depth) => (depth === 1 ? { type: paragraphType, attrs: {} } : null),
					},
				},
			};
			expect(window.ProseMirrorCommands.isBlockActive(state, schema, 'paragraph')).toBe(true);
		});

		it('returns false when the current node type does not match', () => {
			const paragraphType = { name: 'paragraph' };
			const headingType = { name: 'heading' };
			const schema = { nodes: { paragraph: paragraphType, heading: headingType } };
			const state = {
				selection: {
					$from: {
						depth: 1,
						node: (depth) => (depth === 1 ? { type: headingType, attrs: { level: 2 } } : null),
					},
				},
			};
			expect(window.ProseMirrorCommands.isBlockActive(state, schema, 'paragraph')).toBe(false);
		});
	});
});
