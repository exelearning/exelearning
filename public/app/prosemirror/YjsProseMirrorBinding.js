/**
 * Yjs ProseMirror Binding
 *
 * Integrates ProseMirror with Yjs for real-time collaborative editing.
 * Uses y-prosemirror plugins for synchronization and cursor awareness.
 */
(function () {
	'use strict';

	const { ySyncPlugin, yCursorPlugin, yUndoPlugin } = window.ProseMirrorBundle;

	const Logger = window.Logger || console;

	// User colors for remote cursors
	const USER_COLORS = [
		'#e91e63',
		'#9c27b0',
		'#673ab7',
		'#3f51b5',
		'#2196f3',
		'#03a9f4',
		'#00bcd4',
		'#009688',
		'#4caf50',
		'#8bc34a',
		'#cddc39',
		'#ffeb3b',
		'#ffc107',
		'#ff9800',
		'#ff5722',
		'#795548',
	];

	/**
	 * Generate a consistent color for a user ID
	 */
	function getUserColor(userId) {
		if (!userId) return USER_COLORS[0];
		let hash = 0;
		for (let i = 0; i < userId.length; i++) {
			hash = (hash << 5) - hash + userId.charCodeAt(i);
			hash = hash & hash;
		}
		return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
	}

	/**
	 * YjsProseMirrorBinding class
	 *
	 * Binds a ProseMirror editor to a Yjs XmlFragment for real-time collaboration.
	 */
	class YjsProseMirrorBinding {
		/**
		 * @param {ProseMirrorEditor} editor - ProseMirror editor instance
		 * @param {Y.XmlFragment} yXmlFragment - Yjs XmlFragment for content sync
		 * @param {Object} options
		 * @param {Y.Awareness} [options.awareness] - Yjs awareness for cursor sync
		 * @param {string} [options.userId] - Current user ID
		 * @param {string} [options.userName] - Current user display name
		 * @param {string} [options.userColor] - User cursor color (auto-generated if not provided)
		 */
		constructor(editor, yXmlFragment, options = {}) {
			this.editor = editor;
			this.yXmlFragment = yXmlFragment;
			this.awareness = options.awareness || null;
			this.userId = options.userId || 'unknown';
			this.userName = options.userName || 'User';
			this.userColor = options.userColor || getUserColor(this.userId);

			this._plugins = [];
			this._destroyed = false;
			this._assetObserver = null;

			this._init();
		}

		/**
		 * Initialize the binding
		 * @private
		 */
		_init() {
			// Create y-prosemirror plugins
			const plugins = [];

			// Sync plugin - synchronizes document content
			plugins.push(ySyncPlugin(this.yXmlFragment));

			// Undo plugin - collaborative undo/redo
			plugins.push(yUndoPlugin());

			// Cursor plugin - shows remote user cursors
			if (this.awareness) {
				// Set local user state
				this.awareness.setLocalStateField('user', {
					name: this.userName,
					color: this.userColor,
					colorLight: this.userColor + '33', // 20% opacity for selection
				});

				plugins.push(
					yCursorPlugin(this.awareness, {
						cursorBuilder: this._buildCursor.bind(this),
						selectionBuilder: this._buildSelection.bind(this),
					})
				);
			}

			this._plugins = plugins;

			// Add plugins to editor
			this.editor.addPlugins(plugins);

			// Setup asset URL observer
			this._setupAssetUrlObserver();

			Logger.log('[YjsProseMirrorBinding] Initialized with', {
				userId: this.userId,
				userName: this.userName,
				hasAwareness: !!this.awareness,
			});
		}

		/**
		 * Build cursor element for remote user
		 * @private
		 */
		_buildCursor(user) {
			const cursor = document.createElement('span');
			cursor.className = 'yjs-prosemirror-cursor';
			cursor.style.borderLeftColor = user.color;

			const label = document.createElement('span');
			label.className = 'yjs-cursor-label';
			label.textContent = user.name || 'Anonymous';
			label.style.backgroundColor = user.color;

			cursor.appendChild(label);
			return cursor;
		}

		/**
		 * Build selection decoration for remote user
		 * @private
		 */
		_buildSelection(user) {
			return {
				class: 'yjs-remote-selection',
				style: `background-color: ${user.colorLight || user.color + '33'}`,
			};
		}

		/**
		 * Setup observer for asset:// URL resolution
		 * @private
		 */
		_setupAssetUrlObserver() {
			const view = this.editor.view;
			if (!view || !view.dom) return;

			const assetManager = window.eXeLearning?.app?.project?._yjsBridge?.assetManager;
			if (!assetManager) {
				Logger.log('[YjsProseMirrorBinding] AssetManager not available, skipping URL observer');
				return;
			}

			// Use MutationObserver to detect new images/media with asset:// URLs
			this._assetObserver = new MutationObserver((mutations) => {
				for (const mutation of mutations) {
					for (const node of mutation.addedNodes) {
						if (node.nodeType === Node.ELEMENT_NODE) {
							this._resolveAssetUrls(node);
						}
					}
				}
			});

			this._assetObserver.observe(view.dom, {
				childList: true,
				subtree: true,
			});

			// Resolve existing asset URLs
			this._resolveAssetUrls(view.dom);
		}

		/**
		 * Resolve asset:// URLs to blob: URLs for display
		 * @private
		 */
		async _resolveAssetUrls(rootElement) {
			const assetManager = window.eXeLearning?.app?.project?._yjsBridge?.assetManager;
			if (!assetManager) return;

			// Find all elements with asset:// URLs
			const mediaSelectors = [
				'img[src^="asset://"]',
				'video[src^="asset://"]',
				'audio[src^="asset://"]',
				'source[src^="asset://"]',
			];

			const elements = rootElement.querySelectorAll(mediaSelectors.join(', '));

			// Also check if rootElement itself matches
			if (rootElement.matches && rootElement.matches(mediaSelectors.join(', '))) {
				await this._resolveElementAssetUrl(rootElement, assetManager);
			}

			for (const element of elements) {
				await this._resolveElementAssetUrl(element, assetManager);
			}
		}

		/**
		 * Resolve asset URL for a single element
		 * @private
		 */
		async _resolveElementAssetUrl(element, assetManager) {
			const src = element.getAttribute('src');
			if (!src || !src.startsWith('asset://')) return;

			// Store original asset URL
			if (!element.getAttribute('data-asset-src')) {
				element.setAttribute('data-asset-src', src);
			}

			// Set placeholder while loading
			if (element.tagName === 'IMG') {
				element.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
			}

			try {
				// Parse asset URL: asset://uuid/filename
				const match = src.match(/^asset:\/\/([a-f0-9-]+)\/(.+)$/i);
				if (!match) {
					Logger.warn('[YjsProseMirrorBinding] Invalid asset URL:', src);
					return;
				}

				const assetId = match[1];

				// Try to get blob URL from cache
				let blobUrl = assetManager.blobURLCache?.get(assetId);

				if (!blobUrl) {
					// Resolve via AssetManager
					blobUrl = await assetManager.resolveAssetURL?.(src);
				}

				if (blobUrl && !this._destroyed) {
					element.src = blobUrl;
					Logger.log('[YjsProseMirrorBinding] Resolved asset URL:', src, '->', blobUrl);
				}
			} catch (error) {
				Logger.error('[YjsProseMirrorBinding] Failed to resolve asset URL:', src, error);
			}
		}

		/**
		 * Convert blob: URLs in HTML to asset:// URLs for persistence
		 * @param {string} html - HTML content with blob URLs
		 * @returns {string} - HTML with asset:// URLs
		 */
		convertBlobUrlsToAssetUrls(html) {
			const assetManager = window.eXeLearning?.app?.project?._yjsBridge?.assetManager;
			if (!assetManager || !assetManager.reverseBlobCache) {
				return html;
			}

			// Match blob URLs
			const blobUrlRegex = /blob:https?:\/\/[^"'\s)]+/g;

			return html.replace(blobUrlRegex, (blobUrl) => {
				const assetId = assetManager.reverseBlobCache.get(blobUrl);
				if (assetId) {
					const asset = assetManager.getAssetById?.(assetId);
					const filename = asset?.filename || 'file';
					return assetManager.getAssetUrl(assetId, filename);
				}
				return blobUrl;
			});
		}

		/**
		 * Convert asset:// URLs in HTML to blob: URLs for display
		 * @param {string} html - HTML content with asset:// URLs
		 * @returns {string} - HTML with blob: URLs (where available)
		 */
		convertAssetUrlsToBlobUrls(html) {
			const assetManager = window.eXeLearning?.app?.project?._yjsBridge?.assetManager;
			if (!assetManager || !assetManager.blobURLCache) {
				return html;
			}

			// Match asset:// URLs
			const assetUrlRegex = /asset:\/\/([a-f0-9-]+)\/[^"'\s)]+/gi;

			return html.replace(assetUrlRegex, (assetUrl, assetId) => {
				const blobUrl = assetManager.blobURLCache.get(assetId);
				if (blobUrl) {
					return blobUrl;
				}
				return assetUrl;
			});
		}

		/**
		 * Get the current user info
		 * @returns {Object}
		 */
		getUserInfo() {
			return {
				userId: this.userId,
				userName: this.userName,
				userColor: this.userColor,
			};
		}

		/**
		 * Update user info
		 * @param {Object} info
		 */
		updateUserInfo(info) {
			if (info.userName) this.userName = info.userName;
			if (info.userColor) this.userColor = info.userColor;

			if (this.awareness) {
				this.awareness.setLocalStateField('user', {
					name: this.userName,
					color: this.userColor,
					colorLight: this.userColor + '33',
				});
			}
		}

		/**
		 * Get connected users
		 * @returns {Array}
		 */
		getConnectedUsers() {
			if (!this.awareness) return [];

			const users = [];
			this.awareness.getStates().forEach((state, clientId) => {
				if (state.user && clientId !== this.awareness.clientID) {
					users.push({
						clientId,
						...state.user,
					});
				}
			});

			return users;
		}

		/**
		 * Check if binding is destroyed
		 * @returns {boolean}
		 */
		isDestroyed() {
			return this._destroyed;
		}

		/**
		 * Destroy the binding
		 */
		destroy() {
			if (this._destroyed) return;

			this._destroyed = true;

			// Stop observing asset URLs
			if (this._assetObserver) {
				this._assetObserver.disconnect();
				this._assetObserver = null;
			}

			// Clear awareness state
			if (this.awareness) {
				this.awareness.setLocalStateField('user', null);
			}

			this._plugins = [];

			Logger.log('[YjsProseMirrorBinding] Destroyed');
		}
	}

	// Export globally
	window.YjsProseMirrorBinding = YjsProseMirrorBinding;
})();
