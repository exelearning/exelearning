/**
 * Unit tests for the beforeafter iDevice (export/runtime).
 *
 * Covers the one thing the LMS depends on: this activity is a "see every card" task,
 * so the moment the learner reaches the last card it is finished, and it has to say so.
 * The completion signal is separate from the score — the runtime decides `passed` from
 * what the activity reports as finished, not from the number it reports.
 */

/* eslint-disable no-undef */
import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load the export runtime and expose `$eXeBeforeAfter` globally.
 *
 * The file ends with a jQuery-ready call to `init()`, which walks the page looking for
 * authored instances. There are none here, so the auto-init is dropped: this exercises
 * `sendScore` in isolation, not the bootstrap.
 */
function loadExportIdevice(code) {
  const modified = code
    .replace(/var\s+\$eXeBeforeAfter\s*=/, 'global.$eXeBeforeAfter =')
    .replace(/\$\(function \(\) \{\s*\$eXeBeforeAfter\.init\(\);\s*\}\);\s*$/, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modified);
  return global.$eXeBeforeAfter;
}

describe('beforeafter iDevice export', () => {
  let $eXeBeforeAfter;
  let calls;

  beforeEach(() => {
    global.$eXeBeforeAfter = undefined;
    calls = [];
    // The object literal reads `gamification.colors` while it is being defined, so the
    // shared surface has to exist before the file is evaluated, not after.
    global.$exeDevices = {
      iDevice: {
        gamification: {
          colors: { borderColors: { red: '#f00', green: '#0f0', blue: '#00f' } },
          scorm: { sendScoreNew: (auto, game) => calls.push({ auto, game }) },
        },
      },
    };

    const code = readFileSync(join(__dirname, 'beforeafter.js'), 'utf-8');
    $eXeBeforeAfter = loadExportIdevice(code);
  });

  /**
   * Minimal instance state: `sendScore` only reads the card count, how many have been
   * seen, and the two fields it copies across for the report.
   *
   * @param {number} visiteds index of the card the learner has reached
   * @param {number} cards how many cards the activity has
   * @returns {number} the instance index to pass to sendScore
   */
  function givenInstance(visiteds, cards) {
    $eXeBeforeAfter.options = [
      { visiteds, cardsGame: new Array(cards).fill({}), msgs: {} },
    ];
    return 0;
  }

  describe('sendScore', () => {
    it('reports progress as a fraction of the cards seen', () => {
      $eXeBeforeAfter.sendScore(true, givenInstance(1, 4));

      expect(calls).toHaveLength(1);
      expect(calls[0].game.scorerp).toBe(5);
    });

    it('does not mark the activity finished while cards remain', () => {
      $eXeBeforeAfter.sendScore(true, givenInstance(1, 4));

      expect(calls[0].game.gameOver).toBeUndefined();
    });

    it('marks the activity finished on the last card, so the page can be passed', () => {
      // 4 of 4 seen: score 10 of 10, and the activity is over. Without the flag the
      // page stays `incomplete` in the LMS at 100%.
      $eXeBeforeAfter.sendScore(true, givenInstance(3, 4));

      expect(calls[0].game.scorerp).toBe(10);
      expect(calls[0].game.gameOver).toBe(true);
    });

    it('handles a single-card activity, which is finished on its first report', () => {
      $eXeBeforeAfter.sendScore(true, givenInstance(0, 1));

      expect(calls[0].game.scorerp).toBe(10);
      expect(calls[0].game.gameOver).toBe(true);
    });
  });
});
