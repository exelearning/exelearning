/**
 * Unit tests for collaborative-editing iDevice - Edition Mode (ProseMirror)
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load iDevice file and expose $exeDevice globally.
 */
function loadIdevice(code) {
	const modifiedCode = code.replace(/var\s+\$exeDevice\s*=/, 'global.$exeDevice =');
	(0, eval)(modifiedCode);
	return global.$exeDevice;
}

/**
 * Build a fresh mock ProseMirror editor.
 */
function makeMockEditor(html = '<p>Test content</p>', empty = false) {
	return {
		schema: { nodes: { image: {}, video: { create: vi.fn(() => ({})) }, audio: { create: vi.fn(() => ({})) } } },
		view: { state: { tr: { replaceSelectionWith: vi.fn(() => ({})) } }, dispatch: vi.fn() },
		getHTML: vi.fn().mockReturnValue(html),
		setHTML: vi.fn(),
		isEmpty: vi.fn().mockReturnValue(empty),
		isDestroyed: vi.fn().mockReturnValue(false),
		insertImage: vi.fn(),
		destroy: vi.fn(),
		focus: vi.fn(),
	};
}

describe('collaborative-editing iDevice - Edition', () => {
	let $exeDevice;
	let mockElement;

	beforeEach(() => {
		// Reset $exeDevice before loading
		global.$exeDevice = undefined;

		// Clear eXe.app history
		eXe.app.clearHistory();

		// Create mock element for the iDevice
		mockElement = document.createElement('div');
		mockElement.setAttribute('idevice-id', 'test-collab-123');
		document.body.appendChild(mockElement);

		// Mock YjsLoader (ProseMirror loader)
		global.window.YjsLoader = {
			loadProseMirror: vi.fn().mockResolvedValue(undefined),
		};

		// Mock ProseMirrorEditor class
		global.window.ProseMirrorEditor = class MockProseMirrorEditor {
			constructor() {
				Object.assign(this, makeMockEditor());
			}
		};

		// Mock ProseMirrorToolbar class
		global.window.ProseMirrorToolbar = class MockProseMirrorToolbar {
			constructor() {
				this.destroy = vi.fn();
			}
		};

		// Mock ProseMirror editor mode controller (returns a chrome handle)
		global.window.ProseMirrorEditorMode = {
			mount: vi.fn(() => ({ mode: 'modern', setMode: vi.fn(), toggle: vi.fn(), destroy: vi.fn() })),
		};

		// Read and execute the iDevice file
		const filePath = join(__dirname, 'collaborative-editing.js');
		const code = readFileSync(filePath, 'utf-8');

		// Load iDevice and get reference
		$exeDevice = loadIdevice(code);
	});

	afterEach(() => {
		mockElement = null;
		delete global.window.ProseMirrorEditor;
		delete global.window.ProseMirrorToolbar;
		delete global.window.ProseMirrorEditorMode;
		delete global.window.YjsProseMirrorBinding;
		delete global.window.Y;
	});

	describe('i18n and configuration', () => {
		it('has name defined', () => {
			expect($exeDevice.name).toBeDefined();
		});

		it('has form ID defined', () => {
			expect($exeDevice.formId).toBe('collabEditForm');
		});

		it('has main editor ID defined', () => {
			expect($exeDevice.mainEditorId).toBe('collabMainEditor');
		});

		it('has feedback editor ID defined', () => {
			expect($exeDevice.feedbackEditorId).toBe('collabFeedbackEditor');
		});

		it('has default feedback button value', () => {
			expect($exeDevice.feedbackInputValue).toBeDefined();
		});
	});

	describe('init', () => {
		it('stores ideviceBody reference', () => {
			$exeDevice.init(mockElement, {});
			expect($exeDevice.ideviceBody).toBe(mockElement);
		});

		it('stores previousData reference', () => {
			const previousData = { htmlContent: '<p>Previous</p>' };
			$exeDevice.init(mockElement, previousData);
			expect($exeDevice.idevicePreviousData).toBe(previousData);
		});

		it('creates the form structure', () => {
			$exeDevice.init(mockElement, {});
			const form = mockElement.querySelector('#collabEditForm');
			expect(form).toBeTruthy();
		});

		it('creates the main editor container', () => {
			$exeDevice.init(mockElement, {});
			const editor = mockElement.querySelector('#collabMainEditor');
			expect(editor).toBeTruthy();
		});

		it('creates the main editor toolbar host', () => {
			$exeDevice.init(mockElement, {});
			const toolbar = mockElement.querySelector('#collabMainEditorToolbar');
			expect(toolbar).toBeTruthy();
		});

		it('creates the feedback fieldset', () => {
			$exeDevice.init(mockElement, {});
			const fieldset = mockElement.querySelector('#collabFeedbackFieldset');
			expect(fieldset).toBeTruthy();
		});

		it('creates the feedback input', () => {
			$exeDevice.init(mockElement, {});
			const input = mockElement.querySelector('#collabFeedbackInput');
			expect(input).toBeTruthy();
		});
	});

	describe('editorHostHtml', () => {
		it('returns toolbar + editor host markup for the given id', () => {
			const html = $exeDevice.editorHostHtml('myEditor');
			expect(html).toContain('id="myEditorToolbar"');
			expect(html).toContain('id="myEditor"');
		});
	});

	describe('setBehaviour', () => {
		it('makes fieldset legend clickable', () => {
			$exeDevice.init(mockElement, {});

			const fieldset = mockElement.querySelector('#collabFeedbackFieldset');
			const legend = fieldset.querySelector('.exe-fieldset-legend');

			// Initially closed
			expect(fieldset.classList.contains('exe-fieldset-closed')).toBe(true);

			// Click to open
			legend.click();
			expect(fieldset.classList.contains('exe-fieldset-open')).toBe(true);

			// Click to close
			legend.click();
			expect(fieldset.classList.contains('exe-fieldset-closed')).toBe(true);
		});
	});

	describe('loadPreviousValues', () => {
		it('loads feedback button text', () => {
			const previousData = { feedbackButtonText: 'Custom Button' };
			$exeDevice.init(mockElement, previousData);
			$exeDevice.loadPreviousValues();

			const input = mockElement.querySelector('#collabFeedbackInput');
			expect(input.value).toBe('Custom Button');
		});

		it('opens feedback fieldset if there is feedback content', () => {
			const previousData = { feedbackContent: '<p>Feedback</p>' };
			$exeDevice.init(mockElement, previousData);
			$exeDevice.loadPreviousValues();

			const fieldset = mockElement.querySelector('#collabFeedbackFieldset');
			expect(fieldset.classList.contains('exe-fieldset-open')).toBe(true);
		});
	});

	describe('checkFormValues', () => {
		it('returns false if main editor is null', () => {
			$exeDevice.init(mockElement, {});
			$exeDevice.mainEditor = null;
			const result = $exeDevice.checkFormValues();
			expect(result).toBe(false);
		});

		it('returns true if main editor has content', () => {
			$exeDevice.init(mockElement, {});
			$exeDevice.mainEditor = makeMockEditor('<p>Test</p>', false);
			const result = $exeDevice.checkFormValues();
			expect(result).toBe(true);
		});
	});

	describe('readEditorHtml', () => {
		it('returns empty string when editor is null', () => {
			$exeDevice.init(mockElement, {});
			expect($exeDevice.readEditorHtml(null, null)).toBe('');
		});

		it('returns editor HTML when no binding present', () => {
			$exeDevice.init(mockElement, {});
			const editor = makeMockEditor('<p>raw</p>');
			expect($exeDevice.readEditorHtml(editor, null)).toBe('<p>raw</p>');
		});

		it('converts blob URLs to asset URLs via the binding', () => {
			$exeDevice.init(mockElement, {});
			const editor = makeMockEditor('<p>blob</p>');
			const binding = {
				convertBlobUrlsToAssetUrls: vi.fn().mockReturnValue('<p>asset</p>'),
			};
			expect($exeDevice.readEditorHtml(editor, binding)).toBe('<p>asset</p>');
			expect(binding.convertBlobUrlsToAssetUrls).toHaveBeenCalledWith('<p>blob</p>');
		});
	});

	describe('save', () => {
		it('returns object with htmlContent when editor exists', () => {
			$exeDevice.init(mockElement, {});
			$exeDevice.mainEditor = makeMockEditor('<p>Main content</p>', false);
			$exeDevice.feedbackEditor = makeMockEditor('', true);

			const result = $exeDevice.save();
			expect(result).toHaveProperty('htmlContent');
			expect(result.htmlContent).toBe('<p>Main content</p>');
		});

		it('clears feedbackContent when the feedback editor is empty', () => {
			$exeDevice.init(mockElement, {});
			$exeDevice.mainEditor = makeMockEditor('<p>Test</p>', false);
			$exeDevice.feedbackEditor = makeMockEditor('<p>ignored</p>', true);

			const result = $exeDevice.save();
			expect(result.feedbackContent).toBe('');
		});

		it('returns object with feedbackButtonText', () => {
			$exeDevice.init(mockElement, {});
			$exeDevice.mainEditor = makeMockEditor('<p>Test</p>', false);
			$exeDevice.feedbackEditor = makeMockEditor('', true);

			const result = $exeDevice.save();
			expect(result).toHaveProperty('feedbackButtonText');
		});

		it('returns object with ideviceId', () => {
			$exeDevice.init(mockElement, {});
			$exeDevice.mainEditor = makeMockEditor('<p>Test</p>', false);
			$exeDevice.feedbackEditor = makeMockEditor('', true);

			const result = $exeDevice.save();
			expect(result).toHaveProperty('ideviceId');
			expect(result.ideviceId).toBe('test-collab-123');
		});
	});

	describe('getDataJson', () => {
		it('returns empty object when checkFormValues fails', () => {
			$exeDevice.init(mockElement, {});
			$exeDevice.mainEditor = null;
			const result = $exeDevice.getDataJson();
			expect(result).toEqual({});
		});

		it('returns save() result when checkFormValues passes', () => {
			$exeDevice.init(mockElement, {});
			$exeDevice.mainEditor = makeMockEditor('<p>Test</p>', false);
			$exeDevice.feedbackEditor = makeMockEditor('', true);

			const result = $exeDevice.getDataJson();
			expect(result).toHaveProperty('htmlContent');
		});
	});

	describe('insertMedia', () => {
		it('inserts an image via editor.insertImage', () => {
			$exeDevice.init(mockElement, {});
			const editor = makeMockEditor();
			$exeDevice.insertMedia(editor, 'image', { src: 'blob:abc', alt: 'pic' });
			expect(editor.insertImage).toHaveBeenCalledWith({ src: 'blob:abc', alt: 'pic' });
		});

		it('inserts a video node for media type', () => {
			$exeDevice.init(mockElement, {});
			const editor = makeMockEditor();
			$exeDevice.insertMedia(editor, 'media', { src: 'blob:vid' });
			expect(editor.schema.nodes.video.create).toHaveBeenCalledWith({ src: 'blob:vid' });
			expect(editor.view.dispatch).toHaveBeenCalled();
		});

		it('inserts an audio node for audio type', () => {
			$exeDevice.init(mockElement, {});
			const editor = makeMockEditor();
			$exeDevice.insertMedia(editor, 'audio', { src: 'blob:aud' });
			expect(editor.schema.nodes.audio.create).toHaveBeenCalledWith({ src: 'blob:aud' });
		});
	});

	describe('handleMediaLibrary', () => {
		it('does nothing when the editor is missing', () => {
			$exeDevice.init(mockElement, {});
			$exeDevice.mainEditor = null;
			expect(() => $exeDevice.handleMediaLibrary('main', 'image')).not.toThrow();
		});

		it('warns when the media library is not available', () => {
			$exeDevice.init(mockElement, {});
			$exeDevice.mainEditor = makeMockEditor();
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
			// Ensure no filemanager
			if (window.eXeLearning?.app?.modals) {
				window.eXeLearning.app.modals.filemanager = undefined;
			}
			$exeDevice.handleMediaLibrary('main', 'image');
			expect(warnSpy).toHaveBeenCalled();
			warnSpy.mockRestore();
		});
	});

	describe('bindEditor', () => {
		it('seeds the editor with saved HTML when Yjs is not enabled', () => {
			$exeDevice.init(mockElement, {});
			const editor = makeMockEditor();
			const binding = $exeDevice.bindEditor(editor, 'main', 'htmlContent', '<p>saved</p>');
			expect(binding).toBeNull();
			expect(editor.setHTML).toHaveBeenCalledWith('<p>saved</p>');
		});
	});

	describe('getUserColor', () => {
		it('returns a hex color string', () => {
			$exeDevice.init(mockElement, {});
			const color = $exeDevice.getUserColor();
			expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
		});
	});

	describe('extractYjsIds', () => {
		it('extracts component ID from DOM', () => {
			// Create DOM structure with IDs
			const pageEl = document.createElement('div');
			pageEl.setAttribute('nav-id', 'page-123');

			const blockEl = document.createElement('div');
			blockEl.classList.add('block-content');
			blockEl.id = 'block-456';

			const ideviceEl = document.createElement('div');
			ideviceEl.classList.add('idevice_node');
			ideviceEl.id = 'idevice-789';

			// Create inner element (ideviceBody is usually inside the idevice_node)
			const innerEl = document.createElement('div');
			ideviceEl.appendChild(innerEl);

			pageEl.appendChild(blockEl);
			blockEl.appendChild(ideviceEl);
			document.body.appendChild(pageEl);

			$exeDevice.ideviceBody = innerEl;

			const ids = $exeDevice.extractYjsIds();

			expect(ids).toEqual({
				pageId: 'page-123',
				blockId: 'block-456',
				componentId: 'idevice-789',
			});

			// Cleanup
			document.body.removeChild(pageEl);
		});

		it('returns null if IDs are missing', () => {
			$exeDevice.ideviceBody = document.createElement('div');
			const ids = $exeDevice.extractYjsIds();
			expect(ids).toBeNull();
		});
	});

	describe('destroy', () => {
		it('destroys editors, toolbars and bindings when they exist', () => {
			$exeDevice.init(mockElement, {});

			// Manually set up mocks
			const mainEditorDestroy = vi.fn();
			const mainToolbarDestroy = vi.fn();
			const mainBindingDestroy = vi.fn();
			const feedbackEditorDestroy = vi.fn();
			const feedbackToolbarDestroy = vi.fn();

			$exeDevice.mainEditor = { destroy: mainEditorDestroy };
			$exeDevice.mainToolbar = { destroy: mainToolbarDestroy };
			$exeDevice.mainBinding = { destroy: mainBindingDestroy };
			$exeDevice.feedbackEditor = { destroy: feedbackEditorDestroy };
			$exeDevice.feedbackToolbar = { destroy: feedbackToolbarDestroy };

			$exeDevice.destroy();

			expect(mainEditorDestroy).toHaveBeenCalled();
			expect(mainToolbarDestroy).toHaveBeenCalled();
			expect(mainBindingDestroy).toHaveBeenCalled();
			expect($exeDevice.mainEditor).toBeNull();
			expect($exeDevice.mainToolbar).toBeNull();
			expect($exeDevice.mainBinding).toBeNull();
		});

		it('handles null editors gracefully', () => {
			$exeDevice.init(mockElement, {});
			// editors are null by default
			expect(() => $exeDevice.destroy()).not.toThrow();
		});

		it('cleans up click-outside handler on destroy', () => {
			$exeDevice.init(mockElement, {});

			// Simulate having a click handler
			const mockHandler = vi.fn();
			$exeDevice._clickOutsideHandler = mockHandler;

			// Spy on removeEventListener
			const removeSpy = vi.spyOn(document, 'removeEventListener');

			$exeDevice.destroy();

			expect(removeSpy).toHaveBeenCalledWith('click', mockHandler, true);
			expect($exeDevice._clickOutsideHandler).toBeNull();

			removeSpy.mockRestore();
		});

		it('clears auto-save timeout on destroy', () => {
			$exeDevice.init(mockElement, {});

			// Simulate having a timeout
			$exeDevice._autoSaveTimeout = setTimeout(() => {}, 1000);

			$exeDevice.destroy();

			expect($exeDevice._autoSaveTimeout).toBeNull();
		});
	});

	describe('auto-save', () => {
		it('has setupAutoSave method', () => {
			expect(typeof $exeDevice.setupAutoSave).toBe('function');
		});

		it('has triggerAutoSave method', () => {
			expect(typeof $exeDevice.triggerAutoSave).toBe('function');
		});

		it('has performAutoSave method', () => {
			expect(typeof $exeDevice.performAutoSave).toBe('function');
		});
	});
});
