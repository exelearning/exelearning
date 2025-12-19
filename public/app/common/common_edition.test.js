import { beforeEach, describe, expect, it, vi } from 'vitest';

// Setup globals needed BEFORE the script is loaded
globalThis._ = vi.fn((key) => key);
globalThis.c_ = vi.fn((key) => key);
globalThis.eXe = {
  app: {
    alert: vi.fn(),
    clearHistory: vi.fn(),
    _confirmResponses: {
      clear: vi.fn()
    }
  },
};
globalThis.$exeTinyMCE = {
  init: vi.fn(),
};
globalThis.$exeDevice = {
  init: vi.fn(),
  save: vi.fn(() => '<div>Saved HTML</div>'),
  i18n: {
    en: { 'Test': 'Translated Test' }
  }
};
globalThis.top = {
  translations: {}
};

// Load the module using require() for coverage tracking
const $exeDevicesEdition = require('./common_edition.js');
globalThis.$exeDevicesEdition = $exeDevicesEdition;

describe('common_edition.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    if (!globalThis.$ || !globalThis.jQuery) {
      throw new Error('jQuery is not available in the test environment');
    }

    // Ensure $exeDevice is defined globally before script evaluation in each test
    globalThis.$exeDevice = {
      init: vi.fn(),
      save: vi.fn(() => '<div>Saved HTML</div>'),
      i18n: {
        en: { 'Test': 'Translated Test' }
      }
    };
    document.documentElement.setAttribute('lang', 'en');
    document.body.innerHTML = '';

    const submitWrapper = document.createElement('div');
    submitWrapper.id = 'exe-submitButton';
    const submitLink = document.createElement('a');
    submitLink.setAttribute('onclick', 'console.log("clicked")');
    submitWrapper.appendChild(submitLink);
    document.body.appendChild(submitWrapper);

    const editorTextarea = document.createElement('textarea');
    editorTextarea.className = 'mceEditor';
    document.body.appendChild(editorTextarea);

    const nodeContent = document.createElement('div');
    nodeContent.id = 'node-content';
    const ideviceNode = document.createElement('div');
    ideviceNode.className = 'idevice_node';
    ideviceNode.setAttribute('mode', 'edition');
    nodeContent.appendChild(ideviceNode);
    document.body.appendChild(nodeContent);
  });

  it('defines global $exeDevicesEdition', () => {
    expect(globalThis.$exeDevicesEdition).toBeDefined();
    expect(typeof globalThis.$exeDevicesEdition.iDevice.init).toBe('function');
  });

  describe('iDevice.init', () => {
    it('calls $exeDevice.init and $exeTinyMCE.init', () => {
      globalThis.$exeDevicesEdition.iDevice.init();
      expect(globalThis.$exeDevice.init).toHaveBeenCalled();
      const majorVersion = Number(globalThis.tinymce?.majorVersion || 0);
      if (majorVersion === 4) {
        expect(globalThis.$exeTinyMCE.init).toHaveBeenCalledWith('multiple-visible', '.exe-html-editor');
      } else if (majorVersion === 3) {
        expect(globalThis.$exeTinyMCE.init).toHaveBeenCalledWith('specific_textareas', 'exe-html-editor');
      } else {
        expect(globalThis.$exeTinyMCE.init).not.toHaveBeenCalled();
      }
    });

    it('shows alert if $exeDevice is not fully defined', () => {
      const originalInit = globalThis.$exeDevice.init;
      delete globalThis.$exeDevice.init;

      globalThis.$exeDevicesEdition.iDevice.init();

      expect(globalThis.eXe.app.alert).toHaveBeenCalled();

      globalThis.$exeDevice.init = originalInit;
    });
  });

  describe('common', () => {
    it('getTextFieldset returns fieldset HTML', () => {
      const result = globalThis.$exeDevicesEdition.iDevice.common.getTextFieldset('after');
      expect(result).toContain('fieldset');
      expect(result).toContain('eXeIdeviceTextAfter');
    });
  });

  describe('gamification', () => {
    it('instructions.getFieldset returns fieldset HTML', () => {
      const result = globalThis.$exeDevicesEdition.iDevice.gamification.instructions.getFieldset('test info');
      expect(result).toContain('fieldset');
      expect(result).toContain('eXeGameInstructions');
      expect(result).toContain('test info');
    });

    it('itinerary.getValues returns object with values', () => {
      const clueCheckbox = document.createElement('input');
      clueCheckbox.id = 'eXeGameShowClue';
      clueCheckbox.type = 'checkbox';
      clueCheckbox.checked = true;
      document.body.appendChild(clueCheckbox);

      const clueInput = document.createElement('input');
      clueInput.id = 'eXeGameClue';
      clueInput.value = 'Clue Text';
      document.body.appendChild(clueInput);

      const percentSelect = document.createElement('select');
      percentSelect.id = 'eXeGamePercentajeClue';
      const option = document.createElement('option');
      option.value = '40';
      option.selected = true;
      percentSelect.appendChild(option);
      document.body.appendChild(percentSelect);

      const values = globalThis.$exeDevicesEdition.iDevice.gamification.itinerary.getValues();
      expect(values).toHaveProperty('showClue');
      expect(values).toHaveProperty('clueGame');
      expect(values.clueGame).toBe('Clue Text');
    });

    it('scorm.getValues returns SCORM values', () => {
      const scormRadio = document.createElement('input');
      scormRadio.type = 'radio';
      scormRadio.name = 'eXeGameSCORM';
      scormRadio.value = '1';
      scormRadio.checked = true;
      document.body.appendChild(scormRadio);

      const scormButtonText = document.createElement('input');
      scormButtonText.id = 'eXeGameSCORMbuttonText';
      scormButtonText.value = 'Save';
      document.body.appendChild(scormButtonText);

      const scormWeight = document.createElement('input');
      scormWeight.id = 'eXeGameSCORMWeight';
      scormWeight.value = '100';
      document.body.appendChild(scormWeight);

      const values = globalThis.$exeDevicesEdition.iDevice.gamification.scorm.getValues();
      expect(values.isScorm).toBe(1);
      expect(values.textButtonScorm).toBe('Save');
    });
  });

  describe('tabs', () => {
    it('init handles tabs', () => {
      const container = document.createElement('div');
      container.id = 'test-id';
      const tab = document.createElement('div');
      tab.className = 'exe-form-tab';
      tab.setAttribute('title', 'Tab Title');
      container.appendChild(tab);
      document.body.appendChild(container);

      globalThis.$exeDevicesEdition.iDevice.tabs.init('test-id');
      const tabList = container.querySelector('.exe-form-tabs');
      expect(tabList).toBeTruthy();
    });
  });
});
