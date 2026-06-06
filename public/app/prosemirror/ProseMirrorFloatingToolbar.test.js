import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadScript(rel) {
	const code = readFileSync(join(__dirname, rel), 'utf-8');
	(0, eval)(code);
}

// Minimal ProseMirrorBundle stub — must be set BEFORE the IIFE runs because
// it destructures Plugin/PluginKey at parse time.
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
		toggleMark: vi.fn(() => vi.fn(() => true)),
	};
	global.window.ProseMirrorIcons = {
		getIcon: vi.fn((n) => `<svg data-icon="${n}"></svg>`),
	};
	global.window.ProseMirrorCommands = {
		isMarkActive: vi.fn(() => false),
	};
}

describe('ProseMirrorFloatingToolbar', () => {
	beforeEach(() => {
		setupBundle();
		delete global.window.proseMirrorFloatingToolbarPlugin;
		delete global.window.floatingToolbarPluginKey;
		delete global.window.ProseMirrorFloatingToolbarInternals;
		loadScript('./ProseMirrorFloatingToolbar.js');
	});

	afterEach(() => {
		delete global.window.ProseMirrorBundle;
		delete global.window.ProseMirrorIcons;
		delete global.window.ProseMirrorCommands;
		delete global.window.proseMirrorFloatingToolbarPlugin;
		delete global.window.floatingToolbarPluginKey;
		delete global.window.ProseMirrorFloatingToolbarInternals;
		document.body.innerHTML = '';
	});

	// -----------------------------------------------------------------------
	// Exports
	// -----------------------------------------------------------------------
	it('exposes proseMirrorFloatingToolbarPlugin, floatingToolbarPluginKey, and ProseMirrorFloatingToolbarInternals', () => {
		expect(typeof window.proseMirrorFloatingToolbarPlugin).toBe('function');
		expect(window.floatingToolbarPluginKey).toBeTruthy();
		expect(window.ProseMirrorFloatingToolbarInternals).toBeTruthy();
		expect(typeof window.ProseMirrorFloatingToolbarInternals.isTextSelectionActive).toBe('function');
		expect(typeof window.ProseMirrorFloatingToolbarInternals.applyMark).toBe('function');
	});

	it('floatingToolbarPluginKey has key "exeFloatingToolbar"', () => {
		expect(window.floatingToolbarPluginKey.key).toBe('exeFloatingToolbar');
	});

	// -----------------------------------------------------------------------
	// isTextSelectionActive
	// -----------------------------------------------------------------------
	describe('isTextSelectionActive', () => {
		let isTextSelectionActive;

		beforeEach(() => {
			isTextSelectionActive = window.ProseMirrorFloatingToolbarInternals.isTextSelectionActive;
		});

		it('returns false for an empty selection', () => {
			expect(isTextSelectionActive({ selection: { empty: true } })).toBe(false);
		});

		it('returns false for a NodeSelection (has .node property)', () => {
			expect(isTextSelectionActive({ selection: { empty: false, node: {} } })).toBe(false);
		});

		it('returns true for a non-empty text selection (no .node property)', () => {
			expect(isTextSelectionActive({ selection: { empty: false } })).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// Plugin view — bar creation and buttons
	// -----------------------------------------------------------------------
	describe('proseMirrorFloatingToolbarPlugin — view lifecycle', () => {
		function buildFakeView(selectionOpts = {}) {
			const dom = document.createElement('div');
			const hostDiv = document.createElement('div');
			hostDiv.appendChild(dom);
			document.body.appendChild(hostDiv);

			const fakeView = {
				dom,
				hasFocus: () => true,
				coordsAtPos: () => ({ left: 100, top: 100, bottom: 120 }),
				focus: vi.fn(),
				dispatch: vi.fn(),
				state: {
					schema: {
						marks: { strong: {}, em: {}, underline: {}, link: {} },
					},
					selection: { empty: false, ...selectionOpts },
				},
			};
			return { fakeView, hostDiv, dom };
		}

		it('appends a .prosemirror-floating-toolbar to the editor host', () => {
			const plugin = window.proseMirrorFloatingToolbarPlugin({});
			const { fakeView, hostDiv } = buildFakeView();
			plugin.spec.view(fakeView);
			expect(hostDiv.querySelector('.prosemirror-floating-toolbar')).toBeTruthy();
		});

		it('creates buttons for strong, em, underline, and link marks', () => {
			const plugin = window.proseMirrorFloatingToolbarPlugin({});
			const { fakeView, hostDiv } = buildFakeView();
			plugin.spec.view(fakeView);
			const bar = hostDiv.querySelector('.prosemirror-floating-toolbar');
			expect(bar.querySelector('[data-cmd="strong"]')).toBeTruthy();
			expect(bar.querySelector('[data-cmd="em"]')).toBeTruthy();
			expect(bar.querySelector('[data-cmd="underline"]')).toBeTruthy();
			expect(bar.querySelector('[data-cmd="link"]')).toBeTruthy();
		});

		it('skips buttons for marks not present in the schema', () => {
			const plugin = window.proseMirrorFloatingToolbarPlugin({});
			const { dom, hostDiv } = buildFakeView();
			const fakeView = {
				dom,
				hasFocus: () => false,
				coordsAtPos: () => ({ left: 0, top: 0, bottom: 10 }),
				focus: vi.fn(),
				dispatch: vi.fn(),
				state: {
					schema: { marks: { strong: {} } }, // only strong
					selection: { empty: false },
				},
			};
			plugin.spec.view(fakeView);
			const bar = hostDiv.querySelector('.prosemirror-floating-toolbar');
			expect(bar.querySelector('[data-cmd="strong"]')).toBeTruthy();
			expect(bar.querySelector('[data-cmd="em"]')).toBeNull();
			expect(bar.querySelector('[data-cmd="underline"]')).toBeNull();
			expect(bar.querySelector('[data-cmd="link"]')).toBeNull();
		});

		// -----------------------------------------------------------------------
		// Show/hide behaviour
		// -----------------------------------------------------------------------
		it('shows the bar (display flex) on non-empty text selection when editor has focus', () => {
			const plugin = window.proseMirrorFloatingToolbarPlugin({});
			const { fakeView, hostDiv } = buildFakeView(); // selection.empty = false, hasFocus = true
			plugin.spec.view(fakeView);
			const bar = hostDiv.querySelector('.prosemirror-floating-toolbar');
			expect(bar.style.display).toBe('flex');
		});

		it('hides the bar (display none) when selection becomes empty after update()', () => {
			const plugin = window.proseMirrorFloatingToolbarPlugin({});
			const { fakeView, hostDiv } = buildFakeView();
			const pv = plugin.spec.view(fakeView);
			const bar = hostDiv.querySelector('.prosemirror-floating-toolbar');
			expect(bar.style.display).toBe('flex');

			// Simulate selection cleared
			fakeView.state.selection = { empty: true };
			pv.update();
			expect(bar.style.display).toBe('none');
		});

		it('hides the bar when editor loses focus', () => {
			const plugin = window.proseMirrorFloatingToolbarPlugin({});
			const { fakeView, hostDiv } = buildFakeView();
			// hasFocus returns false
			fakeView.hasFocus = () => false;
			const pv = plugin.spec.view(fakeView);
			const bar = hostDiv.querySelector('.prosemirror-floating-toolbar');
			expect(bar.style.display).toBe('none');
		});

		// -----------------------------------------------------------------------
		// Mark button dispatches toggleMark
		// -----------------------------------------------------------------------
		it('mousedown on [data-cmd="strong"] calls toggleMark with the strong mark type', () => {
			const { toggleMark } = window.ProseMirrorBundle;
			const plugin = window.proseMirrorFloatingToolbarPlugin({});
			const { fakeView, hostDiv } = buildFakeView();
			plugin.spec.view(fakeView);

			const strongBtn = hostDiv.querySelector('[data-cmd="strong"]');
			expect(strongBtn).toBeTruthy();

			strongBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

			expect(toggleMark).toHaveBeenCalledWith(fakeView.state.schema.marks.strong, undefined);
		});

		it('mousedown on [data-cmd="em"] calls toggleMark with the em mark type', () => {
			const { toggleMark } = window.ProseMirrorBundle;
			const plugin = window.proseMirrorFloatingToolbarPlugin({});
			const { fakeView, hostDiv } = buildFakeView();
			plugin.spec.view(fakeView);

			const emBtn = hostDiv.querySelector('[data-cmd="em"]');
			emBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

			expect(toggleMark).toHaveBeenCalledWith(fakeView.state.schema.marks.em, undefined);
		});

		it('mousedown on [data-cmd="strong"] calls the returned command with view.dispatch', () => {
			const commandFn = vi.fn(() => true);
			window.ProseMirrorBundle.toggleMark = vi.fn(() => commandFn);

			const plugin = window.proseMirrorFloatingToolbarPlugin({});
			const { fakeView, hostDiv } = buildFakeView();
			plugin.spec.view(fakeView);

			const strongBtn = hostDiv.querySelector('[data-cmd="strong"]');
			strongBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

			// The command is called with (state, dispatch, view)
			expect(commandFn).toHaveBeenCalledWith(fakeView.state, fakeView.dispatch, fakeView);
		});

		// -----------------------------------------------------------------------
		// Destroy
		// -----------------------------------------------------------------------
		it('destroy removes the bar from the DOM', () => {
			const plugin = window.proseMirrorFloatingToolbarPlugin({});
			const { fakeView, hostDiv } = buildFakeView();
			const pv = plugin.spec.view(fakeView);

			expect(hostDiv.querySelector('.prosemirror-floating-toolbar')).toBeTruthy();
			pv.destroy();
			expect(hostDiv.querySelector('.prosemirror-floating-toolbar')).toBeNull();
		});

		it('destroy removes scroll/resize listeners without throwing', () => {
			const plugin = window.proseMirrorFloatingToolbarPlugin({});
			const { fakeView } = buildFakeView();
			const pv = plugin.spec.view(fakeView);
			// Should not throw
			expect(() => pv.destroy()).not.toThrow();
		});
	});
});
