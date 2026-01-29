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

  describe('first page visibility toggle', () => {
    it('disables visibility checkbox for first page', () => {
      modal.isFirstPage = true;
      const prop = { type: 'checkbox', value: 'true' };
      const el = modal.makeRowValueElement('id', 'visibility', prop);
      const input = el.querySelector('input');
      expect(input.disabled).toBe(true);
      expect(input.checked).toBe(true);
    });

    it('keeps visibility checkbox enabled for non-first page', () => {
      modal.isFirstPage = false;
      const prop = { type: 'checkbox', value: 'false' };
      const el = modal.makeRowValueElement('id', 'visibility', prop);
      const input = el.querySelector('input');
      expect(input.disabled).toBe(false);
      expect(input.checked).toBe(false);
    });

    it('sets data-first-page-visibility attribute when disabled', () => {
      modal.isFirstPage = true;
      const prop = { type: 'checkbox', value: 'true' };
      const el = modal.makeRowValueElement('id', 'visibility', prop);
      expect(el.getAttribute('data-first-page-visibility')).toBe('true');
    });

    it('does not set data-first-page-visibility for non-visibility checkbox', () => {
      modal.isFirstPage = true;
      const prop = { type: 'checkbox', value: 'false' };
      const el = modal.makeRowValueElement('id', 'otherProperty', prop);
      expect(el.getAttribute('data-first-page-visibility')).toBeNull();
    });

    it('sets cursor to not-allowed when toggle is disabled', () => {
      modal.isFirstPage = true;
      const properties = {
        visibility: { title: 'Visibility', type: 'checkbox', value: 'true', category: 'C1' }
      };
      const body = modal.makeBodyElement(properties);
      const item = body.querySelector('.toggle-item');
      expect(item.style.cursor).toBe('not-allowed');
    });

    it('does not toggle checkbox when clicking disabled item', () => {
      modal.isFirstPage = true;
      const properties = {
        visibility: { title: 'Visibility', type: 'checkbox', value: 'true', category: 'C1' }
      };
      modal.setBodyElement(modal.makeBodyElement(properties));
      const input = modal.modalElementBody.querySelector('.toggle-input');
      const item = modal.modalElementBody.querySelector('.toggle-item');

      // Simulate click
      item.click();

      // Should still be checked (disabled, so click has no effect on toggle)
      expect(input.checked).toBe(true);
    });

    it('shows toast when clicking disabled visibility toggle for first page', () => {
      const mockToast = vi.fn();
      window.eXeLearning = {
        app: {
          common: {
            generateId: vi.fn().mockReturnValue('123'),
          },
          toasts: {
            createToast: mockToast,
          },
        },
      };

      modal.isFirstPage = true;
      const properties = {
        visibility: { title: 'Visibility', type: 'checkbox', value: 'true', category: 'C1' }
      };
      modal.setBodyElement(modal.makeBodyElement(properties));
      const item = modal.modalElementBody.querySelector('.toggle-item');

      // Simulate click
      item.click();

      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        icon: 'info',
      }));
    });
  });

  describe('show with isFirstPage', () => {
    it('sets isFirstPage from data parameter', () => {
      vi.useFakeTimers();
      modal.show({ isFirstPage: true, properties: {} });
      vi.advanceTimersByTime(500);
      expect(modal.isFirstPage).toBe(true);
      vi.useRealTimers();
    });

    it('defaults isFirstPage to false when not provided', () => {
      vi.useFakeTimers();
      modal.show({ properties: {} });
      vi.advanceTimersByTime(500);
      expect(modal.isFirstPage).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('_showFirstPageVisibilityToast', () => {
    it('calls toast with correct parameters', () => {
      const mockToast = vi.fn();
      window.eXeLearning = {
        app: {
          common: {
            generateId: vi.fn().mockReturnValue('123'),
          },
          toasts: {
            createToast: mockToast,
          },
        },
      };

      modal._showFirstPageVisibilityToast();

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Visible in export',
        body: 'The first page is always visible in the export',
        icon: 'info',
        remove: 4000,
      });
    });

    it('does nothing when toast system is not available', () => {
      window.eXeLearning = {
        app: {
          common: {
            generateId: vi.fn().mockReturnValue('123'),
          },
        },
      };

      // Should not throw
      expect(() => modal._showFirstPageVisibilityToast()).not.toThrow();
    });
  });
});
