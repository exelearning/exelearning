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
});
