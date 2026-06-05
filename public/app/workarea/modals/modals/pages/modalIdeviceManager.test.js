/**
 * ModalIdeviceManager Class Tests
 *
 * Unit tests for the ModalIdeviceManager class that handles iDevice management modal.
 *
 * Run with: make test-frontend
 */

import ModalIdeviceManager from './modalIdeviceManager.js';
import Modal from '../modal.js';

vi.mock('../modal.js');

describe('ModalIdeviceManager', () => {
  let modalIdeviceManager;
  let mockManager;
  let modalElement;
  let mockBootstrapModal;
  let mockDB;
  let mockTransaction;
  let mockStore;

  beforeEach(() => {
    // Mock translation function
    window._ = vi.fn((text) => text);

    // Mock interact.js
    window.interact = vi.fn(() => ({
      draggable: vi.fn().mockReturnThis(),
    }));
    window.interact.modifiers = {
      restrictRect: vi.fn(),
    };

    // Create modal DOM structure
    modalElement = document.createElement('div');
    modalElement.id = 'modalIdeviceManager';
    modalElement.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"></h5>
        </div>
        <div class="modal-body">
          <div class="modal-body-content"></div>
          <div class="alert alert-danger">
            <span class="text"></span>
            <button class="close-alert">X</button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="confirm btn btn-primary">Confirm</button>
          <button class="close btn btn-secondary">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalElement);

    // Mock Bootstrap Modal
    mockBootstrapModal = {
      show: vi.fn(),
      hide: vi.fn(),
      _isShown: false,
    };
    window.bootstrap = {
      Modal: function () {
        return mockBootstrapModal;
      },
    };

    // Mock manager
    mockManager = {
      closeModals: vi.fn().mockReturnValue(false),
    };

    // Mock IndexedDB
    mockStore = {
      put: vi.fn(),
      get: vi.fn(() => ({
        onsuccess: null,
        onerror: null,
        result: { id: 'testuser', value: ['text', 'form'] },
      })),
    };

    mockTransaction = {
      objectStore: vi.fn(() => mockStore),
      complete: Promise.resolve(),
    };

    mockDB = {
      transaction: vi.fn(() => mockTransaction),
      objectStoreNames: {
        contains: vi.fn(() => false),
      },
      createObjectStore: vi.fn(),
    };

    global.indexedDB = {
      open: vi.fn(() => ({
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      })),
    };

    // Mock eXeLearning global
    window.eXeLearning = {
      app: {
        api: {
          parameters: {
            ideviceInfoFieldsConfig: {
              name: true,
              title: true,
              type: true,
            },
          },
          putSaveUserPreferences: vi.fn().mockResolvedValue({}),
          postUploadIdevice: vi.fn().mockResolvedValue({
            responseMessage: 'OK',
            idevice: {
              name: 'test-idevice',
              title: 'Test iDevice',
              type: 'user',
            },
          }),
          deleteIdeviceInstalled: vi.fn().mockResolvedValue({
            responseMessage: 'OK',
            deleted: { name: 'test-idevice' },
          }),
        },
        user: {
          name: 'testuser',
          preferences: {
            setPreferences: vi.fn(),
          },
        },
        menus: {
          menuIdevices: {
            compose: vi.fn(),
            behaviour: vi.fn(),
            menuIdevicesBottomContent: {
              innerHTML: '',
            },
            menuIdevicesBottom: {
              init: vi.fn(),
            },
          },
        },
        project: {
          idevices: {
            behaviour: vi.fn(),
          },
        },
        idevices: {
          selectIdevice: vi.fn(),
          list: {
            installed: {},
          },
        },
      },
      config: {
        ideviceVisibilityPreferencePre: 'idevice_visibility_',
        ideviceTypeBase: 'base',
        ideviceTypeUser: 'user',
        isOfflineInstallation: false,
        userIdevices: true,
      },
    };

    // Mock FileReader
    global.FileReader = vi.fn(function () {
      this.readAsDataURL = vi.fn();
      this.onload = null;
    });

    // Initialize Modal mock implementation
    Modal.mockImplementation(function (manager, id, titleDefault, clearAfterClose) {
      this.manager = manager;
      this.id = id;
      this.titleDefault = titleDefault;
      this.clearAfterClose = clearAfterClose;
      this.modalElement = document.getElementById(id);
      this.modalElementHeader = this.modalElement.querySelector('.modal-header');
      this.modalElementTitle = this.modalElement.querySelector('.modal-title');
      this.modalElementBody = this.modalElement.querySelector('.modal-body');
      this.modalElementButtonsConfirm = this.modalElement.querySelectorAll('.confirm');
      this.modalElementButtonsClose = this.modalElement.querySelectorAll('.close');
      this.modal = mockBootstrapModal;
      this.timeMax = 500;
      this.timeMin = 50;
      this.addBehaviourExeTabs = vi.fn();
      this.setTitle = vi.fn();
      this.setConfirmExec = vi.fn();
      return this;
    });

    modalIdeviceManager = new ModalIdeviceManager(mockManager);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    delete window._;
    delete window.interact;
    delete window.bootstrap;
    delete window.eXeLearning;
    delete global.indexedDB;
    delete global.FileReader;
  });

  describe('constructor', () => {
    it('should call parent Modal constructor with correct parameters', () => {
      expect(Modal).toHaveBeenCalledWith(mockManager, 'modalIdeviceManager', undefined, false);
    });

    it('should set modalElementBodyContent reference', () => {
      expect(modalIdeviceManager.modalElementBodyContent).toBeDefined();
      expect(modalIdeviceManager.modalElementBodyContent.className).toBe('modal-body-content');
    });

    it('should set modalFooter reference', () => {
      expect(modalIdeviceManager.modalFooter).toBeDefined();
      expect(modalIdeviceManager.modalFooter.className).toBe('modal-footer');
    });

    it('should set confirmButton reference', () => {
      expect(modalIdeviceManager.confirmButton).toBeDefined();
      expect(modalIdeviceManager.confirmButton.classList.contains('btn-primary')).toBe(true);
    });

    it('should set cancelButton reference', () => {
      expect(modalIdeviceManager.cancelButton).toBeDefined();
      expect(modalIdeviceManager.cancelButton.classList.contains('btn-secondary')).toBe(true);
    });

    it('should set modalElementAlert reference', () => {
      expect(modalIdeviceManager.modalElementAlert).toBeDefined();
      expect(modalIdeviceManager.modalElementAlert.classList.contains('alert-danger')).toBe(true);
    });

    it('should set modalElementAlertText reference', () => {
      expect(modalIdeviceManager.modalElementAlertText).toBeDefined();
      expect(modalIdeviceManager.modalElementAlertText.className).toBe('text');
    });

    it('should set modalElementAlertCloseButton reference', () => {
      expect(modalIdeviceManager.modalElementAlertCloseButton).toBeDefined();
      expect(modalIdeviceManager.modalElementAlertCloseButton.className).toBe('close-alert');
    });

    it('should initialize readers array', () => {
      expect(modalIdeviceManager.readers).toEqual([]);
    });

    it('should call addBehaviourButtonCloseAlert', () => {
      const spy = vi.spyOn(ModalIdeviceManager.prototype, 'addBehaviourButtonCloseAlert');
      new ModalIdeviceManager(mockManager);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('button visibility methods', () => {
    describe('hideConfirmButtonText', () => {
      it('should set confirm button display to none', () => {
        modalIdeviceManager.hideConfirmButtonText();
        expect(modalIdeviceManager.confirmButton.style.display).toBe('none');
      });
    });

    describe('showConfirmButtonText', () => {
      it('should set confirm button display to flex', () => {
        modalIdeviceManager.showConfirmButtonText();
        expect(modalIdeviceManager.confirmButton.style.display).toBe('flex');
      });
    });

    describe('hideCancelButtonText', () => {
      it('should set cancel button display to none', () => {
        modalIdeviceManager.hideCancelButtonText();
        expect(modalIdeviceManager.cancelButton.style.display).toBe('none');
      });
    });

    describe('showCancelButtonText', () => {
      it('should set cancel button display to flex', () => {
        modalIdeviceManager.showCancelButtonText();
        expect(modalIdeviceManager.cancelButton.style.display).toBe('flex');
      });
    });
  });

  describe('generateButtonBack', () => {
    it('should create back button element', () => {
      const button = modalIdeviceManager.generateButtonBack();
      expect(button.tagName).toBe('BUTTON');
    });

    it('should add correct classes to back button', () => {
      const button = modalIdeviceManager.generateButtonBack();
      expect(button.classList.contains('back')).toBe(true);
      expect(button.classList.contains('btn')).toBe(true);
      expect(button.classList.contains('btn-secondary')).toBe(true);
    });

    it('should set button type to button', () => {
      const button = modalIdeviceManager.generateButtonBack();
      expect(button.getAttribute('type')).toBe('button');
    });

    it('should set button text from translation', () => {
      const button = modalIdeviceManager.generateButtonBack();
      expect(button.innerHTML).toBe('Back');
      expect(window._).toHaveBeenCalledWith('Back');
    });

    it('should add click event listener', () => {
      modalIdeviceManager.idevices = {
        installed: { text: { name: 'text', title: 'Text', type: 'base' } },
      };
      vi.spyOn(modalIdeviceManager, 'setBodyElement').mockImplementation(() => {});
      const button = modalIdeviceManager.generateButtonBack();
      const spy = vi.spyOn(modalIdeviceManager, 'backExecEvent');
      button.click();
      expect(spy).toHaveBeenCalled();
    });

    it('should append button to modal footer', () => {
      const button = modalIdeviceManager.generateButtonBack();
      expect(modalIdeviceManager.modalFooter.contains(button)).toBe(true);
    });

    it('should return the button element', () => {
      const button = modalIdeviceManager.generateButtonBack();
      expect(button).toBe(modalIdeviceManager.buttonBack);
    });
  });

  describe('removeButtonBack', () => {
    it('should remove button if it exists', () => {
      modalIdeviceManager.generateButtonBack();
      expect(modalIdeviceManager.buttonBack).toBeDefined();
      modalIdeviceManager.removeButtonBack();
      expect(modalIdeviceManager.modalFooter.contains(modalIdeviceManager.buttonBack)).toBe(false);
    });

    it('should not throw if button does not exist', () => {
      expect(() => modalIdeviceManager.removeButtonBack()).not.toThrow();
    });
  });

  describe('backExecEvent', () => {
    beforeEach(() => {
      modalIdeviceManager.idevices = {
        installed: { text: { name: 'text', title: 'Text', type: 'base' } },
      };
    });

    it('should call setBodyElement with makeBodyElement result', () => {
      const spy = vi.spyOn(modalIdeviceManager, 'setBodyElement');
      const makeBodySpy = vi.spyOn(modalIdeviceManager, 'makeBodyElement').mockReturnValue(document.createElement('div'));
      modalIdeviceManager.backExecEvent();
      expect(makeBodySpy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalled();
    });

    it('should call addBehaviourExeTabs', () => {
      vi.spyOn(modalIdeviceManager, 'makeBodyElement').mockReturnValue(document.createElement('div'));
      vi.spyOn(modalIdeviceManager, 'setBodyElement');
      modalIdeviceManager.backExecEvent();
      expect(modalIdeviceManager.addBehaviourExeTabs).toHaveBeenCalled();
    });

    it('should call clickSelectedTab', () => {
      vi.spyOn(modalIdeviceManager, 'makeBodyElement').mockReturnValue(document.createElement('div'));
      vi.spyOn(modalIdeviceManager, 'setBodyElement');
      const spy = vi.spyOn(modalIdeviceManager, 'clickSelectedTab');
      modalIdeviceManager.backExecEvent();
      expect(spy).toHaveBeenCalled();
    });

    it('should call showButtonsConfirmCancel', () => {
      vi.spyOn(modalIdeviceManager, 'makeBodyElement').mockReturnValue(document.createElement('div'));
      vi.spyOn(modalIdeviceManager, 'setBodyElement');
      const spy = vi.spyOn(modalIdeviceManager, 'showButtonsConfirmCancel');
      modalIdeviceManager.backExecEvent();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('showButtonsConfirmCancel', () => {
    it('should call removeButtonBack', () => {
      const spy = vi.spyOn(modalIdeviceManager, 'removeButtonBack');
      modalIdeviceManager.showButtonsConfirmCancel();
      expect(spy).toHaveBeenCalled();
    });

    it('should call showConfirmButtonText', () => {
      const spy = vi.spyOn(modalIdeviceManager, 'showConfirmButtonText');
      modalIdeviceManager.showButtonsConfirmCancel();
      expect(spy).toHaveBeenCalled();
    });

    it('should call showCancelButtonText', () => {
      const spy = vi.spyOn(modalIdeviceManager, 'showCancelButtonText');
      modalIdeviceManager.showButtonsConfirmCancel();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('clickSelectedTab', () => {
    it('should click the selected tab link if exists', () => {
      const link = document.createElement('a');
      link.href = '#test-tab';
      link.click = vi.fn();
      modalIdeviceManager.modalElementBody.appendChild(link);
      modalIdeviceManager.tabSelectedLink = '#test-tab';
      modalIdeviceManager.clickSelectedTab();
      expect(link.click).toHaveBeenCalled();
    });

    it('should not throw if tabSelectedLink is null', () => {
      modalIdeviceManager.tabSelectedLink = null;
      expect(() => modalIdeviceManager.clickSelectedTab()).not.toThrow();
    });

    it('should throw if tabSelectedLink is set but link does not exist', () => {
      modalIdeviceManager.tabSelectedLink = '#nonexistent';
      expect(() => modalIdeviceManager.clickSelectedTab()).toThrow();
    });
  });

  describe('show', () => {
    let idevices;

    beforeEach(() => {
      vi.useFakeTimers();
      idevices = {
        installed: {
          text: { name: 'text', title: 'Text', type: 'base' },
          userIdevice: { name: 'userIdevice', title: 'User iDevice', type: 'user' },
        },
      };
      vi.spyOn(modalIdeviceManager, 'makeBodyElement').mockReturnValue(document.createElement('div'));
      vi.spyOn(modalIdeviceManager, 'setBodyElement');
      vi.spyOn(modalIdeviceManager, 'showButtonsConfirmCancel');
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should set titleDefault', () => {
      modalIdeviceManager.show(idevices);
      expect(modalIdeviceManager.titleDefault).toBe('iDevice manager');
    });

    it('should copy ideviceInfoFieldsConfig', () => {
      modalIdeviceManager.show(idevices);
      expect(modalIdeviceManager.paramsInfo).toEqual({
        name: true,
        title: true,
        type: true,
      });
    });

    it('should set idevices if provided', () => {
      modalIdeviceManager.show(idevices);
      expect(modalIdeviceManager.idevices).toBe(idevices);
    });

    it('should call getBaseIdevices', () => {
      const spy = vi.spyOn(modalIdeviceManager, 'getBaseIdevices');
      modalIdeviceManager.show(idevices);
      expect(spy).toHaveBeenCalledWith(idevices.installed);
    });

    it('should call getUserIdevices', () => {
      const spy = vi.spyOn(modalIdeviceManager, 'getUserIdevices');
      modalIdeviceManager.show(idevices);
      expect(spy).toHaveBeenCalledWith(idevices.installed);
    });

    it('should call makeBodyElement', () => {
      modalIdeviceManager.show(idevices);
      expect(modalIdeviceManager.makeBodyElement).toHaveBeenCalled();
    });

    it('should call manager.closeModals', () => {
      modalIdeviceManager.show(idevices);
      expect(mockManager.closeModals).toHaveBeenCalled();
    });

    it('should call modal.show after timeout', () => {
      modalIdeviceManager.show(idevices);
      vi.advanceTimersByTime(100);
      expect(mockBootstrapModal.show).toHaveBeenCalled();
    });

    it('should remove show class from alert if idevices provided', () => {
      modalIdeviceManager.modalElementAlert.classList.add('show');
      modalIdeviceManager.show(idevices);
      vi.advanceTimersByTime(100);
      expect(modalIdeviceManager.modalElementAlert.classList.contains('show')).toBe(false);
    });
  });

  describe('setBodyElement', () => {
    it('should clear modal body content innerHTML', () => {
      modalIdeviceManager.modalElementBodyContent.innerHTML = '<div>test</div>';
      const element = document.createElement('div');
      modalIdeviceManager.setBodyElement(element);
      expect(modalIdeviceManager.modalElementBodyContent.innerHTML).not.toContain('test');
    });

    it('should append new body element', () => {
      const element = document.createElement('div');
      element.id = 'test-element';
      modalIdeviceManager.setBodyElement(element);
      expect(modalIdeviceManager.modalElementBodyContent.contains(element)).toBe(true);
    });
  });

  describe('saveIdevicesVisibility', () => {
    beforeEach(() => {
      modalIdeviceManager.modalElementBody.innerHTML = `
        <div class="idevice-row">
          <div class="idevice-visible">
            <input type="checkbox" checked idevice="text" />
          </div>
        </div>
        <div class="idevice-row">
          <div class="idevice-visible">
            <input type="checkbox" idevice="form" />
          </div>
        </div>
      `;
      modalIdeviceManager.idevicesBase = {
        text: { name: 'text', visible: false },
      };
      modalIdeviceManager.idevicesUser = {
        form: { name: 'form', visible: true },
      };
      // Add both idevices to global installed list
      eXeLearning.app.idevices.list.installed = {
        text: { name: 'text', visible: false },
        form: { name: 'form', visible: true },
      };
    });

    it('should collect idevice visibility preferences', () => {
      modalIdeviceManager.saveIdevicesVisibility();
      expect(eXeLearning.app.api.putSaveUserPreferences).toHaveBeenCalledWith({
        'idevice_visibility_text': true,
        'idevice_visibility_form': false,
      });
    });

    it('should update idevice visibility in idevicesBase', () => {
      modalIdeviceManager.saveIdevicesVisibility();
      expect(modalIdeviceManager.idevicesBase.text.visible).toBe(true);
    });

    it('should update preferences on API success', async () => {
      const response = { preference1: 'value1' };
      eXeLearning.app.api.putSaveUserPreferences.mockResolvedValue(response);
      await modalIdeviceManager.saveIdevicesVisibility();
      expect(eXeLearning.app.user.preferences.setPreferences).toHaveBeenCalledWith(response);
    });

    it('should recompose idevices menu', async () => {
      await modalIdeviceManager.saveIdevicesVisibility();
      expect(eXeLearning.app.menus.menuIdevices.compose).toHaveBeenCalled();
    });

    it('should call menu behaviour', async () => {
      await modalIdeviceManager.saveIdevicesVisibility();
      expect(eXeLearning.app.menus.menuIdevices.behaviour).toHaveBeenCalled();
    });

    it('should call project idevices behaviour', async () => {
      await modalIdeviceManager.saveIdevicesVisibility();
      expect(eXeLearning.app.project.idevices.behaviour).toHaveBeenCalled();
    });
  });

  describe('getBaseIdevices', () => {
    it('should filter base idevices', () => {
      const idevices = {
        text: { name: 'text', type: 'base' },
        custom: { name: 'custom', type: 'user' },
        image: { name: 'image', type: 'base' },
      };
      const result = modalIdeviceManager.getBaseIdevices(idevices);
      expect(result).toEqual({
        text: { name: 'text', type: 'base' },
        image: { name: 'image', type: 'base' },
      });
    });

    it('should return empty object if no base idevices', () => {
      const idevices = {
        custom: { name: 'custom', type: 'user' },
      };
      const result = modalIdeviceManager.getBaseIdevices(idevices);
      expect(result).toEqual({});
    });
  });

  describe('getUserIdevices', () => {
    it('should filter user idevices', () => {
      const idevices = {
        text: { name: 'text', type: 'base' },
        custom: { name: 'custom', type: 'user' },
        another: { name: 'another', type: 'user' },
      };
      const result = modalIdeviceManager.getUserIdevices(idevices);
      expect(result).toEqual({
        custom: { name: 'custom', type: 'user' },
        another: { name: 'another', type: 'user' },
      });
    });

    it('should return empty object if no user idevices', () => {
      const idevices = {
        text: { name: 'text', type: 'base' },
      };
      const result = modalIdeviceManager.getUserIdevices(idevices);
      expect(result).toEqual({});
    });
  });

  describe('updateIdeviceVisibility', () => {
    beforeEach(() => {
      modalIdeviceManager.idevicesBase = {
        text: { name: 'text', visible: false },
      };
      modalIdeviceManager.idevicesUser = {
        custom: { name: 'custom', visible: true },
      };
      eXeLearning.app.idevices.list.installed = {
        text: { name: 'text', visible: false },
        custom: { name: 'custom', visible: true },
      };
    });

    it('should update visibility in idevicesBase', () => {
      modalIdeviceManager.updateIdeviceVisibility('text', true);
      expect(modalIdeviceManager.idevicesBase.text.visible).toBe(true);
    });

    it('should update visibility in idevicesUser', () => {
      modalIdeviceManager.updateIdeviceVisibility('custom', false);
      expect(modalIdeviceManager.idevicesUser.custom.visible).toBe(false);
    });

    it('should update visibility in global installed list', () => {
      modalIdeviceManager.updateIdeviceVisibility('text', true);
      expect(eXeLearning.app.idevices.list.installed.text.visible).toBe(true);
    });

    it('should throw if idevice not in global installed list', () => {
      expect(() => modalIdeviceManager.updateIdeviceVisibility('nonexistent', true)).toThrow();
    });
  });

  describe('makeBodyElement', () => {
    beforeEach(() => {
      modalIdeviceManager.idevices = {
        installed: { text: { name: 'text', title: 'Text', type: 'base' } },
      };
      vi.spyOn(modalIdeviceManager, 'makeFilterTableIdevices').mockReturnValue(document.createElement('input'));
      vi.spyOn(modalIdeviceManager, 'makeElementToButtons').mockReturnValue(document.createElement('div'));
      vi.spyOn(modalIdeviceManager, 'makeElementTableIdevices').mockReturnValue(document.createElement('div'));
      vi.spyOn(modalIdeviceManager, 'makeRowTableTheadElements').mockReturnValue(document.createElement('div'));
    });

    it('should create body container', () => {
      const result = modalIdeviceManager.makeBodyElement();
      expect(result.classList.contains('body-idevices-container')).toBe(true);
    });

    it('should call makeFilterTableIdevices', () => {
      const result = modalIdeviceManager.makeBodyElement();
      expect(modalIdeviceManager.makeFilterTableIdevices).toHaveBeenCalled();
    });

    it('should call makeElementToButtons', () => {
      modalIdeviceManager.makeBodyElement();
      expect(modalIdeviceManager.makeElementToButtons).toHaveBeenCalled();
    });

    it('should call makeElementTableIdevices', () => {
      modalIdeviceManager.makeBodyElement();
      expect(modalIdeviceManager.makeElementTableIdevices).toHaveBeenCalled();
    });

    it('should add search icon', () => {
      const result = modalIdeviceManager.makeBodyElement();
      const icon = result.querySelector('.search-icon');
      expect(icon).toBeDefined();
    });
  });

  describe('makeFilterTableIdevices', () => {
    let container;

    beforeEach(() => {
      container = document.createElement('div');
      container.innerHTML = `
        <div class="toggle-item">
          <span class="idevice-title">Text iDevice</span>
        </div>
        <div class="toggle-item">
          <span class="idevice-title">Quiz iDevice</span>
        </div>
      `;
    });

    it('should create input element with correct classes', () => {
      const wrapper = modalIdeviceManager.makeFilterTableIdevices(container, '.idevice-title', 'Search');
      const input = wrapper.querySelector('input');
      expect(input.classList.contains('table-filter')).toBe(true);
      expect(input.classList.contains('form-control')).toBe(true);
    });

    it('should set placeholder', () => {
      const wrapper = modalIdeviceManager.makeFilterTableIdevices(container, '.idevice-title', 'Search iDevices');
      const input = wrapper.querySelector('input');
      expect(input.getAttribute('placeholder')).toBe('Search iDevices');
    });

    it('should filter items on keyup', () => {
      document.body.appendChild(container);
      const wrapper = modalIdeviceManager.makeFilterTableIdevices(container, '.idevice-title', 'Search');
      const input = wrapper.querySelector('input');
      input.value = 'quiz';
      input.dispatchEvent(new Event('keyup'));
      const items = container.querySelectorAll('.toggle-item');
      expect(items[0].style.display).toBe('none');
      expect(items[1].style.display).toBe('');
    });

    it('should create label with visually-hidden class', () => {
      const wrapper = modalIdeviceManager.makeFilterTableIdevices(container, '.idevice-title', 'Search');
      const label = wrapper.querySelector('label');
      expect(label.classList.contains('visually-hidden')).toBe(true);
    });
  });

  describe('makeElementToButtons', () => {
    beforeEach(() => {
      vi.spyOn(modalIdeviceManager, 'makeElementInputFileImportIdevice').mockReturnValue(document.createElement('input'));
      vi.spyOn(modalIdeviceManager, 'makeElementButtonImportIdevice').mockReturnValue(document.createElement('button'));
    });

    it('should create buttons container', () => {
      const result = modalIdeviceManager.makeElementToButtons();
      expect(result.classList.contains('idevices-button-container')).toBe(true);
    });

    it('should call makeElementInputFileImportIdevice', () => {
      modalIdeviceManager.makeElementToButtons();
      expect(modalIdeviceManager.makeElementInputFileImportIdevice).toHaveBeenCalled();
    });

    it('should call makeElementButtonImportIdevice', () => {
      modalIdeviceManager.makeElementToButtons();
      expect(modalIdeviceManager.makeElementButtonImportIdevice).toHaveBeenCalled();
    });

    it('should not append import button if false returned', () => {
      modalIdeviceManager.makeElementButtonImportIdevice.mockReturnValue(false);
      const result = modalIdeviceManager.makeElementToButtons();
      const button = result.querySelector('button');
      expect(button).toBeNull();
    });
  });

  describe('makeElementInputFileImportIdevice', () => {
    it('should create input element with correct type', () => {
      const wrapper = modalIdeviceManager.makeElementInputFileImportIdevice();
      const input = wrapper.querySelector('input');
      expect(input.getAttribute('type')).toBe('file');
    });

    it('should accept only zip files', () => {
      const wrapper = modalIdeviceManager.makeElementInputFileImportIdevice();
      const input = wrapper.querySelector('input');
      expect(input.getAttribute('accept')).toBe('.zip');
    });

    it('should have hidden class', () => {
      const wrapper = modalIdeviceManager.makeElementInputFileImportIdevice();
      const input = wrapper.querySelector('input');
      expect(input.classList.contains('hidden')).toBe(true);
    });

    it('should call addNewReader on file change', () => {
      const wrapper = modalIdeviceManager.makeElementInputFileImportIdevice();
      const input = wrapper.querySelector('input');
      const spy = vi.spyOn(modalIdeviceManager, 'addNewReader');
      const file = new File(['content'], 'test.zip', { type: 'application/zip' });
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      input.dispatchEvent(new Event('change'));
      expect(spy).toHaveBeenCalledWith(file);
    });

    it('should reset input value after change', () => {
      const wrapper = modalIdeviceManager.makeElementInputFileImportIdevice();
      const input = wrapper.querySelector('input');
      const file = new File(['content'], 'test.zip', { type: 'application/zip' });
      Object.defineProperty(input, 'files', {
        value: [file],
        writable: false,
      });
      input.dispatchEvent(new Event('change'));
      // Source code sets value to null, which is a falsy value
      expect(input.value).toBeFalsy();
    });
  });

  describe('makeElementButtonImportIdevice', () => {
    it('should return false if offline installation is false and userIdevices is false', () => {
      eXeLearning.config.isOfflineInstallation = false;
      eXeLearning.config.userIdevices = false;
      const result = modalIdeviceManager.makeElementButtonImportIdevice();
      expect(result).toBe(false);
    });

    it('should create button if offline installation is true', () => {
      eXeLearning.config.isOfflineInstallation = true;
      eXeLearning.config.userIdevices = false;
      const result = modalIdeviceManager.makeElementButtonImportIdevice();
      expect(result.tagName).toBe('BUTTON');
    });

    it('should create button if userIdevices is true', () => {
      eXeLearning.config.isOfflineInstallation = false;
      eXeLearning.config.userIdevices = true;
      const result = modalIdeviceManager.makeElementButtonImportIdevice();
      expect(result.tagName).toBe('BUTTON');
    });

    it('should have correct classes', () => {
      const result = modalIdeviceManager.makeElementButtonImportIdevice();
      expect(result.classList.contains('idevices-button-import')).toBe(true);
      expect(result.classList.contains('btn')).toBe(true);
    });

    it('should trigger file input click on button click', () => {
      const input = document.createElement('input');
      input.classList.add('idevice-file-import');
      input.click = vi.fn();
      modalIdeviceManager.modalElementBody.appendChild(input);
      const button = modalIdeviceManager.makeElementButtonImportIdevice();
      button.click();
      expect(input.click).toHaveBeenCalled();
    });
  });

  describe('makeElementTableIdevices', () => {
    beforeEach(() => {
      vi.spyOn(modalIdeviceManager, 'getUserListIdevices').mockResolvedValue(['text']);
      vi.spyOn(modalIdeviceManager, 'makeRowTableIdevicesElement').mockReturnValue(document.createElement('div'));
    });

    it('should create container with correct classes', () => {
      const idevices = { text: { id: 'text', name: 'text' } };
      const result = modalIdeviceManager.makeElementTableIdevices(idevices, { active: true, id: 'test-tab' });
      expect(result.classList.contains('idevices-toggle-container')).toBe(true);
      expect(result.classList.contains('exe-form-content')).toBe(true);
    });

    it('should add active class if dataTab.active is true', () => {
      const idevices = { text: { id: 'text', name: 'text' } };
      const result = modalIdeviceManager.makeElementTableIdevices(idevices, { active: true });
      expect(result.classList.contains('exe-form-active-content')).toBe(true);
    });

    it('should set id from dataTab', () => {
      const idevices = { text: { id: 'text', name: 'text' } };
      const result = modalIdeviceManager.makeElementTableIdevices(idevices, { id: 'test-tab' });
      expect(result.id).toBe('test-tab');
    });

    it('should skip example idevice', async () => {
      const idevices = {
        text: { id: 'text', name: 'text' },
        example: { id: 'example', name: 'example' },
      };
      modalIdeviceManager.makeElementTableIdevices(idevices);
      await Promise.resolve();
      expect(modalIdeviceManager.makeRowTableIdevicesElement).toHaveBeenCalledTimes(1);
    });
  });

  describe('makeRowTableTheadElements', () => {
    it('should create alert element', () => {
      const result = modalIdeviceManager.makeRowTableTheadElements();
      expect(result.classList.contains('alert')).toBe(true);
      expect(result.classList.contains('alert-info')).toBe(true);
    });

    it('should set role to alert', () => {
      const result = modalIdeviceManager.makeRowTableTheadElements();
      expect(result.getAttribute('role')).toBe('alert');
    });
  });

  describe('makeRowTableIdevicesElement', () => {
    let idevice;

    beforeEach(() => {
      idevice = {
        id: 'text',
        name: 'text',
        title: 'Text iDevice',
        type: 'base',
        visible: true,
      };
      modalIdeviceManager.alertFiveIdevices = document.createElement('div');
    });

    it('should create toggle item', () => {
      const result = modalIdeviceManager.makeRowTableIdevicesElement(idevice, ['text']);
      expect(result.classList.contains('toggle-item')).toBe(true);
    });

    it('should set idevice-id attribute', () => {
      const result = modalIdeviceManager.makeRowTableIdevicesElement(idevice, ['text']);
      expect(result.getAttribute('idevice-id')).toBe('text');
    });

    it('should create label with idevice title', () => {
      const result = modalIdeviceManager.makeRowTableIdevicesElement(idevice, ['text']);
      const label = result.querySelector('.toggle-label');
      expect(label.textContent).toContain('Text iDevice');
    });

    it('should not add asterisk for user idevices', () => {
      idevice.type = 'user';
      const result = modalIdeviceManager.makeRowTableIdevicesElement(idevice, ['text']);
      const label = result.querySelector('.toggle-label');
      expect(label.textContent).not.toContain('*');
      expect(label.textContent).toContain('Text iDevice');
    });

    it('should create checkbox input', () => {
      const result = modalIdeviceManager.makeRowTableIdevicesElement(idevice, ['text']);
      const input = result.querySelector('input[type="checkbox"]');
      expect(input).toBeDefined();
    });

    it('should check checkbox if idevice is in user preferences', () => {
      const result = modalIdeviceManager.makeRowTableIdevicesElement(idevice, ['text']);
      const input = result.querySelector('input[type="checkbox"]');
      expect(input.checked).toBe(true);
    });

    it('should not check checkbox if idevice is not in user preferences', () => {
      const result = modalIdeviceManager.makeRowTableIdevicesElement(idevice, ['other']);
      const input = result.querySelector('input[type="checkbox"]');
      expect(input.checked).toBe(false);
    });
  });

  describe('IndexedDB methods', () => {
    describe('getUserListIdevices', () => {
      it('should retrieve idevices from IndexedDB', async () => {
        vi.spyOn(modalIdeviceManager, 'openDB').mockResolvedValue(mockDB);

        let capturedRequest;
        mockStore.get.mockImplementation(() => {
          capturedRequest = {
            onsuccess: null,
            onerror: null,
            result: { id: 'testuser', value: ['text', 'form'] },
          };
          return capturedRequest;
        });

        const promise = modalIdeviceManager.getUserListIdevices();
        await Promise.resolve();

        if (capturedRequest.onsuccess) {
          capturedRequest.onsuccess();
        }

        const result = await promise;
        expect(result).toEqual(['text', 'form']);
      });

      it('should return null if no data exists', async () => {
        vi.spyOn(modalIdeviceManager, 'openDB').mockResolvedValue(mockDB);

        let capturedRequest;
        mockStore.get.mockImplementation(() => {
          capturedRequest = {
            onsuccess: null,
            onerror: null,
            result: null,
          };
          return capturedRequest;
        });

        const promise = modalIdeviceManager.getUserListIdevices();
        await Promise.resolve();

        if (capturedRequest.onsuccess) {
          capturedRequest.onsuccess();
        }

        const result = await promise;
        expect(result).toBeNull();
      });
    });

    describe('openDB', () => {
      it('should open indexedDB with correct name', async () => {
        const mockRequest = {
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
        };
        global.indexedDB.open.mockReturnValue(mockRequest);

        const promise = modalIdeviceManager.openDB();
        mockRequest.onsuccess({ target: { result: mockDB } });

        const result = await promise;
        expect(global.indexedDB.open).toHaveBeenCalledWith('exelearning', 1);
        expect(result).toBe(mockDB);
      });

      it('should create object store on upgrade', async () => {
        const mockRequest = {
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
        };
        global.indexedDB.open.mockReturnValue(mockRequest);

        const promise = modalIdeviceManager.openDB();
        mockRequest.onupgradeneeded({ target: { result: mockDB } });

        expect(mockDB.createObjectStore).toHaveBeenCalledWith('idevicesSettings', { keyPath: 'id' });

        mockRequest.onsuccess({ target: { result: mockDB } });
        await promise;
      });
    });

    describe('saveIdevices', () => {
      it('should save idevices to IndexedDB', async () => {
        vi.spyOn(modalIdeviceManager, 'openDB').mockResolvedValue(mockDB);

        await modalIdeviceManager.saveIdevices(['text', 'form']);

        expect(mockDB.transaction).toHaveBeenCalledWith('idevicesSettings', 'readwrite');
        expect(mockStore.put).toHaveBeenCalledWith({
          id: 'testuser',
          value: ['text', 'form'],
        });
      });
    });
  });

  describe('showElementAlert', () => {
    it('should set alert text', () => {
      modalIdeviceManager.showElementAlert('Error occurred');
      expect(modalIdeviceManager.modalElementAlertText.innerHTML).toContain('Error occurred');
    });

    it('should show error from response if available', () => {
      modalIdeviceManager.showElementAlert('Error occurred', { error: 'Specific error' });
      expect(modalIdeviceManager.modalElementAlertText.innerHTML).toContain('Specific error');
    });

    it('should add show class to alert', () => {
      modalIdeviceManager.showElementAlert('Error occurred');
      expect(modalIdeviceManager.modalElementAlert.classList.contains('show')).toBe(true);
    });
  });

  describe('addBehaviourButtonCloseAlert', () => {
    it('should clear alert text on close button click', () => {
      modalIdeviceManager.modalElementAlertText.innerHTML = 'Error message';
      modalIdeviceManager.modalElementAlertCloseButton.click();
      expect(modalIdeviceManager.modalElementAlertText.innerHTML).toBe('');
    });

    it('should remove show class from alert on close button click', () => {
      modalIdeviceManager.modalElementAlert.classList.add('show');
      modalIdeviceManager.modalElementAlertCloseButton.click();
      expect(modalIdeviceManager.modalElementAlert.classList.contains('show')).toBe(false);
    });
  });

  describe('selectIdevice', () => {
    it('should call eXeLearning.app.idevices.selectIdevice', () => {
      modalIdeviceManager.selectIdevice('text');
      expect(eXeLearning.app.idevices.selectIdevice).toHaveBeenCalledWith('text', true);
    });

    it('should call addClassSelectIdeviceRow', () => {
      const spy = vi.spyOn(modalIdeviceManager, 'addClassSelectIdeviceRow');
      modalIdeviceManager.selectIdevice('text');
      expect(spy).toHaveBeenCalledWith('text');
    });
  });

  describe('addClassSelectIdeviceRow', () => {
    beforeEach(() => {
      modalIdeviceManager.modalElementBody.innerHTML = `
        <table class="idevices-table">
          <tr class="idevice-row" idevice-id="text"></tr>
          <tr class="idevice-row" idevice-id="form"></tr>
        </table>
      `;
    });

    it('should add selected class to matching row', () => {
      modalIdeviceManager.addClassSelectIdeviceRow('text');
      const row = modalIdeviceManager.modalElementBody.querySelector('[idevice-id="text"]');
      expect(row.classList.contains('selected')).toBe(true);
    });

    it('should remove selected class from other rows', () => {
      const textRow = modalIdeviceManager.modalElementBody.querySelector('[idevice-id="text"]');
      const formRow = modalIdeviceManager.modalElementBody.querySelector('[idevice-id="form"]');
      textRow.classList.add('selected');
      modalIdeviceManager.addClassSelectIdeviceRow('form');
      expect(textRow.classList.contains('selected')).toBe(false);
      expect(formRow.classList.contains('selected')).toBe(true);
    });
  });

  describe('addNewReader', () => {
    it('should create new FileReader', () => {
      const file = new File(['content'], 'test.zip', { type: 'application/zip' });
      modalIdeviceManager.addNewReader(file);
      expect(FileReader).toHaveBeenCalled();
    });

    it('should add reader to readers array', () => {
      const file = new File(['content'], 'test.zip', { type: 'application/zip' });
      modalIdeviceManager.addNewReader(file);
      expect(modalIdeviceManager.readers.length).toBe(1);
    });

    it('should call uploadIdevice on load', () => {
      const file = new File(['content'], 'test.zip', { type: 'application/zip' });
      // Mock uploadIdevice to prevent actual API call
      const spy = vi.spyOn(modalIdeviceManager, 'uploadIdevice').mockImplementation(() => {});
      modalIdeviceManager.addNewReader(file);
      const reader = FileReader.mock.results[0].value;
      reader.onload({ target: { result: 'data:application/zip;base64,abc123' } });
      expect(spy).toHaveBeenCalledWith('test.zip', 'data:application/zip;base64,abc123');
    });

    it('should call readAsDataURL', () => {
      const file = new File(['content'], 'test.zip', { type: 'application/zip' });
      modalIdeviceManager.addNewReader(file);
      const reader = FileReader.mock.results[0].value;
      expect(reader.readAsDataURL).toHaveBeenCalledWith(file);
    });
  });

  describe('uploadIdevice', () => {
    let resolveUpload;
    let uploadPromise;

    beforeEach(() => {
      modalIdeviceManager.idevices = {
        installed: {},
        loadIdevice: vi.fn(),
      };
      vi.spyOn(modalIdeviceManager, 'getBaseIdevices').mockReturnValue({});
      vi.spyOn(modalIdeviceManager, 'getUserIdevices').mockReturnValue({});
      vi.spyOn(modalIdeviceManager, 'makeBodyElement').mockReturnValue(document.createElement('div'));
      vi.spyOn(modalIdeviceManager, 'setBodyElement');
      vi.spyOn(modalIdeviceManager, 'saveIdevicesVisibility');
    });

    it('should call API postUploadIdevice', () => {
      // Use a pending promise to prevent callback execution
      eXeLearning.app.api.postUploadIdevice.mockReturnValue(new Promise(() => {}));
      modalIdeviceManager.uploadIdevice('test.zip', 'filedata');
      expect(eXeLearning.app.api.postUploadIdevice).toHaveBeenCalledWith({
        filename: 'test.zip',
        file: 'filedata',
      });
    });

    it('should load idevice on success', async () => {
      uploadPromise = new Promise(resolve => { resolveUpload = resolve; });
      eXeLearning.app.api.postUploadIdevice.mockReturnValue(uploadPromise);
      modalIdeviceManager.uploadIdevice('test.zip', 'filedata');
      resolveUpload({
        responseMessage: 'OK',
        idevice: { name: 'test-idevice', title: 'Test iDevice', type: 'user' },
      });
      await uploadPromise;
      await Promise.resolve(); // Flush microtasks
      expect(modalIdeviceManager.idevices.loadIdevice).toHaveBeenCalledWith({
        name: 'test-idevice',
        title: 'Test iDevice',
        type: 'user',
      });
    });

    it('should refresh body element on success', async () => {
      uploadPromise = new Promise(resolve => { resolveUpload = resolve; });
      eXeLearning.app.api.postUploadIdevice.mockReturnValue(uploadPromise);
      modalIdeviceManager.uploadIdevice('test.zip', 'filedata');
      resolveUpload({
        responseMessage: 'OK',
        idevice: { name: 'test-idevice', title: 'Test iDevice', type: 'user' },
      });
      await uploadPromise;
      await Promise.resolve(); // Flush microtasks
      expect(modalIdeviceManager.setBodyElement).toHaveBeenCalled();
    });

    it('should show alert on failure', async () => {
      uploadPromise = new Promise(resolve => { resolveUpload = resolve; });
      eXeLearning.app.api.postUploadIdevice.mockReturnValue(uploadPromise);
      const spy = vi.spyOn(modalIdeviceManager, 'showElementAlert');
      modalIdeviceManager.uploadIdevice('test.zip', 'filedata');
      resolveUpload({ responseMessage: 'ERROR', error: 'Invalid file' });
      await uploadPromise;
      await Promise.resolve(); // Flush microtasks
      expect(spy).toHaveBeenCalledWith('Failed to install the new iDevice', { responseMessage: 'ERROR', error: 'Invalid file' });
    });
  });

  describe('removeIdevice', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      modalIdeviceManager.idevices = {
        installed: {
          text: { name: 'text', title: 'Text', type: 'base' },
        },
        removeIdevice: vi.fn(),
      };
      modalIdeviceManager.idevicesBase = {};
      modalIdeviceManager.idevicesUser = {};
      vi.spyOn(modalIdeviceManager, 'show').mockImplementation(() => {});
      vi.spyOn(modalIdeviceManager, 'showElementAlert');
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should call API deleteIdeviceInstalled', async () => {
      await modalIdeviceManager.removeIdevice('test-idevice');
      expect(eXeLearning.app.api.deleteIdeviceInstalled).toHaveBeenCalledWith({ id: 'test-idevice' });
    });

    it('should remove idevice on success', async () => {
      await modalIdeviceManager.removeIdevice('test-idevice');
      expect(modalIdeviceManager.idevices.removeIdevice).toHaveBeenCalledWith('test-idevice');
    });

    it('should show modal after successful deletion', async () => {
      mockBootstrapModal._isShown = false;
      await modalIdeviceManager.removeIdevice('test-idevice');
      vi.advanceTimersByTime(600);
      expect(modalIdeviceManager.show).toHaveBeenCalledWith(false);
    });

    it('should show alert on failure', async () => {
      eXeLearning.app.api.deleteIdeviceInstalled.mockResolvedValue({ responseMessage: 'ERROR', error: 'Cannot delete' });
      mockBootstrapModal._isShown = false;
      await modalIdeviceManager.removeIdevice('test-idevice');
      vi.advanceTimersByTime(600);
      expect(modalIdeviceManager.showElementAlert).toHaveBeenCalledWith(
        'Could not remove the iDevice',
        { responseMessage: 'ERROR', error: 'Cannot delete' }
      );
    });
  });
});
