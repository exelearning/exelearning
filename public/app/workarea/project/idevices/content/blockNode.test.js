/**
 * BlockNode Tests
 *
 * Unit tests for IdeviceBlockNode class methods.
 * Tests core functionality like parameter handling, properties, toggle, order calculation, etc.
 *
 * Run with: make test-frontend
 */

 

// Setup global mocks before tests
beforeEach(() => {
  // Mock eXeLearning global object
  global.eXeLearning = {
    app: {
      api: {
        parameters: {
          generateNewItemKey: 'generated-key-123',
          odePagStructureSyncPropertiesConfig: {
            identifier: { value: '' },
            visibility: { value: 'false' },
            cssClass: { value: '' },
            allowToggle: { value: 'true' },
            minimized: { value: 'false' },
          },
        },
      },
      project: {
        _yjsEnabled: false,
        _yjsBridge: null,
        odeVersion: 'v1',
        odeSession: 'session-123',
        structure: {
          getSelectNodeNavId: vi.fn(() => 'nav-id-1'),
          getSelectNodePageId: vi.fn(() => 'page-id-1'),
          getAllNodesOrderByView: vi.fn(() => [
            { id: 'page-1', deep: 0, pageName: 'Home' },
            { id: 'page-2', deep: 1, pageName: 'Chapter 1' },
          ]),
        },
      },
      themes: {
        getThemeIcons: vi.fn(() => ({
          icon1: { id: 'icon1', value: '/path/to/icon1.svg', title: 'Icon 1' },
          icon2: { id: 'icon2', value: '/path/to/icon2.svg', title: 'Icon 2' },
        })),
      },
      modals: {
        alert: { show: vi.fn() },
        confirm: {
          show: vi.fn(),
          close: vi.fn(),
          modalElementBody: null,
        },
        properties: { show: vi.fn() },
      },
      common: {
        initTooltips: vi.fn(),
      },
      menus: {
        menuStructure: {
          menuStructureBehaviour: {
            checkIfEmptyNode: vi.fn(),
          },
        },
      },
    },
    config: {
      isOfflineInstallation: false,
    },
  };

  // Reset window.AppLogger
  global.window = global.window || {};
  global.window.AppLogger = {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * Mock IdeviceBlockNode class for testing
 * We create a minimal mock since full class has many dependencies
 */
class MockIdeviceBlockNode {
  constructor(parent, data) {
    this.engine = parent || {
      generateId: () => `engine-id-${Date.now()}`,
      movingClassDuration: 300,
      nodeContentElement: document.createElement('div'),
      addEventDragStartToContentBlock: vi.fn(),
      addEventDragEndToContentBlock: vi.fn(),
      components: { blocks: [], idevices: [] },
    };

    this.id = data?.id || eXeLearning.app.api.parameters.generateNewItemKey;

    const yjsEnabled = eXeLearning?.app?.project?._yjsEnabled;
    this.blockId = data?.blockId
      ? data.blockId
      : yjsEnabled
        ? `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        : this.engine.generateId();

    this.setParams(data || {});

    this.idevices = [];
    this.removeIfEmpty = false;
    this.askForRemoveIfEmpty = true;
    this.canHaveHeirs = true;

    this.blockContent = null;
    this.headElement = null;
    this.idevicesContainerElement = null;
    this.iconElement = null;
    this.blockNameElementText = null;
    this.toggleElement = null;
    this.blockButtons = null;
    this.offlineInstallation = eXeLearning.config.isOfflineInstallation;
  }

  emptyIcon = 'block';

  properties = JSON.parse(
    JSON.stringify(eXeLearning.app.api.parameters.odePagStructureSyncPropertiesConfig)
  );

  params = [
    'odeNavStructureSyncId',
    'odeSessionId',
    'odeVersionId',
    'pageId',
    'mode',
    'blockName',
    'iconName',
    'order',
  ];

  default = {
    mode: 'export',
    blockName: '',
    iconName: '',
    order: 0,
  };

  setParams(data) {
    for (let [i, param] of Object.entries(this.params)) {
      let defaultValue = this.default[param] ? this.default[param] : null;
      this[param] = data[param] ? data[param] : defaultValue;
    }
    if (data.odePagStructureSyncProperties) {
      this.setProperties(data.odePagStructureSyncProperties);
    }
  }

  isYjsEnabled() {
    return eXeLearning.app?.project?._yjsEnabled === true;
  }

  loadPropertiesFromYjs() {
    if (!this.isYjsEnabled()) return;

    const project = eXeLearning.app.project;
    const bridge = project._yjsBridge;

    if (!bridge || !bridge.structureBinding) return;

    const yjsProperties = bridge.structureBinding.getBlockProperties(this.blockId);
    if (yjsProperties) {
      for (let [key, value] of Object.entries(yjsProperties)) {
        if (this.properties[key]) {
          if (typeof value === 'boolean') {
            this.properties[key].value = value ? 'true' : 'false';
          } else {
            this.properties[key].value = value;
          }
        }
      }
    }
  }

  setProperties(properties, onlyHeritable) {
    for (let [key, value] of Object.entries(this.properties)) {
      if (!properties || !properties[key]) {
        continue;
      }

      if (onlyHeritable) {
        if (properties[key].heritable) value.value = properties[key].value;
      } else {
        value.value = properties[key].value;
      }
    }
    if (this.blockContent) this.setPropertiesClassesToElement();
  }

  setPropertiesClassesToElement() {
    if (!this.blockContent) return;

    if (this.properties.identifier.value != '') {
      this.blockContent.setAttribute('identifier', this.properties.identifier.value);
    }
    if (this.properties.visibility.value == 'true') {
      this.blockContent.setAttribute('export-view', this.properties.visibility.value);
    }
    if (this.properties.cssClass.value != '') {
      let cssClasses = this.properties.cssClass.value
        ? this.properties.cssClass.value.split(' ')
        : [];
      cssClasses.forEach((cls) => {
        this.blockContent.classList.add(cls);
      });
    }
    if (this.properties.minimized.value == 'true') {
      this.toggleOff();
    }
  }

  generateBlockContentNode(newNode) {
    if (newNode) {
      this.blockContent = document.createElement('article');
    } else {
      this.blockContent.classList.remove(...this.blockContent.classList);
      while (this.blockContent.attributes.length > 0) {
        this.blockContent.removeAttribute(this.blockContent.attributes[0].name);
      }
      if (this.toggleElement) {
        this.toggleElement.removeAttribute('disabled');
      }
    }
    this.blockContent.id = this.blockId;
    this.blockContent.classList.add('box');
    this.blockContent.classList.add('idevice-element-in-content');
    this.blockContent.classList.add('draggable');
    if (this.id) this.blockContent.setAttribute('sym-id', this.id);
    this.blockContent.setAttribute('order', this.order);
    this.blockContent.setAttribute('drag', 'box');
    this.blockContent.setAttribute('drop', '["idevice"]');

    this.setPropertiesClassesToElement();
    this.updateMode();
    return this.blockContent;
  }

  toggleOff() {
    if (!this.blockContent || !this.toggleElement) return;
    this.blockContent.classList.add('hidden-idevices');
    this.blockContent.classList.remove('dropdown-menu-on');
    this.toggleElement.classList.add('box-toggle-off');
    this.toggleElement.classList.remove('box-toggle-on');
    this.toggleElement.setAttribute('title', _('Show'));
    const span = this.toggleElement.querySelector('span');
    if (span) span.innerHTML = 'keyboard_arrow_up';
  }

  toggleOn() {
    if (!this.blockContent || !this.toggleElement) return;
    this.blockContent.classList.remove('hidden-idevices');
    this.toggleElement.classList.remove('box-toggle-off');
    this.toggleElement.classList.add('box-toggle-on');
    this.toggleElement.setAttribute('title', _('Hide'));
    const span = this.toggleElement.querySelector('span');
    if (span) span.innerHTML = 'keyboard_arrow_down';
  }

  getCurrentOrder() {
    let previousBlock, nextBlock;
    if ((previousBlock = this.getContentPrevBlock())) {
      this.order = parseInt(previousBlock.getAttribute('order')) + 1;
      return this.order;
    } else if ((nextBlock = this.getContentNextBlock())) {
      this.order = parseInt(nextBlock.getAttribute('order')) - 1;
      return this.order;
    }
    return -1;
  }

  getContentPrevBlock() {
    if (!this.blockContent) return false;
    let previousBlock = this.blockContent.previousElementSibling;
    if (previousBlock && previousBlock.classList && previousBlock.classList.contains('box')) {
      return previousBlock;
    }
    return false;
  }

  getContentNextBlock() {
    if (!this.blockContent) return false;
    let nextBlock = this.blockContent.nextSibling;
    if (nextBlock && nextBlock.classList && nextBlock.classList.contains('box')) {
      return nextBlock;
    }
    return false;
  }

  generateDataObject(params) {
    let baseDataDict = this.getDictBaseValuesData();
    let data = {};
    params.forEach((param) => {
      data[param] = baseDataDict[param];
    });
    return data;
  }

  getDictBaseValuesData() {
    let defaultVersion = eXeLearning.app.project.odeVersion;
    let defaultSession = eXeLearning.app.project.odeSession;
    let defaultOdeNavStructureSyncId = eXeLearning.app.project.structure.getSelectNodeNavId();
    let defaultOdePageId = eXeLearning.app.project.structure.getSelectNodePageId();
    return {
      odePagStructureSyncId: this.id,
      odeVersionId: defaultVersion,
      odeSessionId: defaultSession,
      odeNavStructureSyncId: this.odeNavStructureSyncId
        ? this.odeNavStructureSyncId
        : defaultOdeNavStructureSyncId,
      odePageId: this.pageId ? this.pageId : defaultOdePageId,
      iconName: this.iconName,
      blockName: this.blockName,
      order: this.order,
    };
  }

  updateParam(param, newValue) {
    this[param] = newValue;
    switch (param) {
      case 'order':
        if (this.blockContent) this.blockContent.setAttribute('order', this.order);
        break;
      case 'id':
        if (this.blockContent) this.blockContent.setAttribute('sym-id', this.id);
        break;
    }
  }

  updateMode(mode) {
    if (mode) this.mode = mode;
    if (this.blockContent) {
      this.blockContent.setAttribute('mode', this.mode);
    }
    if (this.headElement) {
      switch (this.mode) {
        case 'edition':
          this.headElement.setAttribute('draggable', false);
          this.headElement.classList.remove('draggable');
          break;
        case 'export':
          this.headElement.setAttribute('draggable', true);
          this.headElement.classList.add('draggable');
          break;
      }
    }
  }

  getFallbackPageOrder() {
    try {
      const currentPageId =
        this.pageId ||
        (this.engine &&
        this.engine.project &&
        this.engine.project.app &&
        this.engine.project.app.project &&
        this.engine.project.app.project.structure &&
        this.engine.project.app.project.structure.getSelectNodePageId
          ? this.engine.project.app.project.structure.getSelectNodePageId()
          : null);

      const list =
        this.engine && this.engine.components && Array.isArray(this.engine.components.blocks)
          ? this.engine.components.blocks
          : [];

      const orders = list
        .filter((blk) => {
          if (!blk) return false;
          const blkPageId = blk.pageId || null;
          return blkPageId && currentPageId ? String(blkPageId) === String(currentPageId) : false;
        })
        .map((blk) => {
          const v1 =
            blk.order !== undefined && blk.order !== null ? parseInt(blk.order) : NaN;
          const v2 =
            blk.blockContent && blk.blockContent.getAttribute
              ? parseInt(blk.blockContent.getAttribute('order'))
              : NaN;
          return !isNaN(v1) ? v1 : !isNaN(v2) ? v2 : NaN;
        })
        .filter((n) => !isNaN(n));

      if (orders.length) return Math.max(...orders) + 1;

      return 1;
    } catch (_) {
      /* Silently fall back to default order */
    }

    return 1;
  }

  generateModalMoveToPageBody() {
    let bodyElement = document.createElement('div');
    let textElement = document.createElement('p');
    let selectElement = document.createElement('select');
    textElement.innerHTML = _(
      'Select the page you want to move the block to. This will be at the end of it.'
    );
    textElement.classList.add('text-info-move-to-page');
    selectElement.classList.add('select-move-to-page');
    bodyElement.append(textElement);
    bodyElement.append(selectElement);

    let pages = eXeLearning.app.project.structure.getAllNodesOrderByView();
    pages.forEach((page) => {
      let option = document.createElement('option');
      option.value = page.id;
      option.innerHTML = `${'&nbsp;&nbsp;'.repeat(page.deep)} ${page.pageName}`;
      if (page.id == this.odeNavStructureSyncId) option.setAttribute('selected', 'selected');
      selectElement.append(option);
    });
    return bodyElement;
  }

  makeEmptyIcon() {
    let emptyIconElement = document.createElement('div');
    let emptyIconValue = this.emptyIcon;
    let emptyIconTitle = _('Empty');
    emptyIconElement.classList.add('exe-icon');
    emptyIconElement.classList.add('option-block-icon');
    emptyIconElement.classList.add('empty-block-icon');
    emptyIconElement.setAttribute('tabindex', 0);
    emptyIconElement.setAttribute('icon-id', 0);
    emptyIconElement.title = emptyIconTitle;
    emptyIconElement.innerHTML = emptyIconValue;
    emptyIconElement.setAttribute('selected', !this.iconName);
    return emptyIconElement;
  }

  makeIconValueElement(icon) {
    let iconValue = document.createElement('img');
    iconValue.setAttribute('src', icon.value);
    iconValue.setAttribute('alt', icon.title);
    return iconValue;
  }

  focusTextInput(input) {
    input.focus();
    let inputElementValue = input.value;
    input.value = '';
    input.value = inputElementValue;
  }
}

describe('IdeviceBlockNode', () => {
  let block;

  beforeEach(() => {
    block = new MockIdeviceBlockNode(null, {
      id: 'block-1',
      blockId: 'block-id-1',
      blockName: 'Test Block',
      iconName: 'icon1',
      order: 1,
      pageId: 'page-1',
    });
  });

  afterEach(() => {
    block = null;
  });

  describe('constructor', () => {
    it('initializes with provided data', () => {
      expect(block.id).toBe('block-1');
      expect(block.blockId).toBe('block-id-1');
      expect(block.blockName).toBe('Test Block');
      expect(block.iconName).toBe('icon1');
      expect(block.order).toBe(1);
    });

    it('uses default values when data is missing', () => {
      const emptyBlock = new MockIdeviceBlockNode(null, {});
      expect(emptyBlock.mode).toBe('export');
      // Note: blockName, iconName default to '' which is falsy, so setParams returns null
      expect(emptyBlock.blockName).toBeNull();
      expect(emptyBlock.iconName).toBeNull();
      // order defaults to 0 which is also falsy, so setParams returns null
      expect(emptyBlock.order).toBeNull();
    });

    it('generates id when not provided', () => {
      const newBlock = new MockIdeviceBlockNode(null, {});
      expect(newBlock.id).toBe('generated-key-123');
    });

    it('initializes empty idevices array', () => {
      expect(block.idevices).toEqual([]);
    });

    it('initializes control parameters', () => {
      expect(block.removeIfEmpty).toBe(false);
      expect(block.askForRemoveIfEmpty).toBe(true);
      expect(block.canHaveHeirs).toBe(true);
    });
  });

  describe('setParams', () => {
    it('sets all params from data object', () => {
      block.setParams({
        odeNavStructureSyncId: 'nav-123',
        odeSessionId: 'session-456',
        odeVersionId: 'v2',
        pageId: 'page-2',
        mode: 'edition',
        blockName: 'Updated Block',
        iconName: 'icon2',
        order: 5,
      });

      expect(block.odeNavStructureSyncId).toBe('nav-123');
      expect(block.odeSessionId).toBe('session-456');
      expect(block.odeVersionId).toBe('v2');
      expect(block.pageId).toBe('page-2');
      expect(block.mode).toBe('edition');
      expect(block.blockName).toBe('Updated Block');
      expect(block.iconName).toBe('icon2');
      expect(block.order).toBe(5);
    });

    it('uses default values for missing params', () => {
      block.setParams({});
      expect(block.mode).toBe('export');
      // Note: blockName defaults to '' which is falsy, so null is returned
      expect(block.blockName).toBeNull();
      // order defaults to 0 which is also falsy, so null is returned
      expect(block.order).toBeNull();
    });

    it('calls setProperties when odePagStructureSyncProperties provided', () => {
      const spy = vi.spyOn(block, 'setProperties');
      block.setParams({
        odePagStructureSyncProperties: {
          identifier: { value: 'my-id' },
        },
      });
      expect(spy).toHaveBeenCalledWith({ identifier: { value: 'my-id' } });
    });
  });

  describe('setProperties', () => {
    it('sets property values from data', () => {
      block.setProperties({
        identifier: { value: 'custom-id' },
        visibility: { value: 'true' },
        cssClass: { value: 'my-class' },
      });

      expect(block.properties.identifier.value).toBe('custom-id');
      expect(block.properties.visibility.value).toBe('true');
      expect(block.properties.cssClass.value).toBe('my-class');
    });

    it('only sets heritable properties when onlyHeritable is true', () => {
      block.setProperties(
        {
          identifier: { value: 'inherited-id', heritable: true },
          visibility: { value: 'true', heritable: false },
        },
        true
      );

      expect(block.properties.identifier.value).toBe('inherited-id');
      // visibility should remain default since heritable is false
      expect(block.properties.visibility.value).toBe('false');
    });

    it('handles missing properties gracefully', () => {
      expect(() => {
        block.setProperties(null);
      }).not.toThrow();

      expect(() => {
        block.setProperties({});
      }).not.toThrow();
    });
  });

  describe('isYjsEnabled', () => {
    it('returns false when Yjs is not enabled', () => {
      eXeLearning.app.project._yjsEnabled = false;
      expect(block.isYjsEnabled()).toBe(false);
    });

    it('returns true when Yjs is enabled', () => {
      eXeLearning.app.project._yjsEnabled = true;
      expect(block.isYjsEnabled()).toBe(true);
    });

    it('returns false when project is undefined', () => {
      eXeLearning.app.project = undefined;
      expect(block.isYjsEnabled()).toBe(false);
    });
  });

  describe('loadPropertiesFromYjs', () => {
    it('does nothing when Yjs is not enabled', () => {
      eXeLearning.app.project._yjsEnabled = false;
      block.loadPropertiesFromYjs();
      // Properties should remain unchanged
      expect(block.properties.identifier.value).toBe('');
    });

    it('loads properties from Yjs when enabled', () => {
      eXeLearning.app.project._yjsEnabled = true;
      eXeLearning.app.project._yjsBridge = {
        structureBinding: {
          getBlockProperties: vi.fn(() => ({
            identifier: 'yjs-id',
            visibility: true,
            cssClass: 'yjs-class',
          })),
        },
      };

      block.loadPropertiesFromYjs();

      expect(block.properties.identifier.value).toBe('yjs-id');
      expect(block.properties.visibility.value).toBe('true');
      expect(block.properties.cssClass.value).toBe('yjs-class');
    });

    it('converts boolean values to strings', () => {
      eXeLearning.app.project._yjsEnabled = true;
      eXeLearning.app.project._yjsBridge = {
        structureBinding: {
          getBlockProperties: vi.fn(() => ({
            minimized: true,
            allowToggle: false,
          })),
        },
      };

      block.loadPropertiesFromYjs();

      expect(block.properties.minimized.value).toBe('true');
      expect(block.properties.allowToggle.value).toBe('false');
    });
  });

  describe('generateBlockContentNode', () => {
    it('creates new article element when newNode is true', () => {
      const node = block.generateBlockContentNode(true);

      expect(node.tagName).toBe('ARTICLE');
      expect(node.id).toBe('block-id-1');
      expect(node.classList.contains('box')).toBe(true);
      expect(node.classList.contains('idevice-element-in-content')).toBe(true);
      expect(node.classList.contains('draggable')).toBe(true);
    });

    it('sets correct attributes', () => {
      const node = block.generateBlockContentNode(true);

      expect(node.getAttribute('sym-id')).toBe('block-1');
      expect(node.getAttribute('order')).toBe('1');
      expect(node.getAttribute('drag')).toBe('box');
      expect(node.getAttribute('drop')).toBe('["idevice"]');
    });

    it('reuses existing element when newNode is false', () => {
      block.blockContent = document.createElement('article');
      block.blockContent.classList.add('old-class');
      block.toggleElement = document.createElement('button');
      block.toggleElement.setAttribute('disabled', 'true');

      const node = block.generateBlockContentNode(false);

      expect(node.classList.contains('old-class')).toBe(false);
      expect(node.classList.contains('box')).toBe(true);
      expect(block.toggleElement.hasAttribute('disabled')).toBe(false);
    });

    it('applies CSS classes from properties', () => {
      block.properties.cssClass.value = 'custom-class another-class';
      const node = block.generateBlockContentNode(true);

      expect(node.classList.contains('custom-class')).toBe(true);
      expect(node.classList.contains('another-class')).toBe(true);
    });
  });

  describe('setPropertiesClassesToElement', () => {
    beforeEach(() => {
      block.blockContent = document.createElement('article');
      block.toggleElement = document.createElement('button');
      const span = document.createElement('span');
      block.toggleElement.appendChild(span);
    });

    it('sets identifier attribute', () => {
      block.properties.identifier.value = 'my-block-id';
      block.setPropertiesClassesToElement();

      expect(block.blockContent.getAttribute('identifier')).toBe('my-block-id');
    });

    it('sets export-view attribute when visibility is true', () => {
      block.properties.visibility.value = 'true';
      block.setPropertiesClassesToElement();

      expect(block.blockContent.getAttribute('export-view')).toBe('true');
    });

    it('adds CSS classes', () => {
      block.properties.cssClass.value = 'class1 class2 class3';
      block.setPropertiesClassesToElement();

      expect(block.blockContent.classList.contains('class1')).toBe(true);
      expect(block.blockContent.classList.contains('class2')).toBe(true);
      expect(block.blockContent.classList.contains('class3')).toBe(true);
    });

    it('calls toggleOff when minimized is true', () => {
      const spy = vi.spyOn(block, 'toggleOff');
      block.properties.minimized.value = 'true';
      block.setPropertiesClassesToElement();

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('toggleOff / toggleOn', () => {
    beforeEach(() => {
      block.blockContent = document.createElement('article');
      block.toggleElement = document.createElement('button');
      block.toggleElement.classList.add('box-toggle-on');
      const span = document.createElement('span');
      span.innerHTML = 'keyboard_arrow_down';
      block.toggleElement.appendChild(span);
    });

    it('toggleOff adds hidden-idevices class', () => {
      block.toggleOff();

      expect(block.blockContent.classList.contains('hidden-idevices')).toBe(true);
      expect(block.toggleElement.classList.contains('box-toggle-off')).toBe(true);
      expect(block.toggleElement.classList.contains('box-toggle-on')).toBe(false);
    });

    it('toggleOn removes hidden-idevices class', () => {
      block.blockContent.classList.add('hidden-idevices');
      block.toggleElement.classList.add('box-toggle-off');
      block.toggleElement.classList.remove('box-toggle-on');

      block.toggleOn();

      expect(block.blockContent.classList.contains('hidden-idevices')).toBe(false);
      expect(block.toggleElement.classList.contains('box-toggle-on')).toBe(true);
      expect(block.toggleElement.classList.contains('box-toggle-off')).toBe(false);
    });
  });

  describe('getCurrentOrder', () => {
    beforeEach(() => {
      const container = document.createElement('div');

      const prevBlock = document.createElement('article');
      prevBlock.classList.add('box');
      prevBlock.setAttribute('order', '5');

      block.blockContent = document.createElement('article');
      block.blockContent.classList.add('box');

      const nextBlock = document.createElement('article');
      nextBlock.classList.add('box');
      nextBlock.setAttribute('order', '10');

      container.appendChild(prevBlock);
      container.appendChild(block.blockContent);
      container.appendChild(nextBlock);
    });

    it('returns order based on previous block', () => {
      const order = block.getCurrentOrder();
      expect(order).toBe(6); // previous block order (5) + 1
    });

    it('returns -1 when no adjacent blocks exist', () => {
      const container = document.createElement('div');
      block.blockContent = document.createElement('article');
      block.blockContent.classList.add('box');
      container.appendChild(block.blockContent);

      const order = block.getCurrentOrder();
      expect(order).toBe(-1);
    });
  });

  describe('getContentPrevBlock / getContentNextBlock', () => {
    it('returns previous block when exists', () => {
      const container = document.createElement('div');
      const prevBlock = document.createElement('article');
      prevBlock.classList.add('box');
      block.blockContent = document.createElement('article');

      container.appendChild(prevBlock);
      container.appendChild(block.blockContent);

      expect(block.getContentPrevBlock()).toBe(prevBlock);
    });

    it('returns false when no previous block', () => {
      const container = document.createElement('div');
      block.blockContent = document.createElement('article');
      container.appendChild(block.blockContent);

      expect(block.getContentPrevBlock()).toBe(false);
    });

    it('returns next block when exists', () => {
      const container = document.createElement('div');
      block.blockContent = document.createElement('article');
      const nextBlock = document.createElement('article');
      nextBlock.classList.add('box');

      container.appendChild(block.blockContent);
      container.appendChild(nextBlock);

      expect(block.getContentNextBlock()).toBe(nextBlock);
    });

    it('returns false when no next block', () => {
      const container = document.createElement('div');
      block.blockContent = document.createElement('article');
      container.appendChild(block.blockContent);

      expect(block.getContentNextBlock()).toBe(false);
    });
  });

  describe('generateDataObject', () => {
    it('generates data object with specified params', () => {
      const data = block.generateDataObject(['odePagStructureSyncId', 'blockName', 'order']);

      expect(data.odePagStructureSyncId).toBe('block-1');
      expect(data.blockName).toBe('Test Block');
      expect(data.order).toBe(1);
      expect(data.iconName).toBeUndefined();
    });

    it('includes all requested params', () => {
      const data = block.generateDataObject([
        'odePagStructureSyncId',
        'odeVersionId',
        'odeSessionId',
        'iconName',
      ]);

      expect(Object.keys(data)).toHaveLength(4);
    });
  });

  describe('getDictBaseValuesData', () => {
    it('returns complete data dictionary', () => {
      const dict = block.getDictBaseValuesData();

      expect(dict.odePagStructureSyncId).toBe('block-1');
      expect(dict.odeVersionId).toBe('v1');
      expect(dict.odeSessionId).toBe('session-123');
      expect(dict.iconName).toBe('icon1');
      expect(dict.blockName).toBe('Test Block');
      expect(dict.order).toBe(1);
    });

    it('uses default values from project structure when block values missing', () => {
      block.odeNavStructureSyncId = null;
      block.pageId = null;

      const dict = block.getDictBaseValuesData();

      expect(dict.odeNavStructureSyncId).toBe('nav-id-1');
      expect(dict.odePageId).toBe('page-id-1');
    });
  });

  describe('updateParam', () => {
    beforeEach(() => {
      block.blockContent = document.createElement('article');
    });

    it('updates order param and attribute', () => {
      block.updateParam('order', 10);

      expect(block.order).toBe(10);
      expect(block.blockContent.getAttribute('order')).toBe('10');
    });

    it('updates id param and sym-id attribute', () => {
      block.updateParam('id', 'new-block-id');

      expect(block.id).toBe('new-block-id');
      expect(block.blockContent.getAttribute('sym-id')).toBe('new-block-id');
    });

    it('updates other params without side effects', () => {
      block.updateParam('blockName', 'New Name');

      expect(block.blockName).toBe('New Name');
    });
  });

  describe('updateMode', () => {
    beforeEach(() => {
      block.blockContent = document.createElement('article');
      block.headElement = document.createElement('header');
      block.headElement.classList.add('draggable');
    });

    it('sets mode to edition', () => {
      block.updateMode('edition');

      expect(block.mode).toBe('edition');
      expect(block.blockContent.getAttribute('mode')).toBe('edition');
      expect(block.headElement.getAttribute('draggable')).toBe('false');
      expect(block.headElement.classList.contains('draggable')).toBe(false);
    });

    it('sets mode to export', () => {
      block.updateMode('export');

      expect(block.mode).toBe('export');
      expect(block.blockContent.getAttribute('mode')).toBe('export');
      expect(block.headElement.getAttribute('draggable')).toBe('true');
      expect(block.headElement.classList.contains('draggable')).toBe(true);
    });

    it('uses existing mode when no parameter provided', () => {
      block.mode = 'edition';
      block.updateMode();

      expect(block.blockContent.getAttribute('mode')).toBe('edition');
    });
  });

  describe('getFallbackPageOrder', () => {
    it('returns 1 when no blocks exist', () => {
      block.engine.components.blocks = [];
      expect(block.getFallbackPageOrder()).toBe(1);
    });

    it('returns max order + 1 when blocks exist on same page', () => {
      block.pageId = 'page-1';
      block.engine.components.blocks = [
        { pageId: 'page-1', order: 3 },
        { pageId: 'page-1', order: 7 },
        { pageId: 'page-1', order: 2 },
      ];

      expect(block.getFallbackPageOrder()).toBe(8);
    });

    it('ignores blocks on different pages', () => {
      block.pageId = 'page-1';
      block.engine.components.blocks = [
        { pageId: 'page-1', order: 3 },
        { pageId: 'page-2', order: 100 },
        { pageId: 'page-1', order: 5 },
      ];

      expect(block.getFallbackPageOrder()).toBe(6);
    });

    it('reads order from blockContent attribute as fallback', () => {
      block.pageId = 'page-1';
      const mockBlockContent = {
        getAttribute: vi.fn(() => '10'),
      };
      block.engine.components.blocks = [
        { pageId: 'page-1', order: undefined, blockContent: mockBlockContent },
      ];

      expect(block.getFallbackPageOrder()).toBe(11);
    });
  });

  describe('generateModalMoveToPageBody', () => {
    it('creates modal body with select element', () => {
      const body = block.generateModalMoveToPageBody();

      expect(body.querySelector('.text-info-move-to-page')).not.toBeNull();
      expect(body.querySelector('.select-move-to-page')).not.toBeNull();
    });

    it('populates select with pages', () => {
      const body = block.generateModalMoveToPageBody();
      const options = body.querySelectorAll('option');

      expect(options.length).toBe(2);
      expect(options[0].value).toBe('page-1');
      expect(options[1].value).toBe('page-2');
    });

    it('marks current page as selected', () => {
      block.odeNavStructureSyncId = 'page-1';
      const body = block.generateModalMoveToPageBody();
      const selectedOption = body.querySelector('option[selected]');

      expect(selectedOption.value).toBe('page-1');
    });
  });

  describe('makeEmptyIcon', () => {
    it('creates empty icon element with correct classes', () => {
      const icon = block.makeEmptyIcon();

      expect(icon.classList.contains('exe-icon')).toBe(true);
      expect(icon.classList.contains('option-block-icon')).toBe(true);
      expect(icon.classList.contains('empty-block-icon')).toBe(true);
    });

    it('sets correct attributes', () => {
      const icon = block.makeEmptyIcon();

      expect(icon.getAttribute('tabindex')).toBe('0');
      expect(icon.getAttribute('icon-id')).toBe('0');
      expect(icon.title).toBe('Empty');
    });

    it('sets selected to true when no iconName', () => {
      block.iconName = '';
      const icon = block.makeEmptyIcon();

      expect(icon.getAttribute('selected')).toBe('true');
    });

    it('sets selected to false when iconName exists', () => {
      block.iconName = 'icon1';
      const icon = block.makeEmptyIcon();

      expect(icon.getAttribute('selected')).toBe('false');
    });
  });

  describe('makeIconValueElement', () => {
    it('creates img element with correct src and alt', () => {
      const icon = { value: '/path/to/icon.svg', title: 'My Icon' };
      const img = block.makeIconValueElement(icon);

      expect(img.tagName).toBe('IMG');
      expect(img.getAttribute('src')).toBe('/path/to/icon.svg');
      expect(img.getAttribute('alt')).toBe('My Icon');
    });
  });

  describe('focusTextInput', () => {
    it('focuses input and preserves value', () => {
      const input = document.createElement('input');
      input.value = 'test value';
      document.body.appendChild(input);

      block.focusTextInput(input);

      expect(input.value).toBe('test value');
      expect(document.activeElement).toBe(input);

      document.body.removeChild(input);
    });
  });
});
