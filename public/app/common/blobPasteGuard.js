/**
 * BlobPasteGuard
 *
 * Listens for paste events on the document and warns the user when the
 * clipboard content contains blob: URLs. Blob URLs are ephemeral — they are
 * only valid in the browser session and context where they were created. If a
 * user copies HTML from a TinyMCE editor (which uses blob: URLs internally)
 * and pastes it into a different iDevice, page, or session, those references
 * will be broken.
 *
 * This guard does not cancel the paste; it only informs the user so they can
 * take corrective action (use the File Manager, or clone the iDevice instead).
 *
 * Covered scenarios:
 * - Pasting HTML containing blob: image/audio/video references into any element
 *   in the main document (e.g. TinyMCE "Source code" textarea, iDevice fields).
 * - Pasting a bare blob: URL into a plain text input or textarea.
 *
 * Not covered (separate concern):
 * - Rich-text paste inside TinyMCE's own iframe (handled via paste_preprocess).
 *
 * Usage:
 *   const guard = new BlobPasteGuard({ toastsManager: app.toasts });
 *   guard.start();
 */
export default class BlobPasteGuard {
    /**
     * @param {Object} options
     * @param {Object} options.toastsManager - ToastsManager instance (app.toasts)
     */
    constructor(options = {}) {
        this.toastsManager = options.toastsManager;
        this._warningToast = null;
        this._boundHandlePaste = this._handlePaste.bind(this);
    }

    /**
     * Attach the paste listener to the document.
     */
    start() {
        document.addEventListener('paste', this._boundHandlePaste);
    }

    /**
     * Remove the paste listener from the document.
     */
    stop() {
        document.removeEventListener('paste', this._boundHandlePaste);
    }

    /**
     * @param {ClipboardEvent} event
     */
    _handlePaste(event) {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return;

        const html = clipboardData.getData('text/html');
        const text = clipboardData.getData('text/plain');

        const combined = (html || '') + ' ' + (text || '');

        // Match blob: URLs (always blob:http:// or blob:https://)
        if (!/blob:https?:\/\//.test(combined)) return;

        // Only warn if at least one blob URL is not known to the current AssetManager.
        // Blobs in reverseBlobCache are valid in this session and will be handled
        // correctly by images_upload_handler on save — no warning needed for those.
        const reverseBlobCache =
            window.eXeLearning?.app?.project?._yjsBridge?.assetManager?.reverseBlobCache;
        if (reverseBlobCache) {
            const blobs = combined.match(/blob:https?:\/\/[^\s"'>]+/g) || [];
            if (blobs.length > 0 && blobs.every((blob) => reverseBlobCache.has(blob))) return;
        }

        this._showWarning();
    }

    /**
     * Show a persistent toast warning the user about broken blob references.
     * If a warning toast is already visible, does nothing.
     */
    _showWarning() {
        if (!this.toastsManager) return;
        if (this._warningToast?.toastElement?.isConnected) return;

        this._warningToast = this.toastsManager.createToast({
            icon: 'warning',
            title: _('Temporary files detected'),
            body: _('Some files in this content use blob: links, which only work on this page. If you paste this elsewhere, images or files may be missing. To reuse content with files, add them from the File Manager or clone the iDevice.'),
        });
    }
}
