/**
 * Collaborative Editing iDevice - Edition Mode
 *
 * Uses Lexical Playground (React) with @lexical/yjs for real-time collaborative editing.
 * Features the full playground toolbar, insert menu, floating toolbar, etc.
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

	// Editor handles (React-based Lexical Playground)
	mainEditor: null,
	feedbackEditor: null,

	// State
	ideviceBody: null,
	idevicePreviousData: null,
	_lexicalPlaygroundLoaded: false,
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
	 * Create the editing form
	 */
	createForm: function () {
		const html = `
			<div id="${this.formId}" class="collab-edit-form">
				<!-- Main Content Section -->
				<div class="exe-field">
					<label for="${this.mainEditorId}">${this.textareaTitle}</label>
					<div id="${this.mainEditorId}" class="lexical-playground-container"></div>
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
							<div id="${this.feedbackEditorId}" class="lexical-playground-container"></div>
						</div>
					</div>
				</fieldset>
			</div>
		`;

		this.ideviceBody.innerHTML = html;
		this.setBehaviour();
		this.initLexicalEditors();
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
				if (event.target.closest('.modal, .dropdown-menu, .tox-dialog, .lexical-select-dropdown')) {
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
	 * Initialize Lexical Playground editors (React-based)
	 */
	initLexicalEditors: async function () {
		try {
			// Load Lexical Playground if not already loaded
			await this.ensureLexicalPlaygroundLoaded();

			const assetManager = window.eXeLearning?.app?.project?._yjsBridge?.assetManager;

			// Create main editor
			const mainContainer = document.getElementById(this.mainEditorId);
			if (mainContainer) {
				this.mainEditor = window.LexicalPlayground.mount(mainContainer, {
					editorId: this.mainEditorId,
					placeholder: this.placeholderText,
					initialHTML: this.idevicePreviousData.htmlContent || '',
					editable: true,
					onMediaLibraryOpen: this.handleMediaLibrary.bind(this, 'main'),
					assetManager: assetManager,
				});

				// Bind to Yjs
				this.bindMainEditorToYjs();
			}

			// Create feedback editor
			const feedbackContainer = document.getElementById(this.feedbackEditorId);
			if (feedbackContainer) {
				this.feedbackEditor = window.LexicalPlayground.mount(feedbackContainer, {
					editorId: this.feedbackEditorId,
					placeholder: _('Enter feedback...'),
					initialHTML: this.idevicePreviousData.feedbackContent || '',
					editable: true,
					onMediaLibraryOpen: this.handleMediaLibrary.bind(this, 'feedback'),
					assetManager: assetManager,
				});

				// Bind to Yjs
				this.bindFeedbackEditorToYjs();
			}

			// Load previous values
			this.loadPreviousValues();
		} catch (error) {
			console.error('[CollaborativeEditing] Failed to initialize Lexical Playground:', error);
			eXe.app.alert(_('Failed to initialize collaborative editor'));
		}
	},

	/**
	 * Ensure Lexical Playground (React) is loaded
	 */
	ensureLexicalPlaygroundLoaded: async function () {
		if (this._lexicalPlaygroundLoaded && window.LexicalPlayground) {
			return;
		}

		if (window.YjsLoader) {
			await window.YjsLoader.loadLexicalPlayground();
			this._lexicalPlaygroundLoaded = true;
		} else {
			throw new Error('YjsLoader not available');
		}
	},

	/**
	 * Bind main editor to Yjs
	 */
	bindMainEditorToYjs: function () {
		const project = window.eXeLearning?.app?.project;
		const Logger = window.Logger || console;

		Logger.log('[CollaborativeEditing] bindMainEditorToYjs called', {
			hasProject: !!project,
			yjsEnabled: project?._yjsEnabled,
			hasBridge: !!project?._yjsBridge,
			hasMainEditor: !!this.mainEditor,
		});

		if (!project?._yjsEnabled || !project?._yjsBridge?.documentManager?.wsProvider) {
			Logger.warn('[CollaborativeEditing] Yjs not enabled or WebSocket provider not available');
			return;
		}

		const ids = this.extractYjsIds();
		Logger.log('[CollaborativeEditing] Extracted IDs:', ids);
		if (!ids) {
			Logger.warn('[CollaborativeEditing] Could not extract Yjs IDs');
			return;
		}

		// Use the new setYjsBinding API from the React editor
		if (this.mainEditor && typeof this.mainEditor.setYjsBinding === 'function') {
			const userId = project._yjsBridge.app?.user?.id;
			this.mainEditor.setYjsBinding({
				provider: project._yjsBridge.documentManager.wsProvider,
				docId: `${ids.componentId}-htmlContent`,
				userId: String(userId || 'unknown'),
				userName: project._yjsBridge.app?.user?.name || 'User',
				userColor: this.getUserColor(),
			});
			Logger.log('[CollaborativeEditing] Main editor Yjs binding set:', {
				docId: `${ids.componentId}-htmlContent`,
			});
		}
	},

	/**
	 * Bind feedback editor to Yjs
	 */
	bindFeedbackEditorToYjs: function () {
		const project = window.eXeLearning?.app?.project;
		if (!project?._yjsEnabled || !project?._yjsBridge?.documentManager?.wsProvider) {
			return;
		}

		const ids = this.extractYjsIds();
		if (!ids) {
			return;
		}

		// Use the new setYjsBinding API from the React editor
		if (this.feedbackEditor && typeof this.feedbackEditor.setYjsBinding === 'function') {
			const userId = project._yjsBridge.app?.user?.id;
			this.feedbackEditor.setYjsBinding({
				provider: project._yjsBridge.documentManager.wsProvider,
				docId: `${ids.componentId}-feedbackContent`,
				userId: String(userId || 'unknown'),
				userName: project._yjsBridge.app?.user?.name || 'User',
				userColor: this.getUserColor(),
			});
		}
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

		// pageId and blockId are optional - bindLexical can find the component by ID alone
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
	 * Handle Media Library callback
	 * Called from the React editor's onMediaLibraryOpen callback
	 * @param {string} editorType - 'main' or 'feedback'
	 * @param {string} mediaType - 'image', 'video', 'audio', or 'file'
	 */
	handleMediaLibrary: function (editorType, mediaType) {
		const editorHandle = editorType === 'main' ? this.mainEditor : this.feedbackEditor;
		if (!editorHandle) return;

		// Open Media Library modal
		const filemanager = window.eXeLearning?.app?.modals?.filemanager;
		if (filemanager) {
			filemanager.show({
				onSelect: (result) => {
					// result = { assetUrl, blobUrl, asset }
					if (!result || !result.asset) return;

					const assetManager = window.eXeLearning?.app?.project?._yjsBridge?.assetManager;

					// Ensure blob URL is in cache
					if (assetManager && result.blobUrl && result.asset?.id) {
						if (!assetManager.reverseBlobCache.has(result.blobUrl)) {
							assetManager.reverseBlobCache.set(result.blobUrl, result.asset.id);
							assetManager.blobURLCache.set(result.asset.id, result.blobUrl);
						}
					}

					// Use the editor handle's insert methods
					const editor = editorHandle.getEditor();
					if (!editor) return;

					if (mediaType === 'image') {
						editorHandle.insertImage?.({
							src: result.blobUrl,
							altText: result.asset.filename || '',
							dataAssetId: result.asset.id,
							dataAssetSrc: result.assetUrl,
						});
					} else if (mediaType === 'video') {
						editorHandle.insertVideo?.({
							src: result.blobUrl,
							dataAssetId: result.asset.id,
							dataAssetSrc: result.assetUrl,
						});
					} else if (mediaType === 'audio') {
						editorHandle.insertAudio?.({
							src: result.blobUrl,
							dataAssetId: result.asset.id,
							dataAssetSrc: result.assetUrl,
						});
					}
				},
			});
		} else {
			console.warn('[CollaborativeEditing] Media Library not available');
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
	 * Save handler - returns JSON data
	 * @returns {Object|false}
	 */
	save: function () {
		if (!this.checkFormValues()) {
			return false;
		}

		// Get content from editors
		const htmlContent = this.mainEditor ? this.mainEditor.getHTML() : '';
		let feedbackContent = this.feedbackEditor ? this.feedbackEditor.getHTML() : '';

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

		// Destroy editors (React-based - handles unmount and cleanup)
		if (this.mainEditor) {
			this.mainEditor.destroy();
			this.mainEditor = null;
		}
		if (this.feedbackEditor) {
			this.feedbackEditor.destroy();
			this.feedbackEditor = null;
		}

		// Clear references
		this._ideviceNode = null;
	},
};
