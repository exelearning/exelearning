/**
 * Unit tests for collaborative-editing iDevice - Edition Mode
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

		// Mock YjsLoader
		global.window.YjsLoader = {
			loadLexical: vi.fn().mockResolvedValue(undefined),
		};

		// Mock LexicalBundle
		global.window.LexicalBundle = {
			createEditor: vi.fn(),
			$getRoot: vi.fn(),
			$getSelection: vi.fn(),
			$insertNodes: vi.fn(),
		};

		// Mock LexicalEditor - use class for proper constructor behavior
		global.window.LexicalEditor = class MockLexicalEditor {
			constructor() {
				this.getHTML = vi.fn().mockReturnValue('<p>Test content</p>');
				this.setHTML = vi.fn();
				this.isEmpty = vi.fn().mockReturnValue(false);
				this.isDestroyed = vi.fn().mockReturnValue(false);
				this.destroy = vi.fn();
				this.focus = vi.fn();
				this.getEditor = vi.fn().mockReturnValue({});
				this.update = vi.fn();
				this.insertImage = vi.fn();
			}
		};

		// Mock LexicalToolbar - use class for proper constructor behavior
		global.window.LexicalToolbar = class MockLexicalToolbar {
			constructor() {
				this.destroy = vi.fn();
			}
		};

		// Mock LexicalNodes
		global.window.LexicalNodes = {
			$createImageNode: vi.fn(),
			$createVideoNode: vi.fn(),
			$createAudioNode: vi.fn(),
			$createIframeNode: vi.fn(),
		};

		// Read and execute the iDevice file
		const filePath = join(__dirname, 'collaborative-editing.js');
		const code = readFileSync(filePath, 'utf-8');

		// Load iDevice and get reference
		$exeDevice = loadIdevice(code);
	});

	afterEach(() => {
		mockElement = null;
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
			// mainEditor is null without async initialization
			const result = $exeDevice.checkFormValues();
			expect(result).toBe(false);
		});

		it('returns true if main editor has content', () => {
			$exeDevice.init(mockElement, {});
			// Manually set up editor mock
			$exeDevice.mainEditor = {
				isEmpty: vi.fn().mockReturnValue(false),
				getHTML: vi.fn().mockReturnValue('<p>Test</p>'),
			};

			const result = $exeDevice.checkFormValues();
			expect(result).toBe(true);
		});
	});

	describe('save', () => {
		it('returns object with htmlContent when editor exists', () => {
			$exeDevice.init(mockElement, {});
			// Manually set up editor mocks
			$exeDevice.mainEditor = {
				isEmpty: vi.fn().mockReturnValue(false),
				getHTML: vi.fn().mockReturnValue('<p>Main content</p>'),
			};
			$exeDevice.feedbackEditor = {
				isEmpty: vi.fn().mockReturnValue(true),
				getHTML: vi.fn().mockReturnValue(''),
			};

			const result = $exeDevice.save();
			expect(result).toHaveProperty('htmlContent');
			expect(result.htmlContent).toBe('<p>Main content</p>');
		});

		it('returns object with feedbackButtonText', () => {
			$exeDevice.init(mockElement, {});
			$exeDevice.mainEditor = {
				isEmpty: vi.fn().mockReturnValue(false),
				getHTML: vi.fn().mockReturnValue('<p>Test</p>'),
			};
			$exeDevice.feedbackEditor = {
				isEmpty: vi.fn().mockReturnValue(true),
				getHTML: vi.fn().mockReturnValue(''),
			};

			const result = $exeDevice.save();
			expect(result).toHaveProperty('feedbackButtonText');
		});

		it('returns object with ideviceId', () => {
			$exeDevice.init(mockElement, {});
			$exeDevice.mainEditor = {
				isEmpty: vi.fn().mockReturnValue(false),
				getHTML: vi.fn().mockReturnValue('<p>Test</p>'),
			};
			$exeDevice.feedbackEditor = {
				isEmpty: vi.fn().mockReturnValue(true),
				getHTML: vi.fn().mockReturnValue(''),
			};

			const result = $exeDevice.save();
			expect(result).toHaveProperty('ideviceId');
			expect(result.ideviceId).toBe('test-collab-123');
		});
	});

	describe('getDataJson', () => {
		it('returns empty object when checkFormValues fails', () => {
			$exeDevice.init(mockElement, {});
			// mainEditor is null, so checkFormValues returns false
			const result = $exeDevice.getDataJson();
			expect(result).toEqual({});
		});

		it('returns save() result when checkFormValues passes', () => {
			$exeDevice.init(mockElement, {});
			$exeDevice.mainEditor = {
				isEmpty: vi.fn().mockReturnValue(false),
				getHTML: vi.fn().mockReturnValue('<p>Test</p>'),
			};
			$exeDevice.feedbackEditor = {
				isEmpty: vi.fn().mockReturnValue(true),
				getHTML: vi.fn().mockReturnValue(''),
			};

			const result = $exeDevice.getDataJson();
			expect(result).toHaveProperty('htmlContent');
		});
	});

	describe('extractYjsIds', () => {
		it('extracts component ID from DOM', () => {
			// Create DOM structure with IDs
			// The new extractYjsIds looks for idevice_node class and id attribute
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
		it('destroys editors and bindings when they exist', () => {
			$exeDevice.init(mockElement, {});

			// Manually set up mocks
			const mainEditorDestroy = vi.fn();
			const mainToolbarDestroy = vi.fn();
			const feedbackEditorDestroy = vi.fn();
			const feedbackToolbarDestroy = vi.fn();

			$exeDevice.mainEditor = { destroy: mainEditorDestroy };
			$exeDevice.mainToolbar = { destroy: mainToolbarDestroy };
			$exeDevice.feedbackEditor = { destroy: feedbackEditorDestroy };
			$exeDevice.feedbackToolbar = { destroy: feedbackToolbarDestroy };

			$exeDevice.destroy();

			expect(mainEditorDestroy).toHaveBeenCalled();
			expect(mainToolbarDestroy).toHaveBeenCalled();
			expect($exeDevice.mainEditor).toBeNull();
			expect($exeDevice.mainToolbar).toBeNull();
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
