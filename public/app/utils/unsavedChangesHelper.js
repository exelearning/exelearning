/**
 * UnsavedChangesHelper
 * Centralized helper for detecting and managing unsaved changes in eXeLearning.
 *
 * This module provides a unified way to check for unsaved changes and prompt the user
 * before navigating away from the workarea. It uses the YjsProjectBridge's save status
 * tracking as the single source of truth.
 *
 * Usage:
 *   // Check if there are unsaved changes
 *   const hasChanges = UnsavedChangesHelper.hasUnsavedChanges();
 *
 *   // Prompt user before leaving if there are changes
 *   const canLeave = await UnsavedChangesHelper.promptIfUnsavedChanges();
 *
 *   // Get the current save status
 *   const status = UnsavedChangesHelper.getSaveStatus();
 */
const UnsavedChangesHelper = {
  /**
   * LocalStorage key for persisting dirty state across page reloads
   * @type {string}
   */
  DIRTY_STATE_KEY: 'exelearning_dirty_state',

  /**
   * Check if the current project has unsaved changes.
   * Uses the YjsDocumentManager's dirty tracking as the source of truth.
   *
   * @returns {boolean} True if there are unsaved changes
   */
  hasUnsavedChanges() {
    const app = window.eXeLearning?.app;
    const yjsBridge = app?.project?._yjsBridge;

    // If no Yjs bridge, no changes
    if (!yjsBridge || !yjsBridge.documentManager) {
      return false;
    }

    // Check the document manager's dirty state
    return yjsBridge.documentManager.isDirty === true;
  },

  /**
   * Get the current save status of the project.
   * Provides detailed information about the save state.
   *
   * @returns {{ isDirty: boolean, lastSavedAt: Date|null, saveInProgress: boolean, isInitialized: boolean }}
   */
  getSaveStatus() {
    const app = window.eXeLearning?.app;
    const yjsBridge = app?.project?._yjsBridge;
    const docManager = yjsBridge?.documentManager;

    if (!docManager) {
      return {
        isDirty: false,
        lastSavedAt: null,
        saveInProgress: false,
        isInitialized: false,
      };
    }

    return {
      isDirty: docManager.isDirty === true,
      lastSavedAt: docManager.lastSavedAt || null,
      saveInProgress: docManager.saveInProgress === true,
      isInitialized: docManager._initialized === true,
    };
  },

  /**
   * Prompt the user to save changes before leaving.
   * Returns true if user confirms leaving (either no changes, save success, or discard).
   * Returns false if user cancels the action.
   *
   * @param {Object} options - Options for the prompt
   * @param {string} [options.message] - Custom message for the prompt
   * @returns {Promise<boolean>} True if the action can proceed, false if cancelled
   */
  async promptIfUnsavedChanges(options = {}) {
    // No unsaved changes, proceed immediately
    if (!this.hasUnsavedChanges()) {
      return true;
    }

    const app = window.eXeLearning?.app;

    // Use the app's modal if available
    if (app?.modals?.saveChangesModal?.confirmDiscardOrSave) {
      try {
        const result = await app.modals.saveChangesModal.confirmDiscardOrSave();
        // result is 'save', 'discard', or 'cancel'
        if (result === 'cancel') {
          return false;
        }
        if (result === 'save') {
          // User chose to save
          await this.saveProject();
        }
        // 'discard' or successful save means proceed
        return true;
      } catch (error) {
        // Modal was cancelled
        return false;
      }
    }

    // Fallback to browser confirm dialog
    const message = options.message || _('You have unsaved changes. Are you sure you want to leave?');
    return window.confirm(message);
  },

  /**
   * Save the current project.
   * Uses the YjsProjectBridge's save method.
   *
   * @returns {Promise<{ success: boolean, message?: string }>}
   */
  async saveProject() {
    const app = window.eXeLearning?.app;
    const yjsBridge = app?.project?._yjsBridge;

    if (!yjsBridge) {
      return { success: false, message: 'Project not initialized' };
    }

    try {
      const result = await yjsBridge.save();
      return result;
    } catch (error) {
      console.error('[UnsavedChangesHelper] Save failed:', error);
      return { success: false, message: error.message };
    }
  },

  /**
   * Mark the document as dirty (has unsaved changes).
   * This is typically called automatically by the Yjs update observer,
   * but can be called manually if needed.
   */
  markDirty() {
    const app = window.eXeLearning?.app;
    const docManager = app?.project?._yjsBridge?.documentManager;

    if (docManager) {
      docManager.markDirty();
    }
  },

  /**
   * Mark the document as clean (no unsaved changes).
   * This is typically called after a successful save.
   */
  markClean() {
    const app = window.eXeLearning?.app;
    const docManager = app?.project?._yjsBridge?.documentManager;

    if (docManager) {
      docManager.markClean();
    }
  },

  /**
   * Persist the dirty state to localStorage.
   * This allows detecting unsaved changes across page reloads.
   *
   * @param {string} projectId - The project ID
   * @param {boolean} isDirty - Whether the project has unsaved changes
   */
  persistDirtyState(projectId, isDirty) {
    if (!projectId) return;

    try {
      const key = `${this.DIRTY_STATE_KEY}_${projectId}`;
      if (isDirty) {
        localStorage.setItem(key, 'true');
      } else {
        localStorage.removeItem(key);
      }
    } catch (e) {
      // localStorage not available or full
      console.warn('[UnsavedChangesHelper] Failed to persist dirty state:', e);
    }
  },

  /**
   * Get the persisted dirty state from localStorage.
   * This is used to restore the dirty state after a page reload.
   *
   * @param {string} projectId - The project ID
   * @returns {boolean} The persisted dirty state
   */
  getPersistedDirtyState(projectId) {
    if (!projectId) return false;

    try {
      const key = `${this.DIRTY_STATE_KEY}_${projectId}`;
      return localStorage.getItem(key) === 'true';
    } catch (e) {
      return false;
    }
  },

  /**
   * Clear the persisted dirty state.
   * Called after a successful save.
   *
   * @param {string} projectId - The project ID
   */
  clearPersistedDirtyState(projectId) {
    if (!projectId) return;

    try {
      const key = `${this.DIRTY_STATE_KEY}_${projectId}`;
      localStorage.removeItem(key);
    } catch (e) {
      // Ignore
    }
  },

  /**
   * Set up the beforeunload handler to warn about unsaved changes.
   * This is automatically called when the YjsDocumentManager initializes.
   * The handler reference is stored so it can be removed on re-setup.
   */
  setupBeforeUnloadHandler() {
    // Remove previous handler if it exists (prevents duplicates on re-init)
    if (this._beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this._beforeUnloadHandler);
    }

    this._beforeUnloadHandler = (event) => {
      // Electron handles close flow separately
      if (window.electronAPI) return;

      const app = window.eXeLearning?.app;
      const assetManager = app?.project?._yjsBridge?.assetManager;
      const hasUnsavedAssets =
        assetManager &&
        typeof assetManager.hasUnsavedAssets === 'function' &&
        assetManager.hasUnsavedAssets();

      if (this.hasUnsavedChanges() || hasUnsavedAssets) {
        // Standard way to trigger the browser's "Leave site?" dialog
        event.preventDefault();
        // For older browsers
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', this._beforeUnloadHandler);
  },

  /**
   * Remove the beforeunload handler.
   * Useful when intentionally navigating away (project transitions).
   */
  removeBeforeUnloadHandler() {
    if (this._beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this._beforeUnloadHandler);
      this._beforeUnloadHandler = null;
    }
  },
};

export default UnsavedChangesHelper;
