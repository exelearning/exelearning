import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalProperties from './modalProperties.js';

describe('ModalProperties', () => {
  let modal;
  let mockManager;
  let mockElement;
  let mockBootstrapModal;

  beforeEach(() => {
    // Mock translation function
    window._ = vi.fn((key) => key);
    
    // Mock eXeLearning global
    window.eXeLearning = {
      app: {
        modals: {
          alert: {
            show: vi.fn(),
          },
        },
        project: {
          _yjsBridge: {
            lockManager: {
              requestLock: vi.fn(() => true),
              releaseLock: vi.fn(),
              refreshLock: vi.fn(),
              getLockInfo: vi.fn(() => ({ user: { name: 'Remote User' } })),
            },
          },
        },
        common: {
          generateId: vi.fn().mockReturnValue('123'),
        },
        interface: {
          connectionTime: {
            loadLasUpdatedInInterface: vi.fn(),
          }
        },
      },
    };

    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'modalProperties';
    mockElement.innerHTML = `
      <div class="modal-header">
        <h5 class="modal-title"></h5>
      </div>
      <div class="modal-body"></div>
      <div class="modal-footer">
        <button class="btn btn-primary">Save</button>
        <button class="close btn btn-secondary">Cancel</button>
      </div>
    `;
    document.body.appendChild(mockElement);

    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'modalProperties') return mockElement;
      return null;
    });

    // Mock bootstrap.Modal
    mockBootstrapModal = {
      show: vi.fn(),
      hide: vi.fn(),
    };
    window.bootstrap = {
      Modal: vi.fn().mockImplementation(function() {
        return mockBootstrapModal;
      }),
    };

    // Mock interact
    const mockInteractable = {
      draggable: vi.fn().mockReturnThis(),
    };
    window.interact = vi.fn().mockImplementation(() => mockInteractable);
    window.interact.modifiers = {
      restrictRect: vi.fn(),
    };

    mockManager = {
      closeModals: vi.fn(() => false),
    };

    modal = new ModalProperties(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('show', () => {
    it('should set title and generate body', () => {
      vi.useFakeTimers();
      const properties = {
        prop1: { title: 'Prop 1', type: 'text', value: 'val1', category: 'Cat 1' }
      };
      modal.show({ properties });
      vi.advanceTimersByTime(500);
      
      expect(mockElement.querySelector('.modal-title').innerHTML).toBe('Preferences');
      expect(mockElement.querySelector('.property-row')).not.toBeNull();
      vi.useRealTimers();
    });
  });

  describe('makeBodyElement', () => {
    it('should generate categories and properties', () => {
      const properties = {
        p1: { title: 'P1', type: 'text', value: 'v1', category: 'C1' },
        p2: { title: 'P2', type: 'text', value: 'v2', category: 'C2' }
      };
      const body = modal.makeBodyElement(properties);
      expect(body.querySelector('.exe-form-tabs')).not.toBeNull();
      expect(body.querySelectorAll('.property-row').length).toBe(2);
    });

    it('should handle groups', () => {
      const properties = {
        p1: { 
            title: 'P1', 
            type: 'text', 
            value: 'v1', 
            category: 'C1',
            groups: { g1: 'Group 1' }
        }
      };
      const body = modal.makeBodyElement(properties);
      expect(body.querySelector('.properties-group')).not.toBeNull();
      expect(body.querySelector('.properties-group-title').innerHTML).toBe('Group 1');
    });
  });

  describe('makeRowValueElement', () => {
    it('should create text input', () => {
      const prop = { type: 'text', value: 'test' };
      const el = modal.makeRowValueElement('id', 'name', prop);
      expect(el.tagName).toBe('INPUT');
      expect(el.value).toBe('test');
    });

    it('should create checkbox (toggle)', () => {
      const prop = { type: 'checkbox', value: 'true' };
      const el = modal.makeRowValueElement('id', 'name', prop);
      expect(el.classList.contains('toggle-item')).toBe(true);
      expect(el.querySelector('input').checked).toBe(true);
    });

    it('should create select with options', () => {
        const prop = { 
            type: 'select', 
            value: 'v2', 
            options: { v1: 'Opt 1', v2: 'Opt 2' } 
        };
        const el = modal.makeRowValueElement('id', 'name', prop);
        expect(el.tagName).toBe('SELECT');
        expect(el.querySelectorAll('option').length).toBe(2);
        expect(el.value).toBe('v2');
    });
  });

  describe('getModalPropertiesData', () => {
    it('should collect data from inputs', () => {
      const properties = {
        p1: { title: 'P1', type: 'text', value: 'v1', category: 'C1' },
        p2: { title: 'P2', type: 'checkbox', value: 'false', category: 'C1' }
      };
      modal.setBodyElement(modal.makeBodyElement(properties));
      
      const data = modal.getModalPropertiesData();
      expect(data.p1).toBe('v1');
      expect(data.p2).toBe('false');
    });
  });

  describe('saveAction', () => {
    it('should call apiSaveProperties on node', async () => {
      const mockNode = {
        apiSaveProperties: vi.fn().mockResolvedValue({ responseMessage: 'OK' })
      };
      modal.node = mockNode;
      const properties = {
        p1: { title: 'P1', type: 'text', value: 'v1', category: 'C1' }
      };
      modal.setBodyElement(modal.makeBodyElement(properties));
      
      await modal.saveAction();
      expect(mockNode.apiSaveProperties).toHaveBeenCalled();
    });
  });

  describe('page-properties locking', () => {
    it('acquires lock when opening page-properties modal', () => {
      vi.useFakeTimers();
      const node = {
        id: 'page-1',
        constructor: { name: 'StructureNode' },
        apiSaveProperties: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      };
      const properties = {
        p1: { title: 'P1', type: 'text', value: 'v1', category: 'C1' }
      };

      modal.show({ node, contentId: 'page-properties', properties });
      vi.advanceTimersByTime(500);

      expect(window.eXeLearning.app.project._yjsBridge.lockManager.requestLock)
        .toHaveBeenCalledWith('page-properties:page-1');
      expect(mockBootstrapModal.show).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('does not open page-properties modal when already locked by another user', () => {
      vi.useFakeTimers();
      window.eXeLearning.app.project._yjsBridge.lockManager.requestLock = vi.fn(() => false);
      const node = {
        id: 'page-1',
        constructor: { name: 'StructureNode' },
        apiSaveProperties: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      };

      modal.show({ node, contentId: 'page-properties', properties: {} });
      vi.advanceTimersByTime(500);

      expect(mockBootstrapModal.show).not.toHaveBeenCalled();
      expect(window.eXeLearning.app.modals.alert.show).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('releases page-properties lock on confirm', async () => {
      vi.useFakeTimers();
      const node = {
        id: 'page-1',
        constructor: { name: 'StructureNode' },
        apiSaveProperties: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      };
      const properties = {
        p1: { title: 'P1', type: 'text', value: 'v1', category: 'C1' }
      };

      modal.show({ node, contentId: 'page-properties', properties });
      vi.advanceTimersByTime(500);
      await modal.confirm();

      expect(window.eXeLearning.app.project._yjsBridge.lockManager.releaseLock)
        .toHaveBeenCalledWith('page-properties:page-1');
      vi.useRealTimers();
    });

    it('acquires lock when opening block-properties modal', () => {
      vi.useFakeTimers();
      const node = {
        blockId: 'block-1',
        apiSaveProperties: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      };
      const properties = {
        p1: { title: 'P1', type: 'text', value: 'v1', category: 'C1' }
      };

      modal.show({ node, contentId: 'block-properties', properties });
      vi.advanceTimersByTime(500);

      expect(window.eXeLearning.app.project._yjsBridge.lockManager.requestLock)
        .toHaveBeenCalledWith('block-properties:block-1');
      expect(mockBootstrapModal.show).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('acquires lock when opening idevice-properties modal', () => {
      vi.useFakeTimers();
      const node = {
        odeIdeviceId: 'idevice-1',
        apiSaveProperties: vi.fn().mockResolvedValue({ responseMessage: 'OK' }),
      };
      const properties = {
        p1: { title: 'P1', type: 'text', value: 'v1', category: 'C1' }
      };

      modal.show({ node, contentId: 'idevice-properties', properties });
      vi.advanceTimersByTime(500);

      expect(window.eXeLearning.app.project._yjsBridge.lockManager.requestLock)
        .toHaveBeenCalledWith('idevice-properties:idevice-1');
      expect(mockBootstrapModal.show).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });
});
