/**
 * Unit tests for scrambled-list iDevice
 *
 * Tests pure functions and data structures:
 * - checkValues: Data validation
 * - dataJson: JSON data structure
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

describe('scrambled-list iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'scrambled-list.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
  });

  describe('name', () => {
    it('has name defined', () => {
      expect($exeDevice.name).toBeDefined();
    });
  });

  describe('checkValues', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.checkValues).toBe('function');
    });
  });

  describe('dataJson', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.dataJson).toBe('function');
    });
  });

  describe('addQuestions', () => {
    it('exists as a function', () => {
      expect(typeof $exeDevice.addQuestions).toBe('function');
    });
  });
});
