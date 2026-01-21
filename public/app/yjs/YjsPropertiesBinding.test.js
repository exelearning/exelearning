/**
 * YjsPropertiesBinding Tests
 *
 * Unit tests for YjsPropertiesBinding - bidirectional binding between form inputs and Y.Map('metadata').
 *
 */

 

// Test functions available globally from vitest setup

const YjsPropertiesBinding = require('./YjsPropertiesBinding');

// Mock Document Manager
const createMockDocumentManager = () => {
  const ydoc = new window.Y.Doc();
  const metadata = ydoc.getMap('metadata');

  return {
    getMetadata: mock(() => metadata),
    getDoc: mock(() => ydoc),
  };
};

describe('YjsPropertiesBinding', () => {
  let binding;
  let mockDocManager;
  let mockFormElement;
  const originalTranslate = global._;

  beforeEach(() => {
    mockDocManager = createMockDocumentManager();
    binding = new YjsPropertiesBinding(mockDocManager);

    // Setup global mocks
    global._ = mock((key) => key);

    // Don't replace window entirely - just set the eXeLearning property
    // This preserves document and other DOM APIs from happy-dom
    window.eXeLearning = {
      app: {
        interface: {
          odeTitleElement: {
            checkTitleLineCount: mock(() => undefined),
          },
        },
      },
    };

    // Create mock form element
    mockFormElement = document.createElement('form');

    // Suppress console.log during tests
    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original globals instead of deleting
    global._ = originalTranslate;
    // Clean up eXeLearning mock (don't replace entire window)
    if (typeof window !== 'undefined') {
      delete window.eXeLearning;
    }
    if (binding) {
      binding.destroy();
    }
  });

  describe('constructor', () => {
    it('initializes with document manager', () => {
      expect(binding.documentManager).toBe(mockDocManager);
    });

    it('initializes metadata reference', () => {
      expect(binding.metadata).toBeDefined();
    });

    it('initializes ydoc reference', () => {
      expect(binding.ydoc).toBeDefined();
    });

    it('initializes empty boundInputs map', () => {
      expect(binding.boundInputs).toBeInstanceOf(Map);
      expect(binding.boundInputs.size).toBe(0);
    });

    it('initializes debounce settings', () => {
      expect(binding.debounceDelay).toBe(300);
      expect(binding.debounceTimers).toBeInstanceOf(Map);
    });

    it('initializes property key map', () => {
      expect(binding.propertyKeyMap).toBeDefined();
      expect(binding.propertyKeyMap.pp_title).toBe('title');
      expect(binding.propertyKeyMap.pp_author).toBe('author');
    });
  });

  describe('mapPropertyToMetadataKey', () => {
    it('maps pp_title to title', () => {
      expect(binding.mapPropertyToMetadataKey('pp_title')).toBe('title');
    });

    it('maps pp_author to author', () => {
      expect(binding.mapPropertyToMetadataKey('pp_author')).toBe('author');
    });

    it('maps pp_lang to language', () => {
      expect(binding.mapPropertyToMetadataKey('pp_lang')).toBe('language');
    });

    it('returns original key if not in map', () => {
      expect(binding.mapPropertyToMetadataKey('unknown')).toBe('unknown');
    });
  });

  describe('mapMetadataKeyToProperty', () => {
    it('maps title to pp_title', () => {
      expect(binding.mapMetadataKeyToProperty('title')).toBe('pp_title');
    });

    it('maps author to pp_author', () => {
      expect(binding.mapMetadataKeyToProperty('author')).toBe('pp_author');
    });

    it('maps language to pp_lang', () => {
      expect(binding.mapMetadataKeyToProperty('language')).toBe('pp_lang');
    });

    it('returns original key if not found', () => {
      expect(binding.mapMetadataKeyToProperty('unknown')).toBe('unknown');
    });
  });

  describe('bindForm', () => {
    it('sets formElement reference', () => {
      binding.bindForm(mockFormElement);
      expect(binding.formElement).toBe(mockFormElement);
    });

    it('binds inputs with property-value class', () => {
      const input = document.createElement('input');
      input.className = 'property-value';
      input.setAttribute('property', 'pp_title');
      input.type = 'text';
      mockFormElement.appendChild(input);

      binding.bindForm(mockFormElement);

      expect(binding.boundInputs.has(input)).toBe(true);
    });

    it('unbinds previous form before binding new one', () => {
      const unbindSpy = spyOn(binding, 'unbindForm');

      binding.bindForm(mockFormElement);
      binding.bindForm(document.createElement('form'));

      expect(unbindSpy).toHaveBeenCalled();
    });

    it('sets up metadata observer', () => {
      binding.bindForm(mockFormElement);
      expect(binding.metadataObserver).toBeDefined();
    });
  });

  describe('bindInput', () => {
    it('skips input without property attribute', () => {
      const input = document.createElement('input');
      binding.bindInput(input);
      expect(binding.boundInputs.has(input)).toBe(false);
    });

    it('binds text input with input event', () => {
      const input = document.createElement('input');
      input.setAttribute('property', 'pp_title');
      input.type = 'text';

      const addEventListenerSpy = spyOn(input, 'addEventListener');
      binding.bindInput(input);

      expect(addEventListenerSpy).toHaveBeenCalledWith('input', expect.any(Function));
    });

    it('binds checkbox with change event', () => {
      const input = document.createElement('input');
      input.setAttribute('property', 'pp_addExeLink');
      input.type = 'checkbox';
      input.setAttribute('data-type', 'checkbox');

      const addEventListenerSpy = spyOn(input, 'addEventListener');
      binding.bindInput(input);

      expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('initializes input value from Yjs', () => {
      binding.metadata.set('title', 'Test Title');

      const input = document.createElement('input');
      input.setAttribute('property', 'pp_title');
      input.type = 'text';

      binding.bindInput(input);

      expect(input.value).toBe('Test Title');
    });
  });

  describe('updateYjsFromInput', () => {
    it('updates metadata with text value', () => {
      const input = document.createElement('input');
      input.value = 'New Title';

      binding.updateYjsFromInput(input, 'title', 'text');

      expect(binding.metadata.get('title')).toBe('New Title');
    });

    it('updates metadata with checkbox value as string', () => {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = true;

      binding.updateYjsFromInput(input, 'addExeLink', 'checkbox');

      expect(binding.metadata.get('addExeLink')).toBe('true');
    });

    it('updates modifiedAt timestamp', () => {
      const input = document.createElement('input');
      input.value = 'Test';

      binding.updateYjsFromInput(input, 'title', 'text');

      expect(binding.metadata.get('modifiedAt')).toBeDefined();
    });
  });

  describe('updateInputFromYjs', () => {
    it('updates text input from metadata', () => {
      binding.metadata.set('title', 'From Yjs');

      const input = document.createElement('input');
      input.type = 'text';

      binding.updateInputFromYjs(input, 'title', 'text');

      expect(input.value).toBe('From Yjs');
    });

    it('updates checkbox from metadata (string true)', () => {
      binding.metadata.set('addExeLink', 'true');

      const input = document.createElement('input');
      input.type = 'checkbox';

      binding.updateInputFromYjs(input, 'addExeLink', 'checkbox');

      expect(input.checked).toBe(true);
    });

    it('updates checkbox from metadata (boolean true)', () => {
      binding.metadata.set('addExeLink', true);

      const input = document.createElement('input');
      input.type = 'checkbox';

      binding.updateInputFromYjs(input, 'addExeLink', 'checkbox');

      expect(input.checked).toBe(true);
    });

    it('does nothing if value is undefined', () => {
      const input = document.createElement('input');
      input.value = 'original';

      binding.updateInputFromYjs(input, 'nonexistent', 'text');

      expect(input.value).toBe('original');
    });

    it('sets isUpdatingFromYjs flag during update', () => {
      binding.metadata.set('title', 'Test');
      const input = document.createElement('input');

      let wasFlagSet = false;
      const originalSet = Object.getOwnPropertyDescriptor(input, 'value')?.set;

      Object.defineProperty(input, 'value', {
        set(val) {
          wasFlagSet = binding.isUpdatingFromYjs;
          if (originalSet) originalSet.call(this, val);
        },
        get() {
          return '';
        },
      });

      binding.updateInputFromYjs(input, 'title', 'text');

      expect(wasFlagSet).toBe(true);
    });
  });

  describe('unbindForm', () => {
    it('removes input listeners', () => {
      const input = document.createElement('input');
      input.className = 'property-value';
      input.setAttribute('property', 'pp_title');
      input.type = 'text';
      mockFormElement.appendChild(input);

      binding.bindForm(mockFormElement);
      const removeEventListenerSpy = spyOn(input, 'removeEventListener');

      binding.unbindForm();

      expect(removeEventListenerSpy).toHaveBeenCalled();
    });

    it('clears boundInputs map', () => {
      const input = document.createElement('input');
      input.className = 'property-value';
      input.setAttribute('property', 'pp_title');
      mockFormElement.appendChild(input);

      binding.bindForm(mockFormElement);
      binding.unbindForm();

      expect(binding.boundInputs.size).toBe(0);
    });

    it('clears debounce timers', () => {
      

      binding.debounceTimers.set('title', setTimeout(() => {}, 1000));
      binding.unbindForm();

      expect(binding.debounceTimers.size).toBe(0);

      
    });

    it('removes metadata observer', () => {
      binding.bindForm(mockFormElement);
      expect(binding.metadataObserver).toBeDefined();

      binding.unbindForm();

      expect(binding.metadataObserver).toBeNull();
    });

    it('sets formElement to null', () => {
      binding.bindForm(mockFormElement);
      binding.unbindForm();

      expect(binding.formElement).toBeNull();
    });
  });

  describe('bindTitleElement', () => {
    it('sets titleElement reference', () => {
      const titleEl = document.createElement('h2');
      binding.bindTitleElement(titleEl);

      expect(binding.titleElement).toBe(titleEl);
    });

    it('initializes title from Yjs', () => {
      binding.metadata.set('title', 'Project Title');

      const titleEl = document.createElement('h2');
      binding.bindTitleElement(titleEl);

      expect(titleEl.textContent).toBe('Project Title');
    });

    it('unbinds previous title element', () => {
      const titleEl1 = document.createElement('h2');
      const titleEl2 = document.createElement('h2');

      binding.bindTitleElement(titleEl1);
      binding.bindTitleElement(titleEl2);

      expect(binding.titleElement).toBe(titleEl2);
    });
  });

  describe('updateTitleInYjs', () => {
    it('updates title in metadata', () => {
      binding.updateTitleInYjs('New Title');

      expect(binding.metadata.get('title')).toBe('New Title');
    });

    it('updates modifiedAt timestamp', () => {
      binding.updateTitleInYjs('New Title');

      expect(binding.metadata.get('modifiedAt')).toBeDefined();
    });

    it('updates form input if exists', () => {
      const input = document.createElement('input');
      input.className = 'property-value';
      input.setAttribute('property', 'pp_title');
      mockFormElement.appendChild(input);

      binding.bindForm(mockFormElement);
      binding.updateTitleInYjs('Updated Title');

      expect(input.value).toBe('Updated Title');
    });
  });

  describe('updateTitleElementFromYjs', () => {
    it('updates title element text', () => {
      const titleEl = document.createElement('h2');
      binding.titleElement = titleEl;
      binding.metadata.set('title', 'From Yjs');

      binding.updateTitleElementFromYjs();

      expect(titleEl.textContent).toBe('From Yjs');
    });

    it('uses default title if metadata is empty', () => {
      const titleEl = document.createElement('h2');
      binding.titleElement = titleEl;

      binding.updateTitleElementFromYjs();

      expect(titleEl.textContent).toBe('Untitled document');
    });

    it('does nothing if titleElement is null', () => {
      // Should not throw
      binding.updateTitleElementFromYjs();
    });

    it('skips update if content is same', () => {
      const titleEl = document.createElement('h2');
      titleEl.textContent = 'Same Title';
      binding.titleElement = titleEl;
      binding.metadata.set('title', 'Same Title');

      // Spy on textContent setter
      const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
      const setSpy = mock(() => undefined);
      Object.defineProperty(titleEl, 'textContent', {
        get: descriptor.get,
        set: setSpy,
      });

      binding.updateTitleElementFromYjs();

      // Should not have been called since content is same
      // (but we already set it initially, so check no extra calls)
    });
  });

  describe('unbindTitleElement', () => {
    it('sets titleElement to null', () => {
      const titleEl = document.createElement('h2');
      binding.bindTitleElement(titleEl);
      binding.unbindTitleElement();

      expect(binding.titleElement).toBeNull();
    });
  });

  describe('isRemoteUpdate', () => {
    it('returns isUpdatingFromYjs flag', () => {
      expect(binding.isRemoteUpdate()).toBe(false);

      binding.isUpdatingFromYjs = true;
      expect(binding.isRemoteUpdate()).toBe(true);
    });
  });

  describe('getValue', () => {
    it('returns metadata value for property key', () => {
      binding.metadata.set('title', 'Test Title');
      expect(binding.getValue('pp_title')).toBe('Test Title');
    });

    it('returns undefined for non-existent key', () => {
      expect(binding.getValue('pp_nonexistent')).toBeUndefined();
    });
  });

  describe('setValue', () => {
    it('sets metadata value for property key', () => {
      binding.setValue('pp_title', 'New Title');
      expect(binding.metadata.get('title')).toBe('New Title');
    });

    it('updates modifiedAt timestamp', () => {
      binding.setValue('pp_title', 'Test');
      expect(binding.metadata.get('modifiedAt')).toBeDefined();
    });
  });

  describe('destroy', () => {
    it('unbinds form', () => {
      const unbindFormSpy = spyOn(binding, 'unbindForm');
      binding.destroy();
      expect(unbindFormSpy).toHaveBeenCalled();
    });

    it('unbinds title element', () => {
      const unbindTitleSpy = spyOn(binding, 'unbindTitleElement');
      binding.destroy();
      expect(unbindTitleSpy).toHaveBeenCalled();
    });

    it('clears references', () => {
      binding.destroy();

      expect(binding.documentManager).toBeNull();
      expect(binding.metadata).toBeNull();
      expect(binding.ydoc).toBeNull();
    });
  });

  describe('syncTitleToHeader', () => {
    beforeEach(() => {
      // Setup DOM structure
      const container = document.createElement('div');
      container.id = 'exe-title';

      const titleContent = document.createElement('span');
      titleContent.className = 'exe-title content';

      container.appendChild(titleContent);
      document.body.appendChild(container);
    });

    afterEach(() => {
      const container = document.getElementById('exe-title');
      if (container) {
        container.remove();
      }
    });

    it('updates header title from metadata', () => {
      binding.metadata.set('title', 'Updated Title');
      binding.syncTitleToHeader();

      const headerTitle = document.querySelector('#exe-title > .exe-title.content');
      expect(headerTitle.textContent).toBe('Updated Title');
    });

    it('skips update if element is in editing mode', () => {
      const headerTitle = document.querySelector('#exe-title > .exe-title.content');
      headerTitle.setAttribute('contenteditable', 'true');
      headerTitle.textContent = 'Original';

      binding.metadata.set('title', 'New Title');
      binding.syncTitleToHeader();

      expect(headerTitle.textContent).toBe('Original');
    });

    it('does nothing if header element not found', () => {
      document.getElementById('exe-title').remove();

      // Should not throw
      binding.syncTitleToHeader();
    });
  });

  describe('onMetadataKeyChanged', () => {
    it('skips modifiedAt key', () => {
      const updateSpy = spyOn(binding, 'updateInputFromYjs');
      binding.onMetadataKeyChanged('modifiedAt');
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('skips createdAt key', () => {
      const updateSpy = spyOn(binding, 'updateInputFromYjs');
      binding.onMetadataKeyChanged('createdAt');
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('updates corresponding input', () => {
      const input = document.createElement('input');
      input.className = 'property-value';
      input.setAttribute('property', 'pp_title');
      input.type = 'text';
      mockFormElement.appendChild(input);

      binding.bindForm(mockFormElement);
      binding.metadata.set('title', 'Changed Title');

      binding.onMetadataKeyChanged('title');

      expect(input.value).toBe('Changed Title');
    });

    it('updates title element if title changed', () => {
      const titleEl = document.createElement('h2');
      binding.titleElement = titleEl;
      binding.metadata.set('title', 'New Title');

      const updateSpy = spyOn(binding, 'updateTitleElementFromYjs');
      binding.onMetadataKeyChanged('title');

      expect(updateSpy).toHaveBeenCalled();
    });
  });

  describe('pp_addMathJax property', () => {
    it('stores addMathJax property in Yjs metadata', () => {
      binding.setValue('pp_addMathJax', 'true');
      expect(binding.metadata.get('addMathJax')).toBe('true');
    });

    it('reads addMathJax from metadata', () => {
      binding.metadata.set('addMathJax', 'true');
      expect(binding.getValue('pp_addMathJax')).toBe('true');
    });

    it('binds pp_addMathJax checkbox input', () => {
      const checkbox = document.createElement('input');
      checkbox.className = 'property-value';
      checkbox.setAttribute('property', 'pp_addMathJax');
      checkbox.type = 'checkbox';
      checkbox.setAttribute('data-type', 'checkbox');
      mockFormElement.appendChild(checkbox);

      binding.bindForm(mockFormElement);

      expect(binding.boundInputs.has(checkbox)).toBe(true);
    });

    it('initializes checkbox state from Yjs metadata (true)', () => {
      binding.metadata.set('addMathJax', 'true');

      const checkbox = document.createElement('input');
      checkbox.className = 'property-value';
      checkbox.setAttribute('property', 'pp_addMathJax');
      checkbox.type = 'checkbox';
      checkbox.setAttribute('data-type', 'checkbox');
      mockFormElement.appendChild(checkbox);

      binding.bindForm(mockFormElement);

      expect(checkbox.checked).toBe(true);
    });

    it('initializes checkbox state from Yjs metadata (false)', () => {
      binding.metadata.set('addMathJax', 'false');

      const checkbox = document.createElement('input');
      checkbox.className = 'property-value';
      checkbox.setAttribute('property', 'pp_addMathJax');
      checkbox.type = 'checkbox';
      checkbox.setAttribute('data-type', 'checkbox');
      mockFormElement.appendChild(checkbox);

      binding.bindForm(mockFormElement);

      expect(checkbox.checked).toBe(false);
    });

    it('updates Yjs when checkbox is checked via updateYjsFromInput', () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;

      binding.updateYjsFromInput(checkbox, 'addMathJax', 'checkbox');

      expect(binding.metadata.get('addMathJax')).toBe('true');
    });

    it('updates Yjs when checkbox is unchecked via updateYjsFromInput', () => {
      binding.metadata.set('addMathJax', 'true');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = false;

      binding.updateYjsFromInput(checkbox, 'addMathJax', 'checkbox');

      expect(binding.metadata.get('addMathJax')).toBe('false');
    });

    it('handles boolean true value from metadata', () => {
      binding.metadata.set('addMathJax', true);

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';

      binding.updateInputFromYjs(checkbox, 'addMathJax', 'checkbox');

      expect(checkbox.checked).toBe(true);
    });

    it('handles boolean false value from metadata', () => {
      binding.metadata.set('addMathJax', false);

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = true;  // Start as checked

      binding.updateInputFromYjs(checkbox, 'addMathJax', 'checkbox');

      expect(checkbox.checked).toBe(false);
    });

    it('maps pp_addMathJax to addMathJax metadata key', () => {
      expect(binding.mapPropertyToMetadataKey('pp_addMathJax')).toBe('addMathJax');
    });

    it('maps addMathJax to pp_addMathJax property', () => {
      expect(binding.mapMetadataKeyToProperty('addMathJax')).toBe('pp_addMathJax');
    });
  });

  describe('legacy license detection', () => {
    it('injects synthetic option when select value is not in options', () => {
      // Create a select with limited options (non-legacy licenses only)
      const select = document.createElement('select');
      select.className = 'property-value';
      select.setAttribute('property', 'pp_license');
      select.setAttribute('data-type', 'select');

      const option1 = document.createElement('option');
      option1.value = 'creative commons: attribution 4.0';
      option1.text = 'CC BY 4.0';
      select.appendChild(option1);

      const option2 = document.createElement('option');
      option2.value = 'public domain';
      option2.text = 'Public Domain';
      select.appendChild(option2);

      // Set a legacy license value in Yjs
      binding.metadata.set('license', 'creative commons: attribution 3.0');

      // Update the select from Yjs
      binding.updateInputFromYjs(select, 'license', 'select');

      // Verify synthetic option was injected with warning in text
      expect(select.options.length).toBe(3);
      expect(select.options[0].value).toBe('creative commons: attribution 3.0');
      expect(select.options[0].textContent).toContain('creative commons: attribution 3.0');
      expect(select.options[0].textContent).toContain('⚠️');
      expect(select.options[0].textContent).toContain('Legacy');
      expect(select.dataset.legacyValue).toBe('true');
    });

    it('does NOT inject synthetic option when value is in options', () => {
      const select = document.createElement('select');
      select.className = 'property-value';
      select.setAttribute('property', 'pp_license');
      select.setAttribute('data-type', 'select');

      const option1 = document.createElement('option');
      option1.value = 'creative commons: attribution 4.0';
      option1.text = 'CC BY 4.0';
      select.appendChild(option1);

      // Set a valid (non-legacy) license value in Yjs
      binding.metadata.set('license', 'creative commons: attribution 4.0');

      // Update the select from Yjs
      binding.updateInputFromYjs(select, 'license', 'select');

      // Should NOT have injected any option
      expect(select.options.length).toBe(1);
      expect(select.dataset.legacyValue).toBeUndefined();
    });

    it('injectLegacyOption creates correct synthetic option with warning in text', () => {
      const select = document.createElement('select');

      binding.injectLegacyOption(select, 'license gfdl');

      expect(select.options.length).toBe(1);
      expect(select.options[0].value).toBe('license gfdl');
      expect(select.options[0].textContent).toContain('license gfdl');
      expect(select.options[0].textContent).toContain('⚠️');
      expect(select.options[0].textContent).toContain('Legacy');
      expect(select.options[0].selected).toBe(true);
      expect(select.options[0].dataset.legacySynthetic).toBe('true');
      // CSS styling via data attribute, no class needed
      expect(select.dataset.legacyValue).toBe('true');
    });

    it('removes legacy warning when valid license is selected', () => {
      const select = document.createElement('select');
      select.className = 'property-value';

      // Add a valid option
      const validOption = document.createElement('option');
      validOption.value = 'public domain';
      validOption.text = 'Public Domain';
      select.appendChild(validOption);

      // First set a legacy license
      binding.metadata.set('license', 'gnu/gpl');
      binding.updateInputFromYjs(select, 'license', 'select');

      // Verify legacy warning is present via data attribute
      expect(select.dataset.legacyValue).toBe('true');
      expect(select.options.length).toBe(2); // synthetic + valid

      // Now select a valid license
      binding.metadata.set('license', 'public domain');
      binding.updateInputFromYjs(select, 'license', 'select');

      // Verify legacy warning is removed
      expect(select.dataset.legacyValue).toBeUndefined();
      expect(select.options.length).toBe(1); // only valid option remains
      expect(select.value).toBe('public domain');
    });

    it('removeLegacyWarning cleans up select element', () => {
      const select = document.createElement('select');

      // Inject legacy option first
      binding.injectLegacyOption(select, 'free software license eupl');

      // Verify it was added
      expect(select.options.length).toBe(1);
      expect(select.dataset.legacyValue).toBe('true');

      // Remove it
      binding.removeLegacyWarning(select);

      // Verify it was removed
      expect(select.options.length).toBe(0);
      expect(select.dataset.legacyValue).toBeUndefined();
    });
  });
});
