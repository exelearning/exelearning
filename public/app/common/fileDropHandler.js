/**
 * FileDropHandler
 *
 * Lets the user open a project by dragging an `.elpx`/`.elp` file onto the
 * editor window. The dropped file is routed through the SAME entry points used
 * by the File menu and the Electron file-association open, so the unsaved-changes
 * prompt and the import flow behave identically to a normal "Open project":
 *
 *   - Electron desktop  → App.openFileFromPath(file.path)
 *   - Static / cloud PWA → App.openStaticFile(file)
 *   - Online (server)    → modals.openuserodefiles.largeFilesUpload(file)
 *
 * All three converge on `largeFilesUpload`, which shows the "save the current
 * project?" dialog (ModalSessionLogout) when there are unsaved changes and then
 * runs the in-memory Yjs import (with chunked-upload fallback online).
 *
 * Disabled in embedded mode so an LMS iframe cannot have its project replaced
 * by a stray drop.
 *
 * Usage:
 *   const dropHandler = new FileDropHandler({ app });
 *   dropHandler.bind();
 */

/**
 * Whether a filename is an openable eXeLearning project file.
 * @param {string} name
 * @returns {boolean}
 */
export function isOpenableProjectFile(name) {
    if (typeof name !== 'string') return false;
    const lower = name.toLowerCase();
    return lower.endsWith('.elpx') || lower.endsWith('.elp');
}

export default class FileDropHandler {
    /**
     * @param {Object} options
     * @param {Object} options.app - The App instance (window.eXeLearning.app)
     * @param {EventTarget} [options.target] - Drop target (defaults to window)
     */
    constructor(options = {}) {
        this.app = options.app;
        this.target = options.target || window;
        this._bound = false;
        this._dragDepth = 0;
        this._overlay = null;
        this._boundDragEnter = this._onDragEnter.bind(this);
        this._boundDragOver = this._onDragOver.bind(this);
        this._boundDragLeave = this._onDragLeave.bind(this);
        this._boundDrop = this._onDrop.bind(this);
    }

    /**
     * Attach drag-and-drop listeners. Idempotent. No-op in embedded mode.
     *
     * Listeners run in the CAPTURE phase so they always fire before any
     * descendant handler that calls stopPropagation() (e.g. the structure tree
     * or content editors). Otherwise a drop landing on such an element would
     * never reach us and the browser would open the file itself.
     */
    bind() {
        if (this._bound) return;
        if (this.app?.capabilities?.embedded?.enabled) return;

        this.target.addEventListener('dragenter', this._boundDragEnter, true);
        this.target.addEventListener('dragover', this._boundDragOver, true);
        this.target.addEventListener('dragleave', this._boundDragLeave, true);
        this.target.addEventListener('drop', this._boundDrop, true);
        this._bound = true;
    }

    /**
     * Detach listeners and remove the overlay.
     */
    unbind() {
        if (!this._bound) return;
        this.target.removeEventListener('dragenter', this._boundDragEnter, true);
        this.target.removeEventListener('dragover', this._boundDragOver, true);
        this.target.removeEventListener('dragleave', this._boundDragLeave, true);
        this.target.removeEventListener('drop', this._boundDrop, true);
        this._hideOverlay();
        this._bound = false;
        this._dragDepth = 0;
    }

    /**
     * True when the drop should be left to another component instead of opening
     * a project — currently any open modal (e.g. the File Manager has its own
     * file dropzone for uploading assets).
     * @param {EventTarget} target
     * @returns {boolean}
     */
    _isHandledElsewhere(target) {
        if (target && typeof target.closest === 'function' && target.closest('.modal.show')) {
            return true;
        }
        return !!document.querySelector('.modal.show');
    }

    /**
     * True when the drag carries files (not text, links, etc.).
     * @param {DragEvent} event
     * @returns {boolean}
     */
    _isFileDrag(event) {
        const types = event?.dataTransfer?.types;
        if (!types) return false;
        return Array.from(types).includes('Files');
    }

    /**
     * @param {DragEvent} event
     */
    _onDragEnter(event) {
        if (!this._isFileDrag(event)) return;
        // preventDefault here and on dragover stops the browser/Electron from
        // navigating to the dropped file.
        event.preventDefault();
        if (this._isHandledElsewhere(event.target)) return;
        this._dragDepth += 1;
        this._showOverlay();
    }

    /**
     * @param {DragEvent} event
     */
    _onDragOver(event) {
        if (!this._isFileDrag(event)) return;
        event.preventDefault();
        if (this._isHandledElsewhere(event.target)) return;
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    }

    /**
     * @param {DragEvent} event
     */
    _onDragLeave(event) {
        if (!this._isFileDrag(event)) return;
        this._dragDepth = Math.max(0, this._dragDepth - 1);
        if (this._dragDepth === 0) this._hideOverlay();
    }

    /**
     * @param {DragEvent} event
     */
    _onDrop(event) {
        if (!this._isFileDrag(event)) return;
        // Always cancel the native open, even when another component handles
        // the file, so a near-miss drop never navigates the window away.
        event.preventDefault();
        this._dragDepth = 0;
        this._hideOverlay();
        if (this._isHandledElsewhere(event.target)) return;
        this.handleFiles(event.dataTransfer?.files);
    }

    /**
     * Validate and open the first dropped file.
     * @param {FileList|File[]} fileList
     */
    handleFiles(fileList) {
        const file = fileList && fileList[0];
        if (!file) return;

        if (!isOpenableProjectFile(file.name)) {
            this._showInvalidAlert();
            return;
        }

        this.openFile(file);
    }

    /**
     * Route the file through the existing per-runtime open path.
     * @param {File} file
     */
    openFile(file) {
        const app = this.app;
        if (!app) return;

        // Electron desktop: route by filesystem path to preserve save-path behavior.
        if (window.electronAPI && file.path && typeof app.openFileFromPath === 'function') {
            app.openFileFromPath(file.path);
            return;
        }

        // Static / cloud PWA: uses the in-memory open with the not-ready queue.
        if (app.runtimeConfig?.isStaticMode?.() && typeof app.openStaticFile === 'function') {
            app.openStaticFile(file);
            return;
        }

        // Online (server) and fallback: same funnel as the File menu open.
        app.modals?.openuserodefiles?.largeFilesUpload?.(file);
    }

    /**
     * Inform the user that only project files can be opened by dropping.
     */
    _showInvalidAlert() {
        this.app?.modals?.alert?.show?.({
            title: _('Open project'),
            body: _('Only .elpx or .elp project files can be opened by dragging them here.'),
            contentId: 'error',
        });
    }

    /**
     * Show the full-window drop overlay (created lazily).
     */
    _showOverlay() {
        if (!this._overlay) {
            const overlay = document.createElement('div');
            overlay.className = 'exe-file-drop-overlay';
            const message = document.createElement('div');
            message.className = 'exe-file-drop-overlay__message';
            message.textContent = _('Drop an .elpx file here to open it');
            overlay.appendChild(message);
            this._overlay = overlay;
        }
        if (!this._overlay.isConnected) {
            document.body.appendChild(this._overlay);
        }
    }

    /**
     * Hide and detach the drop overlay.
     */
    _hideOverlay() {
        if (this._overlay?.isConnected) {
            this._overlay.remove();
        }
    }
}
