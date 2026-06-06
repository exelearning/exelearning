import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadScript(rel) {
	const code = readFileSync(join(__dirname, rel), 'utf-8');
	(0, eval)(code);
}

// Image node-type sentinel shared across the suite.
const IMAGE_TYPE = { name: 'image' };

// NodeSelection stub — getSelectedImage uses `instanceof`.
class FakeNodeSelection {}

function setupBundle() {
	global.window.ProseMirrorBundle = {
		Plugin: class {
			constructor(spec) {
				this.spec = spec;
				this.key = spec.key;
			}
		},
		PluginKey: class {
			constructor(name) {
				this.key = name;
			}
		},
		NodeSelection: FakeNodeSelection,
	};
	global.window.ProseMirrorIcons = {
		getIcon: vi.fn((n) => `<svg data-icon="${n}"></svg>`),
	};
	global.window.ProseMirrorDialog = { openForm: vi.fn(async () => null) };
}

function buildChainableTr() {
	const tr = {
		setNodeMarkup: vi.fn(function () {
			return this;
		}),
		replaceSelectionWith: vi.fn(function () {
			return this;
		}),
		scrollIntoView: vi.fn(function () {
			return this;
		}),
	};
	return tr;
}

/** Editor whose selection is a NodeSelection on an image with the given attrs. */
function buildImageEditor(attrs = {}, pos = 3) {
	const tr = buildChainableTr();
	const node = { type: IMAGE_TYPE, attrs: { src: 'a.png', class: null, ...attrs } };
	const selection = Object.assign(new FakeNodeSelection(), { node, from: pos });
	const dispatch = vi.fn();
	const view = {
		state: {
			schema: { nodes: { image: IMAGE_TYPE } },
			selection,
			tr,
			doc: { nodeAt: vi.fn(() => node) },
		},
		dispatch,
	};
	return { view, schema: view.state.schema, focus: vi.fn(), _tr: tr, _dispatch: dispatch, _node: node };
}

/** Editor with an empty (text) selection — no image selected. */
function buildEmptyEditor() {
	const tr = buildChainableTr();
	const imageType = Object.assign({}, IMAGE_TYPE, { create: vi.fn((a) => ({ type: IMAGE_TYPE, attrs: a })) });
	const dispatch = vi.fn();
	const view = {
		state: {
			schema: { nodes: { image: imageType } },
			selection: { empty: true, from: 1, to: 1 },
			tr,
		},
		dispatch,
	};
	return { view, schema: view.state.schema, focus: vi.fn(), _tr: tr, _dispatch: dispatch, _imageType: imageType };
}

