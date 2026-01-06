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
			loadProseMirror: vi.fn().mockResolvedValue(undefined),
		};

		// Mock ProseMirrorBundle
		global.window.ProseMirrorBundle = {
			Schema: vi.fn(),
			EditorState: { create: vi.fn() },
			EditorView: vi.fn(),
		};

		// Mock ProseMirrorEditor
		global.window.ProseMirrorEditor = vi.fn().mockImplementation(() => ({
			getHTML: vi.fn().mockReturnValue('<p>Test content</p>'),
			setHTML: vi.fn(),
			isEmpty: vi.fn().mockReturnValue(false),
			isDestroyed: vi.fn().mockReturnValue(false),
			destroy: vi.fn(),
			focus: vi.fn(),
			schema: {},
			view: { state: {}, dispatch: vi.fn() },
		}));

		// Mock ProseMirrorToolbar
		global.window.ProseMirrorToolbar = vi.fn().mockImplementation(() => ({
			insertImage: vi.fn(),
			destroy: vi.fn(),
		}));

		// Mock ProseMirrorSchema
		global.window.ProseMirrorSchema = {
			getSchema: vi.fn().mockReturnValue({}),
			parseHTML: vi.fn(),
			serializeHTML: vi.fn(),
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
			const pageEl = document.createElement('div');
			pageEl.setAttribute('nav-id', 'page-123');

			const blockEl = document.createElement('div');
			blockEl.setAttribute('block-id', 'block-456');

			const ideviceEl = document.createElement('div');
			ideviceEl.setAttribute('idevice-id', 'idevice-789');

			pageEl.appendChild(blockEl);
			blockEl.appendChild(ideviceEl);
			document.body.appendChild(pageEl);

			$exeDevice.ideviceBody = ideviceEl;

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
	});
});
