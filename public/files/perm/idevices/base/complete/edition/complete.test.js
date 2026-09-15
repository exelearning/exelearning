/**
 * Unit tests for complete iDevice
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - escapeHtml: HTML escaping
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load iDevice file and expose $exeDevice globally.
 * Replaces 'var $exeDevice' with 'global.$exeDevice' to make it accessible.
 */
function loadIdevice(code) {
  // Replace 'var $exeDevice' with 'global.$exeDevice' anywhere in the code
  const modifiedCode = code.replace(/var\s+\$exeDevice\s*=/, 'global.$exeDevice =');
  // Execute the modified code using eval in global context
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$exeDevice;
}

describe('complete iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'complete.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
  });

  describe('escapeHtml', () => {
    it('escapes ampersand', () => {
      expect($exeDevice.escapeHtml('&')).toBe('&amp;');
      expect($exeDevice.escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('escapes less than', () => {
      expect($exeDevice.escapeHtml('<')).toBe('&lt;');
      expect($exeDevice.escapeHtml('<div>')).toBe('&lt;div&gt;');
    });

    it('escapes greater than', () => {
      expect($exeDevice.escapeHtml('>')).toBe('&gt;');
    });

    it('escapes double quotes', () => {
      expect($exeDevice.escapeHtml('"')).toBe('&quot;');
      expect($exeDevice.escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('escapes single quotes', () => {
      expect($exeDevice.escapeHtml("'")).toBe('&#39;');
      expect($exeDevice.escapeHtml("it's")).toBe('it&#39;s');
    });

    it('escapes multiple characters', () => {
      expect($exeDevice.escapeHtml('<script>alert("XSS")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
      );
    });

    it('handles empty string', () => {
      expect($exeDevice.escapeHtml('')).toBe('');
    });

    it('handles string with no special characters', () => {
      expect($exeDevice.escapeHtml('Hello World')).toBe('Hello World');
    });

    it('converts numbers to string', () => {
      expect($exeDevice.escapeHtml(123)).toBe('123');
    });

    it('handles HTML attributes', () => {
      const input = 'class="test" data-value=\'foo\'';
      const expected = 'class=&quot;test&quot; data-value=&#39;foo&#39;';
      expect($exeDevice.escapeHtml(input)).toBe(expected);
    });
  });

  describe('i18n', () => {
    it('is defined', () => {
      expect($exeDevice.i18n).toBeDefined();
    });
  });

  describe('classIdevice', () => {
    it('has correct class identifier', () => {
      expect($exeDevice.classIdevice).toBe('complete');
    });
  });

  // The editor truncates its numeric fields on keyup. Capping them at one digit
  // made ordinary values impossible to enter: the second keystroke was dropped,
  // so an author aiming for 10 minutes silently ended up with 1.
  describe('numeric field limits', () => {
    let previousItinerary;

    beforeEach(() => {
      previousItinerary = $exeDevicesEdition.iDevice.gamification.itinerary;
      // addEvents wires the whole editor. The itinerary component lives outside
      // this iDevice's source, so it is stubbed rather than exercised here.
      $exeDevicesEdition.iDevice.gamification.itinerary = {
        addEvents: () => {},
        getTab: () => '',
        init: () => {},
        setValues: () => {},
      };
      document.body.innerHTML = `
        <script></script>
        <form id="gameQEIdeviceForm">
          <input id="cmptETime" />
          <input id="cmptEPercentajeError" />
        </form>`;
      $exeDevice.addEvents();
    });

    afterEach(() => {
      $exeDevicesEdition.iDevice.gamification.itinerary = previousItinerary;
      document.body.innerHTML = '';
    });

    it('keeps a two-digit time', () => {
      $('#cmptETime').val('45').trigger('keyup');

      expect($('#cmptETime').val()).toBe('45');
    });

    it('truncates the time beyond two digits and drops non-digits', () => {
      $('#cmptETime').val('1a234').trigger('keyup');

      expect($('#cmptETime').val()).toBe('12');
    });

    it('keeps a three-digit error percentage', () => {
      $('#cmptEPercentajeError').val('100').trigger('keyup');

      expect($('#cmptEPercentajeError').val()).toBe('100');
    });

    it('truncates the error percentage beyond three digits', () => {
      $('#cmptEPercentajeError').val('12345').trigger('keyup');

      expect($('#cmptEPercentajeError').val()).toBe('123');
    });
  });
});

describe('default image edition/export dedup', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const editionDir = __dirname;
  const exportDir = path.join(editionDir, '..', 'export');

  it('ships the default image only in export/ (edition previews the export copy)', () => {
    expect(fs.existsSync(path.join(exportDir, 'cmptbackground.webp'))).toBe(true);
    expect(fs.existsSync(path.join(editionDir, 'cmptbackground.webp'))).toBe(false);
  });

  it('routes every edition reference to the export copy', () => {
    const source = fs.readFileSync(path.join(editionDir, 'complete.js'), 'utf-8');
    const refs = source.split('cmptbackground.webp').length - 1;
    const routed = source.split("replace(/\\/edition\\/?$/, '/export/')").length - 1;
    expect(refs).toBeGreaterThan(0);
    expect(routed).toBeGreaterThan(0);
    // No unrouted direct reference may sneak back in.
    expect(source).not.toContain("path + 'cmptbackground.webp'");
    expect(source).not.toContain('${path}cmptbackground.webp');
    expect(source).not.toContain('${$exeDevice.idevicePath}cmptbackground.webp');
  });

  /**
   * The pass-score control is a shared block in common_edition.js, exercised by
   * its own tests. What is specific to this iDevice -- and what silently breaks
   * if someone edits the form -- is the wiring: all four call sites have to be
   * present, and the two saved fields have to reach the stored data. Reading
   * the source is how that is checked without standing up the whole edition
   * form.
   */
  describe('pass score wiring', () => {
      let source;

      beforeEach(() => {
          source = readFileSync(join(__dirname, 'complete.js'), 'utf-8');
      });

      it('renders the control immediately above the progress report', () => {
          const passScoreAt = source.indexOf('gamification.passScore.getContents()');
          const progressBarAt = source.indexOf('gamification.progressBar.getContents(');

          expect(passScoreAt).toBeGreaterThan(-1);
          expect(progressBarAt).toBeGreaterThan(-1);
          expect(passScoreAt).toBeLessThan(progressBarAt);
      });

      it('restores the control when the iDevice is reopened', () => {
          expect(source).toContain('gamification.passScore.setValues(');
          expect(source).toContain('passScoreMode: game.passScoreMode');
          expect(source).toContain('passScoreCustom: game.passScoreCustom');
      });

      it('saves the mode and the customised mark, and nothing else', () => {
          expect(source).toContain('gamification.passScore.getValues()');
          expect(source).toContain('passScoreMode: passScore.passScoreMode');
          expect(source).toContain('passScoreCustom: passScore.passScoreCustom');
          // The project value is never copied into the iDevice: it is read
          // live, so an iDevice on the global mode follows the project.
          expect(source).not.toContain('passScoreGlobal');
      });

      it('wires the radio and input handlers', () => {
          expect(source).toContain('gamification.passScore.addEvents()');
      });
  });
});
