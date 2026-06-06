import { describe, it, expect, beforeEach, vi } from 'vitest';
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
		delete global.window.ProseMirrorEditorMode;
		loadScript('./ProseMirrorEditorMode.js');
	});

	const fakeEditor = () => ({ focus: vi.fn(), isDestroyed: () => false });

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
});
