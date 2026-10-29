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

    it('should create checkbox (toggle) from boolean true value', () => {
      const prop = { type: 'checkbox', value: true };
      const el = modal.makeRowValueElement('id', 'name', prop);
      expect(el.querySelector('input').checked).toBe(true);
    });

    it('should create checkbox (toggle) from boolean false value', () => {
      const prop = { type: 'checkbox', value: false };
      const el = modal.makeRowValueElement('id', 'name', prop);
      expect(el.querySelector('input').checked).toBe(false);
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

    it('should create a checkbox list with the selected options checked', () => {
      const prop = {
        type: 'multiselect',
        value: ['es', 'fr'],
        options: { 'en-US': 'English', es: 'Spanish', fr: 'French' },
      };
      const el = modal.makeRowValueElement('id', 'name', prop);

      expect(el.getAttribute('data-type')).toBe('multiselect');
      expect(el.querySelector('.multiselect-mode')).toBeNull();
      const list = el.querySelector('.multiselect-options');
      expect(list.id).toBe('id');
      expect(list.hidden).toBe(false);
      expect(Array.from(list.querySelectorAll('.multiselect-option:checked'), input => input.value)).toEqual(['es', 'fr']);
      const firstInput = list.querySelector('.multiselect-option');
      expect(list.querySelector(`label[for="${firstInput.id}"]`).textContent).toBe('English');
    });

    describe('with a System default option', () => {
      const makeProperty = (value) => ({
        type: 'multiselect',
        title: 'Spell checker languages',
        value,
        customLabel: 'Choose languages',
        options: { __system_default__: 'System default', es: 'Spanish', fr: 'French' },
      });

      it('chooses between the default and the list with a select labelled by the row', () => {
        const el = modal.makeRowValueElement('id', 'name', makeProperty(['__system_default__']));
        const mode = el.querySelector('.multiselect-mode');
        const list = el.querySelector('.multiselect-options');

        expect(mode.id).toBe('id');
        expect(Array.from(mode.options, option => option.textContent)).toEqual(['System default', 'Choose languages']);
        expect(mode.value).toBe('__system_default__');
        expect(mode.getAttribute('aria-controls')).toBe(list.id);
        expect(list.hidden).toBe(true);
        expect(list.querySelector('.multiselect-option[value="__system_default__"]')).toBeNull();
      });

      it('falls back to a generic label for the custom choice', () => {
        const { customLabel, ...property } = makeProperty([]);
        const el = modal.makeRowValueElement('id', 'name', property);
        expect(el.querySelector('.multiselect-mode option[value="custom"]').textContent).toBe('Choose');
      });

      it('shows the list only while choosing languages', () => {
        const el = modal.makeRowValueElement('id', 'name', makeProperty(['es']));
        const mode = el.querySelector('.multiselect-mode');
        const list = el.querySelector('.multiselect-options');
        expect(mode.value).toBe('custom');
        expect(list.hidden).toBe(false);

        mode.value = '__system_default__';
        mode.dispatchEvent(new Event('change'));
        expect(list.hidden).toBe(true);

        mode.value = 'custom';
        mode.dispatchEvent(new Event('change'));
        expect(list.hidden).toBe(false);
      });

      it('offers only the System default when there are no languages to choose, keeping the saved ones', () => {
        const property = { ...makeProperty(['es']), options: { __system_default__: 'System default' } };
        const el = modal.makeRowValueElement('id', 'name', property);
        const mode = el.querySelector('.multiselect-mode');
        expect(Array.from(mode.options, option => option.value)).toEqual(['__system_default__']);
        expect(mode.value).toBe('__system_default__');
        expect(el.querySelector('.multiselect-options').hidden).toBe(true);
        expect(modal.getMultiSelectValue(el)).toEqual(['es']);
      });

      it('treats an empty value as the System default', () => {
        const el = modal.makeRowValueElement('id', 'name', makeProperty([]));
        expect(el.querySelector('.multiselect-mode').value).toBe('__system_default__');
      });

      it('hides other help texts when the select is focused', () => {
        const spy = vi.spyOn(modal, 'hideHelpContentAll').mockImplementation(() => {});
        const el = modal.makeRowValueElement('id', 'name', makeProperty([]));
        el.querySelector('.multiselect-mode').dispatchEvent(new Event('focus'));
        expect(spy).toHaveBeenCalledTimes(1);
        el.querySelector('.multiselect-option').dispatchEvent(new Event('focus'));
        expect(spy).toHaveBeenCalledTimes(2);
      });
    });

    it('labels a checkbox group without System default through the row label', () => {
      const row = modal.makeRowElement('languages', {
        type: 'multiselect',
        title: 'Languages',
        value: [],
        options: { es: 'Spanish' },
      });
      const label = row.querySelector(':scope > label');
      const list = row.querySelector('.multiselect-options');

      expect(label.hasAttribute('for')).toBe(false);
      expect(list.getAttribute('aria-labelledby')).toBe(label.id);
      expect(list.hasAttribute('aria-label')).toBe(false);
    });

    it('keeps the row label on the mode select when there is a System default', () => {
      const row = modal.makeRowElement('languages', {
        type: 'multiselect',
        title: 'Languages',
        value: [],
        customLabel: 'Choose languages',
        options: { __system_default__: 'System default', es: 'Spanish' },
      });

      expect(row.querySelector(':scope > label').getAttribute('for')).toBe(row.querySelector('.multiselect-mode').id);
    });

    it('renders a dynamically added preference in the existing category', () => {
      const properties = {
        locale: { title: 'Language', type: 'select', value: 'en', options: { en: 'English' }, category: 'General settings' },
        spellCheckerLanguages: { title: 'Spell checker languages', type: 'multiselect', value: ['es'], options: { es: 'es' }, category: 'General settings' },
      };
      const body = modal.makeBodyElement(properties);
      expect(modal.getListCategories(properties)).toEqual(['General settings']);
      expect(body.querySelector('[property="spellCheckerLanguages"]')).not.toBeNull();
      expect(body.querySelector('[category="undefined"]')).toBeNull();
    });
  });

  describe('getModalPropertiesData', () => {
    const multiselect = (value) =>
      modal.makeMultiSelectElement('id', 'languages', {
        type: 'multiselect',
        title: 'Languages',
        value,
        customLabel: 'Choose languages',
        options: { __system_default__: 'System default', 'en-US': 'English', es: 'Spanish', fr: 'French' },
      });

    it('should collect the checked languages', () => {
      modal.modalElementBody.replaceChildren(multiselect(['en-US', 'fr']));

      expect(modal.getModalPropertiesData()).toEqual({ languages: ['en-US', 'fr'] });
    });

    it('should save the System default when it is chosen, whatever is checked', () => {
      const el = multiselect(['es']);
      const mode = el.querySelector('.multiselect-mode');
      mode.value = '__system_default__';
      mode.dispatchEvent(new Event('change', { bubbles: true }));
      modal.modalElementBody.replaceChildren(el);

      expect(modal.getModalPropertiesData()).toEqual({ languages: ['__system_default__'] });
    });

    it('should save the System default when choosing languages but none is checked', () => {
      const el = multiselect(['es']);
      const option = el.querySelector('.multiselect-option[value="es"]');
      option.checked = false;
      option.dispatchEvent(new Event('change', { bubbles: true }));
      modal.modalElementBody.replaceChildren(el);

      expect(modal.getModalPropertiesData()).toEqual({ languages: ['__system_default__'] });
    });

    it('should keep saved languages that are no longer listed while the field is unchanged', () => {
      modal.modalElementBody.replaceChildren(multiselect(['es', 'de']));

      expect(modal.getModalPropertiesData()).toEqual({ languages: ['es', 'de'] });
    });

    it('should drop languages that are no longer listed once the field changes', () => {
      const el = multiselect(['es', 'de']);
      const option = el.querySelector('.multiselect-option[value="fr"]');
      option.checked = true;
      option.dispatchEvent(new Event('change', { bubbles: true }));
      modal.modalElementBody.replaceChildren(el);

      expect(modal.getModalPropertiesData()).toEqual({ languages: ['es', 'fr'] });
    });

    it('should save an empty list when there is no System default option', () => {
      const el = modal.makeMultiSelectElement('id', 'languages', {
        type: 'multiselect',
        title: 'Languages',
        value: [],
        options: { es: 'Spanish' },
      });
      modal.modalElementBody.replaceChildren(el);

      expect(modal.getModalPropertiesData()).toEqual({ languages: [] });
    });

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
