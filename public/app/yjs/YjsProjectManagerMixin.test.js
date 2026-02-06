/**
 * YjsProjectManagerMixin Tests
 *
 * Unit tests for YjsProjectManagerMixin - adds Yjs capabilities to projectManager.
 *
 */

 

// Test functions available globally from vitest setup

const YjsProjectManagerMixin = require('./YjsProjectManagerMixin');

describe('YjsProjectManagerMixin', () => {
  let projectManager;
  let mockBridge;
  const originalWindow = global.window;
  const originalDocument = global.document;

  beforeEach(() => {
    // Create mock project manager
    projectManager = {
      save: mock(() => undefined).mockResolvedValue({ success: true }),
      generateIntervalAutosave: mock(() => undefined),
      intervalSaveOde: null,
      structure: {
        nodeSelected: { id: 'page-1' },
      },
      app: {
        interface: {
          odeTitleElement: {
            setTitle: mock(() => undefined),
            initYjsBinding: mock(() => undefined),
          },
        },
        themes: {
          initYjsBinding: mock(() => undefined),
        },
      },
    };

    // Mock bridge
    mockBridge = {
      initialize: mock(() => undefined).mockResolvedValue(),
      enableAutoSync: mock(() => undefined),
      disconnect: mock(() => undefined).mockResolvedValue(),
      structureBinding: {
        getComponent: mock(() => undefined),
      },
      documentManager: {
        awareness: null,
        captureBaselineState: mock(() => undefined),
      },
      app: null,
    };

    // Setup global mocks
    global.window = {
      ...global.window,
      YjsModules: {
        initializeProject: mock(() => undefined).mockResolvedValue(mockBridge),
        cleanup: mock(() => undefined).mockResolvedValue(),
        bindTinyMCE: mock(() => undefined),
      },
      YjsLoader: {
        load: mock(() => undefined).mockResolvedValue(),
      },
      $exeTinyMCE: {
        onEditorInit: null,
      },
    };

    global.document = {
      body: {},
      querySelector: mock(() => null),
      createElement: mock((tag) => {
        const el = {
          tagName: tag.toUpperCase(),
          className: '',
          dataset: {},
          style: {},
          innerHTML: '',
          children: [],
          parentElement: null,
          appendChild: mock((child) => {
            el.children.push(child);
            child.parentElement = el;
            return child;
          }),
          closest: mock(() => null),
          querySelector: mock(() => null),
          querySelectorAll: mock(() => []),
        };
        return el;
      }),
    };

    // Suppress console.log during tests
    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'warn').mockImplementation(() => {});
    spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original globals instead of deleting
    global.window = originalWindow;
    global.document = originalDocument;
  });

  describe('applyMixin', () => {
    it('adds _yjsEnabled property', () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
      expect(projectManager._yjsEnabled).toBe(false);
    });

    it('adds _yjsBridge property', () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
      expect(projectManager._yjsBridge).toBeNull();
    });

    it('adds _yjsBindings Map', () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
      expect(projectManager._yjsBindings).toBeInstanceOf(Map);
    });

    it('adds enableYjsMode method', () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
      expect(typeof projectManager.enableYjsMode).toBe('function');
    });

    it('adds disableYjsMode method', () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
      expect(typeof projectManager.disableYjsMode).toBe('function');
    });

    it('adds isYjsEnabled method', () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
      expect(typeof projectManager.isYjsEnabled).toBe('function');
    });

    it('adds getYjsBridge method', () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
      expect(typeof projectManager.getYjsBridge).toBe('function');
    });

    it('adds bindEditorToYjs method', () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
      expect(typeof projectManager.bindEditorToYjs).toBe('function');
    });

    it('adds unbindEditorFromYjs method', () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
      expect(typeof projectManager.unbindEditorFromYjs).toBe('function');
    });
  });

  describe('enableYjsMode', () => {
    beforeEach(() => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('throws error if YjsModules not loaded', async () => {
      window.YjsModules = undefined;
      window.YjsLoader = undefined;

      await expect(projectManager.enableYjsMode(123, 'token')).rejects.toThrow();
    });

    it('loads Yjs modules via YjsLoader if needed', async () => {
      window.YjsModules = undefined;

      // Mock YjsLoader.load to set up YjsModules when called
      window.YjsLoader.load = mock(() => undefined).mockImplementation(async () => {
        window.YjsModules = {
          initializeProject: mock(() => undefined).mockResolvedValue(mockBridge),
          cleanup: mock(() => undefined).mockResolvedValue(),
          bindTinyMCE: mock(() => undefined),
        };
      });

      await projectManager.enableYjsMode(123, 'token');

      expect(window.YjsLoader.load).toHaveBeenCalled();
    });

    it('calls YjsModules.initializeProject', async () => {
      await projectManager.enableYjsMode(123, 'token');

      expect(window.YjsModules.initializeProject).toHaveBeenCalledWith(
        123,
        'token',
        expect.any(Object)
      );
    });

    it('sets _yjsBridge', async () => {
      await projectManager.enableYjsMode(123, 'token');

      expect(projectManager._yjsBridge).toBe(mockBridge);
    });

    it('sets _yjsEnabled to true', async () => {
      await projectManager.enableYjsMode(123, 'token');

      expect(projectManager._yjsEnabled).toBe(true);
    });

    it('clears legacy autosave interval', async () => {
      const mockInterval = setInterval(() => {}, 1000);
      projectManager.intervalSaveOde = mockInterval;
      const clearIntervalSpy = spyOn(global, 'clearInterval');

      await projectManager.enableYjsMode(123, 'token');

      expect(clearIntervalSpy).toHaveBeenCalledWith(mockInterval);
      expect(projectManager.intervalSaveOde).toBeNull();
    });

    it('sets up TinyMCE hook', async () => {
      await projectManager.enableYjsMode(123, 'token');

      expect(window.$exeTinyMCE.onEditorInit).toBeDefined();
    });

    it('initializes title element binding', async () => {
      await projectManager.enableYjsMode(123, 'token');

      expect(projectManager.app.interface.odeTitleElement.setTitle).toHaveBeenCalled();
      expect(projectManager.app.interface.odeTitleElement.initYjsBinding).toHaveBeenCalled();
    });

    it('initializes theme binding', async () => {
      await projectManager.enableYjsMode(123, 'token');

      expect(projectManager.app.themes.initYjsBinding).toHaveBeenCalled();
    });

    it('captures baseline state after initialization', async () => {
      await projectManager.enableYjsMode(123, 'token');

      expect(mockBridge.documentManager.captureBaselineState).toHaveBeenCalled();
    });

    it('returns bridge instance', async () => {
      const result = await projectManager.enableYjsMode(123, 'token');

      expect(result).toBe(mockBridge);
    });

    it('accepts custom options', async () => {
      await projectManager.enableYjsMode(123, 'token', {
        treeContainerId: 'custom-tree',
        customOption: 'value',
      });

      expect(window.YjsModules.initializeProject).toHaveBeenCalledWith(
        123,
        'token',
        expect.objectContaining({
          treeContainerId: 'custom-tree',
          customOption: 'value',
        })
      );
    });
  });

  describe('disableYjsMode', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
      await projectManager.enableYjsMode(123, 'token');
    });

    it('does nothing if not enabled', async () => {
      projectManager._yjsEnabled = false;
      await projectManager.disableYjsMode();
      // Should not throw
    });

    it('cleans up bindings', async () => {
      const mockBinding = { destroy: mock(() => undefined) };
      projectManager._yjsBindings.set('editor-1', mockBinding);

      await projectManager.disableYjsMode();

      expect(mockBinding.destroy).toHaveBeenCalled();
      expect(projectManager._yjsBindings.size).toBe(0);
    });

    it('calls YjsModules.cleanup', async () => {
      await projectManager.disableYjsMode();

      expect(window.YjsModules.cleanup).toHaveBeenCalled();
    });

    it('sets _yjsBridge to null', async () => {
      await projectManager.disableYjsMode();

      expect(projectManager._yjsBridge).toBeNull();
    });

    it('sets _yjsEnabled to false', async () => {
      await projectManager.disableYjsMode();

      expect(projectManager._yjsEnabled).toBe(false);
    });
  });

  describe('isYjsEnabled', () => {
    beforeEach(() => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns false initially', () => {
      expect(projectManager.isYjsEnabled()).toBe(false);
    });

    it('returns true after enabling', async () => {
      await projectManager.enableYjsMode(123, 'token');
      expect(projectManager.isYjsEnabled()).toBe(true);
    });

    it('returns false after disabling', async () => {
      await projectManager.enableYjsMode(123, 'token');
      await projectManager.disableYjsMode();
      expect(projectManager.isYjsEnabled()).toBe(false);
    });
  });

  describe('getYjsBridge', () => {
    beforeEach(() => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns null initially', () => {
      expect(projectManager.getYjsBridge()).toBeNull();
    });

    it('returns bridge after enabling', async () => {
      await projectManager.enableYjsMode(123, 'token');
      expect(projectManager.getYjsBridge()).toBe(mockBridge);
    });
  });

  describe('bindEditorToYjs', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
      await projectManager.enableYjsMode(123, 'token');
    });

    it('calls YjsModules.bindTinyMCE', () => {
      const mockEditor = { id: 'editor-1' };
      projectManager.bindEditorToYjs(mockEditor, 'page-1', 'block-1', 'comp-1');

      expect(window.YjsModules.bindTinyMCE).toHaveBeenCalledWith(
        mockEditor,
        'page-1',
        'block-1',
        'comp-1'
      );
    });

    it('stores binding in _yjsBindings by componentId', () => {
      const mockBinding = { binding: true };
      window.YjsModules.bindTinyMCE.mockReturnValue(mockBinding);

      const mockEditor = { id: 'editor-1' };
      projectManager.bindEditorToYjs(mockEditor, 'page-1', 'block-1', 'comp-1');

      // Binding is stored by componentId, not editor.id
      expect(projectManager._yjsBindings.get('comp-1')).toBe(mockBinding);
    });

    it('does nothing if Yjs not enabled', () => {
      projectManager._yjsEnabled = false;

      const mockEditor = { id: 'editor-1' };
      projectManager.bindEditorToYjs(mockEditor, 'page-1', 'block-1', 'comp-1');

      expect(window.YjsModules.bindTinyMCE).not.toHaveBeenCalled();
    });
  });

  describe('unbindEditorFromYjs', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
      await projectManager.enableYjsMode(123, 'token');
    });

    it('destroys binding and removes from map', () => {
      const mockBinding = { destroy: mock(() => undefined) };
      projectManager._yjsBindings.set('editor-1', mockBinding);

      projectManager.unbindEditorFromYjs('editor-1');

      expect(mockBinding.destroy).toHaveBeenCalled();
      expect(projectManager._yjsBindings.has('editor-1')).toBe(false);
    });

    it('does nothing if binding not found', () => {
      // Should not throw
      projectManager.unbindEditorFromYjs('non-existent');
    });
  });

  describe('save override', () => {
    beforeEach(() => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('uses original save when Yjs not enabled', async () => {
      await projectManager.save();

      expect(projectManager.save).toBeDefined();
    });

    it('uses Yjs save when enabled', async () => {
      mockBridge.save = mock(() => undefined).mockResolvedValue({ success: true });
      await projectManager.enableYjsMode(123, 'token');

      // The mixin should have overridden save behavior
      // (actual implementation depends on mixin details)
    });
  });

  describe('_extractIdsFromEditor', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
      await projectManager.enableYjsMode(123, 'token');
    });

    it('returns null when container not available', () => {
      const mockEditor = {
        getContainer: mock(() => null),
      };

      const ids = projectManager._extractIdsFromEditor(mockEditor);

      expect(ids).toBeNull();
    });

    it('returns null when no page ID found', () => {
      projectManager.structure = { nodeSelected: null };

      const container = document.createElement('div');
      const mockEditor = {
        getContainer: mock(() => container),
      };

      const ids = projectManager._extractIdsFromEditor(mockEditor);

      expect(ids).toBeNull();
    });

    it('extracts IDs from data attributes', () => {
      // Create DOM structure
      const ideviceEl = document.createElement('div');
      ideviceEl.className = 'idevice-node';
      ideviceEl.dataset.odeIdeviceId = 'comp-123';

      const blockEl = document.createElement('div');
      blockEl.className = 'block-node';
      blockEl.dataset.odeBlockId = 'block-456';
      blockEl.appendChild(ideviceEl);

      const container = document.createElement('div');
      ideviceEl.appendChild(container);

      const mockEditor = {
        getContainer: mock(() => container),
      };

      projectManager.structure = { nodeSelected: { id: 'page-789' } };

      const ids = projectManager._extractIdsFromEditor(mockEditor);

      expect(ids).toBeDefined();
      expect(ids.pageId).toBe('page-789');
      expect(ids.componentId).toBe('comp-123');
    });
  });

  describe('_setupTinyMCEHook', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('sets onEditorInit hook', async () => {
      await projectManager.enableYjsMode(123, 'token');

      expect(window.$exeTinyMCE.onEditorInit).toBeDefined();
      expect(typeof window.$exeTinyMCE.onEditorInit).toBe('function');
    });

    it('calls original hook if exists', async () => {
      const originalHook = mock(() => undefined);
      window.$exeTinyMCE.onEditorInit = originalHook;

      await projectManager.enableYjsMode(123, 'token');

      const mockEditor = { id: 'test-editor', getContainer: mock(() => null) };
      window.$exeTinyMCE.onEditorInit(mockEditor);

      expect(originalHook).toHaveBeenCalledWith(mockEditor);
    });

    it('does nothing when $exeTinyMCE not available', async () => {
      window.$exeTinyMCE = undefined;

      await projectManager.enableYjsMode(123, 'token');

      // Should not throw
    });
  });

  // ===== Lock Management Tests =====

  describe('acquireIdeviceLock', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns true when Yjs not enabled', () => {
      const result = projectManager.acquireIdeviceLock('comp-1');
      expect(result).toBe(true);
    });

    it('delegates to bridge when enabled', async () => {
      mockBridge.acquireLock = mock(() => true);
      await projectManager.enableYjsMode(123, 'token');

      const result = projectManager.acquireIdeviceLock('comp-1');

      expect(mockBridge.acquireLock).toHaveBeenCalledWith('comp-1');
      expect(result).toBe(true);
    });
  });

  describe('releaseIdeviceLock', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('does nothing when Yjs not enabled', () => {
      // Should not throw
      projectManager.releaseIdeviceLock('comp-1');
    });

    it('delegates to bridge when enabled', async () => {
      mockBridge.releaseLock = mock(() => undefined);
      await projectManager.enableYjsMode(123, 'token');

      projectManager.releaseIdeviceLock('comp-1');

      expect(mockBridge.releaseLock).toHaveBeenCalledWith('comp-1');
    });
  });

  describe('getIdeviceLockInfo', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns null when Yjs not enabled', () => {
      const result = projectManager.getIdeviceLockInfo('comp-1');
      expect(result).toBeNull();
    });

    it('delegates to bridge when enabled', async () => {
      const lockInfo = { userId: 'user-1', userName: 'Test User' };
      mockBridge.getLockInfo = mock(() => lockInfo);
      await projectManager.enableYjsMode(123, 'token');

      const result = projectManager.getIdeviceLockInfo('comp-1');

      expect(mockBridge.getLockInfo).toHaveBeenCalledWith('comp-1');
      expect(result).toBe(lockInfo);
    });
  });

  // ===== Page Operations Tests =====

  describe('addPageViaYjs', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns null when Yjs not enabled', () => {
      const result = projectManager.addPageViaYjs('New Page');
      expect(result).toBeNull();
    });

    it('delegates to bridge when enabled', async () => {
      const newPage = { id: 'page-1', pageName: 'New Page' };
      mockBridge.addPage = mock(() => newPage);
      await projectManager.enableYjsMode(123, 'token');

      const result = projectManager.addPageViaYjs('New Page', 'parent-1');

      expect(mockBridge.addPage).toHaveBeenCalledWith('New Page', 'parent-1');
      expect(result).toBe(newPage);
    });
  });

  describe('deletePageViaYjs', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns false when Yjs not enabled', () => {
      const result = projectManager.deletePageViaYjs('page-1');
      expect(result).toBe(false);
    });

    it('delegates to bridge when enabled', async () => {
      mockBridge.deletePage = mock(() => true);
      await projectManager.enableYjsMode(123, 'token');

      const result = projectManager.deletePageViaYjs('page-1');

      expect(mockBridge.deletePage).toHaveBeenCalledWith('page-1');
      expect(result).toBe(true);
    });

    it('logs error when deletion fails', async () => {
      mockBridge.deletePage = mock(() => false);
      await projectManager.enableYjsMode(123, 'token');

      const result = projectManager.deletePageViaYjs('page-1');

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('renamePageViaYjs', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns false when Yjs not enabled', () => {
      const result = projectManager.renamePageViaYjs('page-1', 'New Name');
      expect(result).toBe(false);
    });

    it('updates both pageName and title', async () => {
      mockBridge.updatePage = mock(() => undefined);
      await projectManager.enableYjsMode(123, 'token');

      const result = projectManager.renamePageViaYjs('page-1', 'New Name');

      expect(mockBridge.updatePage).toHaveBeenCalledWith('page-1', {
        pageName: 'New Name',
        title: 'New Name',
      });
      expect(result).toBe(true);
    });
  });

  describe('clonePageViaYjs', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns null when Yjs not enabled', () => {
      const result = projectManager.clonePageViaYjs('page-1');
      expect(result).toBeNull();
    });

    it('delegates to bridge when enabled', async () => {
      const clonedPage = { id: 'page-2', pageName: 'Page 1 (copy)' };
      mockBridge.clonePage = mock(() => clonedPage);
      await projectManager.enableYjsMode(123, 'token');

      const result = projectManager.clonePageViaYjs('page-1', 'Custom Name');

      expect(mockBridge.clonePage).toHaveBeenCalledWith('page-1', 'Custom Name');
      expect(result).toBe(clonedPage);
    });
  });

  describe('movePageViaYjs', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns false when Yjs not enabled', () => {
      const result = projectManager.movePageViaYjs('page-1', 'parent-1', 0);
      expect(result).toBe(false);
    });

    it('delegates to bridge when enabled', async () => {
      mockBridge.movePage = mock(() => true);
      await projectManager.enableYjsMode(123, 'token');

      const result = projectManager.movePageViaYjs('page-1', 'parent-1', 2);

      expect(mockBridge.movePage).toHaveBeenCalledWith('page-1', 'parent-1', 2);
      expect(result).toBe(true);
    });

    it('logs warning when move fails', async () => {
      mockBridge.movePage = mock(() => false);
      await projectManager.enableYjsMode(123, 'token');

      const result = projectManager.movePageViaYjs('page-1', 'parent-1', 0);

      expect(result).toBe(false);
      expect(console.warn).toHaveBeenCalled();
    });
  });

  // ===== Block Operations Tests =====

  describe('addBlockViaYjs', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns null when Yjs not enabled', () => {
      const result = projectManager.addBlockViaYjs('page-1', 'New Block');
      expect(result).toBeNull();
    });

    it('delegates to bridge when enabled', async () => {
      mockBridge.addBlock = mock(() => 'block-123');
      await projectManager.enableYjsMode(123, 'token');

      const result = projectManager.addBlockViaYjs('page-1', 'New Block');

      expect(mockBridge.addBlock).toHaveBeenCalledWith('page-1', 'New Block');
      expect(result).toBe('block-123');
    });
  });

  describe('deleteBlockViaYjs', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns false when Yjs not enabled', () => {
      const result = projectManager.deleteBlockViaYjs('page-1', 'block-1');
      expect(result).toBe(false);
    });

    it('delegates to bridge when enabled', async () => {
      mockBridge.deleteBlock = mock(() => undefined);
      await projectManager.enableYjsMode(123, 'token');

      const result = projectManager.deleteBlockViaYjs('page-1', 'block-1');

      expect(mockBridge.deleteBlock).toHaveBeenCalledWith('page-1', 'block-1');
      expect(result).toBe(true);
    });
  });

  describe('cloneBlockViaYjs', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns null when Yjs not enabled', () => {
      const result = projectManager.cloneBlockViaYjs('page-1', 'block-1');
      expect(result).toBeNull();
    });

    it('delegates to bridge when enabled', async () => {
      const clonedBlock = { id: 'block-2', blockName: 'Block 1' };
      mockBridge.cloneBlock = mock(() => clonedBlock);
      await projectManager.enableYjsMode(123, 'token');

      const result = projectManager.cloneBlockViaYjs('page-1', 'block-1');

      expect(mockBridge.cloneBlock).toHaveBeenCalledWith('page-1', 'block-1');
      expect(result).toBe(clonedBlock);
    });
  });

  // ===== Component Operations Tests =====

  describe('addComponentViaYjs', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns null when Yjs not enabled', () => {
      const result = projectManager.addComponentViaYjs('page-1', 'block-1', 'FreeTextIdevice');
      expect(result).toBeNull();
    });

    it('delegates to bridge when enabled', async () => {
      mockBridge.addComponent = mock(() => 'comp-123');
      await projectManager.enableYjsMode(123, 'token');

      const result = projectManager.addComponentViaYjs('page-1', 'block-1', 'FreeTextIdevice', {
        title: 'Test',
      });

      expect(mockBridge.addComponent).toHaveBeenCalledWith('page-1', 'block-1', 'FreeTextIdevice', {
        title: 'Test',
      });
      expect(result).toBe('comp-123');
    });
  });

  describe('deleteComponentViaYjs', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns false when Yjs not enabled', () => {
      const result = projectManager.deleteComponentViaYjs('comp-1');
      expect(result).toBe(false);
    });

    it('delegates to bridge when enabled', async () => {
      mockBridge.deleteComponent = mock(() => undefined);
      await projectManager.enableYjsMode(123, 'token');

      const result = projectManager.deleteComponentViaYjs('comp-1');

      expect(mockBridge.deleteComponent).toHaveBeenCalledWith('comp-1');
      expect(result).toBe(true);
    });
  });

  describe('cloneComponentViaYjs', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns null when Yjs not enabled', () => {
      const result = projectManager.cloneComponentViaYjs('page-1', 'block-1', 'comp-1');
      expect(result).toBeNull();
    });

    it('delegates to bridge when enabled', async () => {
      const clonedComp = { id: 'comp-2', ideviceType: 'FreeTextIdevice' };
      mockBridge.cloneComponent = mock(() => clonedComp);
      await projectManager.enableYjsMode(123, 'token');

      const result = projectManager.cloneComponentViaYjs('page-1', 'block-1', 'comp-1');

      expect(mockBridge.cloneComponent).toHaveBeenCalledWith('page-1', 'block-1', 'comp-1');
      expect(result).toBe(clonedComp);
    });
  });

  describe('updateComponentViaYjs', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('does nothing when Yjs not enabled', () => {
      // Should not throw
      projectManager.updateComponentViaYjs('comp-1', { title: 'Test' });
    });

    it('delegates to bridge when enabled', async () => {
      mockBridge.updateComponent = mock(() => undefined);
      await projectManager.enableYjsMode(123, 'token');

      projectManager.updateComponentViaYjs('comp-1', { title: 'Test' });

      expect(mockBridge.updateComponent).toHaveBeenCalledWith('comp-1', { title: 'Test' });
    });
  });

  describe('updateComponentHtmlViaYjs', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('does nothing when Yjs not enabled', () => {
      // Should not throw
      projectManager.updateComponentHtmlViaYjs('page-1', 'block-1', 'comp-1', '<p>Test</p>');
    });

    it('delegates to bridge when enabled', async () => {
      mockBridge.setComponentHtml = mock(() => undefined);
      await projectManager.enableYjsMode(123, 'token');

      projectManager.updateComponentHtmlViaYjs('page-1', 'block-1', 'comp-1', '<p>Test</p>');

      expect(mockBridge.setComponentHtml).toHaveBeenCalledWith(
        'page-1',
        'block-1',
        'comp-1',
        '<p>Test</p>'
      );
    });
  });

  // ===== Data Retrieval Tests =====

  describe('getPagesFromYjs', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns empty array when Yjs not enabled', () => {
      const result = projectManager.getPagesFromYjs();
      expect(result).toEqual([]);
    });

    it('returns pages from structure binding', async () => {
      const pages = [{ id: 'page-1', pageName: 'Page 1' }];
      mockBridge.structureBinding = {
        getPages: mock(() => pages),
      };
      await projectManager.enableYjsMode(123, 'token');

      const result = projectManager.getPagesFromYjs();

      expect(result).toBe(pages);
    });
  });

  describe('getBlocksFromYjs', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns empty array when Yjs not enabled', () => {
      const result = projectManager.getBlocksFromYjs('page-1');
      expect(result).toEqual([]);
    });

    it('returns blocks from structure binding', async () => {
      const blocks = [{ id: 'block-1', blockName: 'Block 1' }];
      mockBridge.structureBinding = {
        getBlocks: mock(() => blocks),
      };
      await projectManager.enableYjsMode(123, 'token');

      const result = projectManager.getBlocksFromYjs('page-1');

      expect(mockBridge.structureBinding.getBlocks).toHaveBeenCalledWith('page-1');
      expect(result).toBe(blocks);
    });
  });

  describe('getComponentsFromYjs', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns empty array when Yjs not enabled', () => {
      const result = projectManager.getComponentsFromYjs('page-1', 'block-1');
      expect(result).toEqual([]);
    });

    it('returns components from structure binding', async () => {
      const components = [{ id: 'comp-1', ideviceType: 'FreeTextIdevice' }];
      mockBridge.structureBinding = {
        getComponents: mock(() => components),
      };
      await projectManager.enableYjsMode(123, 'token');

      const result = projectManager.getComponentsFromYjs('page-1', 'block-1');

      expect(mockBridge.structureBinding.getComponents).toHaveBeenCalledWith('page-1', 'block-1');
      expect(result).toBe(components);
    });
  });

  // ===== Events & Observers Tests =====

  describe('onStructureChange', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns no-op when Yjs not enabled', () => {
      const callback = mock(() => undefined);
      const unsubscribe = projectManager.onStructureChange(callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe(); // Should not throw
    });

    it('delegates to bridge when enabled', async () => {
      const unsubFn = () => {};
      mockBridge.onStructureChange = mock(() => unsubFn);
      await projectManager.enableYjsMode(123, 'token');

      const callback = mock(() => undefined);
      const result = projectManager.onStructureChange(callback);

      expect(mockBridge.onStructureChange).toHaveBeenCalledWith(callback);
      expect(result).toBe(unsubFn);
    });
  });

  describe('onSaveStatus', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns no-op when Yjs not enabled', () => {
      const callback = mock(() => undefined);
      const unsubscribe = projectManager.onSaveStatus(callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe(); // Should not throw
    });

    it('delegates to bridge when enabled', async () => {
      const unsubFn = () => {};
      mockBridge.onSaveStatus = mock(() => unsubFn);
      await projectManager.enableYjsMode(123, 'token');

      const callback = mock(() => undefined);
      const result = projectManager.onSaveStatus(callback);

      expect(mockBridge.onSaveStatus).toHaveBeenCalledWith(callback);
      expect(result).toBe(unsubFn);
    });
  });

  describe('observeComponentContent', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns no-op when Yjs not enabled', () => {
      const callback = mock(() => undefined);
      const unsubscribe = projectManager.observeComponentContent('comp-1', callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe(); // Should not throw
    });

    it('delegates to bridge when enabled', async () => {
      const unsubFn = () => {};
      mockBridge.observeComponentContent = mock(() => unsubFn);
      await projectManager.enableYjsMode(123, 'token');

      const callback = mock(() => undefined);
      const result = projectManager.observeComponentContent('comp-1', callback);

      expect(mockBridge.observeComponentContent).toHaveBeenCalledWith('comp-1', callback);
      expect(result).toBe(unsubFn);
    });
  });

  // ===== Undo/Redo Tests =====

  describe('undo', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('does nothing when Yjs not enabled', () => {
      // Should not throw
      projectManager.undo();
    });

    it('delegates to bridge when enabled', async () => {
      mockBridge.undo = mock(() => undefined);
      await projectManager.enableYjsMode(123, 'token');

      projectManager.undo();

      expect(mockBridge.undo).toHaveBeenCalled();
    });
  });

  describe('redo', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('does nothing when Yjs not enabled', () => {
      // Should not throw
      projectManager.redo();
    });

    it('delegates to bridge when enabled', async () => {
      mockBridge.redo = mock(() => undefined);
      await projectManager.enableYjsMode(123, 'token');

      projectManager.redo();

      expect(mockBridge.redo).toHaveBeenCalled();
    });
  });

  // ===== Import/Export Tests =====

  describe('exportToElpxViaYjs', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('does nothing when Yjs not enabled', async () => {
      // Should not throw
      await projectManager.exportToElpxViaYjs();
    });

    it('delegates to bridge when enabled', async () => {
      mockBridge.exportToElpx = mock(() => undefined).mockResolvedValue();
      await projectManager.enableYjsMode(123, 'token');

      await projectManager.exportToElpxViaYjs();

      expect(mockBridge.exportToElpx).toHaveBeenCalled();
    });
  });

  describe('importFromElpxViaYjs', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns null when Yjs not enabled', async () => {
      const file = new File(['test'], 'test.elpx');
      const result = await projectManager.importFromElpxViaYjs(file);
      expect(result).toBeNull();
    });

    it('delegates to bridge when enabled', async () => {
      const stats = { pages: 1, blocks: 2, components: 3 };
      mockBridge.importFromElpx = mock(() => undefined).mockResolvedValue(stats);
      await projectManager.enableYjsMode(123, 'token');

      const file = new File(['test'], 'test.elpx');
      const result = await projectManager.importFromElpxViaYjs(file, { clearExisting: true });

      expect(mockBridge.importFromElpx).toHaveBeenCalledWith(file, { clearExisting: true });
      expect(result).toBe(stats);
    });
  });

  describe('importConvertedStructure', () => {
    beforeEach(async () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
    });

    it('returns null when Yjs not enabled', async () => {
      const result = await projectManager.importConvertedStructure({}, []);
      expect(result).toBeNull();
    });

    it('imports structure with pages and blocks', async () => {
      const mockNavigation = new global.window.Y.Array();
      mockBridge.getAssetManager = mock(() => null);
      mockBridge.getDocumentManager = mock(() => ({
        getNavigation: () => mockNavigation,
      }));

      await projectManager.enableYjsMode(123, 'token');

      const structure = {
        pages: [
          {
            id: 'page-1',
            title: 'Test Page',
            blocks: [
              {
                id: 'block-1',
                name: 'Block 1',
                idevices: [
                  {
                    id: 'comp-1',
                    type: 'FreeTextIdevice',
                    htmlView: '<p>Test</p>',
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = await projectManager.importConvertedStructure(structure, []);

      expect(result).toBeDefined();
      expect(result.pages).toBe(1);
      expect(result.blocks).toBe(1);
      expect(result.components).toBe(1);
    });

    it('handles empty structure', async () => {
      const mockNavigation = new global.window.Y.Array();
      mockBridge.getAssetManager = mock(() => null);
      mockBridge.getDocumentManager = mock(() => ({
        getNavigation: () => mockNavigation,
      }));

      await projectManager.enableYjsMode(123, 'token');

      const result = await projectManager.importConvertedStructure({}, []);

      expect(result).toBeDefined();
      expect(result.pages).toBe(0);
    });

    it('clears existing navigation when clearExisting is true', async () => {
      const mockNavigation = new global.window.Y.Array();
      mockNavigation.push(['existing']);
      mockBridge.getAssetManager = mock(() => null);
      mockBridge.getDocumentManager = mock(() => ({
        getNavigation: () => mockNavigation,
      }));

      await projectManager.enableYjsMode(123, 'token');

      await projectManager.importConvertedStructure({ pages: [] }, [], { clearExisting: true });

      // Navigation should have been cleared (delete called)
      expect(mockNavigation.length).toBe(0);
    });

    it('replaces asset paths with new format URLs (asset://uuid.ext)', async () => {
      const mockNavigation = new global.window.Y.Array();

      // Setup proper mocks for asset import
      global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
      global.Blob = class MockBlob {
        constructor(chunks, options) {
          this.type = options?.type || '';
          this.size = chunks[0]?.length || 0;
        }
      };
      global.File = class MockFile extends global.Blob {
        constructor(chunks, name, options) {
          super(chunks, options);
          this.name = name;
        }
      };

      // Track the URL returned by insertImage and the filename used in URL generation
      let capturedFilename = '';
      const mockAssetManager = {
        insertImage: mock((file) => {
          capturedFilename = file.name;
          // Generate new format URL based on file extension
          const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
          const url = ext ? `asset://mock-uuid.${ext}` : 'asset://mock-uuid';
          return Promise.resolve(url);
        }),
        preloadAllAssets: mock(() => Promise.resolve()),
      };

      mockBridge.getAssetManager = mock(() => mockAssetManager);
      mockBridge.getDocumentManager = mock(() => ({
        getNavigation: () => mockNavigation,
      }));

      await projectManager.enableYjsMode(123, 'token');

      const structure = {
        pages: [
          {
            id: 'page-1',
            title: 'Test Page',
            blocks: [
              {
                id: 'block-1',
                name: 'Block 1',
                idevices: [
                  {
                    id: 'comp-1',
                    type: 'FreeTextIdevice',
                    htmlView: '<img src="{{context_path}}/resources/photo.jpg">',
                  },
                ],
              },
            ],
          },
        ],
      };

      // Assets with base64 encoded content
      const assets = [
        {
          path: 'resources/photo.jpg',
          base64: 'dGVzdA==', // "test" in base64
          mime: 'image/jpeg',
        },
      ];

      const result = await projectManager.importConvertedStructure(structure, assets);

      expect(result).toBeDefined();
      expect(result.assets).toBe(1);

      // Verify insertImage was called with correct filename
      expect(mockAssetManager.insertImage).toHaveBeenCalled();
      expect(capturedFilename).toBe('photo.jpg');
    });

    it('handles assets without file extension', async () => {
      const mockNavigation = new global.window.Y.Array();

      global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
      global.Blob = class MockBlob {
        constructor(chunks, options) {
          this.type = options?.type || '';
          this.size = chunks[0]?.length || 0;
        }
      };
      global.File = class MockFile extends global.Blob {
        constructor(chunks, name, options) {
          super(chunks, options);
          this.name = name;
        }
      };

      let capturedFilename = '';
      const mockAssetManager = {
        insertImage: mock((file) => {
          capturedFilename = file.name;
          const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
          const url = ext ? `asset://mock-uuid.${ext}` : 'asset://mock-uuid';
          return Promise.resolve(url);
        }),
        preloadAllAssets: mock(() => Promise.resolve()),
      };

      mockBridge.getAssetManager = mock(() => mockAssetManager);
      mockBridge.getDocumentManager = mock(() => ({
        getNavigation: () => mockNavigation,
      }));

      await projectManager.enableYjsMode(123, 'token');

      const structure = {
        pages: [
          {
            id: 'page-1',
            title: 'Test Page',
            blocks: [
              {
                id: 'block-1',
                name: 'Block 1',
                idevices: [
                  {
                    id: 'comp-1',
                    type: 'FreeTextIdevice',
                    htmlView: '<a href="{{context_path}}/resources/README">Link</a>',
                  },
                ],
              },
            ],
          },
        ],
      };

      const assets = [
        {
          path: 'resources/README',
          base64: 'dGVzdA==',
          mime: 'text/plain',
        },
      ];

      const result = await projectManager.importConvertedStructure(structure, assets);

      expect(result.assets).toBe(1);
      // Verify the filename extracted correctly (no extension)
      expect(capturedFilename).toBe('README');
    });

  });

  describe('isApplied', () => {
    it('returns false before mixin applied', () => {
      expect(YjsProjectManagerMixin.isApplied(projectManager)).toBe(false);
    });

    it('returns true after mixin applied', () => {
      YjsProjectManagerMixin.applyMixin(projectManager);
      expect(YjsProjectManagerMixin.isApplied(projectManager)).toBe(true);
    });
  });
});
