/**
 * Unit tests for flipcards iDevice (export/runtime)
 *
 * Tests pure functions that don't depend on DOM manipulation:
 * - getCardDefault: Returns default card object structure
 * - getTimeToStringMemory: Formats time to mm:ss
 * - hexToRgba: Converts hex color to rgba
 */

/* eslint-disable no-undef */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Helper to load export iDevice file and expose $eXeFlipCards globally.
 * Also removes the auto-init call at the end to prevent side effects.
 */
function loadExportIdevice(code) {
  let modifiedCode = code.replace(/var\s+\$eXeFlipCards\s*=/, 'global.$eXeFlipCards =');
  // Remove auto-init call: $(function () { $eXeFlipCards.init(); });
  modifiedCode = modifiedCode.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeFlipCards\.init\(\);\s*\}\);?/g, '');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$eXeFlipCards;
}

describe('flipcards iDevice export', () => {
  let $eXeFlipCards;
  let scoreCalls;

  beforeEach(() => {
    global.$eXeFlipCards = undefined;
    scoreCalls = [];
    // The runtime reaches for the shared gamification surface when it reports a
    // score, so it has to exist before the file is evaluated.
    global.$exeDevices = {
      iDevice: {
        gamification: {
          scorm: { sendScoreNew: (auto, game) => scoreCalls.push({ auto, game }) },
        },
      },
    };

    const filePath = join(__dirname, 'flipcards.js');
    const code = readFileSync(filePath, 'utf-8');

    $eXeFlipCards = loadExportIdevice(code);
  });

  describe('getCardDefault', () => {
    it('returns object with required front side properties', () => {
      const card = $eXeFlipCards.getCardDefault();
      expect(card.id).toBe('');
      expect(card.type).toBe(2);
      expect(card.url).toBe('');
      expect(card.audio).toBe('');
      expect(card.x).toBe(0);
      expect(card.y).toBe(0);
      expect(card.author).toBe('');
      expect(card.alt).toBe('');
      expect(card.eText).toBe('');
      expect(card.color).toBe('#000000');
      expect(card.backcolor).toBe('#ffffff');
      expect(card.correct).toBe(0);
    });

    it('returns object with required back side properties', () => {
      const card = $eXeFlipCards.getCardDefault();
      expect(card.urlBk).toBe('');
      expect(card.audioBk).toBe('');
      expect(card.xBk).toBe(0);
      expect(card.yBk).toBe(0);
      expect(card.authorBk).toBe('');
      expect(card.altBk).toBe('');
      expect(card.eTextBk).toBe('');
      expect(card.colorBk).toBe('#000000');
      expect(card.backcolorBk).toBe('#ffffff');
    });

    it('returns new object on each call', () => {
      const card1 = $eXeFlipCards.getCardDefault();
      const card2 = $eXeFlipCards.getCardDefault();
      expect(card1).not.toBe(card2);
      expect(card1).toEqual(card2);
    });
  });

  describe('getTimeToStringMemory', () => {
    it('formats zero seconds', () => {
      expect($eXeFlipCards.getTimeToStringMemory(0)).toBe('00:00');
    });

    it('formats seconds only', () => {
      expect($eXeFlipCards.getTimeToStringMemory(30)).toBe('00:30');
      expect($eXeFlipCards.getTimeToStringMemory(59)).toBe('00:59');
    });

    it('formats minutes and seconds', () => {
      expect($eXeFlipCards.getTimeToStringMemory(60)).toBe('01:00');
      expect($eXeFlipCards.getTimeToStringMemory(90)).toBe('01:30');
      expect($eXeFlipCards.getTimeToStringMemory(125)).toBe('02:05');
    });

    it('pads single digits with zeros', () => {
      expect($eXeFlipCards.getTimeToStringMemory(65)).toBe('01:05');
    });

    it('handles large values', () => {
      expect($eXeFlipCards.getTimeToStringMemory(3599)).toBe('59:59');
    });
  });

  describe('hexToRgba', () => {
    it('converts 6-digit hex to rgba', () => {
      expect($eXeFlipCards.hexToRgba('#ff0000', 1)).toBe('rgba(255,0,0,1)');
      expect($eXeFlipCards.hexToRgba('#00ff00', 1)).toBe('rgba(0,255,0,1)');
      expect($eXeFlipCards.hexToRgba('#0000ff', 1)).toBe('rgba(0,0,255,1)');
    });

    it('handles hex without hash', () => {
      expect($eXeFlipCards.hexToRgba('ff0000', 1)).toBe('rgba(255,0,0,1)');
    });

    it('applies opacity parameter', () => {
      expect($eXeFlipCards.hexToRgba('#ff0000', 0.5)).toBe('rgba(255,0,0,0.5)');
      expect($eXeFlipCards.hexToRgba('#ff0000', 0)).toBe('rgba(255,0,0,0)');
    });

    it('defaults to opacity 1 if not finite', () => {
      expect($eXeFlipCards.hexToRgba('#ff0000', undefined)).toBe('rgba(255,0,0,1)');
    });

    it('converts 3-digit hex to rgba', () => {
      expect($eXeFlipCards.hexToRgba('#f00', 1)).toBe('rgba(255,0,0,1)');
      expect($eXeFlipCards.hexToRgba('#0f0', 1)).toBe('rgba(0,255,0,1)');
    });

    it('handles white and black', () => {
      expect($eXeFlipCards.hexToRgba('#ffffff', 1)).toBe('rgba(255,255,255,1)');
      expect($eXeFlipCards.hexToRgba('#000000', 1)).toBe('rgba(0,0,0,1)');
    });
  });

  describe('borderColors', () => {
    it('has required color definitions', () => {
      expect($eXeFlipCards.borderColors).toBeDefined();
      expect($eXeFlipCards.borderColors.black).toBe('#1c1b1b');
      expect($eXeFlipCards.borderColors.blue).toBe('#3334a1');
      expect($eXeFlipCards.borderColors.green).toBe('#006641');
      expect($eXeFlipCards.borderColors.red).toBe('#a2241a');
      expect($eXeFlipCards.borderColors.white).toBe('#ffffff');
      expect($eXeFlipCards.borderColors.yellow).toBe('#f3d55a');
    });
  });

  describe('options', () => {
    it('is initialized as array', () => {
      expect(Array.isArray($eXeFlipCards.options)).toBe(true);
    });
  });

  describe('idevicePath', () => {
    it('is initially empty', () => {
      expect($eXeFlipCards.idevicePath).toBe('');
    });
  });

  /**
   * Completion signal.
   *
   * The runtime decides whether a page may be reported passed/failed from what the
   * activity says about itself (`gameOver`), not from the score it sends. The four
   * authored modes end differently: 0 (Show) and 1 (Navigation) are "flip every card"
   * tasks whose end condition is the visited score reaching 10, while 2 (Identify) and
   * 3 (Memory) finish through gameOver()/gameOverMemory(), which raise the flag
   * themselves before reporting.
   */
  describe('sendScore completion signal', () => {
    /**
     * Minimal instance state: sendScore only reads the mode, the flipped card
     * numbers, the hit count and the card count.
     *
     * @param {object} state mode and progress of the authored activity
     * @returns {number} the instance index to pass to sendScore
     */
    function givenInstance({ type, visiteds = [], hits = 0, cards }) {
      $eXeFlipCards.options = [{ type, visiteds, hits, realNumberCards: cards }];
      return 0;
    }

    it('reports the fraction of cards flipped in Navigation mode', () => {
      $eXeFlipCards.sendScore(true, givenInstance({ type: 1, visiteds: [0], cards: 4 }));

      expect(scoreCalls).toHaveLength(1);
      expect(scoreCalls[0].game.scorerp).toBe(2.5);
    });

    it('does not mark a Navigation activity finished while cards remain unflipped', () => {
      $eXeFlipCards.sendScore(true, givenInstance({ type: 1, visiteds: [0], cards: 4 }));

      expect(scoreCalls[0].game.gameOver).toBeUndefined();
    });

    it('does not count the same card twice towards the end condition', () => {
      $eXeFlipCards.sendScore(true, givenInstance({ type: 1, visiteds: [2, 2, 2, 2], cards: 4 }));

      expect(scoreCalls[0].game.scorerp).toBe(2.5);
      expect(scoreCalls[0].game.gameOver).toBeUndefined();
    });

    it('marks a Navigation activity finished once every card has been flipped', () => {
      // 4 of 4 flipped: score 10 of 10, and the activity is over. Without the flag
      // the page stays `incomplete` in the LMS at 100%.
      $eXeFlipCards.sendScore(true, givenInstance({ type: 1, visiteds: [0, 1, 2, 3], cards: 4 }));

      expect(scoreCalls[0].game.scorerp).toBe(10);
      expect(scoreCalls[0].game.gameOver).toBe(true);
    });

    it('marks a Show activity finished once every card has been flipped', () => {
      $eXeFlipCards.sendScore(true, givenInstance({ type: 0, visiteds: [1, 0], cards: 2 }));

      expect(scoreCalls[0].game.scorerp).toBe(10);
      expect(scoreCalls[0].game.gameOver).toBe(true);
    });

    it('leaves an Identify activity to its own gameOver(), even on a perfect intermediate report', () => {
      // validateReponseGame() reports after every answer and gameOver() runs later,
      // so an intermediate report must never complete the activity by itself.
      $eXeFlipCards.sendScore(true, givenInstance({ type: 2, hits: 4, cards: 4 }));

      expect(scoreCalls[0].game.scorerp).toBe('10.00');
      expect(scoreCalls[0].game.gameOver).toBeUndefined();
    });

    it('leaves a Memory activity to its own gameOverMemory()', () => {
      // correctPairMemory() reports on every matched pair; gameOverMemory() owns the flag.
      $eXeFlipCards.sendScore(true, givenInstance({ type: 3, hits: 4, cards: 4 }));

      expect(scoreCalls[0].game.gameOver).toBeUndefined();
    });

    it('carries a flag already raised by the mode-specific game over into the report', () => {
      const instance = givenInstance({ type: 3, hits: 4, cards: 4 });
      $eXeFlipCards.options[instance].gameOver = true;

      $eXeFlipCards.sendScore(true, instance);

      expect(scoreCalls[0].game.gameOver).toBe(true);
    });
  });
});
