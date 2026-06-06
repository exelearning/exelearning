import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadScript(rel) {
	const code = readFileSync(join(__dirname, rel), 'utf-8');
	(0, eval)(code);
}

/**
 * Build a minimal fake ProseMirrorEditor instance that wires up
 * _additionalPlugins + view.state.plugins so we can test removePlugins /
 * hasPlugin without requiring the real ProseMirrorBundle.
 */
function makeFakeEditor(initialPlugins = [], additionalPlugins = []) {
	let currentPlugins = [...initialPlugins];

	const fakeView = {
		state: {
			get plugins() {
				return currentPlugins;
			},
			reconfigure({ plugins }) {
				// return a new fake state snapshot
				return {
					plugins: [...plugins],
					reconfigure({ plugins: p }) {
						return { plugins: [...p] };
					},
				};
			},
		},
		updateState(newState) {
			// Simulate view accepting the new state
			currentPlugins = [...newState.plugins];
			fakeView.state = {
				...newState,
				reconfigure({ plugins }) {
					return {
						plugins: [...plugins],
						reconfigure({ plugins: p }) {
							return { plugins: [...p] };
						},
					};
				},
			};
		},
	};

	return {
		_additionalPlugins: [...additionalPlugins],
		view: fakeView,
		state: fakeView.state,
	};
}

describe('ProseMirrorEditor – removePlugins / hasPlugin', () => {
	beforeEach(() => {
		// The IIFE reads from window.ProseMirrorBundle at construction time.
		// We don't actually construct a real editor in these tests; we call
		// the prototype methods directly on fake instances, so we only need
		// the bundle stub to satisfy the top-level destructuring when the
		// script is eval-ed.
		global.window.ProseMirrorBundle = {
			EditorState: { create: vi.fn(() => ({ plugins: [] })) },
			Plugin: class Plugin {
				constructor(spec) {
					this.spec = spec;
				}
			},
			PluginKey: class PluginKey {
				constructor(name) {
					this.key = name + '$';
				}
			},
			EditorView: vi.fn(),
			keymap: vi.fn(() => ({})),
			baseKeymap: {},
			history: vi.fn(() => ({})),
			undo: vi.fn(),
			redo: vi.fn(),
			inputRules: vi.fn(() => ({})),
			wrappingInputRule: vi.fn(() => ({})),
			textblockTypeInputRule: vi.fn(() => ({})),
			smartQuotes: [],
			emDash: {},
			ellipsis: {},
			gapCursor: vi.fn(() => ({})),
			dropCursor: vi.fn(() => ({})),
			tableEditing: vi.fn(() => ({})),
			columnResizing: vi.fn(() => ({})),
			goToNextCell: vi.fn(() => () => false),
			toggleMark: vi.fn(),
			setBlockType: vi.fn(),
			wrapIn: vi.fn(),
			lift: vi.fn(),
			chainCommands: vi.fn(),
			exitCode: vi.fn(),
			joinUp: vi.fn(),
			joinDown: vi.fn(),
			liftListItem: vi.fn(),
			sinkListItem: vi.fn(),
			splitListItem: vi.fn(),
		};
		global.window.ProseMirrorSchema = {
			getSchema: vi.fn(() => ({ nodes: {}, marks: {} })),
			parseHTML: vi.fn(),
			serializeHTML: vi.fn(),
		};
		global.window.Logger = console;
		delete global.window.ProseMirrorEditor;
		loadScript('./ProseMirrorEditor.js');
	});

	it('exposes window.ProseMirrorEditor', () => {
		expect(window.ProseMirrorEditor).toBeDefined();
	});

	describe('removePlugins', () => {
		it('removes a matching plugin by PluginKey identity', () => {
			const keyObj = { key: 'myPlugin$' };
			const plugin = { spec: { key: keyObj } };
			const otherPlugin = { spec: { key: { key: 'other$' } } };

			const fake = makeFakeEditor([plugin, otherPlugin], [plugin]);

			window.ProseMirrorEditor.prototype.removePlugins.call(fake, [keyObj]);

			// _additionalPlugins should no longer contain plugin
			expect(fake._additionalPlugins).not.toContain(plugin);
			// view's current plugins should not contain the removed plugin
			expect(fake.view.state.plugins).not.toContain(plugin);
			// the other plugin should still be there
			expect(fake.view.state.plugins).toContain(otherPlugin);
		});

		it('removes a matching plugin by plugin object identity', () => {
			const plugin = { spec: {} };
			const otherPlugin = { spec: { key: { key: 'other$' } } };

			const fake = makeFakeEditor([plugin, otherPlugin], [plugin]);

			window.ProseMirrorEditor.prototype.removePlugins.call(fake, [plugin]);

			expect(fake._additionalPlugins).not.toContain(plugin);
			expect(fake.view.state.plugins).not.toContain(plugin);
			expect(fake.view.state.plugins).toContain(otherPlugin);
		});

		it('accepts a single plugin (non-array) and removes it', () => {
			const keyObj = { key: 'solo$' };
			const plugin = { spec: { key: keyObj } };
			const fake = makeFakeEditor([plugin], [plugin]);

			window.ProseMirrorEditor.prototype.removePlugins.call(fake, keyObj);

			expect(fake._additionalPlugins).not.toContain(plugin);
			expect(fake.view.state.plugins).not.toContain(plugin);
		});

		it('updates this.state to the reconfigured state', () => {
			const keyObj = { key: 'k1$' };
			const plugin = { spec: { key: keyObj } };
			const fake = makeFakeEditor([plugin], [plugin]);

			window.ProseMirrorEditor.prototype.removePlugins.call(fake, [keyObj]);

			// After removePlugins, fake.state should not contain the removed plugin
			expect(fake.state.plugins).not.toContain(plugin);
		});
	});

	describe('hasPlugin', () => {
		it('returns true when a plugin with the given PluginKey is present', () => {
			const keyObj = { key: 'present$' };
			const plugin = { spec: { key: keyObj } };
			const fake = makeFakeEditor([plugin], []);

			const result = window.ProseMirrorEditor.prototype.hasPlugin.call(fake, keyObj);
			expect(result).toBe(true);
		});

		it('returns false when no matching plugin is present', () => {
			const keyObj = { key: 'absent$' };
			const fake = makeFakeEditor([], []);

			const result = window.ProseMirrorEditor.prototype.hasPlugin.call(fake, keyObj);
			expect(result).toBe(false);
		});

		it('returns true when matching by plugin object identity', () => {
			const plugin = { spec: {} };
			const fake = makeFakeEditor([plugin], []);

			const result = window.ProseMirrorEditor.prototype.hasPlugin.call(fake, plugin);
			expect(result).toBe(true);
		});

		it('returns false after removePlugins removes the matching plugin', () => {
			const keyObj = { key: 'transient$' };
			const plugin = { spec: { key: keyObj } };
			const fake = makeFakeEditor([plugin], [plugin]);

			window.ProseMirrorEditor.prototype.removePlugins.call(fake, [keyObj]);
			const result = window.ProseMirrorEditor.prototype.hasPlugin.call(fake, keyObj);
			expect(result).toBe(false);
		});
	});
});
