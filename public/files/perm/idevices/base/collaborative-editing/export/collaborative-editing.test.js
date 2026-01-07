/**
 * @vitest-environment happy-dom
 */

/**
 * Unit tests for collaborative-editing iDevice - Export Mode
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load iDevice file and expose $collaborativeediting globally.
 * Note: The export iDevice uses lowercase 'e' in 'editing' ($collaborativeediting)
 */
function loadIdevice(code) {
	const modifiedCode = code.replace(/var\s+\$collaborativeediting\s*=/, 'global.$collaborativeediting =');
	(0, eval)(modifiedCode);
	return global.$collaborativeediting;
}

describe('collaborative-editing iDevice - Export', () => {
	let $collaborativeEditing;

	beforeEach(() => {
		// Reset before loading
		global.$collaborativeediting = undefined;

		// Mock translation function
		global._ = (s) => s;

		// Create a simple jQuery-like mock that works with DOM
		const createJQueryMock = (selector) => {
			const elements = typeof selector === 'string' ? Array.from(document.querySelectorAll(selector)) : [selector];

			const jqObj = {
				length: elements.length,
				elements: elements,
				find: (s) => createJQueryMock(s),
				on: vi.fn((event, handler) => {
					elements.forEach((el) => el?.addEventListener?.(event, handler));
					return jqObj;
				}),
				val: vi.fn((newVal) => {
					if (newVal === undefined) {
						return elements[0]?.value || '';
					}
					elements.forEach((el) => {
						if (el) el.value = newVal;
					});
					return jqObj;
				}),
				text: vi.fn((newText) => {
					if (newText === undefined) {
						return elements[0]?.textContent || '';
					}
					elements.forEach((el) => {
						if (el) el.textContent = newText;
					});
					return jqObj;
				}),
				is: vi.fn((selector) => elements.some((el) => el?.matches?.(selector))),
				fadeIn: vi.fn((_, cb) => cb?.()),
				fadeOut: vi.fn((_, cb) => cb?.()),
			};
			return jqObj;
		};

		global.$ = vi.fn(createJQueryMock);

		// Read and execute the iDevice file
		const filePath = join(__dirname, 'collaborative-editing.js');
		const code = readFileSync(filePath, 'utf-8');

		// Load iDevice and get reference
		$collaborativeEditing = loadIdevice(code);
	});

	afterEach(() => {
		delete global._;
		delete global.$;
		document.body.innerHTML = '';
	});

	describe('configuration', () => {
		it('has ideviceClass defined', () => {
			expect($collaborativeEditing.ideviceClass).toBe('collaborativeEditingContent');
		});

		it('has mainContentId defined', () => {
			expect($collaborativeEditing.mainContentId).toBe('htmlContent');
		});

		it('has feedbackTitleId defined', () => {
			expect($collaborativeEditing.feedbackTitleId).toBe('feedbackButtonText');
		});

		it('has feedbackContentId defined', () => {
			expect($collaborativeEditing.feedbackContentId).toBe('feedbackContent');
		});
	});

	describe('getHTMLView', () => {
		it('generates HTML with main content', () => {
			const data = {
				htmlContent: '<p>Test content</p>',
			};

			const html = $collaborativeEditing.getHTMLView(data);

			expect(html).toContain('collaborativeEditingContent');
			expect(html).toContain('<p>Test content</p>');
		});

		it('includes feedback section when feedbackContent is present', () => {
			const data = {
				htmlContent: '<p>Main content</p>',
				feedbackContent: '<p>Feedback text</p>',
				feedbackButtonText: 'Show Feedback',
			};

			const html = $collaborativeEditing.getHTMLView(data);

			expect(html).toContain('feedbackbutton');
			expect(html).toContain('feedback-content');
			expect(html).toContain('<p>Feedback text</p>');
		});

		it('does not include feedback section when feedbackContent is empty', () => {
			const data = {
				htmlContent: '<p>Main content</p>',
				feedbackContent: '',
			};

			const html = $collaborativeEditing.getHTMLView(data);

			expect(html).not.toContain('feedbackbutton');
			expect(html).not.toContain('feedback-content');
		});
	});

	describe('createFeedbackHTML', () => {
		it('creates feedback HTML with button and content', () => {
			const html = $collaborativeEditing.createFeedbackHTML('Show', '<p>Feedback</p>');

			expect(html).toContain('feedbackbutton');
			expect(html).toContain('feedback-content');
			expect(html).toContain('<p>Feedback</p>');
		});

		it('includes both show and hide text in button value', () => {
			const html = $collaborativeEditing.createFeedbackHTML('Show Feedback', '<p>Content</p>');

			expect(html).toContain('Show Feedback|');
		});

		it('uses default button text when title is empty', () => {
			const html = $collaborativeEditing.createFeedbackHTML('', '<p>Content</p>');

			expect(html).toContain('value="');
		});
	});

	describe('renderView', () => {
		it('replaces {content} placeholder in template', () => {
			const data = { htmlContent: '<p>Test</p>' };
			const template = '<div class="wrapper">{content}</div>';

			const result = $collaborativeEditing.renderView(data, {}, template);

			expect(result).toContain('<div class="wrapper">');
			expect(result).toContain('collaborativeEditingContent');
			expect(result).toContain('<p>Test</p>');
		});
	});

	describe('renderBehaviour', () => {
		it('attaches click handler to feedback button', () => {
			// Setup DOM
			document.body.innerHTML = `
				<div class="collaborativeEditingContent">
					<input type="button" class="feedbackbutton" value="Show|Hide" />
					<div class="feedback-content" style="display: none;"></div>
				</div>
			`;

			$collaborativeEditing.renderBehaviour({}, {});

			const btn = document.querySelector('.feedbackbutton');
			expect(btn.textContent).toBe('Show');
		});
	});

	describe('init', () => {
		it('is defined as a function', () => {
			expect(typeof $collaborativeEditing.init).toBe('function');
		});
	});

	describe('renderHtmlOldIdevice', () => {
		it('is defined as a function', () => {
			expect(typeof $collaborativeEditing.renderHtmlOldIdevice).toBe('function');
		});
	});
});
