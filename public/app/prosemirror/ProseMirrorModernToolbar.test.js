import { describe, it, expect, beforeEach, vi } from 'vitest';
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
		editor = {
			schema,
			view: { state: { selection: { empty: true } }, focus: vi.fn() },
			execCommand: vi.fn(() => true),
			focus: vi.fn(),
		};
		container = document.createElement('div');
		document.body.appendChild(container);
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

	it('"Modo clásico" button calls onSwitchToClassic', () => {
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
});
