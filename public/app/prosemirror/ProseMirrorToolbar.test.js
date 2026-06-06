/**
 * @vitest-environment happy-dom
 */

/**
 * Unit tests for ProseMirrorToolbar - TinyMCE-like toolbar
 */

describe('ProseMirrorToolbar', () => {
	let ProseMirrorToolbar;
	let mockEditor;
	let container;

	beforeEach(() => {
		// Mock ProseMirror bundle
		window.ProseMirrorBundle = {
			toggleMark: vi.fn(() => vi.fn()),
			setBlockType: vi.fn(() => vi.fn()),
			wrapIn: vi.fn(() => vi.fn()),
			lift: vi.fn(() => vi.fn()),
			chainCommands: vi.fn(() => vi.fn()),
			undo: vi.fn((state, dispatch) => true),
			redo: vi.fn((state, dispatch) => true),
			wrapInList: vi.fn(() => vi.fn()),
			liftListItem: vi.fn(() => vi.fn()),
			addColumnAfter: vi.fn((state, dispatch) => true),
			addColumnBefore: vi.fn((state, dispatch) => true),
			deleteColumn: vi.fn((state, dispatch) => true),
			addRowAfter: vi.fn((state, dispatch) => true),
			addRowBefore: vi.fn((state, dispatch) => true),
			deleteRow: vi.fn((state, dispatch) => true),
			deleteTable: vi.fn((state, dispatch) => true),
			mergeCells: vi.fn((state, dispatch) => true),
			splitCell: vi.fn((state, dispatch) => true),
			toggleHeaderRow: vi.fn((state, dispatch) => true),
			toggleHeaderColumn: vi.fn((state, dispatch) => true),
			isInTable: vi.fn(() => false),
		};

		// Mock translation function
		window._ = (s) => s;

		// Create container
		container = document.createElement('div');
		document.body.appendChild(container);

		// Mock editor
		mockEditor = {
			schema: {
				marks: {
					strong: { isInSet: vi.fn() },
					em: { isInSet: vi.fn() },
					underline: { isInSet: vi.fn() },
					strike: { isInSet: vi.fn() },
					code: { isInSet: vi.fn() },
					link: { create: vi.fn() },
					textColor: { create: vi.fn() },
					backgroundColor: { create: vi.fn() },
				},
				nodes: {
					paragraph: {},
					heading: {},
					blockquote: {},
					code_block: {},
					bullet_list: {},
					ordered_list: {},
					list_item: {},
					image: { create: vi.fn() },
					video: { create: vi.fn() },
					audio: { create: vi.fn() },
					iframe: { create: vi.fn() },
					horizontal_rule: { create: vi.fn() },
					table: { create: vi.fn() },
					table_row: { create: vi.fn() },
					table_cell: { createAndFill: vi.fn() },
				},
			},
			view: {
				state: {
					selection: { from: 0, to: 0, $from: { marks: () => [], sharedDepth: () => 0, node: () => ({ type: {} }), depth: 0 } },
					storedMarks: null,
					doc: { rangeHasMark: vi.fn(), nodesBetween: vi.fn() },
					tr: {
						addMark: vi.fn().mockReturnThis(),
						removeMark: vi.fn().mockReturnThis(),
						setNodeMarkup: vi.fn().mockReturnThis(),
						replaceSelectionWith: vi.fn().mockReturnThis(),
						scrollIntoView: vi.fn().mockReturnThis(),
					},
				},
				dispatch: vi.fn(),
				dom: {
					addEventListener: vi.fn(),
					removeEventListener: vi.fn(),
				},
			},
			focus: vi.fn(),
			getHTML: vi.fn(() => '<p>Test</p>'),
			setHTML: vi.fn(),
		};

		// Load the toolbar module
		const fs = require('fs');
		const path = require('path');
		const code = fs.readFileSync(path.join(__dirname, 'ProseMirrorToolbar.js'), 'utf-8');
		(0, eval)(code);

		ProseMirrorToolbar = window.ProseMirrorToolbar;
	});

	afterEach(() => {
		document.body.innerHTML = '';
		delete window.ProseMirrorBundle;
		delete window._;
		delete window.ProseMirrorToolbar;
	});

	describe('constructor', () => {
		it('creates toolbar with TinyMCE-like structure', () => {
			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
			});

			expect(toolbar.wrapper).toBeTruthy();
			expect(toolbar.wrapper.classList.contains('prosemirror-toolbar-wrapper')).toBe(true);
		});

		it('throws error if editor is missing', () => {
			expect(() => {
				new ProseMirrorToolbar({ container: container });
			}).toThrow('ProseMirrorToolbar: editor and container are required');
		});

		it('throws error if container is missing', () => {
			expect(() => {
				new ProseMirrorToolbar({ editor: mockEditor });
			}).toThrow('ProseMirrorToolbar: editor and container are required');
		});
	});

	describe('menubar', () => {
		it('creates menubar with Edit, Insert, Format, Table, Tools menus', () => {
			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
			});

			const menubar = container.querySelector('.prosemirror-menubar');
			expect(menubar).toBeTruthy();

			const menuBtns = container.querySelectorAll('.prosemirror-menu-btn');
			expect(menuBtns.length).toBe(5);

			const menuNames = Array.from(menuBtns).map((btn) => btn.dataset.menu);
			expect(menuNames).toContain('edit');
			expect(menuNames).toContain('insert');
			expect(menuNames).toContain('format');
			expect(menuNames).toContain('table');
			expect(menuNames).toContain('tools');
		});

		it('menu dropdown appears on click', () => {
			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
			});

			const editBtn = container.querySelector('[data-menu="edit"]');
			const dropdown = editBtn.parentElement.querySelector('.prosemirror-menu-dropdown');

			expect(dropdown.style.display).toBe('none');

			editBtn.click();

			expect(dropdown.style.display).toBe('block');
		});

		it('closes menu when clicking again', () => {
			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
			});

			const editBtn = container.querySelector('[data-menu="edit"]');
			const dropdown = editBtn.parentElement.querySelector('.prosemirror-menu-dropdown');

			editBtn.click();
			expect(dropdown.style.display).toBe('block');

			editBtn.click();
			expect(dropdown.style.display).toBe('none');
		});
	});

	describe('button rows', () => {
		it('creates multiple button rows', () => {
			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
			});

			const rows = container.querySelectorAll('.prosemirror-toolbar-row');
			expect(rows.length).toBe(3);
		});

		it('creates formatting buttons in first row', () => {
			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
			});

			// Row 1 has: paste, bold, italic, format select, font size, font family, colors
			// (underline is in the Format menu, matching TinyMCE's layout)
			const boldBtn = container.querySelector('[data-name="bold"]');
			const italicBtn = container.querySelector('[data-name="italic"]');
			const pasteBtn = container.querySelector('[data-name="pastespecial"]');

			expect(boldBtn).toBeTruthy();
			expect(italicBtn).toBeTruthy();
			expect(pasteBtn).toBeTruthy();
		});

		it('creates alignment buttons in second row', () => {
			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
			});

			const alignLeftBtn = container.querySelector('[data-name="alignleft"]');
			const alignCenterBtn = container.querySelector('[data-name="aligncenter"]');
			const alignRightBtn = container.querySelector('[data-name="alignright"]');

			expect(alignLeftBtn).toBeTruthy();
			expect(alignCenterBtn).toBeTruthy();
			expect(alignRightBtn).toBeTruthy();
		});

		it('creates insert buttons in third row', () => {
			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
			});

			const imageBtn = container.querySelector('[data-name="image"]');
			const mediaBtn = container.querySelector('[data-name="media"]');
			const tableBtn = container.querySelector('[data-name="table"]');

			expect(imageBtn).toBeTruthy();
			expect(mediaBtn).toBeTruthy();
			expect(tableBtn).toBeTruthy();
		});
	});

	describe('select dropdowns', () => {
		it('creates format selector', () => {
			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
			});

			const formatSelect = container.querySelector('.prosemirror-select-wrapper');
			expect(formatSelect).toBeTruthy();

			const selectBtn = formatSelect.querySelector('.prosemirror-select-btn');
			expect(selectBtn).toBeTruthy();
		});

		it('shows options when clicking select button', () => {
			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
			});

			const selectWrapper = container.querySelector('.prosemirror-select-wrapper');
			const selectBtn = selectWrapper.querySelector('.prosemirror-select-btn');
			const dropdown = selectWrapper.querySelector('.prosemirror-select-dropdown');

			expect(dropdown.style.display).toBe('none');

			selectBtn.click();

			expect(dropdown.style.display).toBe('block');
		});
	});

	describe('button actions', () => {
		it('toggles bold mark when clicking bold button', () => {
			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
			});

			const boldBtn = container.querySelector('[data-name="bold"]');
			boldBtn.click();

			expect(window.ProseMirrorBundle.toggleMark).toHaveBeenCalled();
		});

		it('calls undo when clicking undo button', () => {
			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
			});

			const undoBtn = container.querySelector('[data-name="undo"]');
			undoBtn.click();

			expect(window.ProseMirrorBundle.undo).toHaveBeenCalled();
		});

		it('calls redo when clicking redo button', () => {
			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
			});

			const redoBtn = container.querySelector('[data-name="redo"]');
			redoBtn.click();

			expect(window.ProseMirrorBundle.redo).toHaveBeenCalled();
		});
	});

	describe('insertImage', () => {
		it('inserts image node with attributes', () => {
			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
			});

			mockEditor.schema.nodes.image.create.mockReturnValue({ type: 'image' });

			toolbar.insertImage({ src: 'test.jpg', alt: 'Test' });

			expect(mockEditor.schema.nodes.image.create).toHaveBeenCalledWith({ src: 'test.jpg', alt: 'Test' });
			expect(mockEditor.view.dispatch).toHaveBeenCalled();
		});
	});

	describe('_showImageDialog', () => {
		it('delegates to ProseMirrorImageTools when the dialog framework is available', () => {
			const openProperties = vi.fn();
			window.ProseMirrorImageTools = { openProperties };
			window.ProseMirrorDialog = { openForm: vi.fn() };
			const toolbar = new ProseMirrorToolbar({ editor: mockEditor, container });

			toolbar._showImageDialog();

			expect(openProperties).toHaveBeenCalledWith(mockEditor);
			delete window.ProseMirrorImageTools;
			delete window.ProseMirrorDialog;
		});

		it('falls back to a prompt when the dialog framework is unavailable', () => {
			delete window.ProseMirrorImageTools;
			delete window.ProseMirrorDialog;
			const prevPrompt = window.prompt;
			const promptSpy = vi.fn(() => 'http://img.png');
			window.prompt = promptSpy;
			mockEditor.schema.nodes.image.create.mockReturnValue({ type: 'image' });
			const toolbar = new ProseMirrorToolbar({ editor: mockEditor, container });

			toolbar._showImageDialog();

			expect(promptSpy).toHaveBeenCalled();
			expect(mockEditor.schema.nodes.image.create).toHaveBeenCalledWith({ src: 'http://img.png', alt: '' });
			window.prompt = prevPrompt;
		});
	});

	describe('destroy', () => {
		it('removes toolbar from DOM', () => {
			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
			});

			expect(container.querySelector('.prosemirror-toolbar-wrapper')).toBeTruthy();

			toolbar.destroy();

			expect(container.querySelector('.prosemirror-toolbar-wrapper')).toBeFalsy();
		});

		it('clears internal arrays', () => {
			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
			});

			expect(toolbar.buttons.length).toBeGreaterThan(0);
			expect(toolbar.menus.length).toBe(5);

			toolbar.destroy();

			expect(toolbar.buttons.length).toBe(0);
			expect(toolbar.menus.length).toBe(0);
		});
	});

	describe('color picker', () => {
		it('creates color picker popup on text color button click', () => {
			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
			});

			const forecolorBtn = container.querySelector('[data-name="forecolor"]');
			forecolorBtn.click();

			const colorPicker = document.querySelector('.prosemirror-color-picker');
			expect(colorPicker).toBeTruthy();

			// Clean up
			colorPicker.remove();
		});

		it('color picker has color grid', () => {
			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
			});

			const forecolorBtn = container.querySelector('[data-name="forecolor"]');
			forecolorBtn.click();

			const colorPicker = document.querySelector('.prosemirror-color-picker');
			const colorGrid = colorPicker.querySelector('.color-picker-grid');
			const swatches = colorGrid.querySelectorAll('.color-swatch');

			expect(swatches.length).toBeGreaterThan(0);

			// Clean up
			colorPicker.remove();
		});
	});

	describe('fullscreen toggle', () => {
		it('toggles fullscreen class on container', () => {
			const editorContainer = document.createElement('div');
			editorContainer.className = 'prosemirror-editor-container';
			editorContainer.appendChild(container);
			document.body.appendChild(editorContainer);

			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
			});

			const fullscreenBtn = container.querySelector('[data-name="fullscreen"]');

			expect(editorContainer.classList.contains('fullscreen')).toBe(false);

			fullscreenBtn.click();

			expect(editorContainer.classList.contains('fullscreen')).toBe(true);

			fullscreenBtn.click();

			expect(editorContainer.classList.contains('fullscreen')).toBe(false);
		});
	});

	describe('media library callback', () => {
		it('calls onMediaLibrary callback when clicking image button', () => {
			const onMediaLibrary = vi.fn();

			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
				onMediaLibrary: onMediaLibrary,
			});

			const imageBtn = container.querySelector('[data-name="image"]');
			imageBtn.click();

			expect(onMediaLibrary).toHaveBeenCalledWith('image');
		});

		it('calls onMediaLibrary callback when clicking media button', () => {
			const onMediaLibrary = vi.fn();

			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
				onMediaLibrary: onMediaLibrary,
			});

			const mediaBtn = container.querySelector('[data-name="media"]');
			mediaBtn.click();

			expect(onMediaLibrary).toHaveBeenCalledWith('media');
		});
	});

	describe('switchModern action', () => {
		it('calls onSwitchToModern when switchModern action is executed', () => {
			const onSwitchToModern = vi.fn();

			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
				onSwitchToModern,
			});

			toolbar._executeAction('switchModern');

			expect(onSwitchToModern).toHaveBeenCalled();
		});

		it('tools menu items include a switchModern action entry', () => {
			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
			});

			const toolsMenu = toolbar.menus.find((m) => m.config.name === 'tools');
			expect(toolsMenu).toBeTruthy();
			const switchItem = toolsMenu.config.items.find((item) => item.action === 'switchModern');
			expect(switchItem).toBeTruthy();
		});
	});

	describe('destroy listener cleanup', () => {
		it('removes keyup/mouseup/focus listeners from editor dom on destroy', () => {
			const removeEventListener = vi.fn();
			mockEditor.view.dom = {
				addEventListener: vi.fn(),
				removeEventListener,
			};

			const toolbar = new ProseMirrorToolbar({
				editor: mockEditor,
				container: container,
			});

			toolbar.destroy();

			expect(removeEventListener).toHaveBeenCalledWith('keyup', toolbar._updateHandler);
			expect(removeEventListener).toHaveBeenCalledWith('mouseup', toolbar._updateHandler);
			expect(removeEventListener).toHaveBeenCalledWith('focus', toolbar._updateHandler);
		});
	});
});
