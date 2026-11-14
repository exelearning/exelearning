/**
 * Export writes the questions (words, cards...) of an activity and nothing else, so it checks them and nothing
 * else: the settings (feedback, passwords, progress report...) are for saving to check. One case per iDevice
 * whose Export used to run the whole validation of saving.
 */

/* eslint-disable no-undef */

import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const BASE = join(dirname(fileURLToPath(import.meta.url)), '../../files/perm/idevices/base');

// [iDevice, the check of the item on screen, the check of all of them]
const CASES = [
  // Its words are read from the form, the one on screen among them.
  ['az-quiz-game', null, 'validateQuestions'],
  ['classify', 'validateQuestion', 'validateQuestions'],
  ['crossword', 'validateQuestion', 'validateQuestions'],
  ['discover', 'validateQuestion', 'validateQuestions'],
  ['electrical-circuits', 'validateQuestion', 'validateQuestions'],
  // Each of their cards is checked as it is left; there is no check of all of them.
  ['flipcards', 'validateCard', null],
  ['guess', 'validateQuestion', 'validateQuestions'],
  ['quick-questions', 'validateQuestion', 'validateQuestions'],
  ['quick-questions-multiple-choice', 'validateQuestion', 'validateQuestions'],
  ['relate', 'validateCard', null],
  ['trueorfalse', 'validateQuestion', 'validateQuestions'],
  ['word-search', 'validateQuestion', 'validateQuestions'],
];

describe('iDevices: Export checks the questions only', () => {
  let device;

  afterEach(() => {
    vi.restoreAllMocks();
    global.$exeDevice = undefined;
  });

  describe.each(CASES)('%s', (type, onScreen, all) => {
    beforeEach(() => {
      global.$exeDevice = undefined;
      device = global.loadIdevice(join(BASE, type, 'edition', `${type}.js`));
    });

    it('leaves the validation of saving out', () => {
      const validateData = vi.spyOn(device, 'validateData');
      if (onScreen) vi.spyOn(device, onScreen).mockReturnValue(true);
      // Nothing to write: enough to see what Export asked on its way.
      const checkAll = all ? vi.spyOn(device, all).mockReturnValue(false) : null;
      if (!all) device.cardsGame = [];

      expect(device.exportQuestions()).toBe(false);

      expect(validateData).not.toHaveBeenCalled();
      if (checkAll) expect(checkAll).toHaveBeenCalledTimes(1);
    });

    if (!onScreen) return;

    it('stores the item on screen first, and stops when it is not complete', () => {
      const check = vi.spyOn(device, onScreen).mockReturnValue(false);
      const checkAll = all ? vi.spyOn(device, all) : null;

      expect(device.exportQuestions()).toBe(false);

      expect(check).toHaveBeenCalledTimes(1);
      if (checkAll) expect(checkAll).not.toHaveBeenCalled();
    });
  });
});
