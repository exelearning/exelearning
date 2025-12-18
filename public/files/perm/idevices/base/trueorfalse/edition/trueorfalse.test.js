/**
 * Unit tests for trueorfalse iDevice
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - getDefaultQuestion: Default question structure
 * - transformObject: Object transformation
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

describe('trueorfalse iDevice', () => {
  let $exeDevice;

  beforeEach(() => {
    // Reset $exeDevice before loading
    global.$exeDevice = undefined;

    // Read and execute the iDevice file
    const filePath = join(__dirname, 'trueorfalse.js');
    const code = readFileSync(filePath, 'utf-8');

    // Load iDevice and get reference
    $exeDevice = loadIdevice(code);
  });

  describe('getDefaultQuestion', () => {
    it('returns a default question object with correct structure', () => {
      const defaultQuestion = $exeDevice.getDefaultQuestion();

      expect(defaultQuestion).toEqual({
        question: '',
        feedback: '',
        suggestion: '',
        solution: true,
      });
    });

    it('returns a new object each time', () => {
      const q1 = $exeDevice.getDefaultQuestion();
      const q2 = $exeDevice.getDefaultQuestion();

      expect(q1).not.toBe(q2);
      q1.question = 'modified';
      expect(q2.question).toBe('');
    });

    it('has question property as empty string', () => {
      const defaultQuestion = $exeDevice.getDefaultQuestion();
      expect(defaultQuestion.question).toBe('');
    });

    it('has feedback property as empty string', () => {
      const defaultQuestion = $exeDevice.getDefaultQuestion();
      expect(defaultQuestion.feedback).toBe('');
    });

    it('has suggestion property as empty string', () => {
      const defaultQuestion = $exeDevice.getDefaultQuestion();
      expect(defaultQuestion.suggestion).toBe('');
    });

    it('has solution property as true by default', () => {
      const defaultQuestion = $exeDevice.getDefaultQuestion();
      expect(defaultQuestion.solution).toBe(true);
    });
  });

  describe('i18n', () => {
    it('is defined', () => {
      expect($exeDevice.i18n).toBeDefined();
    });
  });

  describe('classIdevice', () => {
    it('has correct class identifier', () => {
      expect($exeDevice.classIdevice).toBe('trueorfalse');
    });
  });

  describe('questionsGame initialization', () => {
    it('starts with empty questions array', () => {
      expect($exeDevice.questionsGame).toEqual([]);
    });
  });
});
