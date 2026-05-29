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

  beforeEach(() => {
    global.$eXeFlipCards = undefined;

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

  describe('SCORM persistence in browsing modes', () => {
    it('saves visited cards only when a mode 0 or 1 card is flipped open', () => {
      const selection = {
        data: () => undefined,
        eq: () => selection,
        show: vi.fn(),
      };
      const card = {
        data: (key) => (key === 'number' ? 2 : undefined),
        find: () => selection,
      };
      const options = {
        isScorm: 1,
        type: 1,
        visiteds: [],
      };

      global.$exeDevices = {
        iDevice: {
          gamification: {
            media: {
              stopSound: vi.fn(),
            },
          },
        },
      };
      $eXeFlipCards.options[0] = options;
      $eXeFlipCards.sendScore = vi.fn();
      $eXeFlipCards.saveEvaluation = vi.fn();
      $eXeFlipCards.showClue = vi.fn();

      $eXeFlipCards.handleCardFlip(card, true, options, 0);

      expect(options.visiteds).toEqual([2]);
      expect($eXeFlipCards.sendScore).toHaveBeenCalledWith(true, 0);
      expect($eXeFlipCards.saveEvaluation).toHaveBeenCalledWith(0);

      $eXeFlipCards.sendScore.mockClear();
      $eXeFlipCards.saveEvaluation.mockClear();

      $eXeFlipCards.handleCardFlip(card, false, options, 0);

      expect(options.visiteds).toEqual([2]);
      expect($eXeFlipCards.sendScore).not.toHaveBeenCalled();
      expect($eXeFlipCards.saveEvaluation).not.toHaveBeenCalled();
    });

    it('does not send scores from previous or next card handlers', () => {
      const source = readFileSync(join(__dirname, 'flipcards.js'), 'utf-8');
      const nextStart = source.indexOf("$('#flcdsNextCard-' + instance).on('click'");
      const previousStart = source.indexOf("$('#flcdsPreviousCard-' + instance).on('click'");
      const startGameStart = source.indexOf("$('#flcdsStartGame-' + instance).on('click'");

      expect(nextStart).toBeGreaterThan(-1);
      expect(previousStart).toBeGreaterThan(nextStart);
      expect(startGameStart).toBeGreaterThan(previousStart);

      const nextHandler = source.slice(nextStart, previousStart);
      const previousHandler = source.slice(previousStart, startGameStart);

      expect(nextHandler).not.toContain('sendScore');
      expect(previousHandler).not.toContain('sendScore');
    });
  });
});
