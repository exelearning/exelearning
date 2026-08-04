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

  /**
   * A stored activity can reach the editor without a usable question list:
   * `transformObject` returns an already-migrated payload untouched, so a
   * missing or non-array `questionsGame` used to land straight on
   * `$exeDevice.questionsGame` and every later `.length` read threw.
   *
   * The two damaged shapes below are the ones shipped in
   * `pr2192-actividades-sin-preguntas.elpx`: the key absent, and the key
   * holding an object. Normalizing to `[]` puts the editor in the same state
   * as a brand-new activity, which `addEvents` then seeds with one question.
   */
  describe('questionsGame load boundary', () => {
    const savedGame = (extra = {}) => ({
      id: 'tof-damaged',
      ideviceId: 'tof-damaged',
      typeGame: 'TrueOrFalse',
      eXeGameInstructions: '<p>Revision final</p>',
      eXeIdeviceTextAfter: '',
      msgs: {},
      questionsRandom: false,
      percentageQuestions: 100,
      time: 0,
      isTest: false,
      isScorm: 0,
      weighted: 100,
      evaluation: false,
      evaluationID: '',
      repeatActivity: true,
      textButtonScorm: 'Guardar',
      ...extra,
    });

    it('normalizes a missing questionsGame to an empty array', () => {
      $exeDevice.idevicePreviousData = savedGame();

      $exeDevice.loadPreviousValues();

      expect($exeDevice.questionsGame).toEqual([]);
    });

    it('normalizes a non-array questionsGame to an empty array', () => {
      $exeDevice.idevicePreviousData = savedGame({
        questionsGame: { 0: 'esto no es un array' },
      });

      $exeDevice.loadPreviousValues();

      expect($exeDevice.questionsGame).toEqual([]);
    });

    it('normalizes a null questionsGame to an empty array', () => {
      $exeDevice.idevicePreviousData = savedGame({ questionsGame: null });

      $exeDevice.loadPreviousValues();

      expect($exeDevice.questionsGame).toEqual([]);
    });

    it('keeps a valid question list untouched', () => {
      const questions = [
        { question: 'Madrid is in Spain', feedback: '', suggestion: '', solution: 1 },
        { question: 'Rome is in France', feedback: '', suggestion: '', solution: 0 },
      ];
      $exeDevice.idevicePreviousData = savedGame({ questionsGame: questions });

      $exeDevice.loadPreviousValues();

      expect($exeDevice.questionsGame).toEqual(questions);
    });

    it('lets the editor open on an activity saved without questions', () => {
      $exeDevice.idevicePreviousData = savedGame();
      $exeDevice.loadPreviousValues();

      // This is the call that threw the reported
      // "can't access property length, $exeDevice.questionsGame is undefined".
      expect(() => $exeDevice.addEvents()).not.toThrow();
      // An empty list is seeded with one editable question, as for a new activity.
      expect($exeDevice.questionsGame).toHaveLength(1);
      expect($exeDevice.questionsGame[0]).toEqual($exeDevice.getDefaultQuestion());
    });

    it('lets showQuestion run on an activity saved without questions', () => {
      $exeDevice.idevicePreviousData = savedGame();
      $exeDevice.loadPreviousValues();

      expect(() => $exeDevice.showQuestion(0)).not.toThrow();
    });

    it('reports the empty activity on save instead of throwing', () => {
      $exeDevice.idevicePreviousData = savedGame();
      $exeDevice.msgs = { msgEOneQuestion: 'Add at least one question' };
      $exeDevice.loadPreviousValues();

      // The reported second failure: "can't access property 0" while saving.
      let result;
      expect(() => {
        result = $exeDevice.validateData();
      }).not.toThrow();
      expect(result).toBe(false);
      expect(eXe.app.alert).toHaveBeenCalledWith('Add at least one question');
    });

    it('treats a missing question editor as empty content when trimming', () => {
      $exeDevice.questionsGame = [
        { question: 'a', feedback: '', suggestion: '', solution: 1 },
        { question: '', feedback: '', suggestion: '', solution: 1 },
      ];
      $exeDevice.active = 1;

      expect(() => $exeDevice.deleteEmptyQuestion()).not.toThrow();
      expect($exeDevice.questionsGame).toHaveLength(1);
    });

    it('keeps a single question when trimming without a question editor', () => {
      $exeDevice.questionsGame = [{ question: '', feedback: '', suggestion: '', solution: 1 }];
      $exeDevice.active = 0;

      $exeDevice.deleteEmptyQuestion();

      expect($exeDevice.questionsGame).toHaveLength(1);
    });

    it('normalizes questionsGame when importing a game file without questions', () => {
      const helpers = $exeDevices.iDevice.gamification.helpers;
      const originalIsJsonString = helpers.isJsonString;
      helpers.isJsonString = () => savedGame();

      try {
        $exeDevice.importGame(JSON.stringify(savedGame()), 'application/json');
      } finally {
        helpers.isJsonString = originalIsJsonString;
      }

      expect($exeDevice.questionsGame).toEqual([]);
    });
  });
});
