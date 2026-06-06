import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadScript(rel) {
	const code = readFileSync(join(__dirname, rel), 'utf-8');
	(0, eval)(code);
}

describe('ProseMirrorEditorMode', () => {
	let classicDestroy, modernDestroy;

	beforeEach(() => {
		localStorage.clear();
		classicDestroy = vi.fn();
		modernDestroy = vi.fn();
		// Stub the two toolbar constructors
		global.window.ProseMirrorToolbar = class {
			constructor(opts) { this.opts = opts; this.destroy = classicDestroy; }
		};
		global.window.ProseMirrorModernToolbar = class {
			constructor(opts) { this.opts = opts; this.destroy = modernDestroy; }
		};
		// Block-menu plugin stubs (overridden per-test when needed)
		global.window.proseMirrorBlockMenuPlugin = vi.fn(() => ({ mockPlugin: true }));
		global.window.blockMenuPluginKey = { key: 'exeBlockMenu' };
		delete global.window.ProseMirrorEditorMode;
		loadScript('./ProseMirrorEditorMode.js');
	});

	afterEach(() => {
		delete global.window.ProseMirrorToolbar;
		delete global.window.ProseMirrorModernToolbar;
		delete global.window.proseMirrorBlockMenuPlugin;
		delete global.window.blockMenuPluginKey;
	});

	const fakeEditor = () => ({
		focus: vi.fn(),
		isDestroyed: () => false,
		addPlugins: vi.fn(),
		removePlugins: vi.fn(),
		hasPlugin: vi.fn(() => false),
	});

	it('defaults to modern when no preference stored', () => {
		expect(window.ProseMirrorEditorMode.getMode()).toBe('modern');
	});

	it('reads a stored preference', () => {
		localStorage.setItem('exe.pm.editorMode', 'classic');
		expect(window.ProseMirrorEditorMode.getMode()).toBe('classic');
	});

	it('mount builds the modern toolbar by default', () => {
		const container = document.createElement('div');
		const handle = window.ProseMirrorEditorMode.mount(fakeEditor(), { toolbarHost: container });
		expect(handle.mode).toBe('modern');
		expect(modernDestroy).not.toHaveBeenCalled();
	});

	it('mount builds the classic toolbar when preference is classic', () => {
		localStorage.setItem('exe.pm.editorMode', 'classic');
		const container = document.createElement('div');
		const handle = window.ProseMirrorEditorMode.mount(fakeEditor(), { toolbarHost: container });
		expect(handle.mode).toBe('classic');
	});

	it('toggle switches mode, persists it, and tears down the previous chrome', () => {
		const container = document.createElement('div');
		const handle = window.ProseMirrorEditorMode.mount(fakeEditor(), { toolbarHost: container });
		expect(handle.mode).toBe('modern');
		handle.toggle();
		expect(handle.mode).toBe('classic');
		expect(localStorage.getItem('exe.pm.editorMode')).toBe('classic');
		expect(modernDestroy).toHaveBeenCalled(); // previous (modern) chrome destroyed
	});

	it('destroy tears down the current toolbar', () => {
		const container = document.createElement('div');
		const handle = window.ProseMirrorEditorMode.mount(fakeEditor(), { toolbarHost: container });
		handle.destroy();
		expect(modernDestroy).toHaveBeenCalled();
	});

	it('calls onModeChange with "classic" after toggle from modern', () => {
		const onModeChange = vi.fn();
		const container = document.createElement('div');
		const handle = window.ProseMirrorEditorMode.mount(fakeEditor(), { toolbarHost: container, onModeChange });
		expect(handle.mode).toBe('modern');
		handle.toggle();
		expect(onModeChange).toHaveBeenCalledWith('classic');
	});

	// -----------------------------------------------------------------------
	// Block-menu plugin wiring
	// -----------------------------------------------------------------------
	it('mounting in modern mode calls editor.addPlugins once', () => {
		const editor = fakeEditor();
		const container = document.createElement('div');
		window.ProseMirrorEditorMode.mount(editor, { toolbarHost: container });
		expect(editor.addPlugins).toHaveBeenCalledTimes(1);
		// The plugin array should contain the result of proseMirrorBlockMenuPlugin()
		expect(editor.addPlugins).toHaveBeenCalledWith([{ mockPlugin: true }]);
	});

	it('does NOT call addPlugins when plugin is already active (hasPlugin returns true)', () => {
		const editor = fakeEditor();
		editor.hasPlugin = vi.fn(() => true); // already present
		const container = document.createElement('div');
		window.ProseMirrorEditorMode.mount(editor, { toolbarHost: container });
		expect(editor.addPlugins).not.toHaveBeenCalled();
	});

	it('toggling from modern to classic calls editor.removePlugins with blockMenuPluginKey', () => {
		const editor = fakeEditor();
		const container = document.createElement('div');
		const handle = window.ProseMirrorEditorMode.mount(editor, { toolbarHost: container });
		expect(handle.mode).toBe('modern');
		handle.toggle(); // → classic
		expect(editor.removePlugins).toHaveBeenCalledWith([window.blockMenuPluginKey]);
	});

	it('mounting in classic mode does NOT call addPlugins', () => {
		localStorage.setItem('exe.pm.editorMode', 'classic');
		const editor = fakeEditor();
		const container = document.createElement('div');
		window.ProseMirrorEditorMode.mount(editor, { toolbarHost: container });
		expect(editor.addPlugins).not.toHaveBeenCalled();
	});
});
