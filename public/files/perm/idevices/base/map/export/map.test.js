/**
 * Unit tests for the map iDevice (export/runtime).
 *
 * Covers the completion signal the LMS depends on. The map has several modes and only
 * one of them lacked an end condition: exposition (evaluationG 0), where the learner
 * just visits points and there is no quiz to finish. Every other mode ends through
 * `gameOver()`, which raises the flag before it reports. The completion signal is
 * separate from the score — the runtime decides `passed` from what the activity reports
 * as finished, not from the number it reports.
 */

/* eslint-disable no-undef */
import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load the export runtime and expose `$eXeMapa` globally.
 *
 * The file ends with a jQuery-ready call to `init()`, which walks the page looking for
 * authored instances. There are none here, so the auto-init is dropped: this exercises
 * the reporting paths in isolation, not the bootstrap.
 */
function loadExportIdevice(code) {
  const modified = code
    .replace(/var\s+\$eXeMapa\s*=/, 'global.$eXeMapa =')
    .replace(/\$\(function \(\) \{\s*\$eXeMapa\.init\(\);\s*\}\);\s*$/, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modified);
  return global.$eXeMapa;
}

describe('map iDevice export', () => {
  let $eXeMapa;
  let calls;

  beforeEach(() => {
    global.$eXeMapa = undefined;
    calls = [];
    global.$exeDevices = {
      iDevice: {
        gamification: {
          scorm: { sendScoreNew: (auto, game) => calls.push({ auto, game }) },
          report: { saveEvaluation: () => {} },
        },
      },
    };

    const code = readFileSync(join(__dirname, 'map.js'), 'utf-8');
    $eXeMapa = loadExportIdevice(code);
  });

  /**
   * Minimal instance state for the exposition mode: `sendScore` only reads the mode,
   * how many points count towards the score, and which point ids have been opened.
   *
   * @param {string[]} visiteds ids of the points the learner has opened, in order
   * @param {number} points how many points the activity scores over
   * @returns {number} the instance index to pass to sendScore
   */
  function givenExposition(visiteds, points) {
    $eXeMapa.options = [
      { evaluationG: 0, numberQuestions: points, visiteds, gameOver: false, msgs: {} },
    ];
    return 0;
  }

  describe('sendScore in exposition mode', () => {
    it('reports progress as a fraction of the points visited', () => {
      $eXeMapa.sendScore(true, givenExposition(['p1'], 4));

      expect(calls).toHaveLength(1);
      expect(calls[0].game.scorerp).toBe('2.50');
    });

    it('does not mark the activity finished while points remain unvisited', () => {
      $eXeMapa.sendScore(true, givenExposition(['p1', 'p2', 'p3'], 4));

      expect(calls[0].game.gameOver).toBe(false);
    });

    it('does not let repeat visits to the same point finish the activity early', () => {
      // Three opens, but only two distinct points: still not over.
      $eXeMapa.sendScore(true, givenExposition(['p1', 'p2', 'p1'], 4));

      expect(calls[0].game.scorerp).toBe('5.00');
      expect(calls[0].game.gameOver).toBe(false);
    });

    it('marks the activity finished on the last point, so the page can be passed', () => {
      // 4 of 4 visited: score 10 of 10, and the activity is over. Without the flag the
      // page stays `incomplete` in the LMS at 100%.
      $eXeMapa.sendScore(true, givenExposition(['p1', 'p2', 'p3', 'p4'], 4));

      expect(calls[0].game.scorerp).toBe('10.00');
      expect(calls[0].game.gameOver).toBe(true);
    });

    it('stays unfinished when the activity scores over no points at all', () => {
      // A zero denominator makes the score non-finite; that is a broken activity, not a
      // completed one, so it must never report itself as finished.
      $eXeMapa.sendScore(true, givenExposition(['p1'], 0));

      expect(calls[0].game.gameOver).toBe(false);
    });
  });

  describe('sendScore in the quiz modes', () => {
    it('never invents completion, even on a perfect intermediate report', () => {
      // Identify mode (2) ends through gameOver(), not through a report. A report with
      // every hit in hand is still just a report: completing here would pass the page
      // while the learner is mid-activity.
      $eXeMapa.options = [
        {
          evaluationG: 2,
          numberQuestions: 4,
          hits: 4,
          visiteds: [],
          gameOver: false,
          msgs: {},
        },
      ];

      $eXeMapa.sendScore(true, 0);

      expect(calls[0].game.scorerp).toBe(10);
      expect(calls[0].game.gameOver).toBe(false);
    });
  });

  describe('gameOver', () => {
    it('raises the flag before it reports, so quiz modes complete', () => {
      vi.useFakeTimers();
      try {
        $eXeMapa.options = [
          {
            evaluationG: 2,
            numberQuestions: 4,
            hits: 4,
            errors: 0,
            visiteds: [],
            gameOver: false,
            isScorm: 1,
            msgs: {},
            activeMap: { pts: [{ type: 0, id: 'p1' }], active: 0 },
          },
        ];

        $eXeMapa.gameOver(0);

        expect(calls).toHaveLength(1);
        expect(calls[0].auto).toBe(true);
        expect(calls[0].game.gameOver).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
