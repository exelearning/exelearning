import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadScript(rel) {
	const code = readFileSync(join(__dirname, rel), 'utf-8');
	(0, eval)(code);
}

describe('ProseMirrorModernToolbar', () => {
	let editor, container;

	beforeEach(() => {
		global.window.ProseMirrorIcons = { bold: '<svg/>', italic: '<svg/>', underline: '<svg/>', link: '<svg/>', code: '<svg/>' };
		global.window.ProseMirrorBundle = {
			toggleMark: vi.fn(() => ({ kind: 'toggleMark' })),
			setBlockType: vi.fn(() => ({ kind: 'setBlockType' })),
			wrapInList: vi.fn(() => ({ kind: 'wrapInList' })),
		};
		delete global.window.ProseMirrorCommands;
		delete global.window.ProseMirrorModernToolbar;
		loadScript('./ProseMirrorCommands.js');
		loadScript('./ProseMirrorModernToolbar.js');

		const schema = {
			marks: { strong: {}, em: {}, underline: {}, code: {}, link: {} },
			nodes: { paragraph: {}, heading: {}, bullet_list: {}, ordered_list: {} },
		};
		const mockNode = { type: { name: 'paragraph' }, attrs: {} };
		editor = {
			schema,
			view: {
				state: {
					selection: {
						empty: true,
						$head: { marks: () => [] },
						$from: { depth: 1, node: () => mockNode },
					},
					storedMarks: null,
				},
				dom: document.createElement('div'),
				focus: vi.fn(),
			},
			execCommand: vi.fn(() => true),
			focus: vi.fn(),
		};
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	afterEach(() => {
		document.body.innerHTML = '';
	});

	it('renders a single compact toolbar row', () => {
		new window.ProseMirrorModernToolbar({ editor, container });
		expect(container.querySelector('.prosemirror-modern-toolbar')).toBeTruthy();
	});

	it('renders bold/italic/underline buttons', () => {
		new window.ProseMirrorModernToolbar({ editor, container });
		expect(container.querySelector('[data-cmd="strong"]')).toBeTruthy();
		expect(container.querySelector('[data-cmd="em"]')).toBeTruthy();
		expect(container.querySelector('[data-cmd="underline"]')).toBeTruthy();
	});

	it('clicking bold dispatches a command on the editor', () => {
		new window.ProseMirrorModernToolbar({ editor, container });
		container.querySelector('[data-cmd="strong"]').click();
		expect(editor.execCommand).toHaveBeenCalled();
	});

	it('Insert button calls onMediaLibrary with "image"', () => {
		const onMediaLibrary = vi.fn();
		new window.ProseMirrorModernToolbar({ editor, container, onMediaLibrary });
		container.querySelector('[data-action="insert-image"]').click();
		expect(onMediaLibrary).toHaveBeenCalledWith('image');
	});

	it('"Classic mode" button calls onSwitchToClassic', () => {
		const onSwitchToClassic = vi.fn();
		new window.ProseMirrorModernToolbar({ editor, container, onSwitchToClassic });
		container.querySelector('[data-action="switch-classic"]').click();
		expect(onSwitchToClassic).toHaveBeenCalled();
	});

	it('destroy removes the toolbar DOM', () => {
		const tb = new window.ProseMirrorModernToolbar({ editor, container });
		tb.destroy();
		expect(container.querySelector('.prosemirror-modern-toolbar')).toBeFalsy();
	});

	it('applies is-active class to [data-cmd="strong"] when isMarkActive returns true', () => {
		// Override ProseMirrorCommands so isMarkActive returns true for 'strong'
		global.window.ProseMirrorCommands.isMarkActive = vi.fn((state, schema, name) => name === 'strong');

		new window.ProseMirrorModernToolbar({ editor, container });

		const boldBtn = container.querySelector('[data-cmd="strong"]');
		expect(boldBtn.classList.contains('is-active')).toBe(true);

		// Other buttons should not be active
		const italicBtn = container.querySelector('[data-cmd="em"]');
		expect(italicBtn.classList.contains('is-active')).toBe(false);
	});

	it('removes editor DOM listeners on destroy', () => {
		const removeEventListener = vi.spyOn(editor.view.dom, 'removeEventListener');
		const tb = new window.ProseMirrorModernToolbar({ editor, container });
		tb.destroy();
		expect(removeEventListener).toHaveBeenCalledWith('keyup', tb._updateHandler);
		expect(removeEventListener).toHaveBeenCalledWith('mouseup', tb._updateHandler);
		expect(removeEventListener).toHaveBeenCalledWith('focus', tb._updateHandler);
	});
});
