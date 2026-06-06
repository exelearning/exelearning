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
		// Icon helper: new shape — getIcon(name) returns an SVG string
		global.window.ProseMirrorIcons = {
			getIcon: vi.fn((n) => `<svg data-icon="${n}"></svg>`),
		};
		global.window.ProseMirrorBundle = {
			toggleMark: vi.fn(() => ({ kind: 'toggleMark' })),
			setBlockType: vi.fn(() => ({ kind: 'setBlockType' })),
			wrapInList: vi.fn(() => ({ kind: 'wrapInList' })),
		};
		delete global.window.ProseMirrorCommands;
		delete global.window.ProseMirrorModernToolbar;
		loadScript('./ProseMirrorCommands.js');
		loadScript('./ProseMirrorModernToolbar.js');

		// Schema includes nodes needed for insert-menu items
		const schema = {
			marks: { strong: {}, em: {}, underline: {}, code: {}, link: {} },
			nodes: {
				paragraph: {},
				heading: {},
				bullet_list: {},
				ordered_list: {},
				horizontal_rule: {},
				table: {},
				code_block: {},
				math: {},
			},
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

	it('clicking [data-action="insert-menu"] opens the insert menu', () => {
		const onMediaLibrary = vi.fn();
		new window.ProseMirrorModernToolbar({ editor, container, onMediaLibrary });
		const insertBtn = container.querySelector('[data-action="insert-menu"]');
		expect(insertBtn).toBeTruthy();
		insertBtn.click();
		expect(container.querySelector('.pm-modern-insert-menu')).toBeTruthy();
	});

	it('mousedown on [data-insert="image"] calls onMediaLibrary with "image"', () => {
		const onMediaLibrary = vi.fn();
		new window.ProseMirrorModernToolbar({ editor, container, onMediaLibrary });
		// Open the menu first
		container.querySelector('[data-action="insert-menu"]').click();
		const imageItem = container.querySelector('.pm-modern-insert-item[data-insert="image"]');
		expect(imageItem).toBeTruthy();
		imageItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		expect(onMediaLibrary).toHaveBeenCalledWith('image');
	});

	it('mousedown on [data-insert="math"] opens the equation dialog when math tools are present', () => {
		const openDialog = vi.fn();
		window.ProseMirrorMathTools = { openDialog };
		new window.ProseMirrorModernToolbar({ editor, container });
		container.querySelector('[data-action="insert-menu"]').click();
		const mathItem = container.querySelector('.pm-modern-insert-item[data-insert="math"]');
		expect(mathItem).toBeTruthy();
		mathItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		expect(openDialog).toHaveBeenCalledWith(editor);
		delete window.ProseMirrorMathTools;
	});

	it('clicking [data-action="insert-menu"] a second time closes the menu', () => {
		const onMediaLibrary = vi.fn();
		new window.ProseMirrorModernToolbar({ editor, container, onMediaLibrary });
		const insertBtn = container.querySelector('[data-action="insert-menu"]');
		// First click: open
		insertBtn.click();
		expect(container.querySelector('.pm-modern-insert-menu')).toBeTruthy();
		// Second click: close
		insertBtn.click();
		expect(container.querySelector('.pm-modern-insert-menu')).toBeFalsy();
	});

	it('mousedown on [data-insert="hr"] calls insertBlock with horizontal_rule', () => {
		const onMediaLibrary = vi.fn();
		// Spy + replace implementation BEFORE constructing toolbar so the
		// cmds reference captured inside the toolbar already points to the spy.
		const insertBlockSpy = vi
			.spyOn(window.ProseMirrorCommands, 'insertBlock')
			.mockReturnValue(true);
		new window.ProseMirrorModernToolbar({ editor, container, onMediaLibrary });
		// Open the insert menu
		container.querySelector('[data-action="insert-menu"]').click();
		const hrItem = container.querySelector('.pm-modern-insert-item[data-insert="hr"]');
		expect(hrItem).toBeTruthy();
		hrItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		expect(insertBlockSpy).toHaveBeenCalledWith(editor, 'horizontal_rule', undefined);
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
