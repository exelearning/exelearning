/**
 * ProseMirror editor mode controller
 *
 * Chooses between the classic (TinyMCE-style) toolbar and the modern (compact)
 * toolbar based on a per-user localStorage preference, and swaps between them
 * without touching the editor content.
 */
(function () {
	'use strict';

	const STORAGE_KEY = 'exe.pm.editorMode';
	const DEFAULT_MODE = 'modern';
	const Logger = window.Logger || console;

	function getMode() {
		try {
			const v = window.localStorage.getItem(STORAGE_KEY);
			return v === 'classic' || v === 'modern' ? v : DEFAULT_MODE;
		} catch (e) {
			return DEFAULT_MODE;
		}
	}

	function persistMode(mode) {
		try {
			window.localStorage.setItem(STORAGE_KEY, mode);
		} catch (e) {
			Logger.warn('[ProseMirrorEditorMode] Could not persist mode:', e);
		}
	}

	/**
	 * @param {ProseMirrorEditor} editor
	 * @param {Object} opts
	 * @param {HTMLElement} opts.toolbarHost - container for the toolbar
	 * @param {Function} [opts.onMediaLibrary] - media library callback (mediaType) => void
	 * @param {Function} [opts.onModeChange] - called with the new mode after a switch
	 * @returns {{ mode: string, setMode: Function, toggle: Function, destroy: Function }}
	 */
	function mount(editor, opts) {
		const toolbarHost = opts.toolbarHost;
		let current = null; // the active toolbar instance
		const handle = { mode: getMode(), setMode, toggle, destroy };

		function buildChrome(mode) {
			// Clear any previous DOM the toolbar appended
			toolbarHost.innerHTML = '';
			if (mode === 'classic') {
				current = new window.ProseMirrorToolbar({
					editor,
					container: toolbarHost,
					onMediaLibrary: opts.onMediaLibrary,
					onSwitchToModern: () => setMode('modern'),
				});
			} else {
				current = new window.ProseMirrorModernToolbar({
					editor,
					container: toolbarHost,
					onMediaLibrary: opts.onMediaLibrary,
					onSwitchToClassic: () => setMode('classic'),
				});
			}
		}

		function teardownChrome() {
			if (current && typeof current.destroy === 'function') {
				current.destroy();
			}
			current = null;
		}

		function setMode(mode) {
			if (mode !== 'classic' && mode !== 'modern') return;
			if (mode === handle.mode && current) return;
			teardownChrome();
			handle.mode = mode;
			persistMode(mode);
			buildChrome(mode);
			if (editor && !editor.isDestroyed?.()) editor.focus?.();
			if (typeof opts.onModeChange === 'function') opts.onModeChange(mode);
		}

		function toggle() {
			setMode(handle.mode === 'modern' ? 'classic' : 'modern');
		}

		function destroy() {
			teardownChrome();
		}

		buildChrome(handle.mode);
		return handle;
	}

	window.ProseMirrorEditorMode = { getMode, mount, STORAGE_KEY, DEFAULT_MODE };
})();
