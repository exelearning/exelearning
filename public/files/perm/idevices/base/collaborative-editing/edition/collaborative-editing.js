/**
 * Collaborative Editing iDevice - Edition Mode
 *
 * Uses Lexical with @lexical/yjs for real-time collaborative editing.
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

	// Editor instances
	mainEditor: null,
	mainToolbar: null,
	feedbackEditor: null,
	feedbackToolbar: null,

	// Yjs bindings
	mainBinding: null,
	feedbackBinding: null,

	// State
	ideviceBody: null,
	idevicePreviousData: null,
	_lexicalLoaded: false,
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
					<div class="lexical-editor-container">
						<div id="${this.mainEditorId}-toolbar" class="lexical-toolbar-container"></div>
						<div id="${this.mainEditorId}" class="lexical-editor"></div>
					</div>
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
							<div class="lexical-editor-container">
								<div id="${this.feedbackEditorId}-toolbar" class="lexical-toolbar-container"></div>
								<div id="${this.feedbackEditorId}" class="lexical-editor"></div>
							</div>
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
	 * Initialize Lexical editors
	 */
	initLexicalEditors: async function () {
		try {
			// Load Lexical if not already loaded
			await this.ensureLexicalLoaded();

			// Create main editor
			const mainContainer = document.getElementById(this.mainEditorId);
			const mainToolbarContainer = document.getElementById(this.mainEditorId + '-toolbar');

			if (mainContainer) {
				this.mainEditor = new window.LexicalEditor({
					container: mainContainer,
					placeholder: this.placeholderText,
					content: this.idevicePreviousData.htmlContent || '',
				});

				this.mainToolbar = new window.LexicalToolbar({
					editor: this.mainEditor,
					container: mainToolbarContainer,
					onMediaLibrary: this.handleMediaLibrary.bind(this, 'main'),
				});

				// Bind to Yjs
				this.bindMainEditorToYjs();
			}

			// Create feedback editor
			const feedbackContainer = document.getElementById(this.feedbackEditorId);
			const feedbackToolbarContainer = document.getElementById(this.feedbackEditorId + '-toolbar');

			if (feedbackContainer) {
				this.feedbackEditor = new window.LexicalEditor({
					container: feedbackContainer,
					placeholder: _('Enter feedback...'),
					content: this.idevicePreviousData.feedbackContent || '',
				});

				this.feedbackToolbar = new window.LexicalToolbar({
					editor: this.feedbackEditor,
					container: feedbackToolbarContainer,
					onMediaLibrary: this.handleMediaLibrary.bind(this, 'feedback'),
				});

				// Bind to Yjs
				this.bindFeedbackEditorToYjs();
			}

			// Load previous values
			this.loadPreviousValues();
		} catch (error) {
			console.error('[CollaborativeEditing] Failed to initialize Lexical:', error);
			eXe.app.alert(_('Failed to initialize collaborative editor'));
		}
	},

	/**
	 * Ensure Lexical is loaded
	 */
	ensureLexicalLoaded: async function () {
		if (this._lexicalLoaded && window.LexicalBundle) {
			return;
		}

		if (window.YjsLoader) {
			await window.YjsLoader.loadLexical();
			this._lexicalLoaded = true;
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
			hasYjsModules: !!window.YjsModules,
			hasYjsLexicalBinding: !!window.YjsLexicalBinding,
		});

		if (!project?._yjsEnabled || !window.YjsModules) {
			Logger.warn('[CollaborativeEditing] Yjs not enabled or YjsModules not available');
			return;
		}

		const ids = this.extractYjsIds();
		Logger.log('[CollaborativeEditing] Extracted IDs:', ids);
		if (!ids) {
			Logger.warn('[CollaborativeEditing] Could not extract Yjs IDs');
			return;
		}

		this.mainBinding = window.YjsModules.bindLexical(this.mainEditor, ids.pageId, ids.blockId, ids.componentId, 'htmlContent');
		Logger.log('[CollaborativeEditing] Main binding created:', {
			hasBinding: !!this.mainBinding,
			bindingId: ids.componentId + '-htmlContent',
		});
	},

	/**
	 * Bind feedback editor to Yjs
	 */
	bindFeedbackEditorToYjs: function () {
		const project = window.eXeLearning?.app?.project;
		if (!project?._yjsEnabled || !window.YjsModules) {
			return;
		}

		const ids = this.extractYjsIds();
		if (!ids) {
			return;
		}

		this.feedbackBinding = window.YjsModules.bindLexical(this.feedbackEditor, ids.pageId, ids.blockId, ids.componentId, 'feedbackContent');
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
	 * @param {string} editorType - 'main' or 'feedback'
	 * @param {string} mediaType - 'image' or 'media'
	 */
	handleMediaLibrary: function (editorType, mediaType) {
		const editor = editorType === 'main' ? this.mainEditor : this.feedbackEditor;
		const toolbar = editorType === 'main' ? this.mainToolbar : this.feedbackToolbar;

		if (!editor || !toolbar) return;

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

					if (mediaType === 'image') {
						editor.insertImage({
							src: result.blobUrl,
							altText: result.asset.filename || '',
							dataAssetId: result.asset.id,
							dataAssetSrc: result.assetUrl,
						});
					} else if (mediaType === 'media' || mediaType === 'audio') {
						// For video/audio, insert the appropriate node
						const isAudio = result.asset.mime?.startsWith('audio/') || mediaType === 'audio';
						const isVideo = result.asset.mime?.startsWith('video/');

						if (isAudio) {
							this._insertAudio(editor, result.blobUrl, result.asset);
						} else if (isVideo) {
							this._insertVideo(editor, result.blobUrl, result.asset);
						} else {
							// Generic media - try to insert as iframe
							this._insertMedia(editor, result.blobUrl, result.asset);
						}
					}
				},
			});
		} else {
			console.warn('[CollaborativeEditing] Media Library not available');
		}
	},

	/**
	 * Insert audio element
	 * @private
	 */
	_insertAudio: function (editor, blobUrl, asset) {
		if (!window.LexicalNodes?.$createAudioNode) {
			console.warn('[CollaborativeEditing] AudioNode not available');
			return;
		}

		editor.update(() => {
			const audioNode = window.LexicalNodes.$createAudioNode({
				src: blobUrl,
				dataAssetId: asset.id,
				dataAssetSrc: `asset://${asset.id}/${asset.filename}`,
				controls: true,
			});
			window.LexicalBundle.$insertNodes([audioNode]);
		});
	},

	/**
	 * Insert video element
	 * @private
	 */
	_insertVideo: function (editor, blobUrl, asset) {
		if (!window.LexicalNodes?.$createVideoNode) {
			console.warn('[CollaborativeEditing] VideoNode not available');
			return;
		}

		editor.update(() => {
			const videoNode = window.LexicalNodes.$createVideoNode({
				src: blobUrl,
				dataAssetId: asset.id,
				dataAssetSrc: `asset://${asset.id}/${asset.filename}`,
				controls: true,
			});
			window.LexicalBundle.$insertNodes([videoNode]);
		});
	},

	/**
	 * Insert generic media (iframe)
	 * @private
	 */
	_insertMedia: function (editor, blobUrl, asset) {
		if (!window.LexicalNodes?.$createIframeNode) {
			console.warn('[CollaborativeEditing] IframeNode not available');
			return;
		}

		editor.update(() => {
			const iframeNode = window.LexicalNodes.$createIframeNode({
				src: blobUrl,
				dataAssetId: asset.id,
			});
			window.LexicalBundle.$insertNodes([iframeNode]);
		});
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

		// Destroy bindings
		if (this.mainBinding) {
			this.mainBinding.destroy();
			this.mainBinding = null;
		}
		if (this.feedbackBinding) {
			this.feedbackBinding.destroy();
			this.feedbackBinding = null;
		}

		// Destroy toolbars
		if (this.mainToolbar) {
			this.mainToolbar.destroy();
			this.mainToolbar = null;
		}
		if (this.feedbackToolbar) {
			this.feedbackToolbar.destroy();
			this.feedbackToolbar = null;
		}

		// Destroy editors
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
