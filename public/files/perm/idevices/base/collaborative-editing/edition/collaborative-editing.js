/**
 * Collaborative Editing iDevice - Edition Mode
 *
 * Uses ProseMirror with y-prosemirror for real-time collaborative editing.
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
	_prosemirrorLoaded: false,

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
					<div class="prosemirror-editor-container">
						<div id="${this.mainEditorId}-toolbar" class="prosemirror-toolbar-container"></div>
						<div id="${this.mainEditorId}" class="prosemirror-editor"></div>
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
							<div class="prosemirror-editor-container">
								<div id="${this.feedbackEditorId}-toolbar" class="prosemirror-toolbar-container"></div>
								<div id="${this.feedbackEditorId}" class="prosemirror-editor"></div>
							</div>
						</div>
					</div>
				</fieldset>
			</div>
		`;

		this.ideviceBody.innerHTML = html;
		this.setBehaviour();
		this.initProseMirrorEditors();
	},

	/**
	 * Set form behaviour (fieldset toggle, etc.)
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
	},

	/**
	 * Initialize ProseMirror editors
	 */
	initProseMirrorEditors: async function () {
		try {
			// Load ProseMirror if not already loaded
			await this.ensureProseMirrorLoaded();

			// Create main editor
			const mainContainer = document.getElementById(this.mainEditorId);
			const mainToolbarContainer = document.getElementById(this.mainEditorId + '-toolbar');

			if (mainContainer) {
				this.mainEditor = new window.ProseMirrorEditor({
					container: mainContainer,
					placeholder: this.placeholderText,
					content: this.idevicePreviousData.htmlContent || '',
				});

				this.mainToolbar = new window.ProseMirrorToolbar({
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
				this.feedbackEditor = new window.ProseMirrorEditor({
					container: feedbackContainer,
					placeholder: _('Enter feedback...'),
					content: this.idevicePreviousData.feedbackContent || '',
				});

				this.feedbackToolbar = new window.ProseMirrorToolbar({
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
			console.error('[CollaborativeEditing] Failed to initialize ProseMirror:', error);
			eXe.app.alert(_('Failed to initialize collaborative editor'));
		}
	},

	/**
	 * Ensure ProseMirror is loaded
	 */
	ensureProseMirrorLoaded: async function () {
		if (this._prosemirrorLoaded && window.ProseMirrorBundle) {
			return;
		}

		if (window.YjsLoader) {
			await window.YjsLoader.loadProseMirror();
			this._prosemirrorLoaded = true;
		} else {
			throw new Error('YjsLoader not available');
		}
	},

	/**
	 * Bind main editor to Yjs
	 */
	bindMainEditorToYjs: function () {
		const project = window.eXeLearning?.app?.project;
		if (!project?._yjsEnabled || !window.YjsModules) {
			return;
		}

		const ids = this.extractYjsIds();
		if (!ids) {
			return;
		}

		this.mainBinding = window.YjsModules.bindProseMirror(this.mainEditor, ids.pageId, ids.blockId, ids.componentId, 'htmlContent');
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

		this.feedbackBinding = window.YjsModules.bindProseMirror(this.feedbackEditor, ids.pageId, ids.blockId, ids.componentId, 'feedbackContent');
	},

	/**
	 * Extract Yjs IDs from DOM structure
	 * @returns {Object|null} - { pageId, blockId, componentId }
	 */
	extractYjsIds: function () {
		// Walk up the DOM to find the component container
		let element = this.ideviceBody;
		while (element && !element.getAttribute('idevice-id')) {
			element = element.parentElement;
		}

		if (!element) {
			console.warn('[CollaborativeEditing] Could not find idevice container');
			return null;
		}

		const componentId = element.getAttribute('idevice-id');

		// Find block
		let blockElement = element;
		while (blockElement && !blockElement.getAttribute('block-id')) {
			blockElement = blockElement.parentElement;
		}
		const blockId = blockElement?.getAttribute('block-id');

		// Find page
		let pageElement = blockElement;
		while (pageElement && !pageElement.getAttribute('nav-id')) {
			pageElement = pageElement.parentElement;
		}
		const pageId = pageElement?.getAttribute('nav-id');

		if (!pageId || !blockId || !componentId) {
			console.warn('[CollaborativeEditing] Missing IDs:', { pageId, blockId, componentId });
			return null;
		}

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

		// Open Media Library modal (same API as TinyMCE)
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
						toolbar.insertImage({
							src: result.blobUrl,
							alt: result.asset.filename || '',
							'data-asset-id': result.asset.id,
							'data-asset-src': result.assetUrl,
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
							// Generic media - try to insert as iframe or link
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
		const { state, dispatch } = editor.view;
		const nodeType = editor.schema.nodes.audio;
		if (nodeType) {
			const node = nodeType.create({
				src: blobUrl,
				'data-asset-id': asset.id,
				'data-asset-src': `asset://${asset.id}/${asset.filename}`,
			});
			dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
		}
	},

	/**
	 * Insert video element
	 * @private
	 */
	_insertVideo: function (editor, blobUrl, asset) {
		const { state, dispatch } = editor.view;
		const nodeType = editor.schema.nodes.video;
		if (nodeType) {
			const node = nodeType.create({
				src: blobUrl,
				'data-asset-id': asset.id,
				'data-asset-src': `asset://${asset.id}/${asset.filename}`,
			});
			dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
		}
	},

	/**
	 * Insert generic media (iframe or link)
	 * @private
	 */
	_insertMedia: function (editor, blobUrl, asset) {
		const { state, dispatch } = editor.view;
		// Try iframe first
		const iframeType = editor.schema.nodes.iframe;
		if (iframeType) {
			const node = iframeType.create({
				src: blobUrl,
				'data-asset-id': asset.id,
			});
			dispatch(state.tr.replaceSelectionWith(node).scrollIntoView());
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
	},
};
