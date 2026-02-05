import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create a localStorage store that persists for the test file
const localStorageStore = {};

// Create spies for localStorage methods
const getItemSpy = vi.fn((key) => localStorageStore[key] || null);
const setItemSpy = vi.fn((key, value) => { localStorageStore[key] = String(value); });
const removeItemSpy = vi.fn((key) => { delete localStorageStore[key]; });
const clearSpy = vi.fn(() => { Object.keys(localStorageStore).forEach(key => delete localStorageStore[key]); });

// Set up global mocks before importing the module
vi.stubGlobal('_', (str) => str);
vi.stubGlobal('confirm', vi.fn());
vi.stubGlobal('localStorage', {
  getItem: getItemSpy,
  setItem: setItemSpy,
  removeItem: removeItemSpy,
  clear: clearSpy,
});

// Import after mocking globals
const UnsavedChangesHelper = await import('./unsavedChangesHelper.js').then(m => m.default || m);

describe('UnsavedChangesHelper', () => {
  let mockDocumentManager;
  let mockYjsBridge;
  let mockApp;

  beforeEach(() => {
    // Reset all mocks and localStorage store
    vi.clearAllMocks();
    Object.keys(localStorageStore).forEach(key => delete localStorageStore[key]);

    // Create mock document manager
    mockDocumentManager = {
      isDirty: false,
      lastSavedAt: null,
      saveInProgress: false,
      _initialized: true,
      markDirty: vi.fn(() => { mockDocumentManager.isDirty = true; }),
      markClean: vi.fn(() => { mockDocumentManager.isDirty = false; }),
    };

    // Create mock Yjs bridge
    mockYjsBridge = {
      documentManager: mockDocumentManager,
      save: vi.fn().mockResolvedValue({ success: true }),
    };

    // Create mock app
    mockApp = {
      project: {
        _yjsBridge: mockYjsBridge,
      },
      modals: {
        saveChangesModal: {
          confirmDiscardOrSave: vi.fn().mockResolvedValue('discard'),
        },
      },
    };

    // Mock window.eXeLearning
    vi.stubGlobal('eXeLearning', { app: mockApp });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Re-stub what we need for the module
    vi.stubGlobal('_', (str) => str);
    vi.stubGlobal('confirm', vi.fn());
    vi.stubGlobal('localStorage', {
      getItem: getItemSpy,
      setItem: setItemSpy,
      removeItem: removeItemSpy,
      clear: clearSpy,
    });
  });

  describe('hasUnsavedChanges', () => {
    it('should return false when no Yjs bridge exists', () => {
      mockApp.project._yjsBridge = null;
      expect(UnsavedChangesHelper.hasUnsavedChanges()).toBe(false);
    });

    it('should return false when document is not dirty', () => {
      mockDocumentManager.isDirty = false;
      expect(UnsavedChangesHelper.hasUnsavedChanges()).toBe(false);
    });

    it('should return true when document is dirty', () => {
      mockDocumentManager.isDirty = true;
      expect(UnsavedChangesHelper.hasUnsavedChanges()).toBe(true);
    });

    it('should return false when document manager is missing', () => {
      mockYjsBridge.documentManager = null;
      expect(UnsavedChangesHelper.hasUnsavedChanges()).toBe(false);
    });
  });

  describe('getSaveStatus', () => {
    it('should return default values when no document manager exists', () => {
      mockApp.project._yjsBridge = null;
      const status = UnsavedChangesHelper.getSaveStatus();
      expect(status).toEqual({
        isDirty: false,
        lastSavedAt: null,
        saveInProgress: false,
        isInitialized: false,
      });
    });

    it('should return correct status from document manager', () => {
      const savedAt = new Date();
      mockDocumentManager.isDirty = true;
      mockDocumentManager.lastSavedAt = savedAt;
      mockDocumentManager.saveInProgress = true;
      mockDocumentManager._initialized = true;

      const status = UnsavedChangesHelper.getSaveStatus();
      expect(status).toEqual({
        isDirty: true,
        lastSavedAt: savedAt,
        saveInProgress: true,
        isInitialized: true,
      });
    });
  });

  describe('promptIfUnsavedChanges', () => {
    it('should return true immediately when no unsaved changes', async () => {
      mockDocumentManager.isDirty = false;
      const result = await UnsavedChangesHelper.promptIfUnsavedChanges();
      expect(result).toBe(true);
      expect(mockApp.modals.saveChangesModal.confirmDiscardOrSave).not.toHaveBeenCalled();
    });

    it('should use modal when available and user discards', async () => {
      mockDocumentManager.isDirty = true;
      mockApp.modals.saveChangesModal.confirmDiscardOrSave.mockResolvedValue('discard');

      const result = await UnsavedChangesHelper.promptIfUnsavedChanges();

      expect(result).toBe(true);
      expect(mockApp.modals.saveChangesModal.confirmDiscardOrSave).toHaveBeenCalled();
    });

    it('should return false when user cancels via modal', async () => {
      mockDocumentManager.isDirty = true;
      mockApp.modals.saveChangesModal.confirmDiscardOrSave.mockResolvedValue('cancel');

      const result = await UnsavedChangesHelper.promptIfUnsavedChanges();

      expect(result).toBe(false);
    });

    it('should save and return true when user chooses save', async () => {
      mockDocumentManager.isDirty = true;
      mockApp.modals.saveChangesModal.confirmDiscardOrSave.mockResolvedValue('save');

      const result = await UnsavedChangesHelper.promptIfUnsavedChanges();

      expect(result).toBe(true);
      expect(mockYjsBridge.save).toHaveBeenCalled();
    });

    it('should fall back to confirm dialog when modal not available', async () => {
      mockDocumentManager.isDirty = true;
      mockApp.modals = null;
      window.confirm.mockReturnValue(true);

      const result = await UnsavedChangesHelper.promptIfUnsavedChanges();

      expect(result).toBe(true);
      expect(window.confirm).toHaveBeenCalled();
    });

    it('should return false when modal throws (cancelled)', async () => {
      mockDocumentManager.isDirty = true;
      mockApp.modals.saveChangesModal.confirmDiscardOrSave.mockRejectedValue(new Error('cancelled'));

      const result = await UnsavedChangesHelper.promptIfUnsavedChanges();

      expect(result).toBe(false);
    });
  });

  describe('saveProject', () => {
    it('should return failure when no Yjs bridge exists', async () => {
      mockApp.project._yjsBridge = null;
      const result = await UnsavedChangesHelper.saveProject();
      expect(result).toEqual({ success: false, message: 'Project not initialized' });
    });

    it('should call Yjs bridge save and return result', async () => {
      const saveResult = { success: true, bytes: 1234 };
      mockYjsBridge.save.mockResolvedValue(saveResult);

      const result = await UnsavedChangesHelper.saveProject();

      expect(mockYjsBridge.save).toHaveBeenCalled();
      expect(result).toEqual(saveResult);
    });

    it('should handle save errors gracefully', async () => {
      mockYjsBridge.save.mockRejectedValue(new Error('Network error'));

      const result = await UnsavedChangesHelper.saveProject();

      expect(result).toEqual({ success: false, message: 'Network error' });
    });
  });

  describe('markDirty and markClean', () => {
    it('should call document manager markDirty', () => {
      UnsavedChangesHelper.markDirty();
      expect(mockDocumentManager.markDirty).toHaveBeenCalled();
    });

    it('should call document manager markClean', () => {
      UnsavedChangesHelper.markClean();
      expect(mockDocumentManager.markClean).toHaveBeenCalled();
    });

    it('should handle missing document manager gracefully', () => {
      mockApp.project._yjsBridge = null;
      // Should not throw
      expect(() => UnsavedChangesHelper.markDirty()).not.toThrow();
      expect(() => UnsavedChangesHelper.markClean()).not.toThrow();
    });
  });

  describe('persistDirtyState', () => {
    it('should save dirty state to localStorage', () => {
      UnsavedChangesHelper.persistDirtyState('project-123', true);
      expect(setItemSpy).toHaveBeenCalledWith(
        'exelearning_dirty_state_project-123',
        'true'
      );
    });

    it('should remove from localStorage when not dirty', () => {
      UnsavedChangesHelper.persistDirtyState('project-123', false);
      expect(removeItemSpy).toHaveBeenCalledWith(
        'exelearning_dirty_state_project-123'
      );
    });

    it('should handle missing projectId', () => {
      UnsavedChangesHelper.persistDirtyState(null, true);
      expect(setItemSpy).not.toHaveBeenCalled();
    });
  });

  describe('getPersistedDirtyState', () => {
    it('should return persisted dirty state', () => {
      // Set directly in the store so getItem will return it
      localStorageStore['exelearning_dirty_state_project-123'] = 'true';
      expect(UnsavedChangesHelper.getPersistedDirtyState('project-123')).toBe(true);
    });

    it('should return false when not persisted', () => {
      expect(UnsavedChangesHelper.getPersistedDirtyState('project-123')).toBe(false);
    });

    it('should return false for missing projectId', () => {
      expect(UnsavedChangesHelper.getPersistedDirtyState(null)).toBe(false);
    });
  });

  describe('clearPersistedDirtyState', () => {
    it('should remove dirty state from localStorage', () => {
      UnsavedChangesHelper.clearPersistedDirtyState('project-123');
      expect(removeItemSpy).toHaveBeenCalledWith(
        'exelearning_dirty_state_project-123'
      );
    });

    it('should handle missing projectId', () => {
      UnsavedChangesHelper.clearPersistedDirtyState(null);
      expect(removeItemSpy).not.toHaveBeenCalled();
    });

    it('should handle localStorage errors gracefully', () => {
      removeItemSpy.mockImplementationOnce(() => { throw new Error('Storage full'); });
      // Should not throw
      expect(() => UnsavedChangesHelper.clearPersistedDirtyState('project-123')).not.toThrow();
    });
  });

  describe('persistDirtyState error handling', () => {
    it('should handle localStorage setItem errors gracefully', () => {
      setItemSpy.mockImplementationOnce(() => { throw new Error('Storage full'); });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should not throw
      expect(() => UnsavedChangesHelper.persistDirtyState('project-123', true)).not.toThrow();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('getPersistedDirtyState error handling', () => {
    it('should return false when localStorage throws', () => {
      getItemSpy.mockImplementationOnce(() => { throw new Error('Access denied'); });
      expect(UnsavedChangesHelper.getPersistedDirtyState('project-123')).toBe(false);
    });
  });

  describe('setupBeforeUnloadHandler', () => {
    it('should add beforeunload event listener', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      UnsavedChangesHelper.setupBeforeUnloadHandler();

      expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      addEventListenerSpy.mockRestore();
    });

    it('should trigger confirmation when there are unsaved changes', () => {
      mockDocumentManager.isDirty = true;

      // Set up the handler
      let capturedHandler;
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
        if (event === 'beforeunload') capturedHandler = handler;
      });

      UnsavedChangesHelper.setupBeforeUnloadHandler();

      // Create mock event
      const mockEvent = { preventDefault: vi.fn(), returnValue: undefined };
      capturedHandler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.returnValue).toBe('');

      addEventListenerSpy.mockRestore();
    });

    it('should not trigger confirmation when no unsaved changes', () => {
      mockDocumentManager.isDirty = false;

      let capturedHandler;
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
        if (event === 'beforeunload') capturedHandler = handler;
      });

      UnsavedChangesHelper.setupBeforeUnloadHandler();

      const mockEvent = { preventDefault: vi.fn(), returnValue: undefined };
      capturedHandler(mockEvent);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();

      addEventListenerSpy.mockRestore();
    });
  });
});
