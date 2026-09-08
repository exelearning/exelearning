/**
 * Unit tests for magnifier iDevice
 *
 * Tests data structures and initialization:
 * - i18n: Internationalization setup
 * - validateData: Data validation structure
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

describe('magnifier iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'magnifier.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
  });

  describe('i18n', () => {
    it('is defined', () => {
      expect($exeDevice.i18n).toBeDefined();
    });

    it('has name defined', () => {
      expect($exeDevice.i18n.name).toBeDefined();
    });
  });

  describe('showMessage', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.showMessage).toBe('function');
    });
  });

  describe('setMessagesInfo', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.setMessagesInfo).toBe('function');
    });
  });

  describe('validateData', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.validateData).toBe('function');
    });
  });

  describe('updateFieldGame', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.updateFieldGame).toBe('function');
    });
  });
});

describe('default image edition/export dedup', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const editionDir = __dirname;
  const exportDir = path.join(editionDir, '..', 'export');

  it('ships the default image only in export/ (edition previews the export copy)', () => {
    expect(fs.existsSync(path.join(exportDir, 'hood.jpg'))).toBe(true);
    expect(fs.existsSync(path.join(editionDir, 'hood.jpg'))).toBe(false);
  });

  it('routes every edition reference to the export copy', () => {
    const source = fs.readFileSync(path.join(editionDir, 'magnifier.js'), 'utf-8');
    const refs = source.split('hood.jpg').length - 1;
    const routed = source.split("replace(/\\/edition\\/?$/, '/export/')").length - 1;
    expect(refs).toBeGreaterThan(0);
    expect(routed).toBeGreaterThan(0);
    // No unrouted direct reference may sneak back in.
    expect(source).not.toContain("path + 'hood.jpg'");
    expect(source).not.toContain('${path}hood.jpg');
    expect(source).not.toContain('${$exeDevice.idevicePath}hood.jpg');
  });
});
