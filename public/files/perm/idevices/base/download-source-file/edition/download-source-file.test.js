/**
 * Download Source File iDevice - Edition Tests
 *
 * Unit tests for the download-source-file iDevice edition code.
 * Tests the $exeDevice object methods for form creation, validation, and saving.
 *
 * Run with: make test-frontend
 */

/* eslint-disable no-undef */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('download-source-file iDevice (edition)', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice
    global.$exeDevice = undefined;

    // Load the iDevice
    $exeDevice = global.loadIdevice(join(__dirname, 'download-source-file.js'));

    // Extend eXe.app with getProjectProperties (don't replace the whole object)
    global.eXe.app.getProjectProperties = vi.fn(() => ({
      pp_title: { value: 'Test Project' },
      pp_description: { value: 'A test description' },
      pp_author: { value: 'Test Author' },
      pp_license: { value: 'creative commons: attribution 4.0' },
    }));

  });

  afterEach(() => {
    global.$exeDevice = undefined;
    vi.clearAllMocks();
  });

  describe('i18n', () => {
    it('has translated name', () => {
      expect($exeDevice.i18n.name).toBe('Download source file');
    });
  });

  describe('warningMessage', () => {
    it('contains warning HTML', () => {
      expect($exeDevice.warningMessage).toContain('exe-block-warning');
      expect($exeDevice.warningMessage).toContain('Properties tab');
    });
  });

  describe('eXeLicenses', () => {
    it('contains Creative Commons licenses', () => {
      expect($exeDevice.eXeLicenses).toBeInstanceOf(Array);
      expect($exeDevice.eXeLicenses.length).toBeGreaterThan(0);
    });

    it('has license entries with name and path', () => {
      const firstLicense = $exeDevice.eXeLicenses[0];
      expect(firstLicense).toBeInstanceOf(Array);
      expect(firstLicense.length).toBe(2);
      expect(typeof firstLicense[0]).toBe('string');
      expect(typeof firstLicense[1]).toBe('string');
    });

    it('includes CC BY 4.0', () => {
      const byLicense = $exeDevice.eXeLicenses.find((l) => l[1] === 'by/4.0');
      expect(byLicense).toBeDefined();
      expect(byLicense[0]).toContain('attribution 4.0');
    });

    it('includes CC BY-SA 4.0', () => {
      const bysaLicense = $exeDevice.eXeLicenses.find((l) => l[1] === 'by-sa/4.0');
      expect(bysaLicense).toBeDefined();
      expect(bysaLicense[0]).toContain('share alike 4.0');
    });

    it('includes licenses from versions 2.5, 3.0, and 4.0', () => {
      const v25 = $exeDevice.eXeLicenses.filter((l) => l[1].includes('2.5'));
      const v30 = $exeDevice.eXeLicenses.filter((l) => l[1].includes('3.0'));
      const v40 = $exeDevice.eXeLicenses.filter((l) => l[1].includes('4.0'));

      expect(v25.length).toBeGreaterThan(0);
      expect(v30.length).toBeGreaterThan(0);
      expect(v40.length).toBeGreaterThan(0);
    });
  });

  describe('completeLicense', () => {
    it('returns HTML link for known license', () => {
      const result = $exeDevice.completeLicense('creative commons: attribution 4.0');

      expect(result).toContain('<a href="https://creativecommons.org/licenses/by/4.0/"');
      expect(result).toContain('rel="license"');
      expect(result).toContain('class="cc cc-by"');
      expect(result).toContain('Creative Commons BY 4.0');
    });

    it('returns HTML link for BY-SA license', () => {
      const result = $exeDevice.completeLicense('creative commons: attribution - share alike 4.0');

      expect(result).toContain('https://creativecommons.org/licenses/by-sa/4.0/');
      expect(result).toContain('class="cc cc-by-sa"');
      expect(result).toContain('BY-SA 4.0');
    });

    it('returns HTML link for BY-NC-ND license', () => {
      const result = $exeDevice.completeLicense(
        'creative commons: attribution - non derived work - non commercial 4.0'
      );

      expect(result).toContain('https://creativecommons.org/licenses/by-nc-nd/4.0/');
      expect(result).toContain('class="cc cc-by-nc-nd"');
    });

    it('returns original string for unknown license', () => {
      const unknownLicense = 'Some unknown license';
      const result = $exeDevice.completeLicense(unknownLicense);

      expect(result).toBe(unknownLicense);
    });

    it('handles version 3.0 licenses', () => {
      const result = $exeDevice.completeLicense('creative commons: attribution 3.0');

      expect(result).toContain('https://creativecommons.org/licenses/by/3.0/');
      expect(result).toContain('BY 3.0');
    });

    it('handles version 2.5 licenses', () => {
      const result = $exeDevice.completeLicense('creative commons: attribution 2.5');

      expect(result).toContain('https://creativecommons.org/licenses/by/2.5/');
      expect(result).toContain('BY 2.5');
    });
  });

  describe('rgb2hex', () => {
    it('converts RGB string to hex', () => {
      expect($exeDevice.rgb2hex('rgb(255, 0, 0)')).toBe('ff0000');
      expect($exeDevice.rgb2hex('rgb(0, 255, 0)')).toBe('00ff00');
      expect($exeDevice.rgb2hex('rgb(0, 0, 255)')).toBe('0000ff');
    });

    it('converts RGB with no spaces', () => {
      expect($exeDevice.rgb2hex('rgb(255,128,64)')).toBe('ff8040');
    });

    it('handles rgba format', () => {
      expect($exeDevice.rgb2hex('rgba(255, 0, 0, 1)')).toBe('ff0000');
      expect($exeDevice.rgb2hex('rgba(0, 128, 255, 0.5)')).toBe('0080ff');
    });

    it('returns original string if not RGB format', () => {
      expect($exeDevice.rgb2hex('#ff0000')).toBe('#ff0000');
      expect($exeDevice.rgb2hex('red')).toBe('red');
    });

    it('pads single digit hex values with zero', () => {
      expect($exeDevice.rgb2hex('rgb(0, 0, 0)')).toBe('000000');
      expect($exeDevice.rgb2hex('rgb(15, 15, 15)')).toBe('0f0f0f');
    });
  });

  describe('init', () => {
    it('stores element, previousData, and path', () => {
      const element = document.createElement('div');
      const previousData = '<p>Previous content</p>';
      const path = '/test/path';

      // Mock createForm to prevent DOM manipulation
      $exeDevice.createForm = vi.fn();

      $exeDevice.init(element, previousData, path);

      expect($exeDevice.ideviceBody).toBe(element);
      expect($exeDevice.idevicePreviousData).toBe(previousData);
      expect($exeDevice.idevicePath).toBe(path);
    });

    it('calls createForm', () => {
      const element = document.createElement('div');
      const createFormSpy = vi.spyOn($exeDevice, 'createForm').mockImplementation(() => {});

      $exeDevice.init(element, '', '');

      expect(createFormSpy).toHaveBeenCalled();
    });
  });

  describe('createForm', () => {
    let container;

    beforeEach(() => {
      container = document.createElement('div');
      $exeDevice.ideviceBody = container;
      $exeDevice.idevicePreviousData = '';
      $exeDevice.loadPreviousValues = vi.fn();
    });

    it('creates form with textarea', () => {
      $exeDevice.createForm();

      const textarea = container.querySelector('#dpiDescription');
      expect(textarea).not.toBeNull();
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('creates form with button text input', () => {
      $exeDevice.createForm();

      const input = container.querySelector('#dpiButtonText');
      expect(input).not.toBeNull();
      expect(input.type).toBe('text');
    });

    it('creates form with font size select', () => {
      $exeDevice.createForm();

      const select = container.querySelector('#dpiButtonFontSize');
      expect(select).not.toBeNull();
      expect(select.tagName).toBe('SELECT');
      expect(select.options.length).toBe(6);
    });

    it('creates form with color pickers', () => {
      $exeDevice.createForm();

      const bgColor = container.querySelector('#dpiButtonBGcolor');
      const textColor = container.querySelector('#dpiButtonTextColor');

      expect(bgColor).not.toBeNull();
      expect(bgColor.type).toBe('color');
      expect(bgColor.value).toBe('#107275');

      expect(textColor).not.toBeNull();
      expect(textColor.type).toBe('color');
      expect(textColor.value).toBe('#ffffff');
    });

    it('populates form with project properties', () => {
      $exeDevice.createForm();

      const content = container.innerHTML;
      expect(content).toContain('Test Project');
      expect(content).toContain('A test description');
      expect(content).toContain('Test Author');
    });

    it('shows alert when all properties are empty', () => {
      global.eXe.app.getProjectProperties = vi.fn(() => ({
        pp_title: { value: '' },
        pp_description: { value: '' },
        pp_author: { value: '' },
        pp_license: { value: '' },
      }));

      $exeDevice.createForm();

      expect(global.eXe.app.alert).toHaveBeenCalledWith(expect.stringContaining('Properties tab'));
    });

    it('calls loadPreviousValues', () => {
      $exeDevice.createForm();

      expect($exeDevice.loadPreviousValues).toHaveBeenCalled();
    });

    it('includes license link for CC license', () => {
      $exeDevice.createForm();

      const content = container.innerHTML;
      expect(content).toContain('creativecommons.org/licenses/by/4.0');
    });
  });

  describe('loadPreviousValues', () => {
    let container;

    beforeEach(() => {
      container = document.createElement('div');
      container.innerHTML = `
        <textarea id="dpiDescription"></textarea>
        <input type="text" id="dpiButtonText" value="" />
        <select id="dpiButtonFontSize">
          <option value="1">100%</option>
          <option value="1.1">110%</option>
          <option value="1.2">120%</option>
        </select>
        <input type="color" id="dpiButtonBGcolor" value="#107275" />
        <input type="color" id="dpiButtonTextColor" value="#ffffff" />
      `;
      document.body.appendChild(container);
      $exeDevice.idevicePreviousData = '';
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('does nothing when previousData is empty', () => {
      $exeDevice.idevicePreviousData = '';
      $exeDevice.loadPreviousValues();

      expect($('#dpiDescription').val()).toBe('');
    });

    it('loads description from previous data', () => {
      $exeDevice.idevicePreviousData = `
        <div class="exe-download-package-instructions">
          <p>Previous instructions</p>
        </div>
        <p class="exe-download-package-link">
          <a href="#">Download</a>
        </p>
      `;

      $exeDevice.loadPreviousValues();

      expect($('#dpiDescription').val()).toContain('Previous instructions');
    });

    it('loads button text from previous data', () => {
      $exeDevice.idevicePreviousData = `
        <div class="exe-download-package-instructions">Content</div>
        <p class="exe-download-package-link">
          <a href="#">Custom Button Text</a>
        </p>
      `;

      $exeDevice.loadPreviousValues();

      expect($('#dpiButtonText').val()).toBe('Custom Button Text');
    });

    it('loads font size from previous data', () => {
      $exeDevice.idevicePreviousData = `
        <div class="exe-download-package-instructions">Content</div>
        <p class="exe-download-package-link">
          <a href="#" style="font-size:1.2em;">Download</a>
        </p>
      `;

      $exeDevice.loadPreviousValues();

      expect($('#dpiButtonFontSize').val()).toBe('1.2');
    });
  });

  describe('save', () => {
    let container;

    beforeEach(async () => {
      container = document.createElement('div');
      container.innerHTML = `
        <textarea id="dpiDescription"></textarea>
        <input type="text" id="dpiButtonText" value="Download .elp file" />
        <select id="dpiButtonFontSize">
          <option value="1" selected>100%</option>
          <option value="1.2">120%</option>
        </select>
        <input type="color" id="dpiButtonBGcolor" value="#107275" />
        <input type="color" id="dpiButtonTextColor" value="#ffffff" />
      `;
      document.body.appendChild(container);

      await createTinyMCEEditor('dpiDescription', {
        content: '<p>Test instructions</p>',
      });
    });

    afterEach(() => {
      document.body.removeChild(container);
    });

    it('returns warning message when no TinyMCE editors', () => {
      if (global.tinymce && typeof global.tinymce.remove === 'function') {
        global.tinymce.remove();
      }

      const result = $exeDevice.save();

      expect(result).toBe($exeDevice.warningMessage);
    });

    it('returns false and shows alert when description is empty', () => {
      const editor = global.tinymce.get('dpiDescription');
      editor.setContent('');

      const result = $exeDevice.save();

      expect(result).toBe(false);
      expect(global.eXe.app.alert).toHaveBeenCalledWith(expect.stringContaining('instructions'));
    });

    it('returns false and shows alert when button text is empty', () => {
      $('#dpiButtonText').val('');

      const result = $exeDevice.save();

      expect(result).toBe(false);
      expect(global.eXe.app.alert).toHaveBeenCalledWith(expect.stringContaining('button text'));
    });

    it('returns HTML with instructions and download link', () => {
      const result = $exeDevice.save();

      expect(result).toContain('exe-download-package-instructions');
      expect(result).toContain('Test instructions');
      expect(result).toContain('exe-download-package-link');
      expect(result).toContain('exe-package:elp');
    });

    it('includes button text in output', () => {
      $('#dpiButtonText').val('Download Now');

      const result = $exeDevice.save();

      expect(result).toContain('>Download Now</a>');
    });

    it('includes font size style when not default', () => {
      $('#dpiButtonFontSize').val('1.2');

      const result = $exeDevice.save();

      expect(result).toContain('font-size:1.2em');
    });

    it('does not include font size when default', () => {
      $('#dpiButtonFontSize').val('1');

      const result = $exeDevice.save();

      expect(result).not.toContain('font-size:1em');
    });

    it('includes background color', () => {
      $('#dpiButtonBGcolor').val('#ff0000');

      const result = $exeDevice.save();

      expect(result).toContain('background-color:#ff0000');
    });

    it('includes text color', () => {
      $('#dpiButtonTextColor').val('#000000');

      const result = $exeDevice.save();

      expect(result).toContain('color:#000000');
    });

    it('strips HTML tags from button text', () => {
      $('#dpiButtonText').val('<script>alert("xss")</script>Download');

      const result = $exeDevice.save();

      expect(result).not.toContain('<script>');
      expect(result).toContain('Download');
    });

    it('generates valid download attribute', () => {
      const result = $exeDevice.save();

      expect(result).toContain('download="exe-package:elp-name"');
      expect(result).toContain('href="exe-package:elp"');
    });

    it('validates color format (7 chars including #)', () => {
      $('#dpiButtonBGcolor').val('#fff');

      const result = $exeDevice.save();

      // Short color should not be included (validation requires 7 chars)
      expect(result).not.toContain('background-color:#fff;');
    });
  });
});