describe('ProseMirrorImageTools', () => {
	beforeEach(() => {
		if (typeof global._ !== 'function') global._ = (s) => s;
		setupBundle();
		loadScript('./ProseMirrorImageTools.js');
	});

	afterEach(() => {
		delete global.window.ProseMirrorImageTools;
		delete global.window.proseMirrorImageToolbarPlugin;
		delete global.window.imageToolbarPluginKey;
		delete global.window.ProseMirrorImageToolsInternals;
		delete global.window.ProseMirrorBundle;
		delete global.window.ProseMirrorIcons;
		delete global.window.ProseMirrorDialog;
		document.body.innerHTML = '';
		vi.restoreAllMocks();
	});

	// -------------------------------------------------------------------------
	// Exports
	// -------------------------------------------------------------------------
	it('exposes the public API, plugin factory, key, and internals', () => {
		const api = window.ProseMirrorImageTools;
		expect(typeof api.openProperties).toBe('function');
		expect(typeof api.applyImage).toBe('function');
		expect(typeof api.setAlign).toBe('function');
		expect(typeof api.getSelectedImage).toBe('function');
		expect(typeof api.insertImage).toBe('function');
		expect(typeof window.proseMirrorImageToolbarPlugin).toBe('function');
		expect(window.imageToolbarPluginKey.key).toBe('exeImageToolbar');
		expect(window.ProseMirrorImageToolsInternals).toBeTruthy();
	});

	// -------------------------------------------------------------------------
	// alignment class helpers
	// -------------------------------------------------------------------------
	describe('alignment helpers', () => {
		let I;
		beforeEach(() => {
			I = window.ProseMirrorImageToolsInternals;
		});

		it('alignFromClass finds the alignment token or returns empty', () => {
			expect(I.alignFromClass('foo position-center bar')).toBe('position-center');
			expect(I.alignFromClass('float-left')).toBe('float-left');
			expect(I.alignFromClass('no-align here')).toBe('');
			expect(I.alignFromClass(null)).toBe('');
		});

		it('alignToClassToken maps logical alignment to class tokens', () => {
			expect(I.alignToClassToken('left')).toBe('position-left');
			expect(I.alignToClassToken('center')).toBe('position-center');
			expect(I.alignToClassToken('right')).toBe('position-right');
			expect(I.alignToClassToken('')).toBe('');
			expect(I.alignToClassToken('bogus')).toBe('');
		});

		it('classTokenToAlign maps class tokens back to logical alignment', () => {
			expect(I.classTokenToAlign('position-left')).toBe('left');
			expect(I.classTokenToAlign('float-left')).toBe('left');
			expect(I.classTokenToAlign('position-center')).toBe('center');
			expect(I.classTokenToAlign('position-right')).toBe('right');
			expect(I.classTokenToAlign('float-right')).toBe('right');
			expect(I.classTokenToAlign('whatever')).toBe('');
		});

		it('setAlignClass swaps the existing token while preserving others', () => {
			expect(I.setAlignClass('foo position-left bar', 'right')).toBe('foo bar position-right');
			expect(I.setAlignClass('foo position-center', '')).toBe('foo');
			expect(I.setAlignClass(null, 'center')).toBe('position-center');
			expect(I.setAlignClass('', '')).toBeNull();
		});

		it('round-trips align ⇆ class', () => {
			['left', 'center', 'right'].forEach((align) => {
				const cls = I.setAlignClass(null, align);
				expect(I.classTokenToAlign(I.alignFromClass(cls))).toBe(align);
			});
		});
	});

	// -------------------------------------------------------------------------
	// getSelectedImage
	// -------------------------------------------------------------------------
	describe('getSelectedImage', () => {
		it('returns { node, pos } for an image NodeSelection', () => {
			const editor = buildImageEditor({ src: 'pic.png' }, 5);
			const result = window.ProseMirrorImageTools.getSelectedImage(editor.view);
			expect(result).toEqual({ node: editor._node, pos: 5 });
		});

		it('returns null for a non-image selection', () => {
			const editor = buildEmptyEditor();
			expect(window.ProseMirrorImageTools.getSelectedImage(editor.view)).toBeNull();
		});

		it('returns null when the schema has no image node', () => {
			const view = { state: { schema: { nodes: {} }, selection: new FakeNodeSelection() } };
			expect(window.ProseMirrorImageTools.getSelectedImage(view)).toBeNull();
		});

		it('returns null when given no view', () => {
			expect(window.ProseMirrorImageTools.getSelectedImage(null)).toBeNull();
		});
	});

	// -------------------------------------------------------------------------
	// valuesToAttrs
	// -------------------------------------------------------------------------
	describe('valuesToAttrs', () => {
		it('maps dialog values onto image attrs and trims src', () => {
			const I = window.ProseMirrorImageToolsInternals;
			const attrs = I.valuesToAttrs(
				{ src: '  pic.png  ', alt: 'Alt', title: '', width: 100, height: null, align: 'center' },
				'foo',
			);
			expect(attrs).toEqual({
				src: 'pic.png',
				alt: 'Alt',
				title: null,
				width: 100,
				height: null,
				class: 'foo position-center',
			});
		});

		it('treats empty width string as null', () => {
			const I = window.ProseMirrorImageToolsInternals;
			const attrs = I.valuesToAttrs({ src: 'x', width: '', height: '', align: '' }, null);
			expect(attrs.width).toBeNull();
			expect(attrs.height).toBeNull();
			expect(attrs.class).toBeNull();
		});
	});

	// -------------------------------------------------------------------------
	// applyImageAttrs / setAlign
	// -------------------------------------------------------------------------
	describe('applyImageAttrs', () => {
		it('dispatches setNodeMarkup merging new attrs and focuses', () => {
			const I = window.ProseMirrorImageToolsInternals;
			const editor = buildImageEditor({ src: 'a.png', alt: 'old' }, 3);
			const ok = I.applyImageAttrs(editor, 3, { alt: 'new' });
			expect(ok).toBe(true);
			expect(editor._tr.setNodeMarkup).toHaveBeenCalledWith(3, null, expect.objectContaining({ src: 'a.png', alt: 'new' }));
			expect(editor._dispatch).toHaveBeenCalledTimes(1);
			expect(editor.focus).toHaveBeenCalled();
		});

		it('returns false when there is no node at pos', () => {
			const I = window.ProseMirrorImageToolsInternals;
			const editor = buildImageEditor({}, 3);
			editor.view.state.doc.nodeAt = vi.fn(() => null);
			expect(I.applyImageAttrs(editor, 3, { alt: 'x' })).toBe(false);
			expect(editor._dispatch).not.toHaveBeenCalled();
		});
	});

	describe('setAlign', () => {
		it('applies the alignment class to the selected image', () => {
			const editor = buildImageEditor({ class: 'position-left' }, 3);
			const ok = window.ProseMirrorImageTools.setAlign(editor, 'right');
			expect(ok).toBe(true);
			expect(editor._tr.setNodeMarkup).toHaveBeenCalledWith(3, null, expect.objectContaining({ class: 'position-right' }));
		});

		it('returns false when no image is selected', () => {
			const editor = buildEmptyEditor();
			expect(window.ProseMirrorImageTools.setAlign(editor, 'left')).toBe(false);
		});
	});

	// -------------------------------------------------------------------------
	// insertImage / applyImage
	// -------------------------------------------------------------------------
	describe('insertImage', () => {
		it('inserts a new image node from attrs', () => {
			const editor = buildEmptyEditor();
			const ok = window.ProseMirrorImageTools.insertImage(editor, { src: 'new.png', alt: 'n' });
			expect(ok).toBe(true);
			expect(editor._imageType.create).toHaveBeenCalledWith({ src: 'new.png', alt: 'n' });
			expect(editor._tr.replaceSelectionWith).toHaveBeenCalled();
			expect(editor._dispatch).toHaveBeenCalledTimes(1);
		});

		it('returns false without a src', () => {
			const editor = buildEmptyEditor();
			expect(window.ProseMirrorImageTools.insertImage(editor, { src: '' })).toBe(false);
			expect(editor._dispatch).not.toHaveBeenCalled();
		});
	});

	describe('applyImage', () => {
		it('edits the selected image when one is selected', () => {
			const editor = buildImageEditor({ src: 'a.png', class: null }, 3);
			const selected = window.ProseMirrorImageTools.getSelectedImage(editor.view);
			const ok = window.ProseMirrorImageTools.applyImage(editor, { src: 'b.png', align: 'center' }, selected);
			expect(ok).toBe(true);
			expect(editor._tr.setNodeMarkup).toHaveBeenCalledWith(
				3,
				null,
				expect.objectContaining({ src: 'b.png', class: 'position-center' }),
			);
		});

		it('inserts a new image when nothing is selected', () => {
			const editor = buildEmptyEditor();
			const ok = window.ProseMirrorImageTools.applyImage(editor, { src: 'c.png' }, null);
			expect(ok).toBe(true);
			expect(editor._tr.replaceSelectionWith).toHaveBeenCalled();
		});

		it('is a no-op when values are null or src is empty', () => {
			const editor = buildEmptyEditor();
			expect(window.ProseMirrorImageTools.applyImage(editor, null, null)).toBe(false);
			expect(window.ProseMirrorImageTools.applyImage(editor, { src: '   ' }, null)).toBe(false);
			expect(editor._dispatch).not.toHaveBeenCalled();
		});
	});

	// -------------------------------------------------------------------------
	// openProperties
	// -------------------------------------------------------------------------
	describe('openProperties', () => {
		it('opens the dialog prefilled from the selected image and applies on confirm', async () => {
			const editor = buildImageEditor({ src: 'a.png', alt: 'A', class: 'position-right' }, 3);
			window.ProseMirrorDialog.openForm = vi.fn(async (cfg) => {
				// dialog is prefilled from the selected image
				const srcField = cfg.fields.find((f) => f.name === 'src');
				const alignField = cfg.fields.find((f) => f.name === 'align');
				expect(srcField.value).toBe('a.png');
				expect(alignField.value).toBe('right');
				return { src: 'a.png', alt: 'A', align: 'left' };
			});
			await window.ProseMirrorImageTools.openProperties(editor);
			expect(window.ProseMirrorDialog.openForm).toHaveBeenCalled();
			expect(editor._tr.setNodeMarkup).toHaveBeenCalledWith(3, null, expect.objectContaining({ class: 'position-left' }));
		});

		it('focuses and does nothing when the dialog is cancelled', async () => {
			const editor = buildImageEditor({}, 3);
			window.ProseMirrorDialog.openForm = vi.fn(async () => null);
			await window.ProseMirrorImageTools.openProperties(editor);
			expect(editor.focus).toHaveBeenCalled();
			expect(editor._dispatch).not.toHaveBeenCalled();
		});

		it('is a no-op without ProseMirrorDialog', async () => {
			delete window.ProseMirrorDialog;
			const editor = buildImageEditor({}, 3);
			await window.ProseMirrorImageTools.openProperties(editor);
			expect(editor._dispatch).not.toHaveBeenCalled();
		});

		it('is a no-op when the schema has no image node', async () => {
			const editor = buildEmptyEditor();
			editor.schema.nodes = {};
			window.ProseMirrorDialog.openForm = vi.fn();
			await window.ProseMirrorImageTools.openProperties(editor);
			expect(window.ProseMirrorDialog.openForm).not.toHaveBeenCalled();
		});
	});

	// -------------------------------------------------------------------------
	// runAction
	// -------------------------------------------------------------------------
	describe('runAction', () => {
		it('opens properties on "edit"', () => {
			const I = window.ProseMirrorImageToolsInternals;
			const editor = buildImageEditor({}, 3);
			window.ProseMirrorDialog.openForm = vi.fn(async () => null);
			I.runAction(editor, 'edit');
			expect(window.ProseMirrorDialog.openForm).toHaveBeenCalled();
		});

		it('sets alignment for align commands', () => {
			const I = window.ProseMirrorImageToolsInternals;
			const editor = buildImageEditor({ class: null }, 3);
			I.runAction(editor, 'center');
			expect(editor._tr.setNodeMarkup).toHaveBeenCalledWith(3, null, expect.objectContaining({ class: 'position-center' }));
		});
	});

	// -------------------------------------------------------------------------
	// Plugin
	// -------------------------------------------------------------------------
	describe('proseMirrorImageToolbarPlugin', () => {
		function buildEditorView(selection) {
			const host = document.createElement('div');
			const dom = document.createElement('div');
			host.appendChild(dom);
			document.body.appendChild(host);
			return {
				dom,
				state: { schema: { nodes: { image: IMAGE_TYPE } }, selection },
				coordsAtPos: vi.fn(() => ({ left: 10, top: 40, bottom: 60 })),
				focus: vi.fn(),
				_host: host,
			};
		}

		it('returns a Plugin with the image toolbar key', () => {
			const plugin = window.proseMirrorImageToolbarPlugin();
			expect(plugin.key.key).toBe('exeImageToolbar');
		});

		it('builds a bar with one button per toolbar action and hides it without a selection', () => {
			const view = buildEditorView({ empty: true });
			const plugin = window.proseMirrorImageToolbarPlugin();
			plugin.spec.view(view);
			const bar = view._host.querySelector('.prosemirror-image-toolbar');
			expect(bar).toBeTruthy();
			expect(bar.querySelectorAll('.prosemirror-image-btn').length).toBe(4);
			expect(bar.style.display).toBe('none');
		});

		it('shows and positions the bar when an image is selected and marks the active align', () => {
			const node = { type: IMAGE_TYPE, attrs: { class: 'position-center' } };
			const selection = Object.assign(new FakeNodeSelection(), { node, from: 2 });
			const view = buildEditorView(selection);
			const plugin = window.proseMirrorImageToolbarPlugin();
			plugin.spec.view(view);
			const bar = view._host.querySelector('.prosemirror-image-toolbar');
			expect(bar.style.display).toBe('flex');
			const centerBtn = bar.querySelector('[data-cmd="center"]');
			expect(centerBtn.classList.contains('is-active')).toBe(true);
		});

		it('runs the action on button mousedown using the passed editor', () => {
			const editor = buildImageEditor({ class: null }, 3);
			// View selection mirrors the editor's so reposition shows the bar.
			const view = buildEditorView(editor.view.state.selection);
			const plugin = window.proseMirrorImageToolbarPlugin({ editor });
			plugin.spec.view(view);
			const bar = view._host.querySelector('.prosemirror-image-toolbar');
			const rightBtn = bar.querySelector('[data-cmd="right"]');
			rightBtn.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
			expect(editor._tr.setNodeMarkup).toHaveBeenCalledWith(3, null, expect.objectContaining({ class: 'position-right' }));
		});

		it('cleans up the bar and listeners on destroy', () => {
			const removeSpy = vi.spyOn(window, 'removeEventListener');
			const view = buildEditorView({ empty: true });
			const plugin = window.proseMirrorImageToolbarPlugin();
			const handle = plugin.spec.view(view);
			handle.update();
			handle.destroy();
			expect(view._host.querySelector('.prosemirror-image-toolbar')).toBeNull();
			expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function), true);
			expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
		});
	});
});
