/**
 * Collaborative Editing iDevice - Edition Mode
 *
 * Uses ProseMirror with y-prosemirror for real-time collaborative editing.
 * Features the full ProseMirror toolbar (menubar + button rows) and the same
 * Media Library integration as the rest of the application.
 */
/* global $exeDevice:true */
var $exeDevice = {
	// i18n
	name: _('Collaborative Text'),
	textareaTitle: _('Content'),
	feedbackTitle: _('Feedback'),
	feedbackInputTitle: _('Button text'),
	placeholderText: _('Start typing...'),

	// IDs
	formId: 'collabEditForm',
	mainEditorId: 'collabMainEditor',
	feedbackEditorId: 'collabFeedbackEditor',
	feedbackInputId: 'collabFeedbackInput',
	feedbackFieldsetId: 'collabFeedbackFieldset',

	// Default values
	feedbackInputValue: c_('Show Feedback'),

	// Editor handles (ProseMirror)
	mainEditor: null,
	feedbackEditor: null,
	mainToolbar: null,
	feedbackToolbar: null,
	mainBinding: null,
	feedbackBinding: null,

	// State
	ideviceBody: null,
	idevicePreviousData: null,
	_proseMirrorLoaded: false,
	_clickOutsideHandler: null,
	_autoSaveTimeout: null,
	_ideviceNode: null,

	/**
	 * Initialize iDevice
	 * @param {HTMLElement} element - Container element
	 * @param {Object} previousData - Saved data from previous edit
	 */
	init: function (element, previousData) {
		this.ideviceBody = element;
		this.idevicePreviousData = previousData || {};
		this.createForm();
	},

	/**
	 * Build the toolbar + editor host markup for a single editor
	 * @param {string} editorId - Base id for the editor host
	 * @returns {string}
	 */
	editorHostHtml: function (editorId) {
		// Class names must match public/app/prosemirror/prosemirror.css:
		// `.prosemirror-editor-container` (framed wrapper) and `.prosemirror-editor`
		// (the editable host that ProseMirror mounts `.ProseMirror` into and that
		// provides the min-height needed to click/type).
		return `
			<div class="prosemirror-editor-container">
				<div id="${editorId}Toolbar" class="prosemirror-toolbar-host"></div>
				<div id="${editorId}" class="prosemirror-editor"></div>
			</div>
		`;
	},

	/**
	 * Create the editing form
	 */
	createForm: function () {
		const html = `
			<div id="${this.formId}" class="collab-edit-form">
				<!-- Main Content Section -->
				<div class="exe-field">
					<label for="${this.mainEditorId}">${this.textareaTitle}</label>
					${this.editorHostHtml(this.mainEditorId)}
				</div>

				<!-- Feedback Section (collapsible) -->
				<fieldset id="${this.feedbackFieldsetId}" class="exe-fieldset exe-advanced exe-fieldset-closed">
					<legend class="exe-fieldset-legend">
						<span class="icon"><i class="bi bi-chevron-right"></i></span>
						<span class="text">${this.feedbackTitle}</span>
					</legend>
					<div class="exe-fieldset-content">
						<div class="exe-field">
							<label for="${this.feedbackInputId}">${this.feedbackInputTitle}</label>
							<input type="text" id="${this.feedbackInputId}" value="${this.feedbackInputValue}" class="exe-input" />
						</div>
						<div class="exe-field">
							<label>${this.feedbackTitle}</label>
							${this.editorHostHtml(this.feedbackEditorId)}
						</div>
					</div>
				</fieldset>
			</div>
		`;

		this.ideviceBody.innerHTML = html;
		this.setBehaviour();
		this.initEditors();
	},

	/**
	 * Set form behaviour (fieldset toggle, auto-save on click outside)
	 */
	setBehaviour: function () {
		const fieldset = document.getElementById(this.feedbackFieldsetId);
		if (fieldset) {
			const legend = fieldset.querySelector('.exe-fieldset-legend');
			if (legend) {
				legend.addEventListener('click', () => {
					const isOpen = fieldset.classList.contains('exe-fieldset-open');
					fieldset.classList.toggle('exe-fieldset-open', !isOpen);
					fieldset.classList.toggle('exe-fieldset-closed', isOpen);
					const icon = legend.querySelector('.icon i');
					if (icon) {
						icon.className = isOpen ? 'bi bi-chevron-right' : 'bi bi-chevron-down';
					}
				});
			}
		}

		// Setup auto-save on click outside
		this.setupAutoSave();
	},

	/**
	 * Setup auto-save behavior for collaborative editing
	 * - Saves when clicking outside the iDevice
	 * - Any user can trigger save
	 */
	setupAutoSave: function () {
		// Find the idevice_node container
		let ideviceContainer = this.ideviceBody;
		while (ideviceContainer && !ideviceContainer.classList.contains('idevice_node')) {
			ideviceContainer = ideviceContainer.parentElement;
		}

		if (!ideviceContainer) {
			console.warn('[CollaborativeEditing] Could not find iDevice container for auto-save');
			return;
		}

		// Store reference to iDevice node for save operation
		this._ideviceNode = ideviceContainer;

		// Create click-outside handler
		this._clickOutsideHandler = (event) => {
			// Check if click is outside the iDevice container
			if (!ideviceContainer.contains(event.target)) {
				// Don't auto-save if clicking on modals or dropdowns
				if (event.target.closest('.modal, .dropdown-menu, .tox-dialog, .prosemirror-menu')) {
					return;
				}
				this.triggerAutoSave();
			}
		};

		// Add click listener to document (with small delay to avoid immediate trigger)
		setTimeout(() => {
			document.addEventListener('click', this._clickOutsideHandler, true);
		}, 500);
	},

	/**
	 * Trigger auto-save with debounce
	 */
	triggerAutoSave: function () {
		// Clear any pending auto-save
		if (this._autoSaveTimeout) {
			clearTimeout(this._autoSaveTimeout);
		}

		// Debounce: save after 100ms of no clicks
		this._autoSaveTimeout = setTimeout(() => {
			this.performAutoSave();
		}, 100);
	},

	/**
	 * Perform the auto-save operation
	 */
	performAutoSave: function () {
		// Get data to save
		const data = this.save();
		if (!data) {
			return; // Validation failed
		}

		// Find the ideviceNode instance from the engine
		const engine = window.eXeLearning?.app?.project?.idevices;
		if (!engine) {
			console.warn('[CollaborativeEditing] Could not find idevices engine');
			return;
		}

		// Get the iDevice ID
		const ids = this.extractYjsIds();
		if (!ids) {
			return;
		}

		// Find the ideviceNode by ID
		const ideviceNode = engine.getIdeviceById?.(ids.componentId);
		if (ideviceNode && typeof ideviceNode.save === 'function') {
			// Trigger save on the ideviceNode
			ideviceNode.save(false).catch((err) => {
				console.error('[CollaborativeEditing] Auto-save failed:', err);
			});
		}
	},

	/**
	 * Initialize the ProseMirror editors (main + feedback)
	 */
	initEditors: async function () {
		// Guard against double initialization on the same iDevice instance
		if (this.mainEditor || this.feedbackEditor) {
			return;
		}
		try {
			// Load the ProseMirror bundle and integration modules
			await this.ensureProseMirrorLoaded();

			// Create main editor
			this.mainEditor = this.createEditor(this.mainEditorId, this.placeholderText, 'main');
			if (this.mainEditor) {
				this.mainBinding = this.bindEditor(this.mainEditor, 'main', 'htmlContent', this.idevicePreviousData.htmlContent);
			}

			// Create feedback editor
			this.feedbackEditor = this.createEditor(this.feedbackEditorId, _('Enter feedback...'), 'feedback');
			if (this.feedbackEditor) {
				this.feedbackBinding = this.bindEditor(this.feedbackEditor, 'feedback', 'feedbackContent', this.idevicePreviousData.feedbackContent);
			}

			// Load previous values (feedback button text, fieldset state)
			this.loadPreviousValues();
		} catch (error) {
			console.error('[CollaborativeEditing] Failed to initialize ProseMirror editor:', error);
			eXe.app.alert(_('Failed to initialize collaborative editor'));
		}
	},

	/**
	 * Ensure the ProseMirror bundle and integration modules are loaded
	 */
	ensureProseMirrorLoaded: async function () {
		if (this._proseMirrorLoaded && window.ProseMirrorEditor) {
			return;
		}

		if (!window.YjsLoader) {
			throw new Error('YjsLoader not available');
		}

		await window.YjsLoader.loadProseMirror();
		this._proseMirrorLoaded = true;
	},

	/**
	 * Create a ProseMirror editor and its toolbar for the given host
	 * @param {string} editorId - Editor host element id
	 * @param {string} placeholder - Placeholder text
	 * @param {string} which - 'main' or 'feedback'
	 * @returns {ProseMirrorEditor|null}
	 */
	createEditor: function (editorId, placeholder, which) {
		const editorHost = document.getElementById(editorId);
		const toolbarHost = document.getElementById(`${editorId}Toolbar`);
		if (!editorHost || !window.ProseMirrorEditor) {
			return null;
		}

		const editor = new window.ProseMirrorEditor({
			container: editorHost,
			placeholder: placeholder,
			editable: true,
		});

		// Mount the toolbar via the editor-mode controller (classic/modern toggle)
		if (toolbarHost && window.ProseMirrorEditorMode) {
			const chrome = window.ProseMirrorEditorMode.mount(editor, {
				toolbarHost: toolbarHost,
				onMediaLibrary: (mediaType) => this.handleMediaLibrary(which, mediaType),
			});
			if (which === 'main') {
				this.mainToolbar = chrome;
			} else {
				this.feedbackToolbar = chrome;
			}
		}

		return editor;
	},

	/**
	 * Bind an editor to Yjs for real-time collaboration.
	 *
	 * The content lives in a top-level Y.XmlFragment keyed by
	 * `${componentId}-${fieldName}` (mirroring how the previous Lexical editor
	 * keyed a top-level Y.XmlText), which is what y-prosemirror's ySyncPlugin
	 * expects. Falls back to seeding the saved HTML when Yjs is not enabled.
	 *
	 * @param {ProseMirrorEditor} editor - The editor instance
	 * @param {string} which - 'main' or 'feedback' (unused, kept for symmetry)
	 * @param {string} fieldName - Field to bind ('htmlContent'|'feedbackContent')
	 * @param {string} fallbackHtml - Saved HTML to seed
	 * @returns {YjsProseMirrorBinding|null}
	 */
	bindEditor: function (editor, which, fieldName, fallbackHtml) {
		const bridge = window.eXeLearning?.app?.project?._yjsBridge;
		const project = window.eXeLearning?.app?.project;
		const documentManager = bridge?.documentManager;
		const ydoc = documentManager?.ydoc || documentManager?.getDoc?.();
		const Y = window.Y;

		const yjsReady =
			project?._yjsEnabled && documentManager?.wsProvider && ydoc && Y && window.YjsProseMirrorBinding;

		if (yjsReady) {
			const ids = this.extractYjsIds();
			if (ids) {
				// Top-level shared type for this editor's content
				const docId = `${ids.componentId}-${fieldName}`;
				const yXmlFragment = ydoc.get(docId, Y.XmlFragment);

				const binding = new window.YjsProseMirrorBinding(editor, yXmlFragment, {
					awareness: documentManager.awareness,
					userId: String(bridge.app?.user?.id || 'unknown'),
					userName: bridge.app?.user?.name || 'User',
					userColor: this.getUserColor(),
				});

				// Seed a brand-new (empty) fragment with the saved HTML so the first
				// editor to open the document populates the shared content.
				if (fallbackHtml && yXmlFragment.length === 0) {
					setTimeout(() => {
						if (!editor.isDestroyed() && yXmlFragment.length === 0) {
							editor.setHTML(fallbackHtml);
						}
					}, 0);
				}

				return binding;
			}
		}

		// Non-collaborative fallback: seed the editor with saved content
		if (fallbackHtml && typeof editor.setHTML === 'function') {
			editor.setHTML(fallbackHtml);
		}
		return null;
	},

	/**
	 * Get a user color for collaboration cursors
	 * @returns {string} - Hex color
	 */
	getUserColor: function () {
		const colors = [
			'#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
			'#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
			'#BB8FCE', '#85C1E9', '#F8B500', '#00CED1',
		];
		const userId = window.eXeLearning?.app?.project?._yjsBridge?.app?.user?.id;
		// Convert userId to string (it may be a number or undefined)
		const userIdStr = String(userId || 'user');
		const hash = userIdStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
		return colors[hash % colors.length];
	},

	/**
	 * Extract Yjs IDs from DOM structure
	 * @returns {Object|null} - { pageId, blockId, componentId }
	 */
	extractYjsIds: function () {
		// Walk up the DOM to find the component container (idevice_node element)
		let element = this.ideviceBody;
		while (element && !element.classList?.contains('idevice_node')) {
			element = element.parentElement;
		}

		if (!element) {
			console.warn('[CollaborativeEditing] Could not find idevice container');
			return null;
		}

		// The componentId is in the 'id' attribute (e.g., "idevice-1234567890-abc123")
		const componentId = element.id || element.getAttribute('idevice-id');

		if (!componentId) {
			console.warn('[CollaborativeEditing] Missing componentId');
			return null;
		}

		// pageId and blockId are optional - the binding can find the component by ID alone
		// Try to find them anyway for completeness
		let blockElement = element;
		while (blockElement && !blockElement.classList?.contains('block-content')) {
			blockElement = blockElement.parentElement;
		}
		const blockId = blockElement?.id || blockElement?.getAttribute('block-id') || null;

		let pageElement = blockElement;
		while (pageElement && !pageElement.getAttribute('nav-id')) {
			pageElement = pageElement.parentElement;
		}
		const pageId = pageElement?.getAttribute('nav-id') || null;

		return { pageId, blockId, componentId };
	},

	/**
	 * Handle Media Library callback from the ProseMirror toolbar.
	 * @param {string} which - 'main' or 'feedback'
	 * @param {string} mediaType - 'image', 'media' (video/iframe), or 'audio'
	 */
	handleMediaLibrary: function (which, mediaType) {
		const editor = which === 'main' ? this.mainEditor : this.feedbackEditor;
		if (!editor) return;

		// Open Media Library modal
		const filemanager = window.eXeLearning?.app?.modals?.filemanager;
		if (!filemanager) {
			console.warn('[CollaborativeEditing] Media Library not available');
			return;
		}

		filemanager.show({
			onSelect: (result) => {
				// result = { assetUrl, blobUrl, asset }
				if (!result || !result.asset) return;

				const assetManager = window.eXeLearning?.app?.project?._yjsBridge?.assetManager;

				// Ensure blob URL is in cache so it can be converted back to asset:// on save
				if (assetManager && result.blobUrl && result.asset?.id) {
					if (!assetManager.reverseBlobCache.has(result.blobUrl)) {
						assetManager.reverseBlobCache.set(result.blobUrl, result.asset.id);
						assetManager.blobURLCache.set(result.asset.id, result.blobUrl);
					}
				}

				this.insertMedia(editor, mediaType, {
					src: result.blobUrl || result.assetUrl,
					alt: result.asset.filename || '',
				});
			},
		});
	},

	/**
	 * Insert a media node (image/video/audio) into a ProseMirror editor.
	 * @param {ProseMirrorEditor} editor
	 * @param {string} mediaType - 'image', 'media', or 'audio'
	 * @param {Object} attrs - { src, alt }
	 */
	insertMedia: function (editor, mediaType, attrs) {
		if (mediaType === 'image') {
			editor.insertImage?.(attrs);
			return;
		}

		// video / audio nodes are inserted directly via the schema
		const nodeName = mediaType === 'audio' ? 'audio' : 'video';
		const nodeType = editor.schema?.nodes?.[nodeName];
		if (nodeType) {
			const { state, dispatch } = editor.view;
			const node = nodeType.create({ src: attrs.src });
			dispatch(state.tr.replaceSelectionWith(node));
		}
	},

	/**
	 * Load previous values into form
	 */
	loadPreviousValues: function () {
		const data = this.idevicePreviousData;
		if (!data) return;

		// Feedback button text
		const feedbackInput = document.getElementById(this.feedbackInputId);
		if (feedbackInput && data.feedbackButtonText) {
			feedbackInput.value = data.feedbackButtonText;
		}

		// Open feedback fieldset if there's content
		if (data.feedbackContent) {
			const fieldset = document.getElementById(this.feedbackFieldsetId);
			if (fieldset) {
				fieldset.classList.remove('exe-fieldset-closed');
				fieldset.classList.add('exe-fieldset-open');
				const icon = fieldset.querySelector('.icon i');
				if (icon) {
					icon.className = 'bi bi-chevron-down';
				}
			}
		}
	},

	/**
	 * Validate form values
	 * @returns {boolean}
	 */
	checkFormValues: function () {
		// Main editor must have content
		if (!this.mainEditor || this.mainEditor.isEmpty()) {
			eXe.app.alert(_('Please enter some content'));
			return false;
		}
		return true;
	},

	/**
	 * Read HTML from an editor, converting blob: URLs back to asset:// for persistence.
	 * @param {ProseMirrorEditor} editor
	 * @param {YjsProseMirrorBinding|null} binding
	 * @returns {string}
	 */
	readEditorHtml: function (editor, binding) {
		if (!editor || typeof editor.getHTML !== 'function') {
			return '';
		}
		const html = editor.getHTML();
		if (binding && typeof binding.convertBlobUrlsToAssetUrls === 'function') {
			return binding.convertBlobUrlsToAssetUrls(html);
		}
		return html;
	},

	/**
	 * Save handler - returns JSON data
	 * @returns {Object|false}
	 */
	save: function () {
		if (!this.checkFormValues()) {
			return false;
		}

		// Get content from editors (blob URLs converted to asset:// for storage)
		const htmlContent = this.readEditorHtml(this.mainEditor, this.mainBinding);
		let feedbackContent = this.readEditorHtml(this.feedbackEditor, this.feedbackBinding);

		// Check if feedback is empty
		if (this.feedbackEditor && this.feedbackEditor.isEmpty()) {
			feedbackContent = '';
		}

		// Get feedback button text
		const feedbackInput = document.getElementById(this.feedbackInputId);
		const feedbackButtonText = feedbackInput ? feedbackInput.value : this.feedbackInputValue;

		// Get iDevice ID
		let ideviceId = '';
		let element = this.ideviceBody;
		while (element && !element.getAttribute('idevice-id')) {
			element = element.parentElement;
		}
		if (element) {
			ideviceId = element.getAttribute('idevice-id');
		}

		return {
			ideviceId: ideviceId,
			htmlContent: htmlContent,
			feedbackContent: feedbackContent,
			feedbackButtonText: feedbackButtonText,
		};
	},

	/**
	 * Get data as JSON
	 * @returns {Object}
	 */
	getDataJson: function () {
		return this.save() || {};
	},

	/**
	 * Clean up when iDevice is closed
	 */
	destroy: function () {
		// Clear auto-save timeout
		if (this._autoSaveTimeout) {
			clearTimeout(this._autoSaveTimeout);
			this._autoSaveTimeout = null;
		}

		// Remove click-outside handler
		if (this._clickOutsideHandler) {
			document.removeEventListener('click', this._clickOutsideHandler, true);
			this._clickOutsideHandler = null;
		}

		// Destroy Yjs bindings
		if (this.mainBinding) {
			this.mainBinding.destroy?.();
			this.mainBinding = null;
		}
		if (this.feedbackBinding) {
			this.feedbackBinding.destroy?.();
			this.feedbackBinding = null;
		}

		// Destroy toolbars
		if (this.mainToolbar) {
			this.mainToolbar.destroy?.();
			this.mainToolbar = null;
		}
		if (this.feedbackToolbar) {
			this.feedbackToolbar.destroy?.();
			this.feedbackToolbar = null;
		}

		// Destroy editors
		if (this.mainEditor) {
			this.mainEditor.destroy?.();
			this.mainEditor = null;
		}
		if (this.feedbackEditor) {
			this.feedbackEditor.destroy?.();
			this.feedbackEditor = null;
		}

		// Clear references
		this._ideviceNode = null;
	},
};
